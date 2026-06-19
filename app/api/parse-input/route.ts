import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { type NextRequest } from "next/server";

/**
 * OpenAI structured outputs は全フィールドを required に含める必要があるため、
 * optional() の代わりに nullable() を使用する。
 * downstream では null を undefined として扱う。
 */
const parsedItemSchema = z.object({
  type: z
    .enum(["project", "task", "todo", "idea", "calendar"])
    .describe(
      "入力の種類: project=プロジェクト, task=タスク, todo=個別TODO, idea=アイデア/メモ, calendar=スケジュール予定",
    ),
  title: z
    .string()
    .describe("タイトル・名前・内容（簡潔に）"),
  priority: z
    .enum(["high", "medium", "low"])
    .nullable()
    .describe(
      "優先度: high=今日・明日・急ぎ・重要, medium=今週・近いうち, low=いつか・余裕があれば。判断できなければ null",
    ),
  dueDate: z
    .string()
    .nullable()
    .describe("期日（YYYY-MM-DD 形式）。期日の言及がなければ null"),
  scheduledDate: z
    .string()
    .nullable()
    .describe(
      "実施予定日時（YYYY-MM-DD または YYYY-MM-DDTHH:MM 形式）。日時の指定がなければ null",
    ),
  isPrivate: z
    .boolean()
    .describe(
      "プライベートな内容かどうか。医療・家族・個人趣味・健康など個人的な事柄は true",
    ),
  description: z
    .string()
    .nullable()
    .describe("補足説明。なければ null"),
});

export type ParsedItem = {
  type: "project" | "task" | "todo" | "idea" | "calendar";
  title: string;
  priority?: "high" | "medium" | "low";
  dueDate?: string;
  scheduledDate?: string;
  isPrivate: boolean;
  description?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text: string };
    const { text } = body;

    if (!text?.trim()) {
      return Response.json({ ok: false, error: "テキストが空です" }, { status: 400 });
    }

    const today = new Date().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Tokyo",
    });

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: parsedItemSchema,
      system: `あなたはパーソナルワークスペースの AI アシスタントです。
ユーザーの入力テキストを解析して、適切なタイプに分類し構造化データを返してください。

今日の日付（JST）: ${today}

タイプ判定の基準:
- project: 「〜プロジェクト」「〜の計画」など複数タスクを束ねる大きな目標
- task: 「〜する」「〜を作る」「〜を調べる」など1〜数日で完結する作業
- todo: 「〜を買う」「〜に電話する」など短時間で終わる小さな作業・チェック項目
- idea: 「〜いいかも」「〜どうだろう」「〜を試したい」など行動が伴わない閃き
- calendar: 「〜に行く」「〜の予約」「〜時に〜」など日時が重要なスケジュール

日付の変換（例）:
- 「明日」→ 翌日の日付（YYYY-MM-DD）
- 「来週月曜」→ 来週の月曜日
- 「今月末」→ 当月末日
- 「14時」「午後2時」→ scheduledDate に時刻付きで（例: 2026-06-08T14:00）

優先度の基準:
- high: 「急ぎ」「今日中」「明日まで」「重要」「絶対に」
- medium: 「今週中」「近いうちに」「できれば」（指定なし時のデフォルト）
- low: 「いつか」「余裕があれば」「気が向いたら」

isPrivate:
- 医療・健康・家族・個人の趣味・プライベートな用事 → true
- 仕事・学習・家事・一般的な用事 → false`,
      prompt: text,
    });

    // null を undefined に正規化して返す
    const data: ParsedItem = {
      type: object.type,
      title: object.title,
      priority: object.priority ?? undefined,
      dueDate: object.dueDate ?? undefined,
      scheduledDate: object.scheduledDate ?? undefined,
      isPrivate: object.isPrivate,
      description: object.description ?? undefined,
    };

    return Response.json({ ok: true, data });
  } catch (err) {
    console.error("[parse-input] error:", err);
    return Response.json(
      { ok: false, error: "AI 解析に失敗しました。しばらく後に再試行してください。" },
      { status: 500 },
    );
  }
}
