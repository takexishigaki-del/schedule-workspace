import { db } from "@/lib/db";
import { users } from "@/db/schema";

/**
 * シングルユーザー運用時の固定ユーザー ID。
 * .env.local の SYSTEM_USER_ID を読む。未設定時はフォールバック UUID を使用。
 */
export const SYSTEM_USER_ID =
  process.env.SYSTEM_USER_ID ?? "22ba2bda-1a6d-450e-84fd-a630fbec82a7";

let ensured = false;

/**
 * システムユーザーが DB に存在しなければ作成する（冪等）。
 * Server Component / Route Handler の先頭で呼ぶ。
 */
export async function ensureSystemUser(): Promise<void> {
  if (ensured) return;
  await db
    .insert(users)
    .values({
      id: SYSTEM_USER_ID,
      email: "owner@local",
      name: "Owner",
    })
    .onConflictDoNothing();
  ensured = true;
}
