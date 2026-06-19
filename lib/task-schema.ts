import { z } from "zod";

// ===== Priority =====

export const prioritySchema = z.enum(["high", "medium", "low"]);
export type Priority = z.infer<typeof prioritySchema>;

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

// ===== Project =====

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: prioritySchema.optional(),
  tags: z.array(z.string()).default([]),
  archived: z.boolean().default(false),
});
export type Project = z.infer<typeof projectSchema>;

// ===== Task =====

export const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

export const taskSchema = z.object({
  id: z.string(),
  projectId: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  scheduledDate: z.string().optional(),
  priority: prioritySchema.optional(),
  tags: z.array(z.string()).default([]),
  status: taskStatusSchema.default("todo"),
  isPrivate: z.boolean().default(false),
  archived: z.boolean().default(false),
});
export type Task = z.infer<typeof taskSchema>;

// ===== TodoItem =====

export const todoItemSchema = z.object({
  id: z.string(),
  taskId: z.string().optional(),
  title: z.string(),
  note: z.string().optional(),
  dueDate: z.string().optional(),
  scheduledDate: z.string().optional(),
  priority: prioritySchema.optional(),
  tags: z.array(z.string()).default([]),
  isPrivate: z.boolean().default(false),
  done: z.boolean().default(false),
});
export type TodoItem = z.infer<typeof todoItemSchema>;

// ===== Idea =====

export const ideaSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.string(),
});
export type Idea = z.infer<typeof ideaSchema>;

// ===== Workspace data (root) =====

export const taskWorkspaceDataSchema = z.object({
  projects: z.array(projectSchema),
  tasks: z.array(taskSchema),
  todos: z.array(todoItemSchema),
  ideas: z.array(ideaSchema),
});
export type TaskWorkspaceData = z.infer<typeof taskWorkspaceDataSchema>;

// ===== Constants =====

/** 「プロジェクト未所属タスク」を表す仮想プロジェクト ID */
export const STANDALONE_PROJECT_ID = "__standalone";

/** 「タスク未所属 TODO」を表す仮想タスク ID */
export const STANDALONE_TASK_ID = "__standalone";
