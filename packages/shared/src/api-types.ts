import type { Role } from "./roles";

export interface PublicUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type LlmProviderKind = "anthropic" | "openai-compatible";

export interface LlmConfigView {
  provider: LlmProviderKind;
  baseUrl: string;
  model: string;
  /** API key tidak pernah dikirim balik; hanya penanda dan 4 karakter terakhir. */
  hasApiKey: boolean;
  apiKeyLast4: string | null;
  source: "database" | "env";
  updatedAt: string | null;
}

export interface LlmConfigUpdate {
  provider: LlmProviderKind;
  baseUrl: string;
  model: string;
  /** Kosong/undefined = pertahankan key lama. */
  apiKey?: string;
}

export interface LlmTestResult {
  ok: boolean;
  provider: LlmProviderKind;
  model: string;
  latencyMs: number;
  reply?: string;
  error?: string;
}

export interface ChatSource {
  /** Nomor rujukan yang dipakai agent di jawaban, mis. [1]. */
  ref: number;
  documentId: number;
  documentTitle: string;
  section: string | null;
  page: number | null;
  excerpt: string;
}

export interface ChatMessageView {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources: ChatSource[];
  status: "ok" | "error";
  createdAt: string;
}

export interface ChatReply {
  userMessage: ChatMessageView;
  reply: ChatMessageView;
}

export interface KnowledgeDocumentView {
  id: number;
  title: string;
  fileName: string;
  mimeType: string;
  agentScope: string;
  chunkCount: number;
  createdAt: string;
}

export interface ApiError {
  error: string;
}
