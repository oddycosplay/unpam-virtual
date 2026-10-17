import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse, type ResolvedLlmConfig } from "./types";

// Endpoint /chat/completions bergaya OpenAI: 9router, OpenRouter, Ollama, dan sejenisnya.

interface ChatCompletionResponse {
  model?: string;
  choices: {
    finish_reason: string | null;
    message: {
      content: string | null;
      tool_calls?: { id: string; function: { name: string; arguments: string } }[];
    };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly kind = "openai-compatible" as const;
  readonly model: string;

  constructor(private readonly config: ResolvedLlmConfig) {
    if (!config.baseUrl) throw new LlmError("LLM_BASE_URL wajib diisi untuk provider openai-compatible");
    this.model = config.model;
  }

  async chat(request: LlmRequest): Promise<LlmResponse> {
    const messages = [
      ...(request.system ? [{ role: "system", content: request.system }] : []),
      ...request.messages,
    ];
    const body = {
      model: this.model,
      max_tokens: request.maxTokens ?? 4096,
      messages,
      tools: request.tools?.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.inputSchema },
      })),
    };

    const url = `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      throw new LlmError(`Tidak bisa terhubung ke ${url}: ${(error as Error).message}`);
    }
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new LlmError(`Provider membalas ${res.status}: ${detail}`, res.status);
    }

    const data = (await res.json()) as ChatCompletionResponse;
    const choice = data.choices[0];
    if (!choice) throw new LlmError("Provider tidak mengembalikan jawaban");

    const toolCalls = (choice.message.tool_calls ?? []).map((call) => {
      let input: unknown;
      try {
        input = JSON.parse(call.function.arguments || "{}");
      } catch {
        input = { _raw: call.function.arguments };
      }
      return { id: call.id, name: call.function.name, input };
    });

    const finish = choice.finish_reason;
    return {
      text: choice.message.content ?? "",
      toolCalls,
      stopReason:
        finish === "stop" ? "end_turn" : finish === "tool_calls" ? "tool_use" : finish === "length" ? "max_tokens" : "other",
      model: data.model ?? this.model,
      usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 },
    };
  }
}
