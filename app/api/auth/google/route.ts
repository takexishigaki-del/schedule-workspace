/**
 * Google OAuth 認証フロー開始。
 * GET /api/auth/google → Google の同意画面にリダイレクト。
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"].join(" ");

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID が設定されていません" },
      { status: 500 },
    );
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent"); // refresh_token を毎回取得

  return NextResponse.redirect(url.toString());
}
