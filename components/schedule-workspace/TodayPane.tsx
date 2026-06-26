"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  CalendarClock, Clock, Copy, GripVertical, ImageIcon, MapPin, Plus, Trash2, UserPlus, X,
} from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { toast } from "sonner";

import {
  type Schedule, type DailyTask, type Attendee, type Contact, type Project, type Priority,
  PRIORITY_LABELS,
} from "@/lib/schedule-schema";
import type { SelectedItem } from "@/components/schedule-workspace/ScheduleWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DeleteConfirmDialog } from "@/components/workspace/DeleteConfirmDialog";
import { mapsUrl } from "@/lib/maps";
import { cn } from "@/lib/utils";

// ── props ──────────────────────────────────────────────────────────────────

type TodayPaneProps = {
  date: Date;
  schedules: Schedule[];
  tasks: DailyTask[];
  selectedItem: SelectedItem;
  contacts: Contact[];
  projects: Project[];
  globalTags: string[];
  onSelectItem: (item: SelectedItem) => void;
  onAddSchedule: (s: Omit<Schedule, "id" | "tags" | "done">) => void;
  onAddTask: (t: Omit<DailyTask, "id" | "tags" | "done">) => void;
  onToggleTask: (id: string) => void;
  onDeleteSchedule: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onCopySchedule: (id: string) => void;
  onCopyTask: (id: string) => void;
  onUpdateSchedule: (id: string, patch: Partial<Schedule>) => void;
  onUpdateTask: (id: string, patch: Partial<DailyTask>) => void;
};

// ── main ───────────────────────────────────────────────────────────────────

export function TodayPane({
  date, schedules, tasks, selectedItem, contacts, projects, globalTags,
  onSelectItem, onAddSchedule, onAddTask, onToggleTask,
  onDeleteSchedule, onDeleteTask, onCopySchedule, onCopyTask,
  onUpdateSchedule, onUpdateTask,
}: TodayPaneProps) {
  const [addScheduleOpen, setAddScheduleOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [pendingDeleteSchedule, setPendingDeleteSchedule] = useState<Schedule | null>(null);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<DailyTask | null>(null);

  // 現在時刻（日本時間）を 1 分ごとに更新
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const currentTime = now.toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const sorted = [...schedules].sort((a, b) => {
    if (!a.startTime) return 1;
    if (!b.startTime) return -1;
    return a.startTime.localeCompare(b.startTime);
  });

  const dateLabel = format(date, "M月d日（E）", { locale: ja });
  const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  // Image drop handler (for dropping onto a schedule/task card)
  const MAX_IMAGE_BYTES = 500 * 1024; // 500 KB → Base64 で約 670 KB
  const handleImageDrop = useCallback((kind: "schedule" | "task", id: string, file: File) => {
    if (file.size > MAX_IMAGE_BYTES) {
      toast.warning(
        `画像が大きすぎます（${Math.round(file.size / 1024)} KB）。500 KB 以下の画像をお使いください。`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      if (kind === "schedule") onUpdateSchedule(id, { imageUrl: url });
      else onUpdateTask(id, { imageUrl: url });
    };
    reader.readAsDataURL(file);
  }, [onUpdateSchedule, onUpdateTask]);

  return (
    <section className="flex h-full w-full flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{isToday ? "今日" : dateLabel}</h2>
          {isToday ? (
            <>
              <span className="text-xs text-muted-foreground">{dateLabel}</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{currentTime}</span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="xs" onClick={() => setAddScheduleOpen(true)} aria-label="予定を追加" className="gap-1 text-xs">
            <CalendarClock className="size-3.5" />
            <span className="hidden sm:inline">予定</span>
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={() => setAddTaskOpen(true)} aria-label="タスクを追加" className="gap-1 text-xs">
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">タスク</span>
          </Button>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 px-3 py-4">
          {/* ── schedules ── */}
          {sorted.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">予定</p>
              <ul className="flex flex-col gap-1.5">
                {sorted.map((s) => (
                  <ScheduleCard
                    key={s.id}
                    schedule={s}
                    isSelected={selectedItem?.kind === "schedule" && selectedItem.data.id === s.id}
                    onClick={() => onSelectItem({ kind: "schedule", data: s })}
                    onDelete={() => setPendingDeleteSchedule(s)}
                    onCopy={() => { onCopySchedule(s.id); toast.success(`「${s.title}」をコピーしました`); }}
                    onImageDrop={(file) => handleImageDrop("schedule", s.id, file)}
                    onToggleDone={() => onUpdateSchedule(s.id, { done: !s.done })}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* ── tasks ── */}
          {tasks.length > 0 && (
            <>
              {sorted.length > 0 && <Separator />}
              <div className="flex flex-col gap-1.5">
                <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">タスク</p>
                <ul className="flex flex-col gap-1">
                  {tasks.map((t) => {
                    const proj = t.projectId ? projects.find((p) => p.id === t.projectId) : undefined;
                    return (
                      <TaskRow
                        key={t.id}
                        task={t}
                        project={proj}
                        isSelected={selectedItem?.kind === "task" && selectedItem.data.id === t.id}
                        onClick={() => onSelectItem({ kind: "task", data: t })}
                        onToggle={() => onToggleTask(t.id)}
                        onDelete={() => setPendingDeleteTask(t)}
                        onCopy={() => { onCopyTask(t.id); toast.success(`「${t.title}」をコピーしました`); }}
                        onImageDrop={(file) => handleImageDrop("task", t.id, file)}
                      />
                    );
                  })}
                </ul>
              </div>
            </>
          )}

          {sorted.length === 0 && tasks.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">この日の予定・タスクはありません</p>
              <div className="mt-3 flex justify-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAddScheduleOpen(true)}>
                  <CalendarClock className="size-3.5" />予定を追加
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAddTaskOpen(true)}>
                  <Plus className="size-3.5" />タスクを追加
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <AddScheduleDialog
        open={addScheduleOpen}
        onOpenChange={setAddScheduleOpen}
        defaultDate={format(date, "yyyy-MM-dd")}
        contacts={contacts}
        globalTags={globalTags}
        onAdd={(s) => { onAddSchedule(s); toast.success("予定を追加しました"); }}
      />
      <AddTaskDialog
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        defaultDate={format(date, "yyyy-MM-dd")}
        projects={projects}
        globalTags={globalTags}
        onAdd={(t) => { onAddTask(t); toast.success("タスクを追加しました"); }}
      />

      {/* 削除確認ダイアログ: 予定 */}
      <DeleteConfirmDialog
        open={pendingDeleteSchedule !== null}
        onOpenChange={(v) => { if (!v) setPendingDeleteSchedule(null); }}
        title="予定を削除"
        itemName={pendingDeleteSchedule?.title ?? ""}
        onConfirm={() => {
          if (!pendingDeleteSchedule) return;
          onDeleteSchedule(pendingDeleteSchedule.id);
          toast.success(`「${pendingDeleteSchedule.title}」を削除しました`);
          setPendingDeleteSchedule(null);
        }}
      />

      {/* 削除確認ダイアログ: タスク */}
      <DeleteConfirmDialog
        open={pendingDeleteTask !== null}
        onOpenChange={(v) => { if (!v) setPendingDeleteTask(null); }}
        title="タスクを削除"
        itemName={pendingDeleteTask?.title ?? ""}
        onConfirm={() => {
          if (!pendingDeleteTask) return;
          onDeleteTask(pendingDeleteTask.id);
          toast.success(`「${pendingDeleteTask.title}」を削除しました`);
          setPendingDeleteTask(null);
        }}
      />
    </section>
  );
}

// ── ScheduleCard ───────────────────────────────────────────────────────────

function ScheduleCard({
  schedule: s, isSelected, onClick, onDelete, onCopy, onImageDrop, onToggleDone,
}: {
  schedule: Schedule;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onImageDrop: (file: File) => void;
  onToggleDone: () => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
    if (file) onImageDrop(file);
  };

  return (
    <li
      onClick={onClick}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "group/card relative cursor-pointer rounded-lg border px-3 py-3 transition-all",
        "hover:border-primary/30 hover:shadow-sm",
        isSelected  ? "border-primary/50 bg-primary/5 shadow-sm" : "border-border bg-card",
        isDragOver  && "border-primary border-dashed bg-primary/5",
        s.done      && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Done toggle */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
          aria-label={s.done ? "未完了に戻す" : "完了にする"}
          className={cn(
            "mt-0.5 size-3.5 shrink-0 rounded-sm border transition-colors",
            s.done ? "border-primary bg-primary" : "border-border hover:border-primary",
          )}
        >
          {s.done && (
            <svg viewBox="0 0 12 12" fill="none" className="p-[1px] text-primary-foreground" aria-hidden>
              <path d="M2 6l2.5 2.5L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {s.priority === "high" && !s.done && (
          <span className="mt-1 size-2 shrink-0 rounded-full bg-destructive" aria-label="高優先" />
        )}

        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium leading-snug", s.done && "line-through text-muted-foreground")}>
            {s.title}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {(s.startTime || s.endTime) && (
              <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                <Clock className="size-3" />
                {s.startTime}{s.endTime && `–${s.endTime}`}
              </span>
            )}
            {s.endDate && s.endDate !== s.date && (
              <span className="text-xs text-muted-foreground">〜{s.endDate}</span>
            )}
            {s.location && (
              <a
                href={mapsUrl(s.location)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                <MapPin className="size-3 shrink-0" />
                <span className="truncate hover:underline">{s.location}</span>
              </a>
            )}
          </div>

          {s.attendees.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {s.attendees.map((a) => (
                <Badge key={a.name} variant="secondary" size="xs">{a.name}</Badge>
              ))}
            </div>
          )}

          {s.imageUrl && (
            <div className="mt-2 overflow-hidden rounded-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.imageUrl} alt={s.title} className="h-28 w-full object-cover" loading="lazy" />
            </div>
          )}

          {!s.imageUrl && isDragOver && (
            <div className="mt-2 flex h-14 items-center justify-center rounded-md border-2 border-dashed border-primary/50 bg-primary/5">
              <ImageIcon className="size-5 text-primary/50" />
            </div>
          )}

          {s.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {s.tags.map((tag) => <Badge key={tag} variant="outline" size="xs">{tag}</Badge>)}
            </div>
          )}
        </div>

        {s.priority && s.priority !== "high" && !s.done && (
          <Badge variant="outline" size="xs" className="shrink-0 self-start">{PRIORITY_LABELS[s.priority]}</Badge>
        )}
      </div>

      {/* Action buttons */}
      <div className={cn(
        "absolute right-2 top-2 flex items-center gap-0.5",
        "opacity-40 transition-opacity group-hover/card:opacity-100",
      )}>
        <button type="button" onClick={(e) => { e.stopPropagation(); onCopy(); }}
          aria-label="コピー" className="relative rounded p-1 text-muted-foreground hover:text-primary after:absolute after:-inset-2 after:content-['']">
          <Copy className="size-3.5" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="削除" className="relative rounded p-1 text-muted-foreground hover:text-destructive after:absolute after:-inset-2 after:content-['']">
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {isDragOver && (
        <p className="absolute inset-x-0 bottom-1 text-center text-xs text-primary/70">
          画像をドロップ
        </p>
      )}
    </li>
  );
}

// ── TaskRow ────────────────────────────────────────────────────────────────

function TaskRow({
  task: t, project, isSelected, onClick, onToggle, onDelete, onCopy, onImageDrop,
}: {
  task: DailyTask;
  project?: Project;
  isSelected: boolean;
  onClick: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onImageDrop: (file: File) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    // Only accept image file drops on the card; task-to-project drags go to P3
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
    if (file) onImageDrop(file);
  };

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/x-task-id", t.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onClick}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "group/row relative flex cursor-grab items-start gap-2.5 rounded-md px-3 py-2.5 transition-colors active:cursor-grabbing",
        "hover:bg-muted/60",
        isSelected && "bg-muted",
        isDragOver && "bg-primary/5 ring-1 ring-primary/30",
      )}
    >
      {/* Drag handle */}
      <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/20 opacity-0 transition-opacity group-hover/row:opacity-100" aria-hidden />
      {/* Checkbox */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-label={t.done ? "未完了に戻す" : "完了にする"}
        className={cn(
          "mt-0.5 size-4 shrink-0 rounded-sm border transition-colors outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring/50",
          t.done ? "border-primary bg-primary" : "border-border hover:border-primary",
        )}
      >
        {t.done && (
          <svg viewBox="0 0 16 16" fill="none" className="size-full p-[2px] text-primary-foreground" aria-hidden>
            <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {t.priority === "high" && !t.done && (
        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive" aria-label="高優先" />
      )}

      <div className="min-w-0 flex-1 pr-14">
        <div className="flex items-center gap-1.5">
          {project && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: project.color ?? "#6366f1" }}
              title={project.name}
            />
          )}
          <p className={cn("text-sm leading-snug", t.done && "line-through text-muted-foreground")}>
            {t.title}
          </p>
        </div>

        {t.imageUrl && (
          <div className="mt-1.5 overflow-hidden rounded">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.imageUrl} alt={t.title} className="h-20 w-full object-cover" loading="lazy" />
          </div>
        )}

        {!t.imageUrl && isDragOver && (
          <div className="mt-1 flex h-10 items-center justify-center rounded border-2 border-dashed border-primary/50">
            <ImageIcon className="size-4 text-primary/50" />
          </div>
        )}

        {t.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {t.tags.map((tag) => <Badge key={tag} variant="outline" size="xs">{tag}</Badge>)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={cn(
        "absolute right-2 top-2 flex items-center gap-0.5",
        "opacity-40 transition-opacity group-hover/row:opacity-100",
      )}>
        <button type="button" onClick={(e) => { e.stopPropagation(); onCopy(); }}
          aria-label="コピー" className="relative rounded p-1 text-muted-foreground hover:text-primary after:absolute after:-inset-2 after:content-['']">
          <Copy className="size-3.5" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="削除" className="relative rounded p-1 text-muted-foreground hover:text-destructive after:absolute after:-inset-2 after:content-['']">
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

// ── Shared: Priority buttons ───────────────────────────────────────────────

function PriorityButtons({
  value, onChange,
}: { value: Priority | ""; onChange: (v: Priority | "") => void }) {
  return (
    <div className="flex gap-1.5">
      {(["high", "medium", "low"] as const).map((p) => (
        <button key={p} type="button" onClick={() => onChange(value === p ? "" : p)}
          className={cn(
            "flex-1 rounded-md border py-1 text-xs font-medium transition-colors",
            value === p
              ? p === "high" ? "border-destructive bg-destructive text-destructive-foreground"
              : p === "medium" ? "border-chart-3 bg-chart-3 text-foreground"
              : "border-muted-foreground bg-muted-foreground/20 text-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-muted",
          )}>
          {PRIORITY_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

// ── Shared: Tag picker ─────────────────────────────────────────────────────

function TagPicker({
  selected, globalTags, onChange,
}: { selected: string[]; globalTags: string[]; onChange: (tags: string[]) => void }) {
  const toggle = (t: string) =>
    onChange(selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {globalTags.map((t) => (
        <button key={t} type="button" onClick={() => toggle(t)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
            selected.includes(t)
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-muted",
          )}>
          {t}
        </button>
      ))}
    </div>
  );
}

// ── Shared: Attendee input ─────────────────────────────────────────────────

function AttendeeInput({
  attendees, contacts, onAdd, onRemove,
}: { attendees: Attendee[]; contacts: Contact[]; onAdd: (a: Attendee) => void; onRemove: (name: string) => void; }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");

  const handleNameChange = (v: string) => {
    setName(v);
    const m = contacts.find((c) => c.name.toLowerCase() === v.toLowerCase());
    if (m?.contact) setContact(m.contact);
    else if (!v) setContact("");
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), contact: contact.trim() || undefined });
    setName(""); setContact("");
  };

  return (
    <div className="flex flex-col gap-2">
      {attendees.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attendees.map((a) => (
            <span key={a.name} className="flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
              {a.name}
              {a.contact && <span className="text-muted-foreground">·{a.contact}</span>}
              <button type="button" onClick={() => onRemove(a.name)} aria-label={`${a.name}を削除`}
                className="ml-0.5 text-muted-foreground/50 hover:text-destructive">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input list="attendee-names-list" value={name} onChange={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder="名前"
            className="h-8 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40" />
          <datalist id="attendee-names-list">
            {contacts.map((c) => <option key={c.name} value={c.name} />)}
          </datalist>
          <Input value={contact} onChange={(e) => setContact(e.target.value)}
            placeholder="連絡先（メール / 電話）" className="h-8 text-xs" />
        </div>
        <Button type="button" variant="outline" size="icon-xs" onClick={handleAdd}
          disabled={!name.trim()} aria-label="参加者を追加" className="self-start">
          <UserPlus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── AddScheduleDialog ──────────────────────────────────────────────────────

type SchedForm = {
  title: string; date: string; endDate: string;
  startTime: string; endTime: string; location: string;
  note: string; priority: Priority | ""; attendees: Attendee[]; tags: string[];
  imageUrl: string;
};

function AddScheduleDialog({
  open, onOpenChange, defaultDate, contacts, globalTags, onAdd,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; defaultDate: string;
  contacts: Contact[]; globalTags: string[];
  onAdd: (s: Omit<Schedule, "id" | "tags" | "done">) => void;
}) {
  const blank = (): SchedForm => ({
    title: "", date: defaultDate, endDate: "",
    startTime: "", endTime: "", location: "",
    note: "", priority: "", attendees: [], tags: [],
    imageUrl: "",
  });
  const [form, setForm] = useState<SchedForm>(blank);

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { if (open) setForm(blank()); }, [open, defaultDate]);

  const set = <K extends keyof SchedForm>(k: K) => (v: SchedForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onAdd({
      title: form.title.trim(),
      date: form.date || defaultDate,
      endDate: form.endDate || undefined,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      location: form.location.trim() || undefined,
      note: form.note.trim() || undefined,
      priority: (form.priority as Priority) || undefined,
      attendees: form.attendees,
      imageUrl: form.imageUrl || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>予定を追加</DialogTitle>
          <DialogDescription>スケジュールに新しい予定を追加します</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="s-title">タイトル *</FieldLabel>
            <Input id="s-title" autoFocus value={form.title}
              onChange={(e) => set("title")(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="例: チームミーティング" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="s-date">開始日</FieldLabel>
              <Input id="s-date" type="date" value={form.date} onChange={(e) => set("date")(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="s-edate">終了日</FieldLabel>
              <Input id="s-edate" type="date" value={form.endDate} onChange={(e) => set("endDate")(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="s-st">開始時刻</FieldLabel>
              <Input id="s-st" type="time" value={form.startTime} onChange={(e) => set("startTime")(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="s-et">終了時刻</FieldLabel>
              <Input id="s-et" type="time" value={form.endTime} onChange={(e) => set("endTime")(e.target.value)} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="s-loc">場所・URL</FieldLabel>
            <Input id="s-loc" value={form.location} onChange={(e) => set("location")(e.target.value)} placeholder="例: 会議室A / Zoom" />
          </Field>
          <Field>
            <FieldLabel>参加者</FieldLabel>
            <AttendeeInput attendees={form.attendees} contacts={contacts}
              onAdd={(a) => setForm((p) => ({ ...p, attendees: [...p.attendees, a] }))}
              onRemove={(name) => setForm((p) => ({ ...p, attendees: p.attendees.filter((a) => a.name !== name) }))} />
          </Field>
          <Field>
            <FieldLabel>優先度</FieldLabel>
            <PriorityButtons value={form.priority} onChange={(v) => setForm((p) => ({ ...p, priority: v }))} />
          </Field>
          {globalTags.length > 0 && (
            <Field>
              <FieldLabel>タグ</FieldLabel>
              <TagPicker selected={form.tags} globalTags={globalTags} onChange={set("tags")} />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="s-note">メモ</FieldLabel>
            <Textarea id="s-note" value={form.note} onChange={(e) => set("note")(e.target.value)}
              placeholder="備考・注意事項" rows={2} className="resize-none" />
          </Field>
          <Field>
            <FieldLabel>画像</FieldLabel>
            <DialogImageZone value={form.imageUrl} onChange={set("imageUrl")} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">キャンセル</Button>} />
          <Button onClick={handleSubmit} disabled={!form.title.trim()}>追加</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── DialogImageZone ─────────────────────────────────────────────────────────

function DialogImageZone({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const MAX_BYTES = 500 * 1024;

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_BYTES) {
      toast.warning(`画像が大きすぎます（${Math.round(file.size / 1024)} KB）。500 KB 以下の画像をお使いください。`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  if (value) {
    return (
      <div className="group/img relative overflow-hidden rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="添付画像" className="h-32 w-full object-cover" />
        <button type="button" onClick={() => onChange("")}
          aria-label="画像を削除"
          className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover/img:opacity-100 hover:bg-destructive">
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setIsDragOver(false);
          const f = [...e.dataTransfer.files].find((fi) => fi.type.startsWith("image/"));
          if (f) processFile(f);
        }}
        className={cn(
          "flex h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed transition-colors",
          isDragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:border-primary/40",
        )}
      >
        <ImageIcon className={cn("size-5", isDragOver ? "text-primary" : "text-muted-foreground/40")} />
        <p className="text-xs text-muted-foreground">
          {isDragOver ? "ドロップして追加" : "クリックまたはドラッグで画像を追加"}
        </p>
      </div>
    </>
  );
}

// ── AddTaskDialog ──────────────────────────────────────────────────────────

type TaskForm = {
  title: string; date: string; note: string;
  priority: Priority | ""; projectId: string; tags: string[];
};

function AddTaskDialog({
  open, onOpenChange, defaultDate, projects, globalTags, onAdd,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; defaultDate: string;
  projects: Project[]; globalTags: string[];
  onAdd: (t: Omit<DailyTask, "id" | "tags" | "done">) => void;
}) {
  const blank = (): TaskForm => ({
    title: "", date: defaultDate, note: "", priority: "", projectId: "", tags: [],
  });
  const [form, setForm] = useState<TaskForm>(blank);

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { if (open) setForm(blank()); }, [open, defaultDate]);

  const set = <K extends keyof TaskForm>(k: K) => (v: TaskForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onAdd({
      title: form.title.trim(),
      date: form.date || defaultDate,
      note: form.note.trim() || undefined,
      priority: (form.priority as Priority) || undefined,
      projectId: form.projectId || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>タスクを追加</DialogTitle>
          <DialogDescription>今日やることを追加します</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="t-title">タイトル *</FieldLabel>
            <Input id="t-title" autoFocus value={form.title}
              onChange={(e) => set("title")(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="例: 提案書を確認する" />
          </Field>
          {projects.length > 0 && (
            <Field>
              <FieldLabel htmlFor="t-proj">プロジェクト</FieldLabel>
              <select id="t-proj" value={form.projectId} onChange={(e) => set("projectId")(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40">
                <option value="">（単独タスク）</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          )}
          <Field>
            <FieldLabel>優先度</FieldLabel>
            <PriorityButtons value={form.priority} onChange={(v) => setForm((p) => ({ ...p, priority: v }))} />
          </Field>
          {globalTags.length > 0 && (
            <Field>
              <FieldLabel>タグ</FieldLabel>
              <TagPicker selected={form.tags} globalTags={globalTags} onChange={set("tags")} />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="t-note">メモ</FieldLabel>
            <Input id="t-note" value={form.note} onChange={(e) => set("note")(e.target.value)} placeholder="補足・注意事項" />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">キャンセル</Button>} />
          <Button onClick={handleSubmit} disabled={!form.title.trim()}>追加</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
