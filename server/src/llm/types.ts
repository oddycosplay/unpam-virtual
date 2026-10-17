import type { LlmProviderKind } from "@unpam/shared";

// Bentuk netral-provider yang dipakai agent. Tiap adapter menerjemahkan ke API masing-masing.

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmTool {
  name: string;
  description: string;
  /** JSON Schema objek input tool. */
  inputSchema: Record<string, unknown>;
}

export interface LlmToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface LlmRequest {
  system?: string;
  messages: LlmMessage[];
  tools?: LlmTool[];
  maxTokens?: number;
  /** Hanya dipakai adapter Anthropic. */
  effort?: "low" | "medium" | "high";
}

export interface LlmResponse {
  text: string;
  toolCalls: LlmToolCall[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "refusal" | "other";
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface LlmProvider {
  readonly kind: LlmProviderKind;
  readonly model: string;
  chat(request: LlmRequest): Promise<LlmResponse>;
}

export interface ResolvedLlmConfig {
  provider: LlmProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}
