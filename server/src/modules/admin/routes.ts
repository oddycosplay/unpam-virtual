import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { LlmTestResult } from "@unpam/shared";
import type { AppContext } from "../../app";
import { audit } from "../../audit/log";
import { requirePermission } from "../../auth/auth";
import { encryptSecret } from "../../crypto/secrets";
import { llmProviderConfig } from "../../db/schema";
import { createProvider, resolveLlmConfig } from "../../llm/factory";
import { LlmError } from "../../llm/types";

const LlmConfigBody = z.object({
  provider: z.enum(["anthropic", "openai-compatible"]),
  baseUrl: z.union([z.literal(""), z.string().trim().url()]),
  model: z.string().trim().min(1),
  apiKey: z.string().trim().optional(),
});

export function adminRoutes(app: FastifyInstance, { db, config }: AppContext): void {
  const guard = { preHandler: requirePermission("admin:config") };

  app.get("/api/admin/llm-config", guard, async () => ({ config: resolveLlmConfig(db, config).view }));

  app.put("/api/admin/llm-config", guard, async (request, reply) => {
    const body = LlmConfigBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? "Data tidak valid" });
    if (body.data.provider === "openai-compatible" && !body.data.baseUrl) {
      return reply.code(400).send({ error: "Base URL wajib diisi untuk provider openai-compatible" });
    }

    const current = resolveLlmConfig(db, config);
    const newKey = body.data.apiKey ? body.data.apiKey : current.apiKey;
    const values = {
      id: 1,
      provider: body.data.provider,
      baseUrl: body.data.baseUrl,
      model: body.data.model,
      apiKeyEncrypted: newKey ? encryptSecret(newKey, config.ENCRYPTION_KEY) : null,
      apiKeyLast4: newKey ? newKey.slice(-4) : null,
      updatedByUserId: request.user!.id,
      updatedAt: new Date().toISOString(),
    };
    db.insert(llmProviderConfig).values(values).onConflictDoUpdate({ target: llmProviderConfig.id, set: values }).run();

    audit(db, {
      actorType: "user",
      actorUserId: request.user!.id,
      action: "config.llm_updated",
      targetType: "llm_provider_config",
      targetId: 1,
      details: {
        provider: values.provider,
        baseUrl: values.baseUrl,
        model: values.model,
        apiKeyChanged: Boolean(body.data.apiKey),
      },
    });
    return { config: resolveLlmConfig(db, config).view };
  });

  app.post("/api/admin/llm-config/test", guard, async (request) => {
    const resolved = resolveLlmConfig(db, config);
    const started = Date.now();
    let result: LlmTestResult;
    try {
      const provider = createProvider(resolved);
      const res = await provider.chat({
        messages: [{ role: "user", content: "Balas hanya dengan satu kata: OK" }],
        maxTokens: 2000,
        effort: "low",
      });
      result = { ok: true, provider: resolved.provider, model: res.model, latencyMs: Date.now() - started, reply: res.text.trim() };
    } catch (error) {
      const message = error instanceof LlmError ? error.message : `Error tak terduga: ${(error as Error).message}`;
      result = { ok: false, provider: resolved.provider, model: resolved.model, latencyMs: Date.now() - started, error: message };
    }
    audit(db, {
      actorType: "user",
      actorUserId: request.user!.id,
      action: "config.llm_tested",
      details: { ok: result.ok, provider: result.provider, model: result.model, latencyMs: result.latencyMs, error: result.error },
    });
    return result;
  });
}
