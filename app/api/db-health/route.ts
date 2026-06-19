/**
 * GET /api/db-health
 * Neon への接続を確認するためのエンドポイント。
 * 動作確認後は削除するか、認証で保護すること。
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // SELECT 1 を実行して接続を確認
    const result = await db.execute(sql`SELECT 1 AS ok`);
    return NextResponse.json({
      status: "connected",
      message: "Neon に正常に接続できました ✅",
      result: result.rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { status: "error", message },
      { status: 500 },
    );
  }
}
