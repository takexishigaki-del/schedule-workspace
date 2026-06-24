"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isSameDay, parseISO } from "date-fns";
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

// localStorage key: schedules/tasks は DB 管理に移行したため v4 に更新
const LS_KEY = "schedule-workspace-v4";

// ===== API helpers (fire-and-forget) =====

function apiPost(url: string, data: unknown): void {
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).catch(() => toast.error("サーバーへの保存に失敗しました。"));
}

function apiPatch(url: string, data: unknown): void {
  fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).catch(() => toast.error("サーバーへの更新に失敗しました。"));
}

function apiDelete(url: string): void {
  fetch(url, { method: "DELETE" }).catch(() =>
    toast.error("サーバーからの削除に失敗しました。"),
  );
}

// ===== Component =====

export function ScheduleWorkspace({ initialData }: Props) {
  // schedules / tasks は DB から初期値を受け取る（localStorage は使わない）
  const [schedules, setSchedules] = useState<Schedule[]>(initialData.schedules);
  const [tasks, setTasks] = useState<DailyTask[]>(initialData.tasks);

  // それ以外は localStorage から復元（なければ initialData の空配列）
  const [savedIdeas, setSavedIdeas] = useState<SavedIdea[]>(() =>
    loadLocalField(savedIdeaSchema, "savedIdeas", initialData.savedIdeas),
  );
  const [contacts, setContacts] = useState<Contact[]>(() =>
    loadLocalField(contactSchema, "contacts", initialData.contacts),
  );
  const [projects, setProjects] = useState<Project[]>(() =>
    loadLocalField(projectSchema, "projects", initialData.projects),
  );
  const [globalTags, setGlobalTags] = useState<string[]>(() =>
    loadLocalField(z.string(), "globalTags", initialData.globalTags),
  );

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);

  // ── schedules/tasks 以外を localStorage に保存 ──────────────────────────
  const storageWarnedRef = useRef(false);
  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ savedIdeas, contacts, projects, globalTags }),
      );
      storageWarnedRef.current = false;
    } catch {
      if (!storageWarnedRef.current) {
        toast.warning("ローカルストレージへの保存に失敗しました。");
        storageWarnedRef.current = true;
      }
    }
  }, [savedIdeas, contacts, projects, globalTags]);

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
          map.set(c.name, {
            name: c.name,
            contact: c.contact ?? map.get(c.name)?.contact,
          });
      }
      return Array.from(map.values());
    });
  }, []);

  // ── Schedules ─────────────────────────────────────

  const addSchedule = useCallback(
    (s: Omit<Schedule, "id" | "tags" | "done">) => {
      const n: Schedule = {
        ...s,
        id: crypto.randomUUID(),
        tags: [],
        done: false,
      };
      setSchedules((prev) => [...prev, n]);
      if (s.attendees?.length) mergeContacts(s.attendees);
      apiPost("/api/schedules", n);
    },
    [mergeContacts],
  );

  const updateSchedule = useCallback(
    (id: string, patch: Partial<Schedule>) => {
      setSchedules((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
      if (patch.attendees?.length) mergeContacts(patch.attendees);
      apiPatch(`/api/schedules/${id}`, patch);
    },
    [mergeContacts],
  );

  const deleteSchedule = useCallback((id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    setSelectedItem((prev) =>
      prev?.kind === "schedule" && prev.data.id === id ? null : prev,
    );
    apiDelete(`/api/schedules/${id}`);
  }, []);

  const copySchedule = useCallback((id: string) => {
    setSchedules((prev) => {
      const src = prev.find((s) => s.id === id);
      if (!src) return prev;
      const copy: Schedule = {
        ...src,
        id: crypto.randomUUID(),
        title: `${src.title}（コピー）`,
      };
      apiPost("/api/schedules", copy);
      return [...prev, copy];
    });
  }, []);

  // ── Tasks ──────────────────────────────────────────

  const addTask = useCallback((t: Omit<DailyTask, "id" | "tags" | "done">) => {
    const n: DailyTask = {
      ...t,
      id: crypto.randomUUID(),
      tags: [],
      done: false,
    };
    setTasks((prev) => [...prev, n]);
    apiPost("/api/tasks", n);
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<DailyTask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
    apiPatch(`/api/tasks/${id}`, patch);
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, done: !t.done };
        apiPatch(`/api/tasks/${id}`, { done: next.done });
        return next;
      }),
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedItem((prev) =>
      prev?.kind === "task" && prev.data.id === id ? null : prev,
    );
    apiDelete(`/api/tasks/${id}`);
  }, []);

  const copyTask = useCallback((id: string) => {
    setTasks((prev) => {
      const src = prev.find((t) => t.id === id);
      if (!src) return prev;
      const copy: DailyTask = {
        ...src,
        id: crypto.randomUUID(),
        title: `${src.title}（コピー）`,
        done: false,
      };
      apiPost("/api/tasks", copy);
      return [...prev, copy];
    });
  }, []);

  // ── Ideas ──────────────────────────────────────────

  const saveIdea = useCallback((idea: Omit<SavedIdea, "id" | "tags">) => {
    setSavedIdeas((prev) => [
      { ...idea, id: `idea-${Date.now()}`, tags: [] },
      ...prev,
    ]);
  }, []);

  const updateIdea = useCallback((id: string, patch: Partial<SavedIdea>) => {
    setSavedIdeas((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  }, []);

  const deleteIdea = useCallback((id: string) => {
    setSavedIdeas((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // ── Projects ──────────────────────────────────────

  const addProject = useCallback((p: Omit<Project, "id">) => {
    setProjects((prev) => [...prev, { ...p, id: `p-${Date.now()}` }]);
  }, []);

  const updateProject = useCallback(
    (id: string, patch: Partial<Project>) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
    },
    [],
  );

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setSelectedItem((prev) =>
      prev?.kind === "project" && prev.data.id === id ? null : prev,
    );
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
              onSelectIdea={(idea) =>
                setSelectedItem({ kind: "idea", data: idea })
              }
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

// ── localStorage ヘルパー（schedules/tasks 以外のフィールドのみ復元） ────────

function loadLocalField<T>(
  schema: z.ZodType<T>,
  key: string,
  fallback: T[],
): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return fallback;
    const raw = JSON.parse(stored) as Record<string, unknown>;
    const result = z.array(schema).safeParse(raw[key]);
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}

