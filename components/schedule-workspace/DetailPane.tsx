"use client";

import { useCallback, useState } from "react";
import {
  CalendarDays, Clock, ExternalLink, FolderOpen, Image as ImageIcon,
  Link, MapPin, MessageSquare, Sparkles, StickyNote, Tag, Trash2, UserPlus, X,
} from "lucide-react";

import {
  type Schedule, type DailyTask, type Attendee, type Contact,
  type Project, type SavedIdea, type Priority, PRIORITY_LABELS,
} from "@/lib/schedule-schema";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { SelectedItem } from "@/components/schedule-workspace/ScheduleWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { InlineTextField } from "@/components/primitives/InlineTextField";
import { InlineTextareaField } from "@/components/primitives/InlineTextareaField";
import { InlineFieldRow } from "@/components/primitives/InlineFieldRow";
import { mapsUrl } from "@/lib/maps";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type DetailPaneProps = {
  selectedItem: SelectedItem;
  contacts: Contact[];
  projects: Project[];
  globalTags: string[];
  tasks: DailyTask[];
  savedIdeas: SavedIdea[];
  onUpdateSchedule: (id: string, patch: Partial<Schedule>) => void;
  onUpdateTask: (id: string, patch: Partial<DailyTask>) => void;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
  onUpdateIdea: (id: string, patch: Partial<SavedIdea>) => void;
};

export function DetailPane({
  selectedItem, contacts, projects, globalTags, tasks, savedIdeas,
  onUpdateSchedule, onUpdateTask, onUpdateProject, onUpdateIdea,
}: DetailPaneProps) {
  return (
    <section className="flex h-full w-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
        <h2 className="text-sm font-semibold">
          {selectedItem?.kind === "schedule" ? "予定の詳細"
            : selectedItem?.kind === "task" ? "タスクの詳細"
            : selectedItem?.kind === "project" ? "プロジェクト詳細"
            : selectedItem?.kind === "idea" ? "アイデアの詳細"
            : "詳細"}
        </h2>
        {selectedItem && (selectedItem.kind === "schedule" || selectedItem.kind === "task") && (
          <PriorityBadge priority={selectedItem.data.priority} />
        )}
      </header>

      {selectedItem === null ? (
        <EmptyState />
      ) : selectedItem.kind === "schedule" ? (
        <ScheduleDetail
          key={selectedItem.data.id}
          schedule={selectedItem.data}
          contacts={contacts}
          globalTags={globalTags}
          onUpdate={(patch) => onUpdateSchedule(selectedItem.data.id, patch)}
        />
      ) : selectedItem.kind === "task" ? (
        <TaskDetail
          key={selectedItem.data.id}
          task={selectedItem.data}
          projects={projects}
          globalTags={globalTags}
          onUpdate={(patch) => onUpdateTask(selectedItem.data.id, patch)}
        />
      ) : selectedItem.kind === "idea" ? (
        <IdeaDetail
          key={selectedItem.data.id}
          idea={selectedItem.data}
          projects={projects}
          globalTags={globalTags}
          onUpdate={(patch) => onUpdateIdea(selectedItem.data.id, patch)}
        />
      ) : (
        <ProjectDetail
          key={selectedItem.data.id}
          project={selectedItem.data}
          tasks={tasks}
          savedIdeas={savedIdeas}
          onUpdate={(patch) => onUpdateProject(selectedItem.data.id, patch)}
          onUpdateTask={onUpdateTask}
          onUpdateIdea={onUpdateIdea}
        />
      )}
    </section>
  );
}

// 笏笏 Empty 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <StickyNote className="size-5 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">詳細を表示</p>
        <p className="text-xs text-muted-foreground">予定・タスク・プロジェクト・アイデアを選択してください</p>
      </div>
    </div>
  );
}

// 笏笏 Priority badge 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

function PriorityBadge({ priority }: { priority?: Priority }) {
  if (!priority) return null;
  return (
    <Badge variant={priority === "high" ? "destructive" : "secondary"} size="xs">
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

// 笏笏 Priority selector 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

function PrioritySelector({ value, onChange }: { value?: Priority; onChange: (p?: Priority) => void }) {
  return (
    <div className="flex gap-1.5">
      {(["high", "medium", "low"] as const).map((p) => (
        <button key={p} type="button" onClick={() => onChange(value === p ? undefined : p)}
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

// 笏笏 Tag picker 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

function TagPicker({ selected, globalTags, onChange }: { selected: string[]; globalTags: string[]; onChange: (t: string[]) => void }) {
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

// 笏笏 Image drop zone 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

function ImageDropZone({
  imageUrl, onDrop, onRemove,
}: { imageUrl?: string; onDrop: (url: string) => void; onRemove: () => void }) {
  const [isDragOver, setIsDragOver] = useState(false);

  const MAX_IMAGE_BYTES = 500 * 1024; // 500 KB → Base64 で約 670 KB

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.warning(
        `画像が大きすぎます（${Math.round(file.size / 1024)} KB）。500 KB 以下の画像をお使いください。`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => onDrop(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  if (imageUrl) {
    return (
      <div className="group/img relative overflow-hidden rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="添付画像" className="h-48 w-full object-cover" />
        <button type="button" onClick={onRemove}
          aria-label="画像を削除"
          className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover/img:opacity-100 hover:bg-destructive">
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "flex h-28 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors",
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/30 hover:border-primary/40",
      )}
    >
      <ImageIcon className={cn("size-6", isDragOver ? "text-primary" : "text-muted-foreground/40")} />
      <p className="text-xs text-muted-foreground">
        {isDragOver ? "ドロップして追加" : "画像をここにドラッグ"}
      </p>
    </div>
  );
}

// 笏笏 Attendees editor 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

function AttendeesEditor({
  attendees, contacts, onChange,
}: { attendees: Attendee[]; contacts: Contact[]; onChange: (a: Attendee[]) => void }) {
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
    onChange([...attendees, { name: name.trim(), contact: contact.trim() || undefined }]);
    setName(""); setContact("");
  };

  return (
    <div className="flex flex-col gap-2">
      {attendees.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {attendees.map((a) => (
            <div key={a.name} className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">{a.name}</p>
                {a.contact && <p className="text-xs text-muted-foreground">{a.contact}</p>}
              </div>
              <button type="button" onClick={() => onChange(attendees.filter((x) => x.name !== a.name))}
                aria-label={`${a.name}を削除`} className="text-muted-foreground/40 hover:text-destructive">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input list="detail-attendee-list" value={name} onChange={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder="名前を入力…"
            className="h-8 w-full rounded-md border border-input bg-card px-3 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40" />
          <datalist id="detail-attendee-list">
            {contacts.map((c) => <option key={c.name} value={c.name} />)}
          </datalist>
          {name && (
            <Input value={contact} onChange={(e) => setContact(e.target.value)}
              placeholder="連絡先（メール / 電話等）" className="h-7 text-xs" />
          )}
        </div>
        <Button type="button" variant="outline" size="icon-xs" onClick={handleAdd}
          disabled={!name.trim()} aria-label="追加" className="self-start">
          <UserPlus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// 笏笏 URL list editor 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

function UrlListEditor({ urls, onChange }: { urls: string[]; onChange: (u: string[]) => void }) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const v = input.trim();
    if (!v || urls.includes(v)) return;
    onChange([...urls, v]);
    setInput("");
  };

  return (
    <div className="flex flex-col gap-2">
      {urls.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {urls.map((u) => (
            <div key={u} className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
              <a href={u} target="_blank" rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-xs text-primary hover:underline">
                {u}
              </a>
              <button type="button" onClick={() => onChange(urls.filter((x) => x !== u))}
                aria-label="URLを削除" className="text-muted-foreground/40 hover:text-destructive">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="https://..."
          className="h-8 flex-1 text-xs"
        />
        <Button type="button" variant="outline" size="icon-xs" onClick={handleAdd}
          disabled={!input.trim()} aria-label="URL追加" className="shrink-0">
          <Link className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// 笏笏 Project linked items drop zone 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

type LinkedItemsProps = {
  projectId: string;
  tasks: DailyTask[];
  savedIdeas: SavedIdea[];
  onUpdateTask: (id: string, patch: Partial<DailyTask>) => void;
  onUpdateIdea: (id: string, patch: Partial<SavedIdea>) => void;
};

function LinkedItemsSection({
  projectId, tasks, savedIdeas, onUpdateTask, onUpdateIdea,
}: LinkedItemsProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const linkedTasks = tasks.filter((t) => t.projectId === projectId);
  const linkedIdeas = savedIdeas.filter((i) => i.projectId === projectId);

  const handleDragOver = (e: React.DragEvent) => {
    const hasTask = e.dataTransfer.types.includes("text/x-task-id");
    const hasIdea = e.dataTransfer.types.includes("text/x-idea-id");
    if (hasTask || hasIdea) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData("text/x-task-id");
    const ideaId = e.dataTransfer.getData("text/x-idea-id");
    if (taskId) onUpdateTask(taskId, { projectId });
    if (ideaId) onUpdateIdea(ideaId, { projectId });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/20 hover:border-primary/30",
        )}
      >
        <FolderOpen className={cn("size-4", isDragOver ? "text-primary" : "text-muted-foreground/40")} />
        <p className="text-xs text-muted-foreground">
          {isDragOver ? "ここにドロップ" : "タスク・アイデアをここにドラッグして追加"}
        </p>
      </div>

      {/* Linked tasks */}
      {linkedTasks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">タスク</p>
          {linkedTasks.map((t) => (
            <div key={t.id}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
              <div className={cn("min-w-0 flex-1", t.done && "line-through text-muted-foreground")}>
                <p className="truncate text-xs font-medium">{t.title}</p>
                {t.date && <p className="text-xs text-muted-foreground">{t.date}</p>}
              </div>
              <button type="button"
                onClick={() => onUpdateTask(t.id, { projectId: undefined })}
                aria-label={`${t.title}をプロジェクトから外す`}
                className="shrink-0 text-muted-foreground/40 hover:text-destructive">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Linked ideas */}
      {linkedIdeas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">アイデア</p>
          {linkedIdeas.map((i) => (
            <div key={i.id}
              className="flex items-start gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
              <p className="min-w-0 flex-1 truncate text-xs">{i.content}</p>
              <button type="button"
                onClick={() => onUpdateIdea(i.id, { projectId: undefined })}
                aria-label="プロジェクトから外す"
                className="mt-0.5 shrink-0 text-muted-foreground/40 hover:text-destructive">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {linkedTasks.length === 0 && linkedIdeas.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">まだ紐づけられた項目はありません</p>
      )}
    </div>
  );
}

// 笏笏 Schedule Detail 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

function ScheduleDetail({ schedule: s, contacts, globalTags, onUpdate }: {
  schedule: Schedule; contacts: Contact[]; globalTags: string[];
  onUpdate: (patch: Partial<Schedule>) => void;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-5 px-4 py-5">
        <InlineTextField value={s.title}
          onSave={(v) => v.trim() && onUpdate({ title: v.trim() })}
          ariaLabel="タイトル" placeholder="タイトル"
          className={cn("h-9 text-base font-semibold", s.done && "line-through text-muted-foreground")} />

        <Separator />

        <ImageDropZone
          imageUrl={s.imageUrl}
          onDrop={(url) => onUpdate({ imageUrl: url })}
          onRemove={() => onUpdate({ imageUrl: undefined })}
        />

        <dl className="flex flex-col gap-4 text-sm">
          <InlineFieldRow label="開始日時">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
                <InlineTextField value={s.date} onSave={(v) => v && onUpdate({ date: v })}
                  ariaLabel="開始日" placeholder="YYYY-MM-DD" className="w-28" />
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                <InlineTextField value={s.startTime ?? ""} onSave={(v) => onUpdate({ startTime: v || undefined })}
                  ariaLabel="開始時刻" placeholder="09:00" className="w-16" />
              </div>
            </div>
          </InlineFieldRow>

          <InlineFieldRow label="終了日時">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
                <InlineTextField value={s.endDate ?? ""} onSave={(v) => onUpdate({ endDate: v || undefined })}
                  ariaLabel="終了日" placeholder="YYYY-MM-DD（複数日可）" className="w-28" />
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                <InlineTextField value={s.endTime ?? ""} onSave={(v) => onUpdate({ endTime: v || undefined })}
                  ariaLabel="終了時刻" placeholder="10:00" className="w-16" />
              </div>
            </div>
          </InlineFieldRow>

          <InlineFieldRow label="場所">
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
              <InlineTextField value={s.location ?? ""} onSave={(v) => onUpdate({ location: v || undefined })}
                ariaLabel="場所" placeholder="場所名・URL" className="flex-1" />
              {s.location && (
                <a
                  href={mapsUrl(s.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-0.5 text-xs text-primary hover:underline"
                  aria-label="Google マップで見る"
                >
                  <ExternalLink className="size-3" />
                  地図
                </a>
              )}
            </div>
          </InlineFieldRow>

          <InlineFieldRow label="参加者">
            <AttendeesEditor attendees={s.attendees} contacts={contacts}
              onChange={(attendees) => onUpdate({ attendees })} />
          </InlineFieldRow>

          <InlineFieldRow label="メモ">
            <InlineTextareaField value={s.note ?? ""} onSave={(v) => onUpdate({ note: v || undefined })}
              ariaLabel="メモ" placeholder="備考" />
          </InlineFieldRow>

          <InlineFieldRow label="優先度">
            <PrioritySelector value={s.priority} onChange={(p) => onUpdate({ priority: p })} />
          </InlineFieldRow>

          {globalTags.length > 0 && (
            <InlineFieldRow label="タグ">
              <TagPicker selected={s.tags} globalTags={globalTags}
                onChange={(tags) => onUpdate({ tags })} />
            </InlineFieldRow>
          )}

          <InlineFieldRow label="状態">
            <button type="button" onClick={() => onUpdate({ done: !s.done })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                s.done ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}>
              {s.done ? "✓ 完了" : "未完了"}
            </button>
          </InlineFieldRow>
        </dl>
      </div>
    </ScrollArea>
  );
}

// 笏笏 Task Detail 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

function TaskDetail({ task: t, projects, globalTags, onUpdate }: {
  task: DailyTask; projects: Project[]; globalTags: string[];
  onUpdate: (patch: Partial<DailyTask>) => void;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-5 px-4 py-5">
        <InlineTextField value={t.title}
          onSave={(v) => v.trim() && onUpdate({ title: v.trim() })}
          ariaLabel="タイトル" placeholder="タイトル"
          className={cn("h-9 text-base font-semibold", t.done && "line-through text-muted-foreground")} />

        <Separator />

        <ImageDropZone
          imageUrl={t.imageUrl}
          onDrop={(url) => onUpdate({ imageUrl: url })}
          onRemove={() => onUpdate({ imageUrl: undefined })}
        />

        <dl className="flex flex-col gap-4 text-sm">
          <InlineFieldRow label="日付">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
              <InlineTextField value={t.date ?? ""} onSave={(v) => onUpdate({ date: v || undefined })}
                ariaLabel="日付" placeholder="YYYY-MM-DD" />
            </div>
          </InlineFieldRow>

          {projects.length > 0 && (
            <InlineFieldRow label="プロジェクト">
              <select value={t.projectId ?? ""} onChange={(e) => onUpdate({ projectId: e.target.value || undefined })}
                className="h-8 w-full rounded-md border border-input bg-card px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring/40">
                <option value="">（未分類タスク）</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </InlineFieldRow>
          )}

          <InlineFieldRow label="メモ">
            <InlineTextareaField value={t.note ?? ""} onSave={(v) => onUpdate({ note: v || undefined })}
              ariaLabel="メモ" placeholder="補足" />
          </InlineFieldRow>

          <InlineFieldRow label="優先度">
            <PrioritySelector value={t.priority} onChange={(p) => onUpdate({ priority: p })} />
          </InlineFieldRow>

          {globalTags.length > 0 && (
            <InlineFieldRow label="タグ">
              <TagPicker selected={t.tags} globalTags={globalTags}
                onChange={(tags) => onUpdate({ tags })} />
            </InlineFieldRow>
          )}

          <InlineFieldRow label="状態">
            <button type="button" onClick={() => onUpdate({ done: !t.done })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                t.done ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}>
              {t.done ? "✓ 完了" : "未完了"}
            </button>
          </InlineFieldRow>
        </dl>
      </div>
    </ScrollArea>
  );
}

// 笏笏 Project Detail 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

function ProjectDetail({ project: p, tasks, savedIdeas, onUpdate, onUpdateTask, onUpdateIdea }: {
  project: Project;
  tasks: DailyTask[];
  savedIdeas: SavedIdea[];
  onUpdate: (patch: Partial<Project>) => void;
  onUpdateTask: (id: string, patch: Partial<DailyTask>) => void;
  onUpdateIdea: (id: string, patch: Partial<SavedIdea>) => void;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-5 px-4 py-5">
        {/* Name with color dot */}
        <div className="flex items-center gap-2">
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: p.color ?? "#6366f1" }}
          />
          <InlineTextField value={p.name}
            onSave={(v) => v.trim() && onUpdate({ name: v.trim() })}
            ariaLabel="プロジェクト名" placeholder="プロジェクト名"
            className="h-9 flex-1 text-base font-semibold" />
        </div>

        <Separator />

        {/* Project image */}
        <ImageDropZone
          imageUrl={p.imageUrl}
          onDrop={(url) => onUpdate({ imageUrl: url })}
          onRemove={() => onUpdate({ imageUrl: undefined })}
        />

        <dl className="flex flex-col gap-4 text-sm">
          <InlineFieldRow label="開始日">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
              <InlineTextField value={p.startDate ?? ""} onSave={(v) => onUpdate({ startDate: v || undefined })}
                ariaLabel="開始日" placeholder="YYYY-MM-DD" className="w-32" />
            </div>
          </InlineFieldRow>

          <InlineFieldRow label="終了日">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
              <InlineTextField value={p.endDate ?? ""} onSave={(v) => onUpdate({ endDate: v || undefined })}
                ariaLabel="終了日" placeholder="YYYY-MM-DD" className="w-32" />
            </div>
          </InlineFieldRow>

          <InlineFieldRow label="概要">
            <InlineTextareaField value={p.summary ?? ""} onSave={(v) => onUpdate({ summary: v || undefined })}
              ariaLabel="概要" placeholder="プロジェクトの概要" />
          </InlineFieldRow>

          <InlineFieldRow label="目標">
            <InlineTextareaField value={p.goal ?? ""} onSave={(v) => onUpdate({ goal: v || undefined })}
              ariaLabel="目標" placeholder="達成したい目標" />
          </InlineFieldRow>

          <InlineFieldRow label="詳細メモ">
            <InlineTextareaField value={p.note ?? ""} onSave={(v) => onUpdate({ note: v || undefined })}
              ariaLabel="詳細メモ" placeholder="詳細・注意事項" />
          </InlineFieldRow>

          <InlineFieldRow label="URL">
            <UrlListEditor
              urls={p.urls}
              onChange={(urls) => onUpdate({ urls })}
            />
          </InlineFieldRow>
        </dl>

        <Separator />

        {/* Linked tasks & ideas */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">紐づけられた項目</p>
          <p className="text-xs text-muted-foreground">
            P2のタスクカードやP4のアイデアカードをドラッグしてここに追加できます
          </p>
          <LinkedItemsSection
            projectId={p.id}
            tasks={tasks}
            savedIdeas={savedIdeas}
            onUpdateTask={onUpdateTask}
            onUpdateIdea={onUpdateIdea}
          />
        </div>
      </div>
    </ScrollArea>
  );
}

// 笏笏 Idea Detail 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

function IdeaDetail({ idea: i, projects, globalTags, onUpdate }: {
  idea: SavedIdea;
  projects: Project[];
  globalTags: string[];
  onUpdate: (patch: Partial<SavedIdea>) => void;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-5 px-4 py-5">
        {/* Content */}
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <InlineTextareaField
            value={i.content}
            onSave={(v) => v.trim() && onUpdate({ content: v.trim() })}
            ariaLabel="アイデア内容"
            placeholder="アイデアの内容"
          />
        </div>

        <Separator />

        {/* AI response (readonly) */}
        {i.aiResponse && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MessageSquare className="size-3" />AI の応答
            </p>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs leading-relaxed text-foreground">
              {i.aiResponse}
            </div>
          </div>
        )}

        <dl className="flex flex-col gap-4 text-sm">
          {/* Category */}
          <InlineFieldRow label="カテゴリ">
            <InlineTextField
              value={i.category ?? ""}
              onSave={(v) => onUpdate({ category: v || undefined })}
              ariaLabel="カテゴリ"
              placeholder="例: アイデア / 調べもの"
            />
          </InlineFieldRow>

          {/* Project */}
          {projects.length > 0 && (
            <InlineFieldRow label="プロジェクト">
              <select
                value={i.projectId ?? ""}
                onChange={(e) => onUpdate({ projectId: e.target.value || undefined })}
                className="h-8 w-full rounded-md border border-input bg-card px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                <option value="">（未紐づけ）</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </InlineFieldRow>
          )}

          {/* Tags */}
          {globalTags.length > 0 && (
            <InlineFieldRow label="タグ">
              <TagPicker selected={i.tags} globalTags={globalTags}
                onChange={(tags) => onUpdate({ tags })} />
            </InlineFieldRow>
          )}

          {/* Created at */}
          <InlineFieldRow label="保存日時">
            <p className="text-xs text-muted-foreground">
              {format(new Date(i.createdAt), "yyyy/M/d HH:mm", { locale: ja })}
            </p>
          </InlineFieldRow>
        </dl>

        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MessageSquare className="size-3 shrink-0" />
            さらに深掘りする場合は、P4（アイデアペイン）のチャットに話しかけてください
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}
