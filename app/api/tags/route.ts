import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { tags } from "@/db/schema";
import { ensureSystemUser, SYSTEM_USER_ID } from "@/lib/system-user";

export async function GET() {
  await ensureSystemUser();
  const rows = await db
    .select()
    .from(tags)
    .where(eq(tags.userId, SYSTEM_USER_ID))
    .orderBy(tags.name);
  return NextResponse.json(rows.map((r) => r.name));
}

export async function POST(request: Request) {
  await ensureSystemUser();
  const body: unknown = await request.json();
  const parsed = z.object({ name: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const name = parsed.data.name.trim();
  const existing = await db
    .select()
    .from(tags)
    .where(eq(tags.userId, SYSTEM_USER_ID));

  if (existing.some((t) => t.name === name) || existing.length >= 20) {
    return NextResponse.json({ ok: true });
  }

  await db.insert(tags).values({
    userId: SYSTEM_USER_ID,
    name,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  await ensureSystemUser();
  const name = new URL(request.url).searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  await db
    .delete(tags)
    .where(and(eq(tags.userId, SYSTEM_USER_ID), eq(tags.name, name)));
  return NextResponse.json({ ok: true });
}
