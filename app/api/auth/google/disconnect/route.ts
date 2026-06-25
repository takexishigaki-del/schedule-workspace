/**
 * Google Calendar 連携を解除する。
 * POST /api/auth/google/disconnect
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { googleTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SYSTEM_USER_ID } from "@/lib/system-user";

export async function POST() {
  await db
    .delete(googleTokens)
    .where(eq(googleTokens.userId, SYSTEM_USER_ID));

  return NextResponse.json({ ok: true });
}
