/**
 * Neon (PostgreSQL) への接続。
 * @neondatabase/serverless の HTTP ドライバーを使うことで、
 * Vercel の Serverless / Edge 環境でも動作する。
 *
 * 環境変数 DATABASE_URL は Vercel ダッシュボードまたは .env.local で設定する。
 * - ローカル: .env.local に DATABASE_URL=postgres://... を追加
 * - Vercel:   npx vercel env pull .env.local で自動取得
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL が設定されていません。\n" +
      ".env.local に DATABASE_URL=postgres://... を追加するか、\n" +
      "`npx vercel env pull .env.local` を実行してください。",
    );
  }
  return drizzle(neon(url), { schema });
}

// リクエスト時に初めて評価されるよう、Proxy でラップする。
// これにより、ビルド時（DATABASE_URL が未設定の環境）でもエラーにならない。
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    return createDb()[prop as keyof ReturnType<typeof createDb>];
  },
});
