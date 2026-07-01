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

// localStorage key: DB 移行用（初回のみ migrate-local API へ送る）
const LS_KEY = "schedule-workspace-v4";
const LS_MIGRATED_KEY = "schedule-workspace-v5-migrated";

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
  const [schedules, setSchedules] = useState<Schedule[]>(initialData.schedules);
  const [tasks, setTasks] = useState<DailyTask[]>(initialData.tasks);
  const [savedIdeas, setSavedIdeas] = useState<SavedIdea[]>(initialData.savedIdeas);
  const [contacts, setContacts] = useState<Contact[]>(initialData.contacts);
  const [projects, setProjects] = useState<Project[]>(initialData.projects);
  const [globalTags, setGlobalTags] = useState<string[]>(initialData.globalTags);

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);

  // ── localStorage → DB 初回移行 ────────────────────────────────
  const migratedRef = useRef(false);
  useEffect(() => {
    if (migratedRef.current) return;
    migratedRef.current = true;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(LS_MIGRATED_KEY)) return;

    const payload = readLocalStoragePayload();
    const hasData =
      payload.savedIdeas.length > 0 ||
      payload.contacts.length > 0 ||
      payload.projects.length > 0 ||
      payload.globalTags.length > 0;
    if (!hasData) {
      localStorage.setItem(LS_MIGRATED_KEY, "1");
      return;
    }

    fetch("/api/migrate-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data: {
        projects?: Project[];
        savedIdeas?: SavedIdea[];
        contacts?: Contact[];
        globalTags?: string[];
      }) => {
        if (data.projects) setProjects(data.projects);
        if (data.savedIdeas) setSavedIdeas(data.savedIdeas);
        if (data.contacts) setContacts(data.contacts);
        if (data.globalTags) setGlobalTags(data.globalTags);
        localStorage.removeItem(LS_KEY);
        localStorage.setItem(LS_MIGRATED_KEY, "1");
        toast.success("ローカルデータを DB に移行しました");
      })
      .catch(() => toast.warning("ローカルデータの DB 移行に失敗しました"));
  }, []);

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
        if (c.name.trim()) {
          map.set(c.name, {
            name: c.name,
            contact: c.contact ?? map.get(c.name)?.contact,
          });
          apiPost("/api/contacts", {
            name: c.name,
            contact: c.contact ?? map.get(c.name)?.contact,
          });
        }
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
    const n: SavedIdea = {
      ...idea,
      id: crypto.randomUUID(),
      tags: [],
    };
    setSavedIdeas((prev) => [n, ...prev]);
    apiPost("/api/ideas", n);
  }, []);

  const updateIdea = useCallback((id: string, patch: Partial<SavedIdea>) => {
    setSavedIdeas((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
    apiPatch(`/api/ideas/${id}`, patch);
  }, []);

  const deleteIdea = useCallback((id: string) => {
    setSavedIdeas((prev) => prev.filter((i) => i.id !== id));
    setSelectedItem((prev) =>
      prev?.kind === "idea" && prev.data.id === id ? null : prev,
    );
    apiDelete(`/api/ideas/${id}`);
  }, []);

  // ── Projects ──────────────────────────────────────

  const addProject = useCallback((p: Omit<Project, "id">) => {
    const n: Project = { ...p, id: crypto.randomUUID() };
    setProjects((prev) => [...prev, n]);
    apiPost("/api/projects", n);
  }, []);

  const updateProject = useCallback(
    (id: string, patch: Partial<Project>) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
      apiPatch(`/api/projects/${id}`, patch);
    },
    [],
  );

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setSelectedItem((prev) =>
      prev?.kind === "project" && prev.data.id === id ? null : prev,
    );
    apiDelete(`/api/projects/${id}`);
  }, []);

  // ── Global Tags ───────────────────────────────────

  const addGlobalTag = useCallback((tag: string) => {
    setGlobalTags((prev) => {
      if (prev.includes(tag) || prev.length >= 20) return prev;
      apiPost("/api/tags", { name: tag });
      return [...prev, tag];
    });
  }, []);

  const deleteGlobalTag = useCallback((tag: string) => {
    setGlobalTags((prev) => prev.filter((t) => t !== tag));
    apiDelete(`/api/tags?name=${encodeURIComponent(tag)}`);
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

// ── localStorage ヘルパー（初回 DB 移行用） ────────────────────────────────

function readLocalStoragePayload(): {
  savedIdeas: SavedIdea[];
  contacts: Contact[];
  projects: Project[];
  globalTags: string[];
} {
  const empty = {
    savedIdeas: [] as SavedIdea[],
    contacts: [] as Contact[],
    projects: [] as Project[],
    globalTags: [] as string[],
  };
  if (typeof window === "undefined") return empty;
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return empty;
    const raw = JSON.parse(stored) as Record<string, unknown>;
    return {
      savedIdeas: z.array(savedIdeaSchema).safeParse(raw.savedIdeas).success
        ? z.array(savedIdeaSchema).parse(raw.savedIdeas)
        : [],
      contacts: z.array(contactSchema).safeParse(raw.contacts).success
        ? z.array(contactSchema).parse(raw.contacts)
        : [],
      projects: z.array(projectSchema).safeParse(raw.projects).success
        ? z.array(projectSchema).parse(raw.projects)
        : [],
      globalTags: z.array(z.string()).safeParse(raw.globalTags).success
        ? z.array(z.string()).parse(raw.globalTags)
        : [],
    };
  } catch {
    return empty;
  }
}

