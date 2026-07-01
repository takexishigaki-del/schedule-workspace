/**
 * Google OAuth コールバック。
 * 認証コードをトークンに交換して DB に保存する。
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { googleTokens } from "@/db/schema";
import { ensureSystemUser, SYSTEM_USER_ID } from "@/lib/system-user";
import { getGoogleRedirectUri } from "@/lib/app-origin";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/?gcal_error=denied", request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/?gcal_error=config", request.url));
  }

  const redirectUri = getGoogleRedirectUri(request);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    return NextResponse.redirect(
      new URL("/?gcal_error=token_exchange", request.url),
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!data.refresh_token) {
    return NextResponse.redirect(
      new URL("/?gcal_error=no_refresh_token", request.url),
    );
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await ensureSystemUser();
  await db
    .insert(googleTokens)
    .values({
      userId: SYSTEM_USER_ID,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: googleTokens.userId,
      set: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
      },
    });

  return NextResponse.redirect(new URL("/?gcal_connected=1", request.url));
}
