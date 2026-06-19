"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";

import { z } from "zod";
import { toast } from "sonner";
import {
  type Schedule,
  type DailyTask,
  type SavedIdea,
  type Contact,
  type Project,
  type ScheduleWorkspaceData,
  scheduleWorkspaceDataSchema,
  scheduleSchema,
  dailyTaskSchema,
  savedIdeaSchema,
  contactSchema,
  projectSchema,
} from "@/lib/schedule-schema";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { CalendarPane } from "@/components/schedule-workspace/CalendarPane";
import { TodayPane } from "@/components/schedule-workspace/TodayPane";
import { DetailPane } from "@/components/schedule-workspace/DetailPane";
import { IdeaPane } from "@/components/schedule-workspace/IdeaPane";
import { OnboardingDialog } from "@/components/schedule-workspace/OnboardingDialog";

// ===== Types =====

export type SelectedItem =
  | { kind: "schedule"; data: Schedule }
  | { kind: "task"; data: DailyTask }
  | { kind: "project"; data: Project }
  | { kind: "idea"; data: SavedIdea }
  | null;

type Props = {
  initialData: ScheduleWorkspaceData;
};

const LS_KEY = "schedule-workspace-v3";

// ===== Component =====

export function ScheduleWorkspace({ initialData }: Props) {
  // ── localStorage 一括読み込み（lazy init で同期的に実施） ──────────────
  const [[loadedData, loadStatus]] = useState<
    [ScheduleWorkspaceData, "ok" | "warn" | "error"]
  >(() => loadInitialDataSync(initialData));

  const [schedules, setSchedules] = useState<Schedule[]>(loadedData.schedules);
  const [tasks, setTasks] = useState<DailyTask[]>(loadedData.tasks);
  const [savedIdeas, setSavedIdeas] = useState<SavedIdea[]>(loadedData.savedIdeas);
  const [contacts, setContacts] = useState<Contact[]>(loadedData.contacts);
  const [projects, setProjects] = useState<Project[]>(loadedData.projects);
  const [globalTags, setGlobalTags] = useState<string[]>(loadedData.globalTags);

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);

  // ── マウント後に通知だけ行う（setState は呼ばない） ──────────────────
  useEffect(() => {
    if (loadStatus === "warn") {
      toast.warning("一部のデータ形式が古いため、読み込めなかった項目があります。");
    } else if (loadStatus === "error") {
      toast.error("保存データの読み込みに失敗しました。データが壊れている可能性があります。");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ストレージ上限警告: 4 MB 超えたら imageUrl を除外して保存
  const storageWarnedRef = useRef(false);

  useEffect(() => {
    const MAX_LS_BYTES = 4 * 1024 * 1024; // 4 MB
    try {
      const data = { schedules, tasks, savedIdeas, contacts, projects, globalTags };
      const raw = JSON.stringify(data);

      if (raw.length > MAX_LS_BYTES) {
        const stripped = {
          ...data,
          schedules: schedules.map(({ imageUrl: _i, ...s }) => s),
          tasks: tasks.map(({ imageUrl: _i, ...t }) => t),
          projects: projects.map(({ imageUrl: _i, ...p }) => p),
        };
        localStorage.setItem(LS_KEY, JSON.stringify(stripped));
        if (!storageWarnedRef.current) {
          toast.warning(
            "ストレージの上限に近いため、画像を省略して保存しました。不要な画像は削除してください。",
          );
          storageWarnedRef.current = true;
        }
      } else {
        localStorage.setItem(LS_KEY, raw);
        storageWarnedRef.current = false;
      }
    } catch { /* ignore */ }
  }, [schedules, tasks, savedIdeas, contacts, projects, globalTags]);

  // ── Derived ────────────────────────────────────────

  const schedulesForDate = schedules.filter((s) =>
    isSameDay(parseISO(s.date), selectedDate),
  );
  const tasksForDate = tasks.filter(
    (t) => t.date && isSameDay(parseISO(t.date), selectedDate),
  );

  const syncedSelectedItem: SelectedItem = (() => {
    if (!selectedItem) return null;
    if (selectedItem.kind === "schedule") {
      const u = schedules.find((s) => s.id === selectedItem.data.id);
      return u ? { kind: "schedule", data: u } : null;
    }
    if (selectedItem.kind === "task") {
      const u = tasks.find((t) => t.id === selectedItem.data.id);
      return u ? { kind: "task", data: u } : null;
    }
    if (selectedItem.kind === "project") {
      const u = projects.find((p) => p.id === selectedItem.data.id);
      return u ? { kind: "project", data: u } : null;
    }
    if (selectedItem.kind === "idea") {
      const u = savedIdeas.find((i) => i.id === selectedItem.data.id);
      return u ? { kind: "idea", data: u } : null;
    }
    return null;
  })();

  // ── Contacts ──────────────────────────────────────

  const mergeContacts = useCallback((incoming: Contact[]) => {
    setContacts((prev) => {
      const map = new Map(prev.map((c) => [c.name, c]));
      for (const c of incoming) {
        if (c.name.trim())
          map.set(c.name, { name: c.name, contact: c.contact ?? map.get(c.name)?.contact });
      }
      return Array.from(map.values());
    });
  }, []);

  // ── Schedules ─────────────────────────────────────

  const addSchedule = useCallback((s: Omit<Schedule, "id" | "tags" | "done">) => {
    const n: Schedule = { ...s, id: `s-${Date.now()}`, tags: [], done: false };
    setSchedules((prev) => [...prev, n]);
    if (s.attendees?.length) mergeContacts(s.attendees);
  }, [mergeContacts]);

  const updateSchedule = useCallback((id: string, patch: Partial<Schedule>) => {
    setSchedules((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
    if (patch.attendees?.length) mergeContacts(patch.attendees);
  }, [mergeContacts]);

  const deleteSchedule = useCallback((id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    setSelectedItem((prev) => prev?.kind === "schedule" && prev.data.id === id ? null : prev);
  }, []);

  const copySchedule = useCallback((id: string) => {
    setSchedules((prev) => {
      const src = prev.find((s) => s.id === id);
      if (!src) return prev;
      return [...prev, { ...src, id: `s-${Date.now()}`, title: `${src.title}（コピー）` }];
    });
  }, []);

  // ── Tasks ──────────────────────────────────────────

  const addTask = useCallback((t: Omit<DailyTask, "id" | "tags" | "done">) => {
    setTasks((prev) => [...prev, { ...t, id: `t-${Date.now()}`, tags: [], done: false }]);
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<DailyTask>) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedItem((prev) => prev?.kind === "task" && prev.data.id === id ? null : prev);
  }, []);

  const copyTask = useCallback((id: string) => {
    setTasks((prev) => {
      const src = prev.find((t) => t.id === id);
      if (!src) return prev;
      return [...prev, { ...src, id: `t-${Date.now()}`, title: `${src.title}（コピー）`, done: false }];
    });
  }, []);

  // ── Ideas ──────────────────────────────────────────

  const saveIdea = useCallback((idea: Omit<SavedIdea, "id" | "tags">) => {
    setSavedIdeas((prev) => [{ ...idea, id: `idea-${Date.now()}`, tags: [] }, ...prev]);
  }, []);

  const updateIdea = useCallback((id: string, patch: Partial<SavedIdea>) => {
    setSavedIdeas((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
  }, []);

  const deleteIdea = useCallback((id: string) => {
    setSavedIdeas((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // ── Projects ──────────────────────────────────────

  const addProject = useCallback((p: Omit<Project, "id">) => {
    setProjects((prev) => [...prev, { ...p, id: `p-${Date.now()}` }]);
  }, []);

  const updateProject = useCallback((id: string, patch: Partial<Project>) => {
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setSelectedItem((prev) => prev?.kind === "project" && prev.data.id === id ? null : prev);
  }, []);

  // ── Global Tags ───────────────────────────────────

  const addGlobalTag = useCallback((tag: string) => {
    setGlobalTags((prev) => {
      if (prev.includes(tag) || prev.length >= 20) return prev;
      return [...prev, tag];
    });
  }, []);

  const deleteGlobalTag = useCallback((tag: string) => {
    setGlobalTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  // ── Date selection ────────────────────────────────

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setSelectedItem(null);
  }, []);

  // ── Render ────────────────────────────────────────

  return (
    <SidebarProvider
      defaultOpen
      className="h-screen w-full overflow-hidden bg-background text-foreground"
    >
      {/* P1: カレンダー + プロジェクト + タグ（サイドバー） */}
      <CalendarPane
        schedules={schedules}
        tasks={tasks}
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        projects={projects}
        globalTags={globalTags}
        selectedItem={syncedSelectedItem}
        onSelectProject={(p) => setSelectedItem({ kind: "project", data: p })}
        onAddProject={addProject}
        onDeleteProject={deleteProject}
        onAddGlobalTag={addGlobalTag}
        onDeleteGlobalTag={deleteGlobalTag}
      />

      {/* P2〜P4: リサイズ可能 */}
      <SidebarInset className="flex min-w-0 flex-col overflow-hidden bg-background">
        <PanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <Panel defaultSize="34%" minSize="20%" maxSize="55%">
            <TodayPane
              date={selectedDate}
              schedules={schedulesForDate}
              tasks={tasksForDate}
              selectedItem={syncedSelectedItem}
              contacts={contacts}
              projects={projects}
              globalTags={globalTags}
              onSelectItem={setSelectedItem}
              onAddSchedule={addSchedule}
              onAddTask={addTask}
              onToggleTask={toggleTask}
              onDeleteSchedule={deleteSchedule}
              onDeleteTask={deleteTask}
              onCopySchedule={copySchedule}
              onCopyTask={copyTask}
              onUpdateSchedule={updateSchedule}
              onUpdateTask={updateTask}
            />
          </Panel>

          <ResizeHandle />

          <Panel defaultSize="32%" minSize="20%" maxSize="50%">
            <DetailPane
              selectedItem={syncedSelectedItem}
              contacts={contacts}
              projects={projects}
              globalTags={globalTags}
              tasks={tasks}
              savedIdeas={savedIdeas}
              onUpdateSchedule={updateSchedule}
              onUpdateTask={updateTask}
              onUpdateProject={updateProject}
              onUpdateIdea={updateIdea}
            />
          </Panel>

          <ResizeHandle />

          <Panel defaultSize="34%" minSize="24%">
            <IdeaPane
              savedIdeas={savedIdeas}
              projects={projects}
              onSaveIdea={saveIdea}
              onUpdateIdea={updateIdea}
              onDeleteIdea={deleteIdea}
              onSelectIdea={(idea) => setSelectedItem({ kind: "idea", data: idea })}
            />
          </Panel>
        </PanelGroup>
      </SidebarInset>

      <OnboardingDialog />
    </SidebarProvider>
  );
}

function ResizeHandle() {
  return (
    <PanelResizeHandle className="group relative flex w-1.5 items-center justify-center bg-border transition-colors hover:bg-primary/20 data-[resize-handle-active]:bg-primary/30">
      <div className="flex flex-col items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-data-[resize-handle-active]:opacity-100">
        <span className="size-1 rounded-full bg-muted-foreground/50" />
        <span className="size-1 rounded-full bg-muted-foreground/50" />
        <span className="size-1 rounded-full bg-muted-foreground/50" />
      </div>
    </PanelResizeHandle>
  );
}

// ── localStorage 一括読み込みヘルパー（コンポーネント外・SSR 安全） ─────
function loadInitialDataSync(
  fallback: ScheduleWorkspaceData,
): [ScheduleWorkspaceData, "ok" | "warn" | "error"] {
  if (typeof window === "undefined") return [fallback, "ok"]; // SSR
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return [fallback, "ok"];
    const raw: unknown = JSON.parse(stored);
    const result = scheduleWorkspaceDataSchema.safeParse(raw);
    if (result.success) return [result.data, "ok"];

    // スキーマ不一致: フィールドごとに部分復元
    const p = raw as Record<string, unknown>;
    const partial: Partial<ScheduleWorkspaceData> = {};
    const schArr = z.array(scheduleSchema).safeParse(p.schedules);
    const taskArr = z.array(dailyTaskSchema).safeParse(p.tasks);
    const ideaArr = z.array(savedIdeaSchema).safeParse(p.savedIdeas);
    const contArr = z.array(contactSchema).safeParse(p.contacts);
    const projArr = z.array(projectSchema).safeParse(p.projects);
    const tagArr = z.array(z.string()).safeParse(p.globalTags);
    if (schArr.success) partial.schedules = schArr.data;
    if (taskArr.success) partial.tasks = taskArr.data;
    if (ideaArr.success) partial.savedIdeas = ideaArr.data;
    if (contArr.success) partial.contacts = contArr.data;
    if (projArr.success) partial.projects = projArr.data;
    if (tagArr.success) partial.globalTags = tagArr.data;
    return [{ ...fallback, ...partial }, "warn"];
  } catch {
    return [fallback, "error"];
  }
}
