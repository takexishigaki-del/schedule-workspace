"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  GripVertical,
  Loader2,
  Send,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { toast } from "sonner";

import { type SavedIdea, type Project } from "@/lib/schedule-schema";
import { useModKey } from "@/lib/use-mod-key";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DeleteConfirmDialog } from "@/components/workspace/DeleteConfirmDialog";
import { cn } from "@/lib/utils";

// ===== Types =====

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  source?: "api" | "mock";
};

type AIMode = "normal" | "grill";

// ===== Mock responses =====

const NORMAL_RESPONSES = [
  "興味深い視点ですね。まず PoC から始めて仮説を検証するアプローチをおすすめします。",
  "その方向性は良いと思います。競合との差別化ポイントを整理すると戦略が明確になります。",
  "リソース制約を踏まえると、80/20 の原則で優先度を決めるのが効果的です。",
  "市場トレンドとも合致しています。ユーザーインタビューで仮説を裏付けましょう。",
  "面白い発想です。Jobs to be Done フレームワークで整理すると刺さるポイントが見えます。",
  "実行するなら最初の1ヶ月でどんな成果を定義しますか？逆算で計画が立てやすくなります。",
];

// Grill-mode: 5段階の掘り下げ質問
const GRILL_QUESTIONS: Array<(topic?: string) => string> = [
  (topic) =>
    `「${topic ?? "そのアイデア"}」を一緒に深掘りしましょう。\n\n**Q1：誰のためのものですか？**\n\nターゲットを具体的な1人として描写してください（年齢・職業・日常の悩みなど）。\n\n💡 おすすめは「あなた自身が一番困っている人」から考えることです。`,
  () =>
    `なるほど。\n\n**Q2：その人の最大の課題は？**\n\n現状の解決策（代替手段）と、そこへの不満も含めて教えてください。\n\n💡 「今はどうやって解決しているか」が分かると差別化のヒントになります。`,
  () =>
    `良い整理ができました。\n\n**Q3：問題が解決された理想の状態は？**\n\nその人の生活・仕事はどう変わりますか？感情的な変化（安心・達成感・自由など）も含めて描写してください。`,
  () =>
    `クリアになってきました。\n\n**Q4：あなたが持つ強みは何ですか？**\n\n競合が簡単に真似できない、あなただけの優位性を考えてみてください（経験・ネットワーク・技術・視点など）。`,
  () =>
    `素晴らしい。最後です。\n\n**Q5：今週できる最小の一歩は？**\n\n1週間以内に試せる最小の PoC を1つだけ挙げてください。\n\n💡 「スモールスタートが成功の鍵」。まず動いて学ぶことが大切です。`,
];

const GRILL_END =
  `お疲れさまでした！5つの質問を通じて、アイデアが具体的になりましたね。\n\n会話を**保存**して、プロジェクト化の検討に役立ててください。`;

function getMockResponse(mode: AIMode, grillIndex: number, userText: string): string {
  if (mode === "grill") {
    if (grillIndex === 0) return GRILL_QUESTIONS[0](userText);
    if (grillIndex < GRILL_QUESTIONS.length) return GRILL_QUESTIONS[grillIndex]();
    return GRILL_END;
  }
  return NORMAL_RESPONSES[Math.floor(Math.random() * NORMAL_RESPONSES.length)] +
    "\n\n_※ モック応答です。API キーを設定すると実際の AI と接続できます。_";
}

// ===== Main =====

type IdeaPaneProps = {
  savedIdeas: SavedIdea[];
  projects: Project[];
  onSaveIdea: (idea: Omit<SavedIdea, "id" | "tags">) => void;
  onUpdateIdea: (id: string, patch: Partial<SavedIdea>) => void;
  onDeleteIdea: (id: string) => void;
  onSelectIdea: (idea: SavedIdea) => void;
};

export function IdeaPane({
  savedIdeas,
  projects,
  onSaveIdea,
  onUpdateIdea,
  onDeleteIdea,
  onSelectIdea,
}: IdeaPaneProps) {
  const modKey = useModKey();
  const [mode, setMode] = useState<AIMode>("normal");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [grillIndex, setGrillIndex] = useState(0);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [savedOpen, setSavedOpen] = useState(true);
  const [pendingDeleteIdea, setPendingDeleteIdea] = useState<SavedIdea | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Reset chat when mode changes
  const handleModeChange = (m: AIMode) => {
    setMode(m);
    setMessages([]);
    setGrillIndex(0);
    setInput("");
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    // Capture messages before state update for API request body
    const currentMessages = messages;
    setMessages((prev) => [...prev, userMsg]);

    const currentGrillIndex = grillIndex;
    if (mode === "grill") {
      setGrillIndex((i) => i + 1);
    }

    const apiMessages = [...currentMessages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const aiMsgId = `msg-${Date.now() + 1}-ai`;
    let streamStarted = false;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, mode }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      // Start streaming
      streamStarted = true;
      setMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
          source: "api",
        },
      ]);
      setIsLoading(false);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: m.content + chunk } : m,
          ),
        );
      }
    } catch {
      // Fall through to mock fallback
    }

    if (!streamStarted) {
      // Mock fallback (used when API key is not set or request fails)
      await new Promise<void>((r) => setTimeout(r, 1000 + Math.random() * 800));
      setMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          role: "assistant",
          content: getMockResponse(mode, currentGrillIndex, text),
          timestamp: new Date().toISOString(),
          source: "mock",
        },
      ]);
      setIsLoading(false);
    }

    textareaRef.current?.focus();
  }, [input, isLoading, mode, grillIndex, messages]);

  const handleSaveMessage = useCallback(
    (msg: ChatMessage) => {
      const prevUserMsg = [...messages]
        .reverse()
        .find((m) => m.role === "user" && m.id < msg.id);

      onSaveIdea({
        content: prevUserMsg?.content ?? msg.content,
        aiResponse:
          msg.role === "assistant"
            ? msg.content.split("\n\n_※")[0].trim() || undefined
            : undefined,
        category: mode === "grill" ? "壁打ち" : "アイデア",
        createdAt: msg.timestamp,
      });
      toast.success("アイデアを保存しました");
    },
    [messages, mode, onSaveIdea],
  );

  const isGrillFinished = mode === "grill" && grillIndex > GRILL_QUESTIONS.length;

  return (
    <section className="flex h-full w-full flex-col bg-canvas">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
        <Sparkles className="size-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">
          アイデア壁打ち
        </h2>

        {/* Mode toggle */}
        <div className="ml-auto flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
          <ModeButton active={mode === "normal"} onClick={() => handleModeChange("normal")}>
            通常
          </ModeButton>
          <ModeButton active={mode === "grill"} onClick={() => handleModeChange("grill")}>
            🔥 壁打ち
          </ModeButton>
        </div>
      </header>

      {/* Grill mode intro banner */}
      {mode === "grill" && messages.length === 0 && (
        <div className="shrink-0 border-b border-amber-200/60 bg-amber-50/60 px-4 py-2.5 dark:border-amber-800/40 dark:bg-amber-900/10">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            🔥 <strong>壁打ちモード</strong>{" "}
            — アイデアを入力すると AI が5つの質問で深掘りします。1問ずつ答えてください。
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Chat area */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        >
          {messages.length === 0 ? (
            <ChatEmptyState mode={mode} onHintClick={(hint) => setInput(hint)} />
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  mode={mode}
                  onSave={() => handleSaveMessage(msg)}
                />
              ))}
              {isLoading && <AiLoadingBubble mode={mode} />}
            </div>
          )}
        </div>

        {/* Saved ideas accordion */}
        {savedIdeas.length > 0 && (
          <>
            <Separator />
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => setSavedOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Bookmark className="size-3" />
                  保存済み（{savedIdeas.length}件）
                </span>
                <span
                  className={cn(
                    "text-xs text-muted-foreground transition-transform",
                    savedOpen && "rotate-90",
                  )}
                >
                  ▶
                </span>
              </button>

              {savedOpen && (
                <ScrollArea className="max-h-48">
                  <div className="flex flex-col gap-1.5 px-4 pb-3">
                    {savedIdeas.map((idea) => (
                      <SavedIdeaCard
                        key={idea.id}
                        idea={idea}
                        project={projects.find((p) => p.id === idea.projectId)}
                        onSelect={() => onSelectIdea(idea)}
                        onDelete={() => setPendingDeleteIdea(idea)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </>
        )}

        {/* アイデア削除確認ダイアログ */}
        <DeleteConfirmDialog
          open={pendingDeleteIdea !== null}
          onOpenChange={(v) => { if (!v) setPendingDeleteIdea(null); }}
          title="アイデアを削除"
          itemName={pendingDeleteIdea?.content ?? ""}
          onConfirm={() => {
            if (!pendingDeleteIdea) return;
            onDeleteIdea(pendingDeleteIdea.id);
            toast.success("アイデアを削除しました");
            setPendingDeleteIdea(null);
          }}
        />

        {/* Input area */}
        <div className="shrink-0 border-t border-border bg-background px-4 py-3">
          {isGrillFinished ? (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-center">
              <p className="text-sm text-foreground">
                壁打ち完了！会話を保存して振り返りに活用しましょう。
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => handleModeChange("grill")}
              >
                もう一度壁打ちする
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    mode === "grill" && messages.length === 0
                      ? "壁打ちしたいアイデア・テーマを入力…"
                      : mode === "grill"
                        ? `Q${grillIndex} への回答を入力…`
                        : `アイデア・疑問・相談を入力… (${modKey}+Enter で送信)`
                  }
                  disabled={isLoading}
                  rows={2}
                  className="min-h-[60px] resize-none text-sm"
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  aria-label="送信"
                  className="mb-0.5 shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground/60">
                {modKey}+Enter で送信
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ===== Mode button =====

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// ===== ChatEmptyState =====

const NORMAL_HINTS = [
  "新機能のアイデアを相談したい",
  "この問題の解決策を探したい",
  "週のふりかえりをしたい",
  "企画書のたたき台を作りたい",
  "迷っていることを整理したい",
];

const GRILL_HINTS = [
  "新規事業のアイデア",
  "改善したいプロセス",
  "解決したい課題",
  "始めてみたいこと",
];

function ChatEmptyState({
  mode,
  onHintClick,
}: {
  mode: AIMode;
  onHintClick: (hint: string) => void;
}) {
  if (mode === "grill") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10">
        <div className="flex size-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <span className="text-2xl">🔥</span>
        </div>
        <div className="flex flex-col gap-1.5 text-center">
          <p className="text-sm font-medium text-foreground">壁打ちモード</p>
          <p className="max-w-[260px] text-xs text-muted-foreground">
            アイデアやテーマを入力すると、AI が 5つの質問で深掘りします。
            答えを重ねるうちにアイデアが具体化します。
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-center text-xs text-muted-foreground/60">▼ クリックで入力</p>
          {GRILL_HINTS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => onHintClick(h)}
              className="flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/60 hover:text-foreground"
            >
              <ArrowRight className="size-3 shrink-0 text-muted-foreground/50" />
              {h}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="size-6 text-primary" />
      </div>
      <div className="flex flex-col gap-1.5 text-center">
        <p className="text-sm font-medium text-foreground">アイデアを壁打ちしよう</p>
        <p className="max-w-[260px] text-xs text-muted-foreground">
          思いついたアイデアや悩みを入力すると AI が一緒に考えます。
          保存してタスクや企画に活かせます。
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-center text-xs text-muted-foreground/60">▼ クリックで入力</p>
        {NORMAL_HINTS.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => onHintClick(h)}
            className="flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/60 hover:text-foreground"
          >
            <ArrowRight className="size-3 shrink-0 text-muted-foreground/50" />
            {h}
          </button>
        ))}
      </div>
    </div>
  );
}

// ===== ChatBubble =====

function ChatBubble({
  message: msg,
  mode,
  onSave,
}: {
  message: ChatMessage;
  mode: AIMode;
  onSave: () => void;
}) {

  const isUser = msg.role === "user";

  // Render markdown-like bold and line breaks
  const renderContent = (text: string) =>
    text.split("\n").map((line, i, arr) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i}>
          {parts.map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={j}>{part.slice(2, -2)}</strong>
            ) : part.startsWith("_※") ? (
              <em key={j} className="text-xs text-muted-foreground not-italic">
                {part.slice(1, -1)}
              </em>
            ) : (
              part
            ),
          )}
          {i < arr.length - 1 && <br />}
        </span>
      );
    });

  return (
    <div className={cn("group/bubble flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      {!isUser && (
        <span className="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
          {mode === "grill" ? "🔥" : <Sparkles className="size-3 text-primary" />}
          AI
          {msg.source === "mock" && (
            <span className="rounded bg-muted px-1 text-[10px]">モック</span>
          )}
        </span>
      )}

      <div
        className={cn(
          "max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : mode === "grill"
              ? "border border-amber-200/80 bg-amber-50/60 text-card-foreground dark:border-amber-800/40 dark:bg-amber-900/10"
              : "border border-border bg-card text-card-foreground",
        )}
      >
        {renderContent(msg.content)}
      </div>

      <div
        className={cn(
          "flex items-center gap-1.5 opacity-0 transition-opacity group-hover/bubble:opacity-100",
          isUser ? "flex-row-reverse" : "flex-row",
        )}
      >
        <span className="text-xs text-muted-foreground/50">
          {format(new Date(msg.timestamp), "HH:mm", { locale: ja })}
        </span>
        {!isUser && (
          <button
            type="button"
            onClick={onSave}
            aria-label="保存"
            className="flex items-center gap-0.5 rounded-md border border-border bg-card px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <Bookmark className="size-2.5" />
            保存
          </button>
        )}
      </div>
    </div>
  );
}

// ===== Loading bubble =====

function AiLoadingBubble({ mode }: { mode: AIMode }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
        {mode === "grill" ? "🔥" : <Sparkles className="size-3 text-primary" />}
        AI
      </span>
      <div
        className={cn(
          "rounded-xl border px-4 py-3",
          mode === "grill"
            ? "border-amber-200/80 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-900/10"
            : "border-border bg-card",
        )}
      >
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 animate-bounce rounded-full bg-muted-foreground/40"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== SavedIdeaCard =====

function SavedIdeaCard({
  idea,
  project,
  onSelect,
  onDelete,
}: {
  idea: SavedIdea;
  project?: Project;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/x-idea-id", idea.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="group/idea relative cursor-pointer rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-muted/40 active:cursor-grabbing"
    >
      <div className="flex items-start gap-2 pr-6">
        <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/20 opacity-0 transition-opacity group-hover/idea:opacity-100" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">{idea.content}</p>
          {idea.aiResponse && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {idea.aiResponse}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {project && (
              <span
                className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium text-foreground"
                style={{ backgroundColor: (project.color ?? "#6366f1") + "20", color: project.color ?? "#6366f1" }}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: project.color ?? "#6366f1" }} />
                {project.name}
              </span>
            )}
            {idea.category && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {idea.category}
              </span>
            )}
            {idea.tags.map((tag) => (
              <Badge key={tag} variant="outline" size="xs">
                <Tag className="size-2.5" />
                {tag}
              </Badge>
            ))}
            <span className="text-xs text-muted-foreground/50">
              {format(new Date(idea.createdAt), "M/d", { locale: ja })}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label="削除"
        className={cn(
          "absolute right-2 top-2 relative rounded p-1",
          "text-muted-foreground/40 hover:text-destructive",
          "opacity-40 transition-opacity group-hover/idea:opacity-100",
          "after:absolute after:-inset-2 after:content-['']",
        )}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
