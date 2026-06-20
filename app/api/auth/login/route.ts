import { NextResponse } from "next/server";

const AUTH_COOKIE = "site-auth";
// クッキーの有効期限: 30日
const MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(request: Request) {
  const { password } = await request.json() as { password?: string };

  const sitePassword = process.env.SITE_PASSWORD;
  const authSecret = process.env.AUTH_SECRET;

  if (!sitePassword || !authSecret) {
    return NextResponse.json(
      { error: "サーバーの設定が不完全です。管理者に連絡してください。" },
      { status: 500 },
    );
  }

  if (!password || password !== sitePassword) {
    return NextResponse.json(
      { error: "パスワードが違います。" },
      { status: 401 },
    );
  }

  // 認証成功 → クッキーを発行してトップページへ
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, authSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
  return response;
}
