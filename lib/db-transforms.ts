/**
 * DB レコード（Drizzle の infer 型）← → アプリ型（schedule-schema）の変換ユーティリティ。
 */
import type { InferSelectModel } from "drizzle-orm";
import type { schedules, tasks } from "@/db/schema";
import type { Schedule, DailyTask, Priority } from "@/lib/schedule-schema";

type DbSchedule = InferSelectModel<typeof schedules>;
type DbTask = InferSelectModel<typeof tasks>;

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
