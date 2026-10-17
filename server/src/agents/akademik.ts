import type { ChatSource } from "@unpam/shared";
import type { Db } from "../db/client";
import { LlmError, type LlmMessage, type LlmProvider } from "../llm/types";
import { searchChunks } from "../rag/search";
import { redactPersonalData } from "./privacy";

export const AKADEMIK_AGENT_ID = "akademik";

export const NOT_FOUND_ANSWER =
  "Maaf, saya tidak menemukan jawabannya di dokumen resmi yang tersedia. " +
  "Silakan tanyakan langsung ke bagian akademik atau dosen wali Anda.";

const SYSTEM_PROMPT = `Kamu adalah Agent Akademik, asisten AI di Unpam Virtual untuk Program Studi Sistem Informasi Universitas Pamulang.
Kamu menjawab pertanyaan seputar jadwal, prosedur, dan kalender akademik.

Aturan yang wajib diikuti:
- Jawab HANYA berdasarkan kutipan dokumen yang diberikan di dalam <dokumen>. Jangan memakai pengetahuan umum atau menebak.
- Setiap fakta harus diberi rujukan nomor kutipan dalam kurung siku, misalnya [1] atau [2][3].
- Bila kutipan tidak memuat jawabannya, katakan dengan jelas bahwa kamu tidak tahu karena informasinya tidak ada di dokumen, lalu sarankan bertanya ke bagian akademik. Jangan beri rujukan dalam kasus ini.
- Kamu asisten AI, bukan sumber resmi kampus. Bila pengguna meminta keputusan resmi, arahkan ke pihak kampus.
- Jawab dalam bahasa Indonesia yang ringkas dan jelas. Gunakan daftar bernomor untuk langkah-langkah.`;

export interface AgentAnswer {
  text: string;
  sources: ChatSource[];
  usedLlm: boolean;
  attempts: number;
  usage: { inputTokens: number; outputTokens: number };
}

export class AgentError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
  ) {
    super(message);
    this.name = "AgentError";
  }
}

function excerpt(content: string, max = 280): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

export async function answerAkademik(input: {
  db: Db;
  provider: () => LlmProvider;
  question: string;
  history: LlmMessage[];
}): Promise<AgentAnswer> {
  const hits = searchChunks(input.db, input.question, { agentScope: AKADEMIK_AGENT_ID, limit: 5 });
  if (hits.length === 0) {
    return { text: NOT_FOUND_ANSWER, sources: [], usedLlm: false, attempts: 0, usage: { inputTokens: 0, outputTokens: 0 } };
  }

  const context = hits
    .map((h, i) => {
      const where = [h.documentTitle, h.section].filter(Boolean).join(" — ");
      return `<kutipan nomor="${i + 1}" sumber="${where}">\n${h.content}\n</kutipan>`;
    })
    .join("\n");

  const messages: LlmMessage[] = [
    ...input.history.map((m) => ({ role: m.role, content: redactPersonalData(m.content) })),
    {
      role: "user",
      content: `<dokumen>\n${context}\n</dokumen>\n\nPertanyaan: ${redactPersonalData(input.question)}`,
    },
  ];

  // Coba ulang sekali, lalu eskalasi ke manusia (PRD §6).
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await input.provider().chat({ system: SYSTEM_PROMPT, messages, maxTokens: 4000, effort: "low" });
      if (res.stopReason === "refusal") throw new LlmError("Model menolak menjawab pertanyaan ini");
      const text = res.text.trim();
      if (!text) throw new LlmError("Model tidak memberi jawaban");

      const cited = new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
      const sources: ChatSource[] = hits
        .map((h, i) => ({
          ref: i + 1,
          documentId: h.documentId,
          documentTitle: h.documentTitle,
          section: h.section,
          page: h.page,
          excerpt: excerpt(h.content),
        }))
        .filter((s) => cited.has(s.ref));

      return { text, sources, usedLlm: true, attempts: attempt, usage: res.usage };
    } catch (error) {
      lastError = error;
    }
  }
  throw new AgentError(lastError instanceof Error ? lastError.message : String(lastError), 2);
}
