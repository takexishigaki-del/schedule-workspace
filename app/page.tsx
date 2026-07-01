import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schedules, tasks, projects, ideas, contacts, tags } from "@/db/schema";
import { ensureSystemUser, SYSTEM_USER_ID } from "@/lib/system-user";
import {
  dbToSchedule,
  dbToTask,
  dbToProject,
  dbToIdea,
  dbToContact,
} from "@/lib/db-transforms";
import { ScheduleWorkspace } from "@/components/schedule-workspace/ScheduleWorkspace";
import type { ScheduleWorkspaceData } from "@/lib/schedule-schema";

export default async function Page() {
  await ensureSystemUser();

  const [dbSchedules, dbTasks, dbProjects, dbIdeas, dbContacts, dbTags] =
    await Promise.all([
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
      db
        .select()
        .from(projects)
        .where(eq(projects.userId, SYSTEM_USER_ID))
        .orderBy(projects.name),
      db
        .select()
        .from(ideas)
        .where(eq(ideas.userId, SYSTEM_USER_ID))
        .orderBy(ideas.createdAt),
      db
        .select()
        .from(contacts)
        .where(eq(contacts.userId, SYSTEM_USER_ID))
        .orderBy(contacts.name),
      db
        .select()
        .from(tags)
        .where(eq(tags.userId, SYSTEM_USER_ID))
        .orderBy(tags.name),
    ]);

  const initialData: ScheduleWorkspaceData = {
    schedules: dbSchedules.map(dbToSchedule),
    tasks: dbTasks.map(dbToTask),
    projects: dbProjects.map(dbToProject),
    savedIdeas: dbIdeas.map(dbToIdea).reverse(),
    contacts: dbContacts.map(dbToContact),
    globalTags: dbTags.map((t) => t.name),
  };

  return <ScheduleWorkspace initialData={initialData} />;
}
