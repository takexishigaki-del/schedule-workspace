import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "site-auth";

// 保護しないパス（ログイン画面・認証API・静的ファイル）
const PUBLIC_PATHS = ["/login", "/api/auth/"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静的アセットと公開パスはスキップ
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // クッキーを確認して認証済みかチェック
  const authCookie = request.cookies.get(AUTH_COOKIE);
  const secret = process.env.AUTH_SECRET;

  if (!secret || !authCookie || authCookie.value !== secret) {
    // 未認証 → ログインページへリダイレクト（元のURLをクエリに含める）
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのパスにマッチ:
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
