"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ja } from "date-fns/locale";
import { addDays, format, isSameDay, isWithinInterval, parseISO } from "date-fns";
import type { DayButton } from "react-day-picker";
import { CalendarCheck2, FolderOpen, Plus, Tag, X } from "lucide-react";
import { toast } from "sonner";

import { type Schedule, type DailyTask, type Project } from "@/lib/schedule-schema";
import type { SelectedItem } from "@/components/schedule-workspace/ScheduleWorkspace";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Pane1Toggle } from "@/components/workspace/Pane1Toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DeleteConfirmDialog } from "@/components/workspace/DeleteConfirmDialog";
import { cn } from "@/lib/utils";

// ───────────────────────────────────────────────
// Marked-days context
// ───────────────────────────────────────────────

type DotType = "high" | "sched" | "task";

type MarkedDays = {
  /** "yyyy-MM-dd" → その日のドット種別リスト（priority 順にソート済み） */
  dotsByDate: Record<string, DotType[]>;
  multiDayRanges: Array<{ start: Date; end: Date }>;
};

const MarkedDaysContext = createContext<MarkedDays>({
  dotsByDate: {},
  multiDayRanges: [],
});

const DOT_ORDER: Record<DotType, number> = { high: 0, sched: 1, task: 2 };

function MarkedDayButton({
  day, modifiers, children, ...props
}: React.ComponentProps<typeof DayButton>) {
  const { dotsByDate, multiDayRanges } = useContext(MarkedDaysContext);

  const dateKey = format(day.date, "yyyy-MM-dd");
  const allDots = dotsByDate[dateKey] ?? [];
  // 優先度順でソートし最大 3 個まで表示
  const visibleDots = [...allDots]
    .sort((a, b) => DOT_ORDER[a] - DOT_ORDER[b])
    .slice(0, 3);

  const range = multiDayRanges.find((r) =>
    isWithinInterval(day.date, { start: r.start, end: r.end }),
  );
  const isStart = range ? isSameDay(day.date, range.start) : false;
  const isEnd   = range ? isSameDay(day.date, range.end)   : false;
  const isMid   = range && !isStart && !isEnd;

  return (
    <CalendarDayButton day={day} modifiers={modifiers} locale={ja} {...props}>
      {range && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-1 h-0.5 bg-primary/50",
            isStart && "left-1/2 rounded-l",
            isEnd   && "right-1/2 rounded-r",
            isMid   && "opacity-80",
          )}
        />
      )}
      {children}
      {visibleDots.length > 0 && (
        <span className="flex h-1.5 items-center justify-center gap-0.5">
          {visibleDots.map((dot, i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                "size-1 rounded-full",
                dot === "high" ? "bg-destructive"
                : dot === "sched" ? "bg-primary"
                : "bg-muted-foreground/50",
              )}
            />
          ))}
        </span>
      )}
    </CalendarDayButton>
  );
}

const MARKED_COMPONENTS = { DayButton: MarkedDayButton } as const;

// ───────────────────────────────────────────────
// Props
// ───────────────────────────────────────────────

type CalendarPaneProps = {
  schedules: Schedule[];
  tasks: DailyTask[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  projects: Project[];
  globalTags: string[];
  selectedItem: SelectedItem;
  onSelectProject: (p: Project) => void;
  onAddProject: (p: Omit<Project, "id">) => void;
  onDeleteProject: (id: string) => void;
  onAddGlobalTag: (tag: string) => void;
  onDeleteGlobalTag: (tag: string) => void;
};

// ───────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────

export function CalendarPane({
  schedules,
  tasks,
  selectedDate,
  onSelectDate,
  projects,
  globalTags,
  selectedItem,
  onSelectProject,
  onAddProject,
  onDeleteProject,
  onAddGlobalTag,
  onDeleteGlobalTag,
}: CalendarPaneProps) {
  // ── Marked days ──

  const dotsByDate = useMemo<Record<string, DotType[]>>(() => {
    const result: Record<string, DotType[]> = {};

    const add = (key: string, type: DotType) => {
      (result[key] ??= []).push(type);
    };

    for (const s of schedules) {
      const startDate = parseISO(s.date);
      const endDate = s.endDate ? parseISO(s.endDate) : startDate;
      const dotType: DotType = s.priority === "high" ? "high" : "sched";
      let cur = startDate;
      while (cur <= endDate) {
        add(format(cur, "yyyy-MM-dd"), dotType);
        cur = addDays(cur, 1);
      }
    }

    for (const t of tasks) {
      if (!t.date || t.done) continue;
      add(t.date, t.priority === "high" ? "high" : "task");
    }

    return result;
  }, [schedules, tasks]);

  const multiDayRanges = useMemo(() =>
    schedules.filter((s) => s.endDate && s.endDate !== s.date)
      .map((s) => ({ start: parseISO(s.date), end: parseISO(s.endDate!) })),
  [schedules]);

  const markedDays = useMemo<MarkedDays>(
    () => ({ dotsByDate, multiDayRanges }),
    [dotsByDate, multiDayRanges],
  );

  return (
    <MarkedDaysContext.Provider value={markedDays}>
      <Sidebar
        collapsible="icon"
        className="border-r border-sidebar-border [&_[data-slot=sidebar-container]]:bg-sidebar"
      >
        {/* Header */}
        <SidebarHeader className="border-b border-sidebar-border p-0">
          <div className="flex h-12 items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center group-data-[state=expanded]:px-4">
            <h2 className="truncate text-sm font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              マイスケジュール
            </h2>
            <Pane1Toggle />
          </div>
        </SidebarHeader>

        <SidebarContent className="flex flex-col gap-0 overflow-hidden group-data-[collapsible=icon]:hidden">
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-0">

              {/* ── Calendar ── */}
              <div className="shrink-0 px-2 pt-3 pb-2">
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && onSelectDate(d)}
                    locale={ja}
                    components={MARKED_COMPONENTS}
                  />
                </div>
                {/* Legend */}
                <div className="mt-1.5 flex items-center justify-center gap-3 text-xs text-sidebar-foreground/50">
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-destructive" />高優先
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-primary" />予定
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-muted-foreground/40" />タスク
                  </span>
                </div>
              </div>

              <Separator />

              {/* ── Projects ── */}
              <ProjectsSection
                projects={projects}
                selectedItem={selectedItem}
                onSelectProject={onSelectProject}
                onAddProject={onAddProject}
                onDeleteProject={onDeleteProject}
              />

              <Separator />

              {/* ── Global Tags ── */}
              <TagsSection
                globalTags={globalTags}
                onAddTag={onAddGlobalTag}
                onDeleteTag={onDeleteGlobalTag}
              />

              <Separator />

              {/* ── Google Calendar 連携 ── */}
              <GoogleCalendarSection />

            </div>
          </ScrollArea>
        </SidebarContent>
      </Sidebar>
    </MarkedDaysContext.Provider>
  );
}

// ───────────────────────────────────────────────
// ProjectsSection
// ───────────────────────────────────────────────

const PROJECT_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#3b82f6", "#ec4899", "#14b8a6",
];

function ProjectsSection({
  projects,
  selectedItem,
  onSelectProject,
  onAddProject,
  onDeleteProject,
}: {
  projects: Project[];
  selectedItem: SelectedItem;
  onSelectProject: (p: Project) => void;
  onAddProject: (p: Omit<Project, "id">) => void;
  onDeleteProject: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [colorIdx, setColorIdx] = useState(0);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<Project | null>(null);

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAddProject({ name: newName.trim(), color: PROJECT_COLORS[colorIdx], urls: [] });
    toast.success(`プロジェクト「${newName.trim()}」を追加しました`);
    setNewName("");
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-1 px-3 pt-3 pb-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          プロジェクト
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setAdding((v) => !v)}
          aria-label="プロジェクトを追加"
          className="size-5 text-sidebar-foreground/40 hover:text-sidebar-foreground"
        >
          <Plus className="size-3" />
        </Button>
      </div>

      {adding && (
        <div className="mt-1 flex flex-col gap-1.5">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="プロジェクト名"
            className="h-7 text-xs"
          />
          <div className="flex flex-wrap gap-1">
            {PROJECT_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => setColorIdx(i)}
                className={cn(
                  "size-4 rounded-full transition-transform",
                  i === colorIdx && "ring-2 ring-offset-1 ring-sidebar-foreground/50 scale-110",
                )}
                style={{ backgroundColor: c }}
                aria-label={`色 ${i + 1}`}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            <Button type="button" size="xs" onClick={handleAdd} disabled={!newName.trim()}>
              追加
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={() => setAdding(false)}>
              キャンセル
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-0.5 mt-1">
        {projects.length === 0 && (
          <p className="py-2 text-center text-xs text-sidebar-foreground/40">
            プロジェクトがありません
          </p>
        )}
        {projects.map((p) => {
          const isSelected = selectedItem?.kind === "project" && selectedItem.data.id === p.id;
          return (
            <div
              key={p.id}
              className={cn(
                "group/proj flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                "hover:bg-sidebar-accent/70",
                isSelected && "bg-sidebar-accent",
              )}
              onClick={() => onSelectProject(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onSelectProject(p)}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: p.color ?? "#6366f1" }}
              />
              <FolderOpen className="size-3.5 shrink-0 text-sidebar-foreground/40" />
              <span className="min-w-0 flex-1 truncate text-xs text-sidebar-foreground">
                {p.name}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setPendingDeleteProject(p); }}
                aria-label="削除"
                className="ml-auto opacity-40 group-hover/proj:opacity-100 text-sidebar-foreground/30 hover:text-destructive transition-opacity"
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
      </div>

      <DeleteConfirmDialog
        open={pendingDeleteProject !== null}
        onOpenChange={(v) => { if (!v) setPendingDeleteProject(null); }}
        title="プロジェクトを削除"
        itemName={pendingDeleteProject?.name ?? ""}
        description={`「${pendingDeleteProject?.name ?? ""}」を削除します。紐付けられたタスクやアイデアは削除されません。`}
        onConfirm={() => {
          if (!pendingDeleteProject) return;
          onDeleteProject(pendingDeleteProject.id);
          toast.success(`プロジェクト「${pendingDeleteProject.name}」を削除しました`);
          setPendingDeleteProject(null);
        }}
      />
    </div>
  );
}

// ───────────────────────────────────────────────
// TagsSection
// ───────────────────────────────────────────────

function TagsSection({
  globalTags,
  onAddTag,
  onDeleteTag,
}: {
  globalTags: string[];
  onAddTag: (tag: string) => void;
  onDeleteTag: (tag: string) => void;
}) {
  const [newTag, setNewTag] = useState("");
  const [pendingDeleteTag, setPendingDeleteTag] = useState<string | null>(null);

  const handleAdd = () => {
    const t = newTag.trim();
    if (!t) return;
    onAddTag(t);
    toast.success(`タグ「${t}」を追加しました`);
    setNewTag("");
  };

  return (
    <div className="flex flex-col gap-2 px-3 pt-3 pb-4">
      <div className="flex items-center gap-1">
        <Tag className="size-3 text-sidebar-foreground/40" />
        <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          タグ（{globalTags.length}/20）
        </p>
      </div>

      {/* Tag cloud */}
      <div className="flex flex-wrap gap-1.5">
        {globalTags.map((tag) => (
          <span
            key={tag}
            className="group/tag flex items-center gap-1 rounded-full border border-sidebar-border bg-sidebar-accent/60 px-2 py-0.5 text-xs text-sidebar-accent-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={() => setPendingDeleteTag(tag)}
              aria-label={`${tag}を削除`}
              className="opacity-40 group-hover/tag:opacity-100 text-sidebar-foreground/30 hover:text-destructive transition-opacity"
            >
              <X className="size-2.5" />
            </button>
          </span>
        ))}
      </div>

      <DeleteConfirmDialog
        open={pendingDeleteTag !== null}
        onOpenChange={(v) => { if (!v) setPendingDeleteTag(null); }}
        title="タグを削除"
        itemName={pendingDeleteTag ?? ""}
        description={`タグ「${pendingDeleteTag ?? ""}」を削除します。このタグが付いた予定・タスクからも外れます。`}
        onConfirm={() => {
          if (!pendingDeleteTag) return;
          onDeleteTag(pendingDeleteTag);
          toast.success(`タグ「${pendingDeleteTag}」を削除しました`);
          setPendingDeleteTag(null);
        }}
      />

      {/* Add tag */}
      {globalTags.length < 20 && (
        <div className="flex gap-1.5">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="タグを追加…"
            className="h-6 text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            onClick={handleAdd}
            disabled={!newTag.trim()}
            aria-label="タグを追加"
            className="size-6 shrink-0"
          >
            <Plus className="size-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────
// GoogleCalendarSection
// ───────────────────────────────────────────────

type GCalStatus = "loading" | "not-configured" | "disconnected" | "connected";

type GCalStatusResponse = {
  connected: boolean;
  configured: boolean;
  appOrigin?: string;
  redirectUri?: string;
};

function GoogleCalendarSection() {
  const [status, setStatus] = useState<GCalStatus>("loading");
  const [redirectUri, setRedirectUri] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/google/status")
      .then((r) => r.json())
      .then((data: GCalStatusResponse) => {
        if (data.redirectUri) setRedirectUri(data.redirectUri);
        if (!data.configured) setStatus("not-configured");
        else if (data.connected) setStatus("connected");
        else setStatus("disconnected");
      })
      .catch(() => setStatus("not-configured"));
  }, []);

  const handleDisconnect = async () => {
    await fetch("/api/auth/google/disconnect", { method: "POST" });
    setStatus("disconnected");
    toast.success("Google Calendar との連携を解除しました");
  };

  if (status === "loading" || status === "not-configured") return null;

  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      <div className="flex items-center gap-1">
        <CalendarCheck2 className="size-3 text-sidebar-foreground/40" />
        <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Google Calendar
        </p>
      </div>

      {status === "connected" ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-green-500" />
            <span className="text-xs text-sidebar-foreground/70">連携中</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleDisconnect}
            className="text-xs text-sidebar-foreground/40 hover:text-destructive"
          >
            解除
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-sidebar-foreground/50">
            予定を Google Calendar と自動同期します
          </p>
          {redirectUri && (
            <p className="rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[10px] leading-relaxed text-sidebar-foreground/50">
              Google Cloud Console の「承認済みのリダイレクト URI」に以下を登録してください:
              <span className="mt-1 block break-all font-mono text-sidebar-foreground/70">
                {redirectUri}
              </span>
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => {
              window.location.href = "/api/auth/google";
            }}
            className="w-full gap-1.5 text-xs"
          >
            <CalendarCheck2 className="size-3" />
            Google Calendar に連携
          </Button>
        </div>
      )}
    </div>
  );
}
