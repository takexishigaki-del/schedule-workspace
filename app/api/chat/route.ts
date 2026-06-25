import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextResponse } from "next/server";

export const maxDuration = 30;

type Message = { role: "user" | "assistant"; content: string };

function getSystemPrompt(mode: string): string {
  if (mode === "grill") {
    return `あなたは日本語で回答するビジネスコーチ・起業家メンターです。
ユーザーのアイデアやテーマを深掘りし、本質的な洞察を引き出してください。
1回の返答で質問は1つだけ行い、ユーザーが自分の考えを明確にできるよう促してください。
質問は具体的・鋭く、「なぜ」「誰が」「どうやって」「どんな成果を」を中心に掘り下げてください。
回答は簡潔に（3〜5行程度）まとめてください。`;
  }
  return `あなたは日本語で回答するAIアシスタントです。
ユーザーのアイデア・相談・疑問に対して、具体的で実践的なアドバイスをします。
回答は要点を絞り、必要に応じて箇条書きや段落を使ってわかりやすく整理してください。
ポジティブで建設的なフィードバックを心がけてください。`;
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY が設定されていません" },
      { status: 503 },
    );
  }

  const { messages, mode } = (await request.json()) as {
    messages: Message[];
    mode: string;
  };

  const result = await streamText({
    model: openai("gpt-4o-mini"),
    system: getSystemPrompt(mode ?? "normal"),
    messages,
  });

  return result.toTextStreamResponse();
}
