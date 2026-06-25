import { z } from "zod";

export const prioritySchema = z.enum(["high", "medium", "low"]);
export type Priority = z.infer<typeof prioritySchema>;

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

/** 予定の参加者（名前＋連絡先） */
export const attendeeSchema = z.object({
  name: z.string(),
  contact: z.string().optional(),
});
export type Attendee = z.infer<typeof attendeeSchema>;

/** 連絡先マスタ（過去入力から自動蓄積） */
export const contactSchema = z.object({
  name: z.string(),
  contact: z.string().optional(),
});
export type Contact = z.infer<typeof contactSchema>;

/** プロジェクト */
export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),  // Tailwind bg-* class or hex
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  summary: z.string().optional(),
  goal: z.string().optional(),
  note: z.string().optional(),
  imageUrl: z.string().optional(),
  urls: z.array(z.string()).default([]),
});
export type Project = z.infer<typeof projectSchema>;

/** 時刻指定のある予定（会議・アポ等） */
export const scheduleSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),                  // "YYYY-MM-DD" 開始日
  endDate: z.string().optional(),    // 複数日イベント時の終了日
  startTime: z.string().optional(),  // "HH:MM"
  endTime: z.string().optional(),    // "HH:MM"
  location: z.string().optional(),
  imageUrl: z.string().optional(),
  note: z.string().optional(),
  priority: prioritySchema.optional(),
  done: z.boolean().default(false),
  projectId: z.string().optional(),
  googleEventId: z.string().optional(),
  attendees: z.array(attendeeSchema).default([]),
  tags: z.array(z.string()).default([]),
});
export type Schedule = z.infer<typeof scheduleSchema>;

/** その日にやること */
export const dailyTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string().optional(),
  time: z.string().optional(),
  priority: prioritySchema.optional(),
  tags: z.array(z.string()).default([]),
  done: z.boolean().default(false),
  note: z.string().optional(),
  imageUrl: z.string().optional(),
  projectId: z.string().optional(),
});
export type DailyTask = z.infer<typeof dailyTaskSchema>;

/** アイデアペインで保存したアイデア */
export const savedIdeaSchema = z.object({
  id: z.string(),
  content: z.string(),
  aiResponse: z.string().optional(),
  tags: z.array(z.string()).default([]),
  category: z.string().optional(),
  createdAt: z.string(),
  projectId: z.string().optional(),
});
export type SavedIdea = z.infer<typeof savedIdeaSchema>;

export const scheduleWorkspaceDataSchema = z.object({
  schedules: z.array(scheduleSchema),
  tasks: z.array(dailyTaskSchema),
  savedIdeas: z.array(savedIdeaSchema),
  contacts: z.array(contactSchema).default([]),
  projects: z.array(projectSchema).default([]),
  globalTags: z.array(z.string()).default([]),
});
export type ScheduleWorkspaceData = z.infer<typeof scheduleWorkspaceDataSchema>;
