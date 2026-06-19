"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CalendarPlus, CheckCircle2, Circle, Clock3, Lightbulb, ListTodo, Pencil, Plus, Trash2, X } from "lucide-react";
import { ja } from "date-fns/locale";
import { format, isSameDay, isPast, parseISO } from "date-fns";
import type { DayButton } from "react-day-picker";

import { type Idea, type TodoItem, type Task, type Priority, PRIORITY_LABELS } from "@/lib/task-schema";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AddItemDialog } from "@/components/workspace/AddItemDialog";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Pane1Toggle } from "@/components/workspace/Pane1Toggle";
import { cn } from "@/lib/utils";

// ===== Marked-days context (stable reference for custom DayButton) =====

type MarkedDays = {
  highPriorityDays: Date[];
  scheduledDays: Date[];
  privateDays: Date[];
};

const MarkedDaysContext = createContext<MarkedDays>({
  highPriorityDays: [],
  scheduledDays: [],
  privateDays: [],
});

// Defined OUTSIDE component so the component identity is stable
// (prevents react-day-picker from remounting day cells on every render).
function MarkedDayButton({
  day,
  modifiers,
  children,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const { highPriorityDays, scheduledDays, privateDays } =
    useContext(MarkedDaysContext);

  const hasHigh = highPriorityDays.some((d) => isSameDay(d, day.date));
  const hasSched = scheduledDays.some((d) => isSameDay(d, day.date));
  const hasPriv = privateDays.some((d) => isSameDay(d, day.date));
  const hasDots = hasHigh || hasSched || hasPriv;

  return (
    <CalendarDayButton day={day} modifiers={modifiers} locale={ja} {...props}>
      {children}
      {hasDots && (
        <span className="flex h-1.5 items-center justify-center gap-0.5">
          {hasHigh && (
            <span
              className="size-1 rounded-full bg-destructive"
              aria-hidden
            />
          )}
          {hasSched && (
            <span className="size-1 rounded-full bg-primary" aria-hidden />
          )}
          {hasPriv && (
            <span
              className="size-1 rounded-full bg-green-500"
              aria-hidden
            />
          )}
        </span>
      )}
    </CalendarDayButton>
  );
}

const MARKED_DAY_BUTTON_COMPONENTS = { DayButton: MarkedDayButton } as const;

// ===== Main component =====

type CalendarIdeaPaneProps = {
  ideas: Idea[];
  todos: TodoItem[];
  tasks: Task[];
  selectedDate: Date | undefined;
  onSelectDate: (date: Date | undefined) => void;
  onAddIdea: (content: string) => void;
  onUpdateIdea: (id: string, content: string) => void;
  onDeleteIdea: (id: string) => void;
  onAddScheduledItem: (date: Date, title: string) => void;
};

export function CalendarIdeaPane({
  ideas,
  todos,
  tasks,
  selectedDate,
  onSelectDate,
  onAddIdea,
  onUpdateIdea,
  onDeleteIdea,
  onAddScheduledItem,
}: CalendarIdeaPaneProps) {
  const [newIdea, setNewIdea] = useState("");
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);

  /**
   * 日付文字列（YYYY-MM-DD）をローカル日付として正しくパースする。
   * new Date("YYYY-MM-DD") は UTC 0:00 になり JST では前日に見える場合があるため
   * parseISO + date-fns を使用してローカル日付として扱う。
   */
  const parseDateStr = (s: string) => parseISO(s);

  /** 日付配列を YYYY-MM-DD 文字列でユニーク化（同日の重複を除去） */
  const uniqueDates = (dates: Date[]): Date[] => {
    const seen = new Set<string>();
    return dates.filter((d) => {
      const key = format(d, "yyyy-MM-dd");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // 高優先度: due/scheduled が設定されている高優先アイテム（ドット: 赤）
  const highPriorityDays = useMemo(
    () =>
      uniqueDates([
        ...todos
          .filter((t) => t.priority === "high" && !t.done)
          .flatMap((t) =>
            [t.dueDate, t.scheduledDate]
              .filter(Boolean)
              .map((d) => parseDateStr(d!)),
          ),
        ...tasks
          .filter((t) => t.priority === "high" && t.status !== "done")
          .flatMap((t) =>
            [t.dueDate, t.scheduledDate]
              .filter(Boolean)
              .map((d) => parseDateStr(d!)),
          ),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todos, tasks],
  );

  // スケジュール済み（高優先・プライベート以外）（ドット: 青）
  const scheduledDays = useMemo(
    () =>
      uniqueDates([
        ...todos
          .filter((t) => t.priority !== "high" && !t.done && !t.isPrivate)
          .flatMap((t) =>
            [t.dueDate, t.scheduledDate]
              .filter(Boolean)
              .map((d) => parseDateStr(d!)),
          ),
        ...tasks
          .filter(
            (t) => t.priority !== "high" && t.status !== "done" && !t.isPrivate,
          )
          .flatMap((t) =>
            [t.dueDate, t.scheduledDate]
              .filter(Boolean)
              .map((d) => parseDateStr(d!)),
          ),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todos, tasks],
  );

  // プライベート（ドット: 緑）
  const privateDays = useMemo(
    () =>
      uniqueDates([
        ...todos
          .filter((t) => t.isPrivate && !t.done)
          .flatMap((t) =>
            [t.dueDate, t.scheduledDate]
              .filter(Boolean)
              .map((d) => parseDateStr(d!)),
          ),
        ...tasks
          .filter((t) => t.isPrivate && t.status !== "done")
          .flatMap((t) =>
            [t.dueDate, t.scheduledDate]
              .filter(Boolean)
              .map((d) => parseDateStr(d!)),
          ),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todos, tasks],
  );

  const markedDays = useMemo<MarkedDays>(
    () => ({ highPriorityDays, scheduledDays, privateDays }),
    [highPriorityDays, scheduledDays, privateDays],
  );

  // 選択日のアイテム（scheduledDate または dueDate が一致）
  type DayItem = {
    id: string;
    kind: "todo" | "task";
    title: string;
    done: boolean;
    priority?: Priority;
    isScheduled: boolean; // true=予定日 / false=期日
  };

  const itemsForDate = useMemo<DayItem[]>(() => {
    if (!selectedDate) return [];

    const result: DayItem[] = [];
    todos.forEach((t) => {
      const onScheduled = t.scheduledDate && isSameDay(parseISO(t.scheduledDate), selectedDate);
      const onDue = t.dueDate && isSameDay(parseISO(t.dueDate), selectedDate);
      if (onScheduled || onDue) {
        result.push({
          id: t.id,
          kind: "todo",
          title: t.title,
          done: t.done,
          priority: t.priority,
          isScheduled: !!onScheduled,
        });
      }
    });
    tasks.forEach((t) => {
      if (t.archived) return;
      const onScheduled = t.scheduledDate && isSameDay(parseISO(t.scheduledDate), selectedDate);
      const onDue = t.dueDate && isSameDay(parseISO(t.dueDate), selectedDate);
      if (onScheduled || onDue) {
        result.push({
          id: t.id,
          kind: "task",
          title: t.name,
          done: t.status === "done",
          priority: t.priority,
          isScheduled: !!onScheduled,
        });
      }
    });
    return result;
  }, [selectedDate, todos, tasks]);

  const handleAddIdea = useCallback(() => {
    const trimmed = newIdea.trim();
    if (!trimmed) return;
    onAddIdea(trimmed);
    setNewIdea("");
  }, [newIdea, onAddIdea]);

  return (
    <MarkedDaysContext.Provider value={markedDays}>
      <Sidebar
        collapsible="icon"
        className="border-r border-sidebar-border [&_[data-slot=sidebar-container]]:bg-sidebar"
      >
        <SidebarHeader className="border-b border-sidebar-border p-0">
          <div className="flex h-12 items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[state=expanded]:px-4">
            <h2 className="truncate text-sm font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              マイワークスペース
            </h2>
            <Pane1Toggle />
          </div>
        </SidebarHeader>

        <SidebarContent className="flex flex-col gap-0 overflow-hidden group-data-[collapsible=icon]:hidden">
          {/* Calendar section */}
          <div className="shrink-0 px-2 pt-4 pb-3">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              カレンダー
            </p>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={onSelectDate}
                locale={ja}
                components={MARKED_DAY_BUTTON_COMPONENTS}
              />
            </div>
            {/* Legend */}
            <div className="mt-2 flex items-center justify-center gap-3 text-xs text-sidebar-foreground/50">
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-destructive" />
                高優先
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-primary" />
                予定あり
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-green-500" />
                プライベート
              </span>
            </div>
            {selectedDate && (
              <div className="mt-2 flex items-center justify-between rounded-md bg-sidebar-accent px-3 py-1.5">
                <p className="text-xs text-sidebar-foreground/70">
                  {format(selectedDate, "M月d日（E）", { locale: ja })}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setScheduleDialogOpen(true)}
                  aria-label="この日に予定を追加"
                  className="text-sidebar-foreground/60 hover:text-sidebar-foreground"
                >
                  <CalendarPlus className="size-3.5" />
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* 日付選択中: スケジュール一覧 / 未選択: アイデアメモ */}
          {selectedDate ? (
            /* ── 選択日のスケジュール表示 ── */
            <div className="flex min-h-0 flex-1 flex-col px-3 pt-3 pb-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  <ListTodo className="size-3" aria-hidden />
                  {format(selectedDate, "M/d の予定", { locale: ja })}
                </p>
                <button
                  type="button"
                  onClick={() => onSelectDate(undefined)}
                  aria-label="日付選択を解除"
                  className="rounded p-0.5 text-sidebar-foreground/40 hover:text-sidebar-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col gap-1 pr-1">
                  {itemsForDate.length === 0 ? (
                    <p className="py-6 text-center text-xs text-sidebar-foreground/40">
                      この日の予定はありません
                    </p>
                  ) : (
                    itemsForDate.map((item) => (
                      <DayScheduleItem key={item.id} item={item} />
                    ))
                  )}
                </div>
              </ScrollArea>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setScheduleDialogOpen(true)}
                className="mt-3 w-full"
              >
                <CalendarPlus className="size-3" />
                この日に予定を追加
              </Button>
            </div>
          ) : (
            /* ── アイデアメモ ── */
            <div className="flex min-h-0 flex-1 flex-col px-3 pt-3 pb-4">
              <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                <Lightbulb className="size-3" aria-hidden />
                アイデア・メモ
              </p>

              <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col gap-1.5 pr-1">
                  {ideas.length === 0 && (
                    <p className="py-4 text-center text-xs text-sidebar-foreground/40">
                      閃きをメモしよう
                    </p>
                  )}
                  {ideas.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      onEdit={() => setEditingIdea(idea)}
                      onDelete={() => onDeleteIdea(idea.id)}
                    />
                  ))}
                </div>
              </ScrollArea>

              <div className="mt-3 flex flex-col gap-1.5">
                <Textarea
                  placeholder="閃き・メモを入力…（Enter で追加）"
                  value={newIdea}
                  onChange={(e) => setNewIdea(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAddIdea();
                    }
                  }}
                  rows={2}
                  className="resize-none text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddIdea}
                  disabled={!newIdea.trim()}
                  className="w-full"
                >
                  <Plus className="size-3" />
                  追加
                </Button>
              </div>
            </div>
          )}
        </SidebarContent>
      </Sidebar>

      {selectedDate && (
        <AddItemDialog
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          title={`${format(selectedDate, "M月d日（E）", { locale: ja })}に予定を追加`}
          description="この日のスケジュールとして TODO に追加します"
          fieldLabel="予定の内容"
          fieldId="schedule-title"
          placeholder="例: 歯医者の予約、打ち合わせ"
          onAdd={(title) => onAddScheduledItem(selectedDate, title)}
        />
      )}

      {/* アイデア編集ダイアログ */}
      <AddItemDialog
        open={editingIdea !== null}
        onOpenChange={(v) => { if (!v) setEditingIdea(null); }}
        title="アイデアを編集"
        description="内容を変更してください"
        fieldLabel="内容"
        fieldId="idea-content-edit"
        placeholder="閃き・メモ"
        defaultValue={editingIdea?.content}
        onAdd={(content) => {
          if (editingIdea) onUpdateIdea(editingIdea.id, content);
        }}
      />
    </MarkedDaysContext.Provider>
  );
}

type DayItem = {
  id: string;
  kind: "todo" | "task";
  title: string;
  done: boolean;
  priority?: Priority;
  isScheduled: boolean;
};

function DayScheduleItem({ item }: { item: DayItem }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md px-2.5 py-2",
        item.done ? "opacity-50" : "bg-sidebar-accent",
      )}
    >
      {item.kind === "todo" ? (
        item.done ? (
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-sidebar-foreground/40" />
        ) : (
          <Circle className="mt-0.5 size-3.5 shrink-0 text-sidebar-foreground/50" />
        )
      ) : (
        <ListTodo className="mt-0.5 size-3.5 shrink-0 text-primary/70" />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-xs leading-snug text-sidebar-accent-foreground",
            item.done && "line-through",
          )}
        >
          {item.title}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="text-[10px] text-sidebar-foreground/40">
            {item.isScheduled ? "予定" : "期日"}
          </span>
          {item.priority && item.priority !== "medium" && (
            <Badge
              variant={item.priority === "high" ? "destructive" : "outline"}
              size="xs"
              className="text-[10px]"
            >
              {PRIORITY_LABELS[item.priority]}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function IdeaCard({
  idea,
  onEdit,
  onDelete,
}: {
  idea: Idea;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group/idea relative rounded-md bg-sidebar-accent px-2.5 py-2">
      <p className="pr-10 text-xs leading-relaxed text-sidebar-accent-foreground">
        {idea.content}
      </p>
      <div
        className={cn(
          "absolute right-1.5 top-1.5 flex items-center gap-0.5",
          "opacity-0 transition-opacity group-hover/idea:opacity-100",
        )}
      >
        <button
          type="button"
          onClick={onEdit}
          aria-label="編集"
          className="rounded p-0.5 text-sidebar-foreground/40 hover:text-sidebar-foreground"
        >
          <Pencil className="size-3" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="削除"
          className="rounded p-0.5 text-sidebar-foreground/30 hover:text-destructive"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  );
}
