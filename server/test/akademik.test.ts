import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { NOT_FOUND_ANSWER } from "../src/agents/akademik";
import { redactPersonalData } from "../src/agents/privacy";
import { loadConfig } from "../src/config/env";
import { createDb, type Db } from "../src/db/client";
import { auditLogs, documentChunks } from "../src/db/schema";
import { seed } from "../src/db/seed";
import { chunkBlocks } from "../src/rag/ingest";
import { searchChunks, searchTerms } from "../src/rag/search";
import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse } from "../src/llm/types";

const config = loadConfig({
  DB_PATH: ":memory:",
  JWT_SECRET: randomBytes(32).toString("hex"),
  ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  SEED_PASSWORD: "test-password",
});

/** Provider palsu: mencatat request, menjawab sesuai antrean. */
class FakeProvider implements LlmProvider {
  readonly kind = "anthropic" as const;
  readonly model = "fake-model";
  requests: LlmRequest[] = [];
  constructor(private readonly replies: (string | Error)[]) {}
  async chat(request: LlmRequest): Promise<LlmResponse> {
    this.requests.push(request);
    const next = this.replies.shift() ?? "";
    if (next instanceof Error) throw next;
    return { text: next, toolCalls: [], stopReason: "end_turn", model: this.model, usage: { inputTokens: 10, outputTokens: 5 } };
  }
}

let db: Db;

beforeEach(async () => {
  db = createDb(":memory:");
  await seed(db, config.SEED_PASSWORD, 4);
});

async function appWith(provider: FakeProvider) {
  const app = await buildApp({ db, config, llm: () => provider });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "mahasiswa@unpam.test", password: config.SEED_PASSWORD },
  });
  const c = login.cookies.find((x) => x.name === "unpam_session")!;
  return { app, cookie: `${c.name}=${c.value}` };
}

describe("chunking", () => {
  it("memecah per heading markdown dan menyimpan judul bagian", () => {
    const chunks = chunkBlocks([{ page: null, text: "# Judul\n\nPengantar.\n\n## KRS\n\nIsi KRS.\n\n## Cuti\n\nIsi cuti." }]);
    expect(chunks.map((c) => c.section)).toEqual(["Judul", "KRS", "Cuti"]);
    expect(chunks[1]!.content).toBe("Isi KRS.");
  });

  it("memecah paragraf panjang di bawah batas ukuran", () => {
    const long = "Kalimat yang cukup panjang untuk pengujian. ".repeat(60);
    const chunks = chunkBlocks([{ page: 3, text: long }]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.content.length <= 900 && c.page === 3 && c.section === "Halaman 3")).toBe(true);
  });
});

describe("pencarian", () => {
  it("membuang kata umum", () => {
    expect(searchTerms("Kapan jadwal UTS semester ini?")).toEqual(["jadwal", "uts", "semester"]);
  });

  it("menemukan bagian yang relevan dan menghormati cakupan agent", () => {
    const hits = searchChunks(db, "berapa minimal kehadiran untuk ikut UAS", { agentScope: "akademik" });
    expect(hits[0]?.section).toBe("Kehadiran dan Syarat Ujian");
    // SOP proposal milik agent HIMA, tidak boleh muncul untuk agent akademik.
    const hima = searchChunks(db, "proposal anggaran kegiatan", { agentScope: "akademik" });
    expect(hima.every((h) => !h.documentTitle.includes("HIMA"))).toBe(true);
  });

  it("indeks FTS ikut terhapus saat dokumen dihapus", () => {
    db.delete(documentChunks).run();
    expect(searchChunks(db, "kehadiran", { agentScope: "akademik" })).toEqual([]);
  });
});

describe("privasi", () => {
  it("menyamarkan NIM, nomor telepon, dan email", () => {
    const out = redactPersonalData("NIM saya 231011400123, hp 0812-3456-7890, email rina@mail.com");
    expect(out).not.toMatch(/231011400123|0812|rina@mail/);
  });
});

describe("Agent Akademik", () => {
  it("menjawab dengan sumber yang dirujuk dan mencatat audit", async () => {
    const provider = new FakeProvider(["Minimal kehadiran 75% untuk ikut UAS [1]."]);
    const { app, cookie } = await appWith(provider);
    const res = await app.inject({
      method: "POST",
      url: "/api/agents/akademik/chat",
      headers: { cookie },
      payload: { message: "Berapa minimal kehadiran untuk ikut UAS? NIM saya 231011400123" },
    });
    expect(res.statusCode).toBe(200);
    const { reply } = res.json();
    expect(reply.status).toBe("ok");
    expect(reply.sources).toHaveLength(1);
    expect(reply.sources[0]).toMatchObject({ ref: 1, section: "Kehadiran dan Syarat Ujian" });

    const sent = JSON.stringify(provider.requests[0]);
    expect(sent).toContain("<dokumen>");
    expect(sent).not.toContain("231011400123");

    const log = db.select().from(auditLogs).all().find((l) => l.action === "agent.answered");
    expect(log).toMatchObject({ actorType: "agent", actorAgent: "akademik" });
  });

  it("bilang tidak tahu tanpa memanggil LLM bila dokumen tidak relevan", async () => {
    const provider = new FakeProvider([]);
    const { app, cookie } = await appWith(provider);
    const res = await app.inject({
      method: "POST",
      url: "/api/agents/akademik/chat",
      headers: { cookie },
      payload: { message: "Siapa juara piala dunia sepakbola?" },
    });
    expect(res.json().reply).toMatchObject({ content: NOT_FOUND_ANSWER, sources: [] });
    expect(provider.requests).toHaveLength(0);
  });

  it("mencoba ulang sekali lalu eskalasi dan mencatat error", async () => {
    const provider = new FakeProvider([new LlmError("timeout"), new LlmError("timeout")]);
    const { app, cookie } = await appWith(provider);
    const res = await app.inject({
      method: "POST",
      url: "/api/agents/akademik/chat",
      headers: { cookie },
      payload: { message: "Kapan jadwal UTS?" },
    });
    expect(res.json().reply.status).toBe("error");
    expect(provider.requests).toHaveLength(2);
    const log = db.select().from(auditLogs).all().find((l) => l.action === "agent.error_escalated");
    expect(log?.details).toMatchObject({ attempts: 2 });
  });

  it("berhasil pada percobaan kedua", async () => {
    const provider = new FakeProvider([new LlmError("rate limit"), "UTS 9â€“20 November 2026 [1]."]);
    const { app, cookie } = await appWith(provider);
    const res = await app.inject({
      method: "POST",
      url: "/api/agents/akademik/chat",
      headers: { cookie },
      payload: { message: "Kapan jadwal UTS?" },
    });
    expect(res.json().reply.status).toBe("ok");
  });

  it("riwayat chat hanya milik pengguna sendiri", async () => {
    const { app, cookie } = await appWith(new FakeProvider(["Jawaban [1]."]));
    await app.inject({ method: "POST", url: "/api/agents/akademik/chat", headers: { cookie }, payload: { message: "Kapan UTS?" } });
    const mine = await app.inject({ method: "GET", url: "/api/agents/akademik/messages", headers: { cookie } });
    expect(mine.json().messages).toHaveLength(2);

    const other = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "dosen@unpam.test", password: config.SEED_PASSWORD },
    });
    const c = other.cookies.find((x) => x.name === "unpam_session")!;
    const theirs = await app.inject({ method: "GET", url: "/api/agents/akademik/messages", headers: { cookie: `${c.name}=${c.value}` } });
    expect(theirs.json().messages).toHaveLength(0);
  });

  it("admin tidak punya akses chat agent", async () => {
    const app = await buildApp({ db, config, llm: () => new FakeProvider([]) });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@unpam.test", password: config.SEED_PASSWORD },
    });
    const c = login.cookies.find((x) => x.name === "unpam_session")!;
    const res = await app.inject({ method: "GET", url: "/api/agents/akademik/messages", headers: { cookie: `${c.name}=${c.value}` } });
    expect(res.statusCode).toBe(403);
  });
});
