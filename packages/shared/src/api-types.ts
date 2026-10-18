import type { Role } from "./roles";
import type { AgentStatus } from "./status";

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

export interface AgentStatusView {
  id: "orkestrator" | "akademik" | "hima";
  name: string;
  status: AgentStatus;
  /** Teks pendek untuk label di atas agent, mis. "Menjawab pertanyaan jadwal". */
  activity: string;
  active: boolean;
}

export interface ActivityItem {
  id: number;
  at: string;
  /** Kalimat siap tampil, mis. "Agent Akademik menjawab pertanyaan (4,1 dtk)". */
  text: string;
  kind: "agent" | "user" | "system" | "error";
}

export interface DashboardSummary {
  agents: AgentStatusView[];
  stats: {
    questionsToday: number;
    answersToday: number;
    errorsToday: number;
    avgLatencyMs: number | null;
    documents: number;
    chunks: number;
    users: number;
  };
  /** Jumlah jawaban agent per jam, 12 jam terakhir (index terakhir = jam ini). */
  answersPerHour: number[];
  recentActivity: ActivityItem[];
}

export interface ApiError {
  error: string;
}
