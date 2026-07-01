import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ideas } from "@/db/schema";
import { SYSTEM_USER_ID } from "@/lib/system-user";
import { savedIdeaSchema } from "@/lib/schedule-schema";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = savedIdeaSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const patch = parsed.data;
  await db
    .update(ideas)
    .set({
      ...(patch.content !== undefined && { content: patch.content }),
      ...(patch.aiResponse !== undefined && { aiResponse: patch.aiResponse }),
      ...(patch.category !== undefined && { category: patch.category }),
      ...(patch.projectId !== undefined && { projectId: patch.projectId }),
      ...(patch.tags !== undefined && { tagsJson: JSON.stringify(patch.tags) }),
    })
    .where(and(eq(ideas.id, id), eq(ideas.userId, SYSTEM_USER_ID)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  await db
    .delete(ideas)
    .where(and(eq(ideas.id, id), eq(ideas.userId, SYSTEM_USER_ID)));
  return NextResponse.json({ ok: true });
}
