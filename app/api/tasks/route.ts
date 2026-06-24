import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks } from "@/db/schema";
import { ensureSystemUser, SYSTEM_USER_ID } from "@/lib/system-user";
import { dbToTask } from "@/lib/db-transforms";
import { dailyTaskSchema } from "@/lib/schedule-schema";

/** 全タスクを取得 */
export async function GET() {
  await ensureSystemUser();
  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, SYSTEM_USER_ID))
    .orderBy(tasks.date);
  return NextResponse.json(rows.map(dbToTask));
}

/** タスクを新規作成 */
export async function POST(request: Request) {
  await ensureSystemUser();
  const body: unknown = await request.json();
  const parsed = dailyTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const t = parsed.data;
  await db.insert(tasks).values({
    id: t.id,
    userId: SYSTEM_USER_ID,
    projectId: t.projectId ?? null,
    title: t.title,
    date: t.date ?? null,
    time: t.time ?? null,
    priority: t.priority ?? null,
    done: t.done,
    note: t.note ?? null,
    imageUrl: t.imageUrl ?? null,
    tagsJson: JSON.stringify(t.tags ?? []),
  });
  return NextResponse.json({ ok: true });
}
