import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schedules, tasks } from "@/db/schema";
import { ensureSystemUser, SYSTEM_USER_ID } from "@/lib/system-user";
import { dbToSchedule, dbToTask } from "@/lib/db-transforms";
import { ScheduleWorkspace } from "@/components/schedule-workspace/ScheduleWorkspace";
import type { ScheduleWorkspaceData } from "@/lib/schedule-schema";

export default async function Page() {
  await ensureSystemUser();

  const [dbSchedules, dbTasks] = await Promise.all([
    db
      .select()
      .from(schedules)
      .where(eq(schedules.userId, SYSTEM_USER_ID))
      .orderBy(schedules.date),
    db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, SYSTEM_USER_ID))
      .orderBy(tasks.date),
  ]);

  const initialData: ScheduleWorkspaceData = {
    schedules: dbSchedules.map(dbToSchedule),
    tasks: dbTasks.map(dbToTask),
    // projects / ideas / contacts / globalTags は引き続き localStorage で管理
    savedIdeas: [],
    contacts: [],
    projects: [],
    globalTags: [],
  };

  return <ScheduleWorkspace initialData={initialData} />;
}
