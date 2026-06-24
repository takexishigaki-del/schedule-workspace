import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schedules } from "@/db/schema";
import { ensureSystemUser, SYSTEM_USER_ID } from "@/lib/system-user";
import { dbToSchedule } from "@/lib/db-transforms";
import { scheduleSchema } from "@/lib/schedule-schema";

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
  });
  return NextResponse.json({ ok: true });
}
