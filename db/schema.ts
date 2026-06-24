/**
 * Drizzle ORM スキーマ定義。
 * このファイルが DB テーブルの「設計図」になる。
 * 変更したら `npx drizzle-kit push` で Neon に反映する。
 */
import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  date,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

// ── ユーザー ─────────────────────────────────────────────────
// 現フェーズはシングルユーザー（パスワード認証）のため clerkId は nullable。
export const users = pgTable("users", {
  id:        uuid("id").primaryKey().defaultRandom(),
  clerkId:   text("clerk_id").unique(), // nullable: Clerk 未使用時は null
  email:     text("email").notNull(),
  name:      text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── プロジェクト ─────────────────────────────────────────────
export const projects = pgTable("projects", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id")
               .references(() => users.id, { onDelete: "cascade" })
               .notNull(),
  name:      text("name").notNull(),
  color:     varchar("color", { length: 20 }),
  summary:   text("summary"),
  goal:      text("goal"),
  note:      text("note"),
  startDate: date("start_date"),
  endDate:   date("end_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ── 予定（カレンダーイベント）────────────────────────────────
export const schedules = pgTable("schedules", {
  id:            uuid("id").primaryKey().defaultRandom(),
  userId:        uuid("user_id")
                   .references(() => users.id, { onDelete: "cascade" })
                   .notNull(),
  projectId:     text("project_id"),   // FK なし（projects 移行前は LS の ID をそのまま保存）
  title:         text("title").notNull(),
  date:          date("date").notNull(),
  endDate:       date("end_date"),
  startTime:     varchar("start_time", { length: 5 }),
  endTime:       varchar("end_time",   { length: 5 }),
  location:      text("location"),
  imageUrl:      text("image_url"),
  note:          text("note"),
  priority:      varchar("priority", { length: 10 }),
  done:          boolean("done").default(false).notNull(),
  attendeesJson: text("attendees_json").default("[]").notNull(),
  tagsJson:      text("tags_json").default("[]").notNull(),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── タスク（やること）────────────────────────────────────────
export const tasks = pgTable("tasks", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id")
               .references(() => users.id, { onDelete: "cascade" })
               .notNull(),
  projectId: text("project_id"),   // FK なし（projects 移行前は LS の ID をそのまま保存）
  title:     text("title").notNull(),
  date:      date("date"),
  time:      varchar("time", { length: 5 }),
  priority:  varchar("priority", { length: 10 }),
  done:      boolean("done").default(false).notNull(),
  note:      text("note"),
  imageUrl:  text("image_url"),
  tagsJson:  text("tags_json").default("[]").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── アイデア ─────────────────────────────────────────────────
export const ideas = pgTable("ideas", {
  id:         uuid("id").primaryKey().defaultRandom(),
  userId:     uuid("user_id")
                .references(() => users.id, { onDelete: "cascade" })
                .notNull(),
  projectId:  uuid("project_id")
                .references(() => projects.id, { onDelete: "set null" }),
  content:    text("content").notNull(),
  aiResponse: text("ai_response"),
  category:   varchar("category", { length: 50 }),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── 連絡先マスタ ─────────────────────────────────────────────
export const contacts = pgTable("contacts", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      uuid("user_id")
                 .references(() => users.id, { onDelete: "cascade" })
                 .notNull(),
  name:        text("name").notNull(),
  contactInfo: text("contact_info"),
});

// ── タグマスタ ───────────────────────────────────────────────
export const tags = pgTable("tags", {
  id:     uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
            .references(() => users.id, { onDelete: "cascade" })
            .notNull(),
  name:   text("name").notNull(),
});

// ── 中間テーブル（多対多）────────────────────────────────────

export const scheduleAttendees = pgTable(
  "schedule_attendees",
  {
    scheduleId: uuid("schedule_id")
                  .references(() => schedules.id, { onDelete: "cascade" })
                  .notNull(),
    contactId:  uuid("contact_id")
                  .references(() => contacts.id, { onDelete: "cascade" })
                  .notNull(),
  },
  (t) => [primaryKey({ columns: [t.scheduleId, t.contactId] })],
);

export const scheduleTags = pgTable(
  "schedule_tags",
  {
    scheduleId: uuid("schedule_id")
                  .references(() => schedules.id, { onDelete: "cascade" })
                  .notNull(),
    tagId:      uuid("tag_id")
                  .references(() => tags.id, { onDelete: "cascade" })
                  .notNull(),
  },
  (t) => [primaryKey({ columns: [t.scheduleId, t.tagId] })],
);

export const taskTags = pgTable(
  "task_tags",
  {
    taskId: uuid("task_id")
              .references(() => tasks.id, { onDelete: "cascade" })
              .notNull(),
    tagId:  uuid("tag_id")
              .references(() => tags.id, { onDelete: "cascade" })
              .notNull(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.tagId] })],
);

export const ideaTags = pgTable(
  "idea_tags",
  {
    ideaId: uuid("idea_id")
              .references(() => ideas.id, { onDelete: "cascade" })
              .notNull(),
    tagId:  uuid("tag_id")
              .references(() => tags.id, { onDelete: "cascade" })
              .notNull(),
  },
  (t) => [primaryKey({ columns: [t.ideaId, t.tagId] })],
);

// ── 添付ファイル（Vercel Blob の URL を保存）─────────────────
// imageUrl の Base64 をやめて、ここにファイル URL を入れる。
export const attachments = pgTable("attachments", {
  id:         uuid("id").primaryKey().defaultRandom(),
  entityType: varchar("entity_type", { length: 20 }).notNull(), // 'schedule'|'task'|'project'
  entityId:   uuid("entity_id").notNull(),
  storageUrl: text("storage_url").notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow(),
});
