import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schedules } from "@/db/schema";
import { ensureSystemUser, SYSTEM_USER_ID } from "@/lib/system-user";
import { dbToSchedule } from "@/lib/db-transforms";
import { scheduleSchema } from "@/lib/schedule-schema";
import {
  getAccessToken,
  buildGCalEvent,
  createCalendarEvent,
} from "@/lib/google-calendar";

/** 全予定を取得 */
export async function GET() {
  await ensureSystemUser();
  const rows = await db
    .select()
    .from(schedules)
    .where(eq(schedules.userId, SYSTEM_USER_ID))
    .orderBy(schedules.date);
  return NextResponse.json(rows.map(dbToSchedule));
}

/** 予定を新規作成 */
export async function POST(request: Request) {
  await ensureSystemUser();
  const body: unknown = await request.json();
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const s = parsed.data;

  await db.insert(schedules).values({
    id: s.id,
    userId: SYSTEM_USER_ID,
    projectId: s.projectId ?? null,
    title: s.title,
    date: s.date,
    endDate: s.endDate ?? null,
    startTime: s.startTime ?? null,
    endTime: s.endTime ?? null,
    location: s.location ?? null,
    imageUrl: s.imageUrl ?? null,
    note: s.note ?? null,
    priority: s.priority ?? null,
    done: s.done,
    attendeesJson: JSON.stringify(s.attendees ?? []),
    tagsJson: JSON.stringify(s.tags ?? []),
    googleEventId: null,
  });

  // Google Calendar 同期（ベストエフォート: 失敗しても予定作成は成功扱い）
  if (!s.done) {
    try {
      const token = await getAccessToken(SYSTEM_USER_ID);
      if (token) {
        const allDay = !s.startTime;
        const gcalEvent = buildGCalEvent({
          summary: s.title,
          location: s.location,
          description: s.note,
          start: allDay ? s.date : `${s.date}T${s.startTime}`,
          end: allDay
            ? s.endDate ?? s.date
            : `${s.date}T${s.endTime ?? s.startTime}`,
          allDay,
        });
        const eventId = await createCalendarEvent(token, gcalEvent);
        if (eventId) {
          await db
            .update(schedules)
            .set({ googleEventId: eventId })
            .where(eq(schedules.id, s.id));
        }
      }
    } catch {
      // ログのみ、エラーは呼び出し元に伝播しない
      console.warn("[gcal] POST sync failed for schedule", s.id);
    }
  }

  return NextResponse.json({ ok: true });
}
