"use client";

import { useState } from "react";
import { Calendar, Lightbulb, ListTodo, SlidersHorizontal } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const LS_ONBOARDED_KEY = "schedule-workspace-onboarded-v1";

const PANES = [
  {
    icon: Calendar,
    color: "bg-primary/10 text-primary",
    label: "P1 カレンダー",
    title: "月カレンダー & プロジェクト管理",
    desc: "月単位でスケジュールを俯瞰できます。日付をクリックすると、その日の予定がP2に表示されます。プロジェクトやタグもここで管理します。",
  },
  {
    icon: ListTodo,
    color: "bg-secondary text-secondary-foreground",
    label: "P2 今日のタスク",
    title: "選んだ日の予定 & タスク",
    desc: "選択した日のスケジュールとタスクを一覧で確認できます。「予定」「タスク」ボタンで新規追加、カードをクリックで詳細をP3に表示します。",
  },
  {
    icon: SlidersHorizontal,
    color: "bg-muted text-muted-foreground",
    label: "P3 詳細 & 編集",
    title: "詳細ビュー & インライン編集",
    desc: "P2で選んだ項目の詳細が表示されます。テキストを直接クリックして編集でき、画像やURLも追加できます。プロジェクトの内容もここで確認・編集できます。",
  },
  {
    icon: Lightbulb,
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    label: "P4 アイデア壁打ち",
    title: "AI と一緒にアイデアを深掘り",
    desc: "思いついたアイデアや悩みを気軽に入力できます。「壁打ちモード」では AI が5つの質問で深掘りします。保存したアイデアはP3でプロジェクトに紐付けられます。",
  },
] as const;

function loadOnboarded(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(LS_ONBOARDED_KEY) === "true";
}

export function OnboardingDialog() {
  const [open, setOpen] = useState(() => !loadOnboarded());
  const [step, setStep] = useState(0);

  const isLast = step === PANES.length - 1;
  const pane = PANES[step];
  const Icon = pane.icon;

  const handleClose = () => {
    localStorage.setItem(LS_ONBOARDED_KEY, "true");
    setOpen(false);
  };

  const handleNext = () => {
    if (isLast) {
      handleClose();
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-3 flex items-center gap-2">
            {PANES.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
          <div className={`mx-auto mb-2 flex size-14 items-center justify-center rounded-full ${pane.color}`}>
            <Icon className="size-7" aria-hidden />
          </div>
          <DialogTitle className="text-center text-base">
            {pane.title}
          </DialogTitle>
          <DialogDescription className="text-center text-xs font-medium text-primary">
            {pane.label}
          </DialogDescription>
        </DialogHeader>

        <p className="text-center text-sm leading-relaxed text-muted-foreground">
          {pane.desc}
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="text-muted-foreground"
          >
            スキップ
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
              >
                戻る
              </Button>
            )}
            <Button type="button" size="sm" onClick={handleNext}>
              {isLast ? "さっそく始める" : "次へ"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
