import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { LlmProviderKind, Role } from "@unpam/shared";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`);

export const roles = sqliteTable("roles", {
  id: text("id").$type<Role>().primaryKey(),
  label: text("label").notNull(),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  roleId: text("role_id")
    .$type<Role>()
    .notNull()
    .references(() => roles.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

/** Jejak audit: siapa meminta, apa yang dilakukan, siapa menyetujui (PRD §6). */
export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorType: text("actor_type").$type<"user" | "agent" | "system">().notNull(),
  actorUserId: integer("actor_user_id").references(() => users.id),
  actorAgent: text("actor_agent"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  approvedByUserId: integer("approved_by_user_id").references(() => users.id),
  details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: createdAt(),
});

/** Satu baris (id = 1). Bila kosong, server memakai nilai LLM_* dari .env. */
export const llmProviderConfig = sqliteTable("llm_provider_config", {
  id: integer("id").primaryKey(),
  provider: text("provider").$type<LlmProviderKind>().notNull(),
  baseUrl: text("base_url").notNull().default(""),
  model: text("model").notNull(),
  apiKeyEncrypted: text("api_key_encrypted"),
  apiKeyLast4: text("api_key_last4"),
  updatedByUserId: integer("updated_by_user_id").references(() => users.id),
  updatedAt: text("updated_at").notNull(),
});
