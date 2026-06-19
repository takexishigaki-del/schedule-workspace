"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock3, Loader2, MoreHorizontal, Plus } from "lucide-react";
import { format, isPast } from "date-fns";
import { ja } from "date-fns/locale";

import { cn } from "@/lib/utils";
import {
  type Task,
  type TaskStatus,
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  STANDALONE_PROJECT_ID,
} from "@/lib/task-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddItemDialog } from "@/components/workspace/AddItemDialog";

type TaskPaneProps = {
  tasks: Task[];
  selectedProjectId: string | null;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onAddTask: (name: string) => void;
  onUpdateTask: (id: string, name: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTaskStatus: (id: string, status: TaskStatus) => void;
  onArchiveTask: (id: string) => void;
};

export function TaskPane({
  tasks,
  selectedProjectId,
  selectedTaskId,
  onSelectTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onUpdateTaskStatus,
  onArchiveTask,
}: TaskPaneProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const paneTitle =
    selectedProjectId === null
      ? "すべてのタスク"
      : selectedProjectId === STANDALONE_PROJECT_ID
        ? "スタンドアロンタスク"
        : "タスク";

  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const todoTasks = tasks.filter((t) => t.status === "todo");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const addDescription =
    selectedProjectId === null || selectedProjectId === STANDALONE_PROJECT_ID
      ? "スタンドアロンタスク（プロジェクト未所属）として追加します"
      : "選択中のプロジェクトにタスクを追加します";

  return (
    <section className="flex h-full w-full flex-col bg-muted/20">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-4">
        <h2 className="truncate text-sm font-semibold text-foreground">
          {paneTitle}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setAddDialogOpen(true)}
          aria-label="タスクを追加"
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus />
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        {tasks.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {selectedProjectId === null
              ? "+ ボタンでスタンドアロンタスクを追加できます"
              : "タスクがありません"}
          </div>
        ) : (
          <div className="flex flex-col gap-5 px-2 py-4">
            {inProgressTasks.length > 0 && (
              <TaskGroup
                label="進行中"
                tasks={inProgressTasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={onSelectTask}
                onUpdateStatus={onUpdateTaskStatus}
                onEdit={setEditingTask}
                onDelete={onDeleteTask}
                onArchive={onArchiveTask}
              />
            )}
            {todoTasks.length > 0 && (
              <TaskGroup
                label="未着手"
                tasks={todoTasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={onSelectTask}
                onUpdateStatus={onUpdateTaskStatus}
                onEdit={setEditingTask}
                onDelete={onDeleteTask}
                onArchive={onArchiveTask}
              />
            )}
            {doneTasks.length > 0 && (
              <TaskGroup
                label="完了"
                tasks={doneTasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={onSelectTask}
                onUpdateStatus={onUpdateTaskStatus}
                onEdit={setEditingTask}
                onDelete={onDeleteTask}
                onArchive={onArchiveTask}
              />
            )}
          </div>
        )}
      </ScrollArea>

      {/* 追加ダイアログ */}
      <AddItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        title="タスクを追加"
        description={addDescription}
        fieldLabel="タスク名"
        fieldId="task-name"
        placeholder="例: 引越し業者の手配"
        onAdd={onAddTask}
      />

      {/* 編集ダイアログ */}
      <AddItemDialog
        open={editingTask !== null}
        onOpenChange={(v) => { if (!v) setEditingTask(null); }}
        title="タスク名を変更"
        description="新しいタスク名を入力してください"
        fieldLabel="タスク名"
        fieldId="task-name-edit"
        placeholder="例: 引越し業者の手配"
        defaultValue={editingTask?.name}
        onAdd={(name) => {
          if (editingTask) onUpdateTask(editingTask.id, name);
        }}
      />
    </section>
  );
}

function TaskGroup({
  label,
  tasks,
  selectedTaskId,
  onSelectTask,
  onUpdateStatus,
  onEdit,
  onDelete,
  onArchive,
}: {
  label: string;
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  return (
    <div>
      <div className="sticky top-0 z-10 -mx-2 mb-1.5 flex items-center gap-1.5 bg-muted/20 px-4 py-1">
        <StatusDot status={tasks[0]?.status ?? "todo"} />
        <span className="text-xs font-semibold text-muted-foreground">
          {label}
        </span>
        <Badge variant="secondary" size="xs">
          {tasks.length}
        </Badge>
      </div>
      <ul className="flex flex-col gap-1">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            selected={selectedTaskId === task.id}
            onSelect={() => onSelectTask(task.id)}
            onUpdateStatus={(status) => onUpdateStatus(task.id, status)}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task.id)}
            onArchive={() => onArchive(task.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function TaskRow({
  task,
  selected,
  onSelect,
  onUpdateStatus,
  onEdit,
  onDelete,
  onArchive,
}: {
  task: Task;
  selected: boolean;
  onSelect: () => void;
  onUpdateStatus: (status: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  const isOverdue =
    task.dueDate && task.status !== "done" && isPast(new Date(task.dueDate));

  const isInProgress = task.status === "in_progress";

  return (
    <li className="group/task relative">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-start gap-2.5 rounded-md border-l-[3px] px-3 py-2.5 text-left transition-colors",
          "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          isInProgress
            ? "border-l-primary bg-primary/5"
            : task.status === "done"
              ? "border-l-muted-foreground/30"
              : "border-l-transparent",
          selected
            ? "bg-accent text-accent-foreground"
            : isInProgress
              ? "hover:bg-primary/10 text-foreground"
              : "text-foreground hover:bg-muted",
        )}
      >
        <StatusIcon status={task.status} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p
              className={cn(
                "truncate text-sm font-medium",
                task.status === "done" && "text-muted-foreground line-through font-normal",
              )}
            >
              {task.name}
            </p>
            {isInProgress && (
              <Badge
                variant="secondary"
                size="xs"
                className="shrink-0 bg-primary/15 text-primary border-0"
              >
                進行中
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {task.dueDate && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-xs",
                  isOverdue ? "text-destructive" : "text-muted-foreground",
                )}
              >
                <Clock3 className="size-3" aria-hidden />
                {format(new Date(task.dueDate), "M/d", { locale: ja })}
                {isOverdue && " 期限切れ"}
              </span>
            )}
            {task.priority && task.priority !== "medium" && (
              <Badge
                variant={task.priority === "high" ? "destructive" : "outline"}
                size="xs"
              >
                {PRIORITY_LABELS[task.priority]}
              </Badge>
            )}
          </div>
        </div>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={cn(
                "absolute right-1 top-2",
                "opacity-0 transition-opacity",
                "group-focus-within/task:opacity-100 group-hover/task:opacity-100",
                "text-muted-foreground hover:text-foreground",
              )}
              aria-label={`${task.name} の操作`}
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onEdit}>
              名前を変更
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {(["todo", "in_progress", "done"] as TaskStatus[]).map((s) => (
              <DropdownMenuItem
                key={s}
                onSelect={() => onUpdateStatus(s)}
                className={task.status === s ? "font-semibold text-primary" : ""}
              >
                <StatusDot status={s} />
                {TASK_STATUS_LABELS[s]}
                {task.status === s && " ✓"}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onArchive}>
              アーカイブ
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              削除
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function StatusIcon({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  if (status === "done") {
    return (
      <CheckCircle2
        className={cn("size-4 text-muted-foreground/60", className)}
        aria-label="完了"
      />
    );
  }
  if (status === "in_progress") {
    return (
      <Loader2
        className={cn("size-4 text-primary", className)}
        aria-label="進行中"
      />
    );
  }
  return (
    <Circle
      className={cn("size-4 text-muted-foreground/40", className)}
      aria-label="未着手"
    />
  );
}

function StatusDot({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        status === "in_progress" && "bg-primary",
        status === "todo" && "bg-muted-foreground/40",
        status === "done" && "bg-muted-foreground/25",
      )}
      aria-hidden
    />
  );
}
