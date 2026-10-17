import Anthropic from "@anthropic-ai/sdk";
import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse, type ResolvedLlmConfig } from "./types";

export class AnthropicProvider implements LlmProvider {
  readonly kind = "anthropic" as const;
  readonly model: string;
  private readonly client: Anthropic;
  /** Fallback refusal sisi server hanya tersedia di endpoint resmi Claude API. */
  private readonly useServerFallback: boolean;

  constructor(config: ResolvedLlmConfig) {
    if (!config.apiKey) throw new LlmError("API key Anthropic belum diisi. Isi di panel Provider AI atau LLM_API_KEY di .env");
    this.model = config.model;
    this.useServerFallback = !config.baseUrl;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
      // Agent sendiri yang mencoba ulang sekali lalu eskalasi (PRD §6).
      maxRetries: 1,
    });
  }

  async chat(request: LlmRequest): Promise<LlmResponse> {
    const params = {
      model: this.model,
      max_tokens: request.maxTokens ?? 16000,
      system: request.system,
      messages: request.messages,
      tools: request.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      })),
      output_config: { effort: request.effort ?? "medium" },
    };

    let response: Anthropic.Message | Anthropic.Beta.BetaMessage;
    try {
      response = this.useServerFallback
        ? await this.client.beta.messages.create({
            ...params,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          } as Anthropic.Beta.MessageCreateParamsNonStreaming)
        : await this.client.messages.create(params);
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) throw new LlmError("API key Anthropic ditolak", 401);
      if (error instanceof Anthropic.RateLimitError) throw new LlmError("Kena rate limit Anthropic, coba lagi nanti", 429);
      if (error instanceof Anthropic.APIError) throw new LlmError(`Anthropic API error: ${error.message}`, error.status);
      throw new LlmError(`Tidak bisa terhubung ke Anthropic: ${(error as Error).message}`);
    }

    const text: string[] = [];
    const toolCalls: LlmResponse["toolCalls"] = [];
    for (const block of response.content) {
      if (block.type === "text") text.push(block.text);
      else if (block.type === "tool_use") toolCalls.push({ id: block.id, name: block.name, input: block.input });
    }

    const stop = response.stop_reason;
    return {
      text: text.join(""),
      toolCalls,
      stopReason: stop === "end_turn" || stop === "tool_use" || stop === "max_tokens" || stop === "refusal" ? stop : "other",
      model: response.model,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  }
}
