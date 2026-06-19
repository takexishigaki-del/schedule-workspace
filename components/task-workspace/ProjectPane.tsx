"use client";

import { useState } from "react";
import { Folder, FolderOpen, MoreHorizontal, Plus } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

import { cn } from "@/lib/utils";
import {
  type Project,
  type Task,
  PRIORITY_LABELS,
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

type ProjectPaneProps = {
  projects: Project[];
  tasks: Task[];
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onAddProject: (name: string) => void;
  onUpdateProject: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  onArchiveProject: (id: string) => void;
};

export function ProjectPane({
  projects,
  tasks,
  selectedProjectId,
  onSelectProject,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onArchiveProject,
}: ProjectPaneProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const activeProjects = projects.filter((p) => !p.archived);
  const standaloneCount = tasks.filter((t) => !t.projectId && !t.archived).length;

  const getTaskCount = (projectId: string) =>
    tasks.filter((t) => t.projectId === projectId && !t.archived).length;

  return (
    <section className="flex h-full w-full flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <h2 className="truncate text-sm font-semibold text-foreground">
          プロジェクト
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setAddDialogOpen(true)}
          aria-label="プロジェクトを追加"
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus />
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-0.5 px-2 py-3">
          {/* スタンドアロンタスク */}
          <StandaloneRow
            count={standaloneCount}
            selected={selectedProjectId === STANDALONE_PROJECT_ID}
            onSelect={() => onSelectProject(STANDALONE_PROJECT_ID)}
          />

          {activeProjects.length > 0 && (
            <p className="mt-3 mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              プロジェクト
            </p>
          )}

          {activeProjects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              taskCount={getTaskCount(project.id)}
              selected={selectedProjectId === project.id}
              onSelect={() => onSelectProject(project.id)}
              onEdit={() => setEditingProject(project)}
              onDelete={() => onDeleteProject(project.id)}
              onArchive={() => onArchiveProject(project.id)}
            />
          ))}

          {activeProjects.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              + ボタンでプロジェクトを追加
            </p>
          )}
        </div>
      </ScrollArea>

      {/* 追加ダイアログ */}
      <AddItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        title="プロジェクトを追加"
        description="新しいプロジェクトを追加します"
        fieldLabel="プロジェクト名"
        fieldId="project-name"
        placeholder="例: 引越し準備"
        onAdd={onAddProject}
      />

      {/* 編集ダイアログ */}
      <AddItemDialog
        open={editingProject !== null}
        onOpenChange={(v) => { if (!v) setEditingProject(null); }}
        title="プロジェクト名を変更"
        description="新しいプロジェクト名を入力してください"
        fieldLabel="プロジェクト名"
        fieldId="project-name-edit"
        placeholder="例: 引越し準備"
        defaultValue={editingProject?.name}
        onAdd={(name) => {
          if (editingProject) onUpdateProject(editingProject.id, name);
        }}
      />
    </section>
  );
}

function StandaloneRow({
  count,
  selected,
  onSelect,
}: {
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors",
        "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected
          ? "bg-accent text-accent-foreground"
          : "text-foreground hover:bg-muted",
      )}
    >
      {selected ? (
        <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <Folder className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1 truncate text-sm">スタンドアロンタスク</span>
      {count > 0 && (
        <Badge variant="secondary" size="xs" className="shrink-0">
          {count}
        </Badge>
      )}
    </button>
  );
}

function ProjectRow({
  project,
  taskCount,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onArchive,
}: {
  project: Project;
  taskCount: number;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="group/project relative">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left transition-colors",
          "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          selected
            ? "bg-accent text-accent-foreground"
            : "text-foreground hover:bg-muted",
        )}
      >
        {selected ? (
          <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <Folder className="size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{project.name}</p>
          {project.dueDate && (
            <p className="text-xs text-muted-foreground">
              {format(new Date(project.dueDate), "M/d", { locale: ja })}まで
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity group-focus-within/project:opacity-0 group-hover/project:opacity-0">
          {project.priority && (
            <Badge
              variant={project.priority === "high" ? "destructive" : "secondary"}
              size="xs"
            >
              {PRIORITY_LABELS[project.priority]}
            </Badge>
          )}
          {taskCount > 0 && (
            <Badge variant="secondary" size="xs">
              {taskCount}
            </Badge>
          )}
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
                "absolute right-1 top-1/2 -translate-y-1/2",
                "opacity-0 transition-opacity",
                "group-focus-within/project:opacity-100 group-hover/project:opacity-100",
                "text-muted-foreground hover:text-foreground",
              )}
              aria-label={`${project.name} の操作`}
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
            <DropdownMenuItem onSelect={onArchive}>
              アーカイブ
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              削除
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
