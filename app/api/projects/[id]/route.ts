import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/db/schema";
import { SYSTEM_USER_ID } from "@/lib/system-user";
import { projectSchema } from "@/lib/schedule-schema";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = projectSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const patch = parsed.data;
  await db
    .update(projects)
    .set({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.color !== undefined && { color: patch.color }),
      ...(patch.summary !== undefined && { summary: patch.summary }),
      ...(patch.goal !== undefined && { goal: patch.goal }),
      ...(patch.note !== undefined && { note: patch.note }),
      ...(patch.imageUrl !== undefined && { imageUrl: patch.imageUrl }),
      ...(patch.urls !== undefined && { urlsJson: JSON.stringify(patch.urls) }),
      ...(patch.startDate !== undefined && { startDate: patch.startDate }),
      ...(patch.endDate !== undefined && { endDate: patch.endDate }),
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, id), eq(projects.userId, SYSTEM_USER_ID)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, SYSTEM_USER_ID)));
  return NextResponse.json({ ok: true });
}
