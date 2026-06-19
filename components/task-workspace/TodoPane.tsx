"use client";

import { useState } from "react";
import { CalendarDays, Clock3, Pencil, Plus, Trash2 } from "lucide-react";
import { format, isPast } from "date-fns";
import { ja } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { type TodoItem, PRIORITY_LABELS, STANDALONE_TASK_ID } from "@/lib/task-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AddItemDialog } from "@/components/workspace/AddItemDialog";

type TodoPaneProps = {
  todos: TodoItem[];
  selectedTaskId: string | null;
  onToggleTodo: (id: string) => void;
  onUpdateTodo: (id: string, title: string) => void;
  onDeleteTodo: (id: string) => void;
  onAddTodo: (title: string) => void;
};

export function TodoPane({
  todos,
  selectedTaskId,
  onToggleTodo,
  onUpdateTodo,
  onDeleteTodo,
  onAddTodo,
}: TodoPaneProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);

  const paneTitle =
    selectedTaskId === null
      ? "TODO"
      : selectedTaskId === STANDALONE_TASK_ID
        ? "スタンドアロン TODO"
        : "TODO";

  const pendingTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);

  const addDescription =
    selectedTaskId === null || selectedTaskId === STANDALONE_TASK_ID
      ? "スタンドアロン TODO（タスク未所属）として追加します"
      : "選択中のタスクに TODO を追加します";

  return (
    <section className="flex h-full w-full flex-col bg-muted/10">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-4">
        <h2 className="truncate text-sm font-semibold text-foreground">
          {paneTitle}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setAddDialogOpen(true)}
          aria-label="TODO を追加"
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus />
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        {selectedTaskId === null && todos.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            + ボタンでスタンドアロン TODO を追加できます
          </div>
        ) : todos.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            TODO がありません
          </div>
        ) : (
          <div className="flex flex-col px-3 py-4">
            {pendingTodos.length > 0 && (
              <ul className="flex flex-col gap-1">
                {pendingTodos.map((todo) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    onToggle={() => onToggleTodo(todo.id)}
                    onEdit={() => setEditingTodo(todo)}
                    onDelete={() => onDeleteTodo(todo.id)}
                  />
                ))}
              </ul>
            )}

            {doneTodos.length > 0 && (
              <>
                {pendingTodos.length > 0 && <Separator className="my-4" />}
                <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">
                  完了済み（{doneTodos.length}）
                </p>
                <ul className="flex flex-col gap-1">
                  {doneTodos.map((todo) => (
                    <TodoRow
                      key={todo.id}
                      todo={todo}
                      onToggle={() => onToggleTodo(todo.id)}
                      onEdit={() => setEditingTodo(todo)}
                      onDelete={() => onDeleteTodo(todo.id)}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </ScrollArea>

      {/* 追加ダイアログ */}
      <AddItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        title="TODO を追加"
        description={addDescription}
        fieldLabel="タイトル"
        fieldId="todo-title"
        placeholder="例: 見積もりを取る"
        onAdd={onAddTodo}
      />

      {/* 編集ダイアログ */}
      <AddItemDialog
        open={editingTodo !== null}
        onOpenChange={(v) => { if (!v) setEditingTodo(null); }}
        title="TODO を編集"
        description="タイトルを変更してください"
        fieldLabel="タイトル"
        fieldId="todo-title-edit"
        placeholder="例: 見積もりを取る"
        defaultValue={editingTodo?.title}
        onAdd={(title) => {
          if (editingTodo) onUpdateTodo(editingTodo.id, title);
        }}
      />
    </section>
  );
}

function TodoRow({
  todo,
  onToggle,
  onEdit,
  onDelete,
}: {
  todo: TodoItem;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isOverdue =
    todo.dueDate && !todo.done && isPast(new Date(todo.dueDate));

  return (
    <li className="group/todo relative flex items-start gap-2.5 rounded-md px-3 py-2.5 hover:bg-muted transition-colors">
      {/* チェックボックス */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={todo.done ? "未完了に戻す" : "完了にする"}
        className={cn(
          "mt-0.5 size-4 shrink-0 rounded-sm border transition-colors",
          "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          todo.done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border hover:border-primary",
        )}
      >
        {todo.done && (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="size-full p-[2px] text-primary-foreground"
            aria-hidden
          >
            <path
              d="M3 8l3.5 3.5L13 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* 内容 */}
      <div className="min-w-0 flex-1 pr-14">
        <p
          className={cn(
            "text-sm leading-snug",
            todo.done && "text-muted-foreground line-through",
          )}
        >
          {todo.title}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {todo.dueDate && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs",
                isOverdue && !todo.done
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              <Clock3 className="size-3" aria-hidden />
              {format(new Date(todo.dueDate), "M/d", { locale: ja })}
            </span>
          )}
          {todo.scheduledDate && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <CalendarDays className="size-3" aria-hidden />
              {format(new Date(todo.scheduledDate), "M/d 予定", { locale: ja })}
            </span>
          )}
          {todo.priority && (
            <Badge
              variant={todo.priority === "high" ? "destructive" : "secondary"}
              size="xs"
            >
              {PRIORITY_LABELS[todo.priority]}
            </Badge>
          )}
          {todo.tags.map((tag) => (
            <Badge key={tag} variant="outline" size="xs">
              {tag}
            </Badge>
          ))}
        </div>

        {todo.note && (
          <p className="mt-1 text-xs text-muted-foreground">{todo.note}</p>
        )}
      </div>

      {/* 編集・削除ボタン（ホバーで表示） */}
      <div
        className={cn(
          "absolute right-2 top-2.5 flex items-center gap-0.5",
          "opacity-0 transition-opacity group-hover/todo:opacity-100",
        )}
      >
        <button
          type="button"
          onClick={onEdit}
          aria-label="編集"
          className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="削除"
          className="rounded p-0.5 text-muted-foreground/30 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </li>
  );
}
