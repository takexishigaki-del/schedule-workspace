import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { projects, ideas, contacts, tags, schedules, tasks } from "@/db/schema";
import { ensureSystemUser, SYSTEM_USER_ID } from "@/lib/system-user";
import {
  dbToProject,
  dbToIdea,
  dbToContact,
} from "@/lib/db-transforms";
import {
  projectSchema,
  savedIdeaSchema,
  contactSchema,
} from "@/lib/schedule-schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toUuid(id: string): string {
  return UUID_RE.test(id) ? id : crypto.randomUUID();
}

const migratePayloadSchema = z.object({
  savedIdeas: z.array(savedIdeaSchema).default([]),
  contacts: z.array(contactSchema).default([]),
  projects: z.array(projectSchema).default([]),
  globalTags: z.array(z.string()).default([]),
});

/** localStorage のデータを DB に移行（既存データは上書きしない） */
export async function POST(request: Request) {
  await ensureSystemUser();
  const body: unknown = await request.json();
  const parsed = migratePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const { savedIdeas, contacts: incomingContacts, projects: incomingProjects, globalTags } =
    parsed.data;

  const projectIdMap = new Map<string, string>();

  const [existingProjects, existingIdeas, existingContacts, existingTags] =
    await Promise.all([
      db.select().from(projects).where(eq(projects.userId, SYSTEM_USER_ID)),
      db.select().from(ideas).where(eq(ideas.userId, SYSTEM_USER_ID)),
      db.select().from(contacts).where(eq(contacts.userId, SYSTEM_USER_ID)),
      db.select().from(tags).where(eq(tags.userId, SYSTEM_USER_ID)),
    ]);

  const existingProjectIds = new Set(existingProjects.map((p) => p.id));
  const existingIdeaIds = new Set(existingIdeas.map((i) => i.id));
  const existingContactNames = new Set(
    existingContacts.map((c) => c.name.toLowerCase()),
  );
  const existingTagNames = new Set(existingTags.map((t) => t.name));

  for (const p of incomingProjects) {
    if (existingProjectIds.has(p.id)) {
      projectIdMap.set(p.id, p.id);
      continue;
    }
    const newId = toUuid(p.id);
    projectIdMap.set(p.id, newId);
    await db.insert(projects).values({
      id: newId,
      userId: SYSTEM_USER_ID,
      name: p.name,
      color: p.color ?? null,
      summary: p.summary ?? null,
      goal: p.goal ?? null,
      note: p.note ?? null,
      imageUrl: p.imageUrl ?? null,
      urlsJson: JSON.stringify(p.urls ?? []),
      startDate: p.startDate ?? null,
      endDate: p.endDate ?? null,
    });
    existingProjectIds.add(newId);
  }

  for (const [oldId, newId] of projectIdMap) {
    if (oldId === newId) continue;
    await db
      .update(schedules)
      .set({ projectId: newId })
      .where(eq(schedules.projectId, oldId));
    await db
      .update(tasks)
      .set({ projectId: newId })
      .where(eq(tasks.projectId, oldId));
  }

  for (const i of savedIdeas) {
    if (existingIdeaIds.has(i.id)) continue;
    const newId = toUuid(i.id);
    const mappedProjectId = i.projectId
      ? (projectIdMap.get(i.projectId) ?? i.projectId)
      : null;
    await db.insert(ideas).values({
      id: newId,
      userId: SYSTEM_USER_ID,
      projectId: mappedProjectId,
      content: i.content,
      aiResponse: i.aiResponse ?? null,
      category: i.category ?? null,
      tagsJson: JSON.stringify(i.tags ?? []),
      createdAt: new Date(i.createdAt),
    });
    existingIdeaIds.add(newId);
  }

  for (const c of incomingContacts) {
    if (!c.name.trim() || existingContactNames.has(c.name.toLowerCase())) continue;
    await db.insert(contacts).values({
      userId: SYSTEM_USER_ID,
      name: c.name,
      contactInfo: c.contact ?? null,
    });
    existingContactNames.add(c.name.toLowerCase());
  }

  for (const tag of globalTags) {
    const name = tag.trim();
    if (!name || existingTagNames.has(name) || existingTagNames.size >= 20) continue;
    await db.insert(tags).values({
      userId: SYSTEM_USER_ID,
      name,
    });
    existingTagNames.add(name);
  }

  const [dbProjects, dbIdeas, dbContacts, dbTags] = await Promise.all([
    db.select().from(projects).where(eq(projects.userId, SYSTEM_USER_ID)),
    db.select().from(ideas).where(eq(ideas.userId, SYSTEM_USER_ID)),
    db.select().from(contacts).where(eq(contacts.userId, SYSTEM_USER_ID)),
    db.select().from(tags).where(eq(tags.userId, SYSTEM_USER_ID)),
  ]);

  return NextResponse.json({
    projects: dbProjects.map(dbToProject),
    savedIdeas: dbIdeas.map(dbToIdea).reverse(),
    contacts: dbContacts.map(dbToContact),
    globalTags: dbTags.map((t) => t.name),
  });
}
