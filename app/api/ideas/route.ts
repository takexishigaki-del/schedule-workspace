import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ideas } from "@/db/schema";
import { ensureSystemUser, SYSTEM_USER_ID } from "@/lib/system-user";
import { dbToIdea } from "@/lib/db-transforms";
import { savedIdeaSchema } from "@/lib/schedule-schema";

export async function GET() {
  await ensureSystemUser();
  const rows = await db
    .select()
    .from(ideas)
    .where(eq(ideas.userId, SYSTEM_USER_ID))
    .orderBy(ideas.createdAt);
  return NextResponse.json(rows.map(dbToIdea).reverse());
}

export async function POST(request: Request) {
  await ensureSystemUser();
  const body: unknown = await request.json();
  const parsed = savedIdeaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const i = parsed.data;
  await db.insert(ideas).values({
    id: i.id,
    userId: SYSTEM_USER_ID,
    projectId: i.projectId ?? null,
    content: i.content,
    aiResponse: i.aiResponse ?? null,
    category: i.category ?? null,
    tagsJson: JSON.stringify(i.tags ?? []),
    createdAt: new Date(i.createdAt),
  });
  return NextResponse.json({ ok: true });
}
