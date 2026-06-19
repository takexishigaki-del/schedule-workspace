"use client";

import { useState, useCallback, useRef } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";

import {
  type Project,
  type Task,
  type TaskStatus,
  type TodoItem,
  type Idea,
  type TaskWorkspaceData,
  STANDALONE_PROJECT_ID,
  STANDALONE_TASK_ID,
} from "@/lib/task-schema";
import type { ParsedItem } from "@/app/api/parse-input/route";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarIdeaPane } from "@/components/task-workspace/CalendarIdeaPane";
import { ProjectPane } from "@/components/task-workspace/ProjectPane";
import { TaskPane } from "@/components/task-workspace/TaskPane";
import { TodoPane } from "@/components/task-workspace/TodoPane";
import { cn } from "@/lib/utils";

// AI 解析結果のフィードバック表示
type FeedbackState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

type TaskWorkspaceProps = {
  initialData: TaskWorkspaceData;
};

export function TaskWorkspace({ initialData }: TaskWorkspaceProps) {
  const [projects, setProjects] = useState<Project[]>(initialData.projects);
  const [tasks, setTasks] = useState<Task[]>(initialData.tasks);
  const [todos, setTodos] = useState<TodoItem[]>(initialData.todos);
  const [ideas, setIdeas] = useState<Idea[]>(initialData.ideas);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // AI 入力欄
  const [aiInput, setAiInput] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>({ kind: "idle" });
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showFeedback = useCallback(
    (next: FeedbackState, autoClear = true) => {
      setFeedback(next);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (autoClear && next.kind !== "loading") {
        feedbackTimerRef.current = setTimeout(
          () => setFeedback({ kind: "idle" }),
          3000,
        );
      }
    },
    [],
  );

  // ===== AI 解析 & 追加 =====

  const handleAiSubmit = useCallback(async () => {
    const text = aiInput.trim();
    if (!text || feedback.kind === "loading") return;

    setAiInput("");
    showFeedback({ kind: "loading" }, false);

    try {
      const res = await fetch("/api/parse-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const json = (await res.json()) as
        | { ok: true; data: ParsedItem }
        | { ok: false; error: string };

      if (!json.ok) {
        showFeedback({ kind: "error", message: json.error });
        return;
      }

      const item = json.data;

      switch (item.type) {
        case "project": {
          const newProject: Project = {
            id: `p-${Date.now()}`,
            name: item.title,
            description: item.description,
            dueDate: item.dueDate,
            priority: item.priority,
            tags: [],
            archived: false,
          };
          setProjects((prev) => [...prev, newProject]);
          showFeedback({ kind: "success", message: `プロジェクト「${item.title}」を追加しました` });
          break;
        }

        case "task": {
          const newTask: Task = {
            id: `t-${Date.now()}`,
            projectId:
              selectedProjectId && selectedProjectId !== STANDALONE_PROJECT_ID
                ? selectedProjectId
                : undefined,
            name: item.title,
            description: item.description,
            dueDate: item.dueDate,
            scheduledDate: item.scheduledDate,
            priority: item.priority,
            isPrivate: item.isPrivate,
            tags: [],
            status: "todo",
            archived: false,
          };
          setTasks((prev) => [...prev, newTask]);
          showFeedback({ kind: "success", message: `タスク「${item.title}」を追加しました` });
          break;
        }

        case "todo":
        case "calendar": {
          const newTodo: TodoItem = {
            id: `td-${Date.now()}`,
            taskId:
              selectedTaskId && selectedTaskId !== STANDALONE_TASK_ID
                ? selectedTaskId
                : undefined,
            title: item.title,
            note: item.description,
            dueDate: item.dueDate,
            scheduledDate: item.scheduledDate,
            priority: item.priority,
            isPrivate: item.isPrivate,
            tags: [],
            done: false,
          };
          setTodos((prev) => [...prev, newTodo]);
          const label = item.type === "calendar" ? "予定" : "TODO";
          showFeedback({ kind: "success", message: `${label}「${item.title}」を追加しました` });
          break;
        }

        case "idea": {
          const newIdea: Idea = {
            id: `idea-${Date.now()}`,
            content: item.title,
            createdAt: new Date().toISOString(),
          };
          setIdeas((prev) => [newIdea, ...prev]);
          showFeedback({ kind: "success", message: `アイデア「${item.title}」をメモしました` });
          break;
        }
      }
    } catch {
      showFeedback({
        kind: "error",
        message: "通信エラーが発生しました。再試行してください。",
      });
    } finally {
      inputRef.current?.focus();
    }
  }, [aiInput, feedback.kind, selectedProjectId, selectedTaskId, showFeedback]);

  // ===== Project CRUD =====

  const addProject = useCallback((name: string) => {
    setProjects((prev) => [
      ...prev,
      { id: `p-${Date.now()}`, name, tags: [], archived: false },
    ]);
  }, []);

  const updateProject = useCallback((id: string, name: string) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setSelectedProjectId((prev) => (prev === id ? null : prev));
    setSelectedTaskId(null);
  }, []);

  const archiveProject = useCallback((id: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, archived: true } : p)),
    );
    setSelectedProjectId((prev) => (prev === id ? null : prev));
    setSelectedTaskId(null);
  }, []);

  // ===== Task CRUD =====

  const addTask = useCallback(
    (name: string) => {
      const newTask: Task = {
        id: `t-${Date.now()}`,
        projectId:
          selectedProjectId && selectedProjectId !== STANDALONE_PROJECT_ID
            ? selectedProjectId
            : undefined,
        name,
        tags: [],
        status: "todo",
        isPrivate: false,
        archived: false,
      };
      setTasks((prev) => [...prev, newTask]);
    },
    [selectedProjectId],
  );

  const updateTaskStatus = useCallback((id: string, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status } : t)),
    );
  }, []);

  const updateTask = useCallback((id: string, name: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedTaskId((prev) => (prev === id ? null : prev));
  }, []);

  const archiveTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, archived: true } : t)),
    );
    setSelectedTaskId((prev) => (prev === id ? null : prev));
  }, []);

  // ===== Todo CRUD =====

  const addTodo = useCallback(
    (title: string) => {
      const newTodo: TodoItem = {
        id: `td-${Date.now()}`,
        taskId:
          selectedTaskId && selectedTaskId !== STANDALONE_TASK_ID
            ? selectedTaskId
            : undefined,
        title,
        tags: [],
        isPrivate: false,
        done: false,
      };
      setTodos((prev) => [...prev, newTodo]);
    },
    [selectedTaskId],
  );

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }, []);

  const updateTodo = useCallback((id: string, title: string) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ===== Idea CRUD =====

  const addIdea = useCallback((content: string) => {
    setIdeas((prev) => [
      { id: `idea-${Date.now()}`, content, createdAt: new Date().toISOString() },
      ...prev,
    ]);
  }, []);

  const updateIdea = useCallback((id: string, content: string) => {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, content } : i)));
  }, []);

  const deleteIdea = useCallback((id: string) => {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // ===== Calendar scheduled item =====

  const addScheduledItem = useCallback((date: Date, title: string) => {
    // toISOString() は UTC 変換するため JST では前日になる → format でローカル日付を使用
    const scheduledDate = format(date, "yyyy-MM-dd");
    const newTodo: TodoItem = {
      id: `td-${Date.now()}`,
      taskId: undefined,
      title,
      scheduledDate,
      tags: [],
      isPrivate: false,
      done: false,
    };
    setTodos((prev) => [...prev, newTodo]);
  }, []);

  // ===== Derived data =====

  const filteredTasks = tasks.filter((t) => {
    if (t.archived) return false;
    if (selectedProjectId === null) return false;
    if (selectedProjectId === STANDALONE_PROJECT_ID) return !t.projectId;
    return t.projectId === selectedProjectId;
  });

  const filteredTodos = todos.filter((t) => {
    if (selectedTaskId === null) return false;
    if (selectedTaskId === STANDALONE_TASK_ID) return !t.taskId;
    return t.taskId === selectedTaskId;
  });

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  const handleSelectProject = useCallback((id: string | null) => {
    setSelectedProjectId(id);
    setSelectedTaskId(null);
  }, []);

  return (
    <SidebarProvider
      defaultOpen
      className="h-screen w-full overflow-hidden bg-background text-foreground"
    >
      {/* Pane 1: カレンダー + アイデアメモ */}
      <CalendarIdeaPane
        ideas={ideas}
        todos={todos}
        tasks={tasks}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onAddIdea={addIdea}
        onUpdateIdea={updateIdea}
        onDeleteIdea={deleteIdea}
        onAddScheduledItem={addScheduledItem}
      />

      <SidebarInset className="flex min-w-0 flex-col bg-background">
        {/* GlobalHeader */}
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
          {/* パンくず */}
          <Breadcrumb aria-label="現在地" className="min-w-0 flex-1 overflow-hidden">
            <BreadcrumbList className="flex-nowrap text-[11px]">
              <BreadcrumbItem className="shrink-0">
                <span className="text-muted-foreground">マイワークスペース</span>
              </BreadcrumbItem>
              {(selectedProject || selectedProjectId === STANDALONE_PROJECT_ID) && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem className="shrink-0">
                    <span className="text-muted-foreground">
                      {selectedProjectId === STANDALONE_PROJECT_ID
                        ? "スタンドアロンタスク"
                        : selectedProject?.name}
                    </span>
                  </BreadcrumbItem>
                </>
              )}
              {selectedTask && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbPage className="truncate font-medium">
                      {selectedTask.name}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>

          {/* AI 入力欄 */}
          <div className="flex shrink-0 items-center gap-2">
            {/* フィードバック */}
            {feedback.kind !== "idle" && feedback.kind !== "loading" && (
              <span
                className={cn(
                  "max-w-[200px] truncate text-xs",
                  feedback.kind === "success"
                    ? "text-primary"
                    : "text-destructive",
                )}
                role="status"
                aria-live="polite"
              >
                {feedback.kind === "success" ? "✓ " : "✕ "}
                {feedback.message}
              </span>
            )}
            <div className="relative flex items-center">
              <Sparkles
                className={cn(
                  "pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground transition-opacity",
                  feedback.kind === "loading" && "opacity-0",
                )}
                aria-hidden
              />
              {feedback.kind === "loading" && (
                <Loader2
                  className="pointer-events-none absolute left-2.5 size-3.5 animate-spin text-primary"
                  aria-hidden
                />
              )}
              <Input
                ref={inputRef}
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAiSubmit();
                }}
                placeholder="タスク・アイデア・予定を入力（AI が自動分類）"
                disabled={feedback.kind === "loading"}
                className="h-8 w-72 pl-8 text-xs placeholder:text-muted-foreground/70"
                aria-label="AI 入力"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAiSubmit}
              disabled={!aiInput.trim() || feedback.kind === "loading"}
              className="h-8 px-2.5"
              aria-label="送信"
            >
              {feedback.kind === "loading" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
            </Button>
          </div>
        </header>

        {/* Pane 2 / 3 / 4 — リサイズ可能 */}
        <PanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1"
        >
          {/* Pane 2: プロジェクト */}
          <Panel defaultSize="22%" minSize="14%" maxSize="40%">
            <ProjectPane
              projects={projects}
              tasks={tasks}
              selectedProjectId={selectedProjectId}
              onSelectProject={handleSelectProject}
              onAddProject={addProject}
              onUpdateProject={updateProject}
              onDeleteProject={deleteProject}
              onArchiveProject={archiveProject}
            />
          </Panel>

          <ResizeHandle />

          {/* Pane 3: タスク */}
          <Panel defaultSize="28%" minSize="16%" maxSize="50%">
            <TaskPane
              tasks={filteredTasks}
              selectedProjectId={selectedProjectId}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
              onAddTask={addTask}
              onUpdateTask={updateTask}
              onDeleteTask={deleteTask}
              onUpdateTaskStatus={updateTaskStatus}
              onArchiveTask={archiveTask}
            />
          </Panel>

          <ResizeHandle />

          {/* Pane 4: TODO */}
          <Panel defaultSize="50%" minSize="20%">
            <TodoPane
              todos={filteredTodos}
              selectedTaskId={selectedTaskId}
              onToggleTodo={toggleTodo}
              onUpdateTodo={updateTodo}
              onDeleteTodo={deleteTodo}
              onAddTodo={addTodo}
            />
          </Panel>
        </PanelGroup>
      </SidebarInset>
    </SidebarProvider>
  );
}

// ドラッグで幅を変えるハンドル
function ResizeHandle() {
  return (
    <PanelResizeHandle className="group relative flex w-1.5 items-center justify-center bg-border transition-colors hover:bg-primary/20 data-[resize-handle-active]:bg-primary/30">
      {/* 視覚的なグリップ（縦3点） */}
      <div className="flex flex-col items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-data-[resize-handle-active]:opacity-100">
        <span className="size-1 rounded-full bg-muted-foreground/50" />
        <span className="size-1 rounded-full bg-muted-foreground/50" />
        <span className="size-1 rounded-full bg-muted-foreground/50" />
      </div>
    </PanelResizeHandle>
  );
}
