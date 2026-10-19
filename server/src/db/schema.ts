import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
  AvatarLook,
  ChatSource,
  Decision,
  LlmProviderKind,
  OrganizationKind,
  OrganizationLinkType,
  ProposalBrief,
  ProposalContent,
  Role,
  SubmissionStatus,
  TaskStatus,
} from "@unpam/shared";

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
  /** Naik setiap password/peran/status berubah; sesi dengan versi lama ditolak. */
  tokenVersion: integer("token_version").notNull().default(0),
  /** True setelah admin membuat akun atau mereset password (password sementara). */
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  /** Batas token AI per hari untuk pengguna ini; null = pakai batas global. */
  dailyTokenLimit: integer("daily_token_limit"),
  /** Avatar kampus 3D (JSON AvatarLook); null = bawaan peran. */
  avatar: text("avatar", { mode: "json" }).$type<AvatarLook>(),
  createdAt: createdAt(),
});

/** Pengaturan aplikasi yang bisa diubah admin (key-value). */
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedByUserId: integer("updated_by_user_id").references(() => users.id),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
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

/** Pengajuan (proposal kegiatan HIMA). Isi terkini di `content`, riwayat di submission_versions. */
export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull().default("proposal_kegiatan"),
  title: text("title").notNull(),
  status: text("status").$type<SubmissionStatus>().notNull(),
  brief: text("brief", { mode: "json" }).$type<ProposalBrief>(),
  content: text("content", { mode: "json" }).$type<ProposalContent>(),
  currentVersion: integer("current_version").notNull().default(0),
  error: text("error"),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  submittedAt: text("submitted_at"),
});

export const submissionVersions = sqliteTable("submission_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  submissionId: integer("submission_id")
    .notNull()
    .references(() => submissions.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  content: text("content", { mode: "json" }).$type<ProposalContent>().notNull(),
  createdByAgent: text("created_by_agent"),
  createdByUserId: integer("created_by_user_id").references(() => users.id),
  note: text("note"),
  createdAt: createdAt(),
});

/** Keputusan penyetuju (PRD §9: penyetuju, keputusan, catatan). */
export const approvals = sqliteTable("approvals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  submissionId: integer("submission_id")
    .notNull()
    .references(() => submissions.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  decision: text("decision").$type<Decision>().notNull(),
  note: text("note"),
  deciderUserId: integer("decider_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

export const submissionComments = sqliteTable("submission_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  submissionId: integer("submission_id")
    .notNull()
    .references(() => submissions.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

/** Kartu di papan tugas. */
export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  status: text("status").$type<TaskStatus>().notNull().default("baru"),
  agentId: text("agent_id"),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => users.id),
  submissionId: integer("submission_id").references(() => submissions.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  readAt: text("read_at"),
  createdAt: createdAt(),
});

/** Direktori organisasi mahasiswa (HIMA dan UKM) se-Universitas Pamulang. */
export const organizations = sqliteTable("organizations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").$type<OrganizationKind>().notNull(),
  number: integer("number").notNull(),
  name: text("name").notNull(),
  linkType: text("link_type").$type<OrganizationLinkType>().notNull(),
  url: text("url"),
  updatedByUserId: integer("updated_by_user_id").references(() => users.id),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
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
