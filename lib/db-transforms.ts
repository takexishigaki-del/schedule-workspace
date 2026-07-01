/**
 * DB レコード（Drizzle の infer 型）← → アプリ型（schedule-schema）の変換ユーティリティ。
 */
import type { InferSelectModel } from "drizzle-orm";
import type { schedules, tasks, projects, ideas, contacts } from "@/db/schema";
import type {
  Schedule,
  DailyTask,
  Project,
  SavedIdea,
  Contact,
  Priority,
} from "@/lib/schedule-schema";

type DbSchedule = InferSelectModel<typeof schedules>;
type DbTask = InferSelectModel<typeof tasks>;
type DbProject = InferSelectModel<typeof projects>;
type DbIdea = InferSelectModel<typeof ideas>;
type DbContact = InferSelectModel<typeof contacts>;

function parseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function dbToSchedule(row: DbSchedule): Schedule {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    endDate: row.endDate ?? undefined,
    startTime: row.startTime ?? undefined,
    endTime: row.endTime ?? undefined,
    location: row.location ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    note: row.note ?? undefined,
    priority: (row.priority as Priority) ?? undefined,
    done: row.done,
    projectId: row.projectId ?? undefined,
    googleEventId: row.googleEventId ?? undefined,
    attendees: parseJson(row.attendeesJson, []),
    tags: parseJson(row.tagsJson, []),
  };
}

export function dbToTask(row: DbTask): DailyTask {
  return {
    id: row.id,
    title: row.title,
    date: row.date ?? undefined,
    time: row.time ?? undefined,
    priority: (row.priority as Priority) ?? undefined,
    done: row.done,
    note: row.note ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    projectId: row.projectId ?? undefined,
    tags: parseJson(row.tagsJson, []),
  };
}

export function dbToProject(row: DbProject): Project {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? undefined,
    startDate: row.startDate ?? undefined,
    endDate: row.endDate ?? undefined,
    summary: row.summary ?? undefined,
    goal: row.goal ?? undefined,
    note: row.note ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    urls: parseJson(row.urlsJson, []),
  };
}

export function dbToIdea(row: DbIdea): SavedIdea {
  return {
    id: row.id,
    content: row.content,
    aiResponse: row.aiResponse ?? undefined,
    category: row.category ?? undefined,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    projectId: row.projectId ?? undefined,
    tags: parseJson(row.tagsJson, []),
  };
}

export function dbToContact(row: DbContact): Contact {
  return {
    name: row.name,
    contact: row.contactInfo ?? undefined,
  };
}
