/**
 * Google Calendar 連携状態を確認する。
 * GET /api/auth/google/status
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { googleTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SYSTEM_USER_ID } from "@/lib/system-user";
import { getAppOrigin, getGoogleRedirectUri } from "@/lib/app-origin";

export async function GET(request: NextRequest) {
  const configured = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  const appOrigin = getAppOrigin(request);
  const redirectUri = getGoogleRedirectUri(request);

  if (!configured) {
    return NextResponse.json({
      connected: false,
      configured: false,
      appOrigin,
      redirectUri,
    });
  }

  const [token] = await db
    .select({ userId: googleTokens.userId })
    .from(googleTokens)
    .where(eq(googleTokens.userId, SYSTEM_USER_ID));

  return NextResponse.json({
    connected: !!token,
    configured: true,
    appOrigin,
    redirectUri,
  });
}
