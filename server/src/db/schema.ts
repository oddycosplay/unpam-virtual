import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ChatSource, LlmProviderKind, Role } from "@unpam/shared";

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

/** Dokumen resmi kampus yang diunggah admin sebagai basis pengetahuan agent. */
export const knowledgeDocuments = sqliteTable("knowledge_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  /** Agent yang boleh memakai dokumen ini, mis. "akademik". */
  agentScope: text("agent_scope").notNull().default("akademik"),
  chunkCount: integer("chunk_count").notNull().default(0),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => users.id),
  createdAt: createdAt(),
});

/** Potongan dokumen. Diindeks oleh tabel virtual FTS5 document_chunks_fts (lihat migrasi custom). */
export const documentChunks = sqliteTable("document_chunks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("document_id")
    .notNull()
    .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
  ordinal: integer("ordinal").notNull(),
  /** Judul bagian terdekat (heading markdown) atau "Halaman N" untuk PDF. */
  section: text("section"),
  page: integer("page"),
  content: text("content").notNull(),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  agentId: text("agent_id").notNull(),
  role: text("role").$type<"user" | "assistant">().notNull(),
  content: text("content").notNull(),
  sources: text("sources", { mode: "json" }).$type<ChatSource[]>(),
  status: text("status").$type<"ok" | "error">().notNull().default("ok"),
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
