import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { contacts } from "@/db/schema";
import { ensureSystemUser, SYSTEM_USER_ID } from "@/lib/system-user";
import { dbToContact } from "@/lib/db-transforms";
import { contactSchema } from "@/lib/schedule-schema";

export async function GET() {
  await ensureSystemUser();
  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.userId, SYSTEM_USER_ID))
    .orderBy(contacts.name);
  return NextResponse.json(rows.map(dbToContact));
}

/** 連絡先を名前で upsert */
export async function POST(request: Request) {
  await ensureSystemUser();
  const body: unknown = await request.json();
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const c = parsed.data;

  const all = await db
    .select()
    .from(contacts)
    .where(eq(contacts.userId, SYSTEM_USER_ID));

  const match = all.find(
    (row) => row.name.toLowerCase() === c.name.toLowerCase(),
  );

  if (match) {
    await db
      .update(contacts)
      .set({ contactInfo: c.contact ?? match.contactInfo })
      .where(eq(contacts.id, match.id));
  } else {
    await db.insert(contacts).values({
      userId: SYSTEM_USER_ID,
      name: c.name,
      contactInfo: c.contact ?? null,
    });
  }

  return NextResponse.json({ ok: true });
}

/** 複数連絡先を一括 upsert（localStorage 移行用） */
export async function PUT(request: Request) {
  await ensureSystemUser();
  const body: unknown = await request.json();
  const parsed = z.array(contactSchema).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(contacts)
    .where(eq(contacts.userId, SYSTEM_USER_ID));

  const byName = new Map(
    existing.map((row) => [row.name.toLowerCase(), row]),
  );

  for (const c of parsed.data) {
    const key = c.name.toLowerCase();
    const match = byName.get(key);
    if (match) {
      if (c.contact && c.contact !== match.contactInfo) {
        await db
          .update(contacts)
          .set({ contactInfo: c.contact })
          .where(eq(contacts.id, match.id));
      }
    } else {
      await db.insert(contacts).values({
        userId: SYSTEM_USER_ID,
        name: c.name,
        contactInfo: c.contact ?? null,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
