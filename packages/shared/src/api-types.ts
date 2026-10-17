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

export interface ApiError {
  error: string;
}
