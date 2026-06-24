import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schedules } from "@/db/schema";
import { SYSTEM_USER_ID } from "@/lib/system-user";
import { scheduleSchema } from "@/lib/schedule-schema";

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
  return NextResponse.json({ ok: true });
}

/** 予定を削除 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  await db
    .delete(schedules)
    .where(
      and(eq(schedules.id, id), eq(schedules.userId, SYSTEM_USER_ID)),
    );
  return NextResponse.json({ ok: true });
}
