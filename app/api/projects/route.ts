import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/db/schema";
import { ensureSystemUser, SYSTEM_USER_ID } from "@/lib/system-user";
import { dbToProject } from "@/lib/db-transforms";
import { projectSchema } from "@/lib/schedule-schema";

export async function GET() {
  await ensureSystemUser();
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, SYSTEM_USER_ID))
    .orderBy(projects.name);
  return NextResponse.json(rows.map(dbToProject));
}

export async function POST(request: Request) {
  await ensureSystemUser();
  const body: unknown = await request.json();
  const parsed = projectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const p = parsed.data;
  await db.insert(projects).values({
    id: p.id,
    userId: SYSTEM_USER_ID,
    name: p.name,
    color: p.color ?? null,
    summary: p.summary ?? null,
    goal: p.goal ?? null,
    note: p.note ?? null,
    imageUrl: p.imageUrl ?? null,
    urlsJson: JSON.stringify(p.urls ?? []),
    startDate: p.startDate ?? null,
    endDate: p.endDate ?? null,
  });
  return NextResponse.json({ ok: true });
}
