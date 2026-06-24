import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks } from "@/db/schema";
import { SYSTEM_USER_ID } from "@/lib/system-user";
import { dailyTaskSchema } from "@/lib/schedule-schema";

type RouteContext = { params: Promise<{ id: string }> };

/** タスクを更新（部分更新） */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = dailyTaskSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const patch = parsed.data;
  await db
    .update(tasks)
    .set({
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.date !== undefined && { date: patch.date }),
      ...(patch.time !== undefined && { time: patch.time }),
      ...(patch.priority !== undefined && { priority: patch.priority }),
      ...(patch.done !== undefined && { done: patch.done }),
      ...(patch.note !== undefined && { note: patch.note }),
      ...(patch.imageUrl !== undefined && { imageUrl: patch.imageUrl }),
      ...(patch.projectId !== undefined && { projectId: patch.projectId }),
      ...(patch.tags !== undefined && { tagsJson: JSON.stringify(patch.tags) }),
    })
    .where(
      and(eq(tasks.id, id), eq(tasks.userId, SYSTEM_USER_ID)),
    );
  return NextResponse.json({ ok: true });
}

/** タスクを削除 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  await db
    .delete(tasks)
    .where(
      and(eq(tasks.id, id), eq(tasks.userId, SYSTEM_USER_ID)),
    );
  return NextResponse.json({ ok: true });
}
