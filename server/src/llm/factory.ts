import { eq } from "drizzle-orm";
import type { LlmConfigView } from "@unpam/shared";
import type { AppConfig } from "../config/env";
import { decryptSecret } from "../crypto/secrets";
import type { Db } from "../db/client";
import { llmProviderConfig } from "../db/schema";
import { AnthropicProvider } from "./anthropic";
import { OpenAiCompatibleProvider } from "./openai-compatible";
import type { LlmProvider, ResolvedLlmConfig } from "./types";

/** Konfigurasi dari panel admin (DB) diutamakan; bila belum ada, pakai LLM_* dari .env. */
export function resolveLlmConfig(db: Db, config: AppConfig): ResolvedLlmConfig & { view: LlmConfigView } {
  const row = db.select().from(llmProviderConfig).where(eq(llmProviderConfig.id, 1)).get();
  if (row) {
    const apiKey = row.apiKeyEncrypted ? decryptSecret(row.apiKeyEncrypted, config.ENCRYPTION_KEY) : "";
    return {
      provider: row.provider,
      baseUrl: row.baseUrl,
      model: row.model,
      apiKey,
      view: {
        provider: row.provider,
        baseUrl: row.baseUrl,
        model: row.model,
        hasApiKey: Boolean(apiKey),
        apiKeyLast4: row.apiKeyLast4,
        source: "database",
        updatedAt: row.updatedAt,
      },
    };
  }
  return {
    provider: config.LLM_PROVIDER,
    baseUrl: config.LLM_BASE_URL,
    model: config.LLM_MODEL,
    apiKey: config.LLM_API_KEY,
    view: {
      provider: config.LLM_PROVIDER,
      baseUrl: config.LLM_BASE_URL,
      model: config.LLM_MODEL,
      hasApiKey: Boolean(config.LLM_API_KEY),
      apiKeyLast4: config.LLM_API_KEY ? config.LLM_API_KEY.slice(-4) : null,
      source: "env",
      updatedAt: null,
    },
  };
}

export function createProvider(config: ResolvedLlmConfig): LlmProvider {
  return config.provider === "anthropic" ? new AnthropicProvider(config) : new OpenAiCompatibleProvider(config);
}

export function getLlmProvider(db: Db, config: AppConfig): LlmProvider {
  return createProvider(resolveLlmConfig(db, config));
}
