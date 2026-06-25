import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schedules } from "@/db/schema";
import { SYSTEM_USER_ID } from "@/lib/system-user";
import { scheduleSchema } from "@/lib/schedule-schema";
import {
  getAccessToken,
  buildGCalEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/google-calendar";

type RouteContext = { params: Promise<{ id: string }> };

/** 予定を更新（部分更新） */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = scheduleSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const patch = parsed.data;

  await db
    .update(schedules)
    .set({
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.date !== undefined && { date: patch.date }),
      ...(patch.endDate !== undefined && { endDate: patch.endDate }),
      ...(patch.startTime !== undefined && { startTime: patch.startTime }),
      ...(patch.endTime !== undefined && { endTime: patch.endTime }),
      ...(patch.location !== undefined && { location: patch.location }),
      ...(patch.imageUrl !== undefined && { imageUrl: patch.imageUrl }),
      ...(patch.note !== undefined && { note: patch.note }),
      ...(patch.priority !== undefined && { priority: patch.priority }),
      ...(patch.done !== undefined && { done: patch.done }),
      ...(patch.projectId !== undefined && { projectId: patch.projectId }),
      ...(patch.attendees !== undefined && {
        attendeesJson: JSON.stringify(patch.attendees),
      }),
      ...(patch.tags !== undefined && { tagsJson: JSON.stringify(patch.tags) }),
    })
    .where(
      and(eq(schedules.id, id), eq(schedules.userId, SYSTEM_USER_ID)),
    );

  // Google Calendar 同期（ベストエフォート）
  try {
    const [row] = await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.id, id), eq(schedules.userId, SYSTEM_USER_ID)));

    if (row?.googleEventId) {
      const token = await getAccessToken(SYSTEM_USER_ID);
      if (token) {
        const allDay = !row.startTime;
        const gcalEvent = buildGCalEvent({
          summary: row.title,
          location: row.location ?? undefined,
          description: row.note ?? undefined,
          start: allDay ? row.date : `${row.date}T${row.startTime}`,
          end: allDay
            ? row.endDate ?? row.date
            : `${row.date}T${row.endTime ?? row.startTime}`,
          allDay,
        });
        await updateCalendarEvent(token, row.googleEventId, gcalEvent);
      }
    }
  } catch {
    console.warn("[gcal] PATCH sync failed for schedule", id);
  }

  return NextResponse.json({ ok: true });
}

/** 予定を削除 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  // Google Calendar 同期（削除前にイベント ID を取得）
  try {
    const [row] = await db
      .select({ googleEventId: schedules.googleEventId })
      .from(schedules)
      .where(and(eq(schedules.id, id), eq(schedules.userId, SYSTEM_USER_ID)));

    if (row?.googleEventId) {
      const token = await getAccessToken(SYSTEM_USER_ID);
      if (token) {
        await deleteCalendarEvent(token, row.googleEventId);
      }
    }
  } catch {
    console.warn("[gcal] DELETE sync failed for schedule", id);
  }

  await db
    .delete(schedules)
    .where(
      and(eq(schedules.id, id), eq(schedules.userId, SYSTEM_USER_ID)),
    );

  return NextResponse.json({ ok: true });
}
