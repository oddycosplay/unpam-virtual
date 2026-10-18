import { z } from "zod";
import type { ProposalBrief, ProposalContent } from "@unpam/shared";
import type { Db } from "../db/client";
import { LlmError, type LlmProvider, type LlmTool } from "../llm/types";
import { searchChunks } from "../rag/search";
import { redactPersonalData } from "./privacy";

export const HIMA_AGENT_ID = "hima";
const TOOL_NAME = "simpan_draf_proposal";

const SYSTEM_PROMPT = `Kamu adalah Agent HIMA, asisten AI di Unpam Virtual yang membantu pengurus Himpunan Mahasiswa Sistem Informasi (HIMA SI) Universitas Pamulang menyusun proposal kegiatan.

Tugasmu: menyusun DRAF proposal dari ringkasan kegiatan, lalu menyimpannya dengan memanggil tool "${TOOL_NAME}" tepat satu kali.

Aturan:
- Ikuti struktur dan aturan di kutipan SOP dalam <sop> bila ada.
- Gunakan hanya fakta dari ringkasan pengurus. Bila informasi tidak diberikan (nama narasumber, nama panitia, tanggal pasti), tulis penanda dalam kurung siku, misalnya "[isi nama ketua panitia]". Jangan mengarang nama orang.
- Anggaran adalah perkiraan kasar dalam Rupiah dengan harga wajar di Tangerang Selatan. Jangan melebihi batas anggaran bila diberikan.
- Tulis dalam bahasa Indonesia formal yang lugas. Latar belakang 2–3 paragraf, tujuan 3–5 butir.
- Ini hanya draf. Pengurus HIMA akan memeriksa dan mengajukannya sendiri ke Kaprodi; kamu tidak mengajukan apa pun.`;

const ProposalSchema = z.object({
  judul: z.string().min(3),
  latarBelakang: z.string().min(20),
  tujuan: z.array(z.string().min(2)).min(1),
  sasaran: z.string().min(2),
  waktu: z.string().min(2),
  tempat: z.string().min(2),
  panitia: z.array(z.string()).default([]),
  rencanaKegiatan: z.array(z.object({ waktu: z.string(), kegiatan: z.string().min(2) })).min(1),
  anggaran: z
    .array(
      z.object({
        pos: z.string().min(2),
        jumlah: z.coerce.number().nonnegative(),
        satuan: z.string().min(1),
        hargaSatuan: z.coerce.number().nonnegative(),
      }),
    )
    .min(1),
  penutup: z.string().min(10),
});

export function parseProposal(input: unknown): ProposalContent {
  return ProposalSchema.parse(input);
}

const PROPOSAL_TOOL: LlmTool = {
  name: TOOL_NAME,
  description: "Menyimpan draf proposal kegiatan HIMA yang sudah disusun lengkap.",
  inputSchema: {
    type: "object",
    properties: {
      judul: { type: "string", description: "Judul proposal, mis. 'Proposal Kegiatan Seminar ...'" },
      latarBelakang: { type: "string", description: "2–3 paragraf, dipisah baris kosong" },
      tujuan: { type: "array", items: { type: "string" } },
      sasaran: { type: "string", description: "Sasaran peserta dan perkiraan jumlahnya" },
      waktu: { type: "string" },
      tempat: { type: "string" },
      panitia: { type: "array", items: { type: "string" }, description: "Jabatan panitia, nama pakai penanda [isi nama] bila tidak diketahui" },
      rencanaKegiatan: {
        type: "array",
        items: {
          type: "object",
          properties: { waktu: { type: "string" }, kegiatan: { type: "string" } },
          required: ["waktu", "kegiatan"],
        },
      },
      anggaran: {
        type: "array",
        items: {
          type: "object",
          properties: {
            pos: { type: "string" },
            jumlah: { type: "number" },
            satuan: { type: "string" },
            hargaSatuan: { type: "number", description: "Rupiah" },
          },
          required: ["pos", "jumlah", "satuan", "hargaSatuan"],
        },
      },
      penutup: { type: "string" },
    },
    required: ["judul", "latarBelakang", "tujuan", "sasaran", "waktu", "tempat", "panitia", "rencanaKegiatan", "anggaran", "penutup"],
  },
};

function describeBrief(brief: ProposalBrief): string {
  const lines = [
    `Nama kegiatan: ${brief.namaKegiatan}`,
    `Deskripsi: ${brief.deskripsi}`,
    brief.tanggal && `Tanggal: ${brief.tanggal}`,
    brief.tempat && `Tempat: ${brief.tempat}`,
    brief.perkiraanPeserta && `Perkiraan peserta: ${brief.perkiraanPeserta} orang`,
    brief.anggaranMaksimal && `Batas anggaran: Rp${brief.anggaranMaksimal.toLocaleString("id-ID")}`,
  ];
  return redactPersonalData(lines.filter(Boolean).join("\n"));
}

export interface DraftResult {
  content: ProposalContent;
  attempts: number;
  sopUsed: boolean;
  usage: { inputTokens: number; outputTokens: number };
}

export class DraftError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
  ) {
    super(message);
    this.name = "DraftError";
  }
}

export async function draftProposal(input: { db: Db; provider: () => LlmProvider; brief: ProposalBrief }): Promise<DraftResult> {
  const sop = searchChunks(input.db, `proposal struktur anggaran batas waktu ${input.brief.namaKegiatan}`, {
    agentScope: HIMA_AGENT_ID,
    limit: 6,
  });
  const sopBlock = sop.length
    ? `<sop>\n${sop.map((h) => `<kutipan sumber="${h.documentTitle} — ${h.section ?? ""}">\n${h.content}\n</kutipan>`).join("\n")}\n</sop>\n\n`
    : "";
  const userMessage = `${sopBlock}<ringkasan_kegiatan>\n${describeBrief(input.brief)}\n</ringkasan_kegiatan>\n\nSusun draf proposalnya lalu simpan dengan tool ${TOOL_NAME}.`;

  // Coba ulang sekali, lalu eskalasi (PRD §6).
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await input.provider().chat({
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
        tools: [PROPOSAL_TOOL],
        maxTokens: 12000,
        effort: "low",
      });
      if (res.stopReason === "refusal") throw new LlmError("Model menolak menyusun proposal ini");
      const call = res.toolCalls.find((c) => c.name === TOOL_NAME);
      if (!call) throw new LlmError("Agent tidak menyimpan draf (tool tidak dipanggil)");
      const content = parseProposal(call.input);
      return { content, attempts: attempt, sopUsed: sop.length > 0, usage: res.usage };
    } catch (error) {
      lastError = error;
    }
  }
  const message =
    lastError instanceof z.ZodError
      ? "Draf dari agent tidak lengkap"
      : lastError instanceof Error
        ? lastError.message
        : String(lastError);
  throw new DraftError(message, 2);
}
