import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { ProposalContent } from "@unpam/shared";
import { buildApp } from "../src/app";
import { JobTracker } from "../src/agents/jobs";
import { loadConfig } from "../src/config/env";
import { createDb, type Db } from "../src/db/client";
import { auditLogs, submissions } from "../src/db/schema";
import { seed } from "../src/db/seed";
import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse } from "../src/llm/types";
import { failInterruptedDrafts } from "../src/modules/submissions/service";

const config = loadConfig({
  DB_PATH: ":memory:",
  JWT_SECRET: randomBytes(32).toString("hex"),
  ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  SEED_PASSWORD: "test-password",
});

const DRAFT: ProposalContent = {
  judul: "Proposal Kegiatan Seminar Karier IT",
  latarBelakang: "Mahasiswa SI membutuhkan wawasan karier di industri teknologi.\n\nSeminar ini menjembatani kebutuhan itu.",
  tujuan: ["Memberi wawasan karier", "Membangun jejaring"],
  sasaran: "Mahasiswa SI, sekitar 100 orang",
  waktu: "Sabtu, 14 November 2026",
  tempat: "Aula Unpam",
  panitia: ["Ketua: [isi nama]"],
  rencanaKegiatan: [{ waktu: "08.00", kegiatan: "Registrasi" }],
  anggaran: [{ pos: "Konsumsi", jumlah: 100, satuan: "kotak", hargaSatuan: 25000 }],
  penutup: "Demikian proposal ini kami ajukan.",
};

/** Provider palsu yang menjawab dengan tool call simpan_draf_proposal. */
class DraftingProvider implements LlmProvider {
  readonly kind = "anthropic" as const;
  readonly model = "fake";
  requests: LlmRequest[] = [];
  constructor(private readonly replies: (ProposalContent | Error | "no-tool")[]) {}
  async chat(req: LlmRequest): Promise<LlmResponse> {
    this.requests.push(req);
    const next = this.replies.shift() ?? DRAFT;
    if (next instanceof Error) throw next;
    const toolCalls = next === "no-tool" ? [] : [{ id: "t1", name: "simpan_draf_proposal", input: next }];
    return { text: "", toolCalls, stopReason: "tool_use", model: this.model, usage: { inputTokens: 10, outputTokens: 10 } };
  }
}

let db: Db;
beforeEach(async () => {
  db = createDb(":memory:");
  await seed(db, config.SEED_PASSWORD, 4);
});

async function setup(replies: (ProposalContent | Error | "no-tool")[] = [DRAFT]) {
  const jobs = new JobTracker();
  const provider = new DraftingProvider(replies);
  const app = await buildApp({ db, config, llm: () => provider, jobs });
  const login = async (email: string) => {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password: config.SEED_PASSWORD } });
    const c = res.cookies.find((x) => x.name === "unpam_session")!;
    return `${c.name}=${c.value}`;
  };
  return {
    app,
    jobs,
    provider,
    hima: await login("hima@unpam.test"),
    kaprodi: await login("kaprodi@unpam.test"),
    dosen: await login("dosen@unpam.test"),
    mhs: await login("mahasiswa@unpam.test"),
  };
}

const BRIEF = { namaKegiatan: "Seminar Karier IT", deskripsi: "Seminar karier bersama alumni yang bekerja di industri teknologi.", perkiraanPeserta: 100 };

describe("alur proposal HIMA", () => {
  it("dari permintaan sampai keputusan Kaprodi, dengan notifikasi dan papan tugas", async () => {
    const t = await setup();
    const req = (method: "GET" | "POST" | "PUT", url: string, cookie: string, payload?: object) =>
      t.app.inject({ method, url, headers: { cookie }, payload });

    // 1. Pengurus HIMA meminta draf. Tugas langsung tercatat "diproses".
    const created = await req("POST", "/api/proposals", t.hima, BRIEF);
    expect(created.statusCode).toBe(202);
    const id = created.json().submission.id;
    expect(created.json().submission.status).toBe("menyusun");
    let tasks = (await req("GET", "/api/tasks", t.hima)).json().tasks;
    expect(tasks[0]).toMatchObject({ status: "diproses", agentId: "hima" });

    // 2. Agent selesai: draf versi 1, BELUM diajukan (agent tidak boleh mengajukan sendiri).
    await t.jobs.idle();
    let detail = (await req("GET", `/api/submissions/${id}`, t.hima)).json().submission;
    expect(detail).toMatchObject({ status: "draft", version: 1, title: DRAFT.judul });
    expect(detail.versions[0]).toMatchObject({ byAgent: true, author: "Agent HIMA" });
    expect(detail.can).toMatchObject({ edit: true, submit: true, decide: false });
    expect(JSON.stringify(t.provider.requests[0])).toContain("<sop>");

    // Draf masih privat: Kaprodi belum bisa melihat.
    expect((await req("GET", `/api/submissions/${id}`, t.kaprodi)).statusCode).toBe(404);

    // 3. Pengurus menyunting â†’ versi 2.
    const edited = await req("PUT", `/api/submissions/${id}`, t.hima, { content: { ...DRAFT, tempat: "Gedung B lt. 3" } });
    expect(edited.json().submission).toMatchObject({ version: 2 });

    // 4. Pengurus mengajukan â†’ Kaprodi dapat notifikasi, tugas pindah kolom.
    const submitted = await req("POST", `/api/submissions/${id}/submit`, t.hima);
    expect(submitted.json().submission.status).toBe("menunggu_persetujuan");
    const kaprodiNotif = (await req("GET", "/api/notifications", t.kaprodi)).json();
    expect(kaprodiNotif.unread).toBe(1);
    expect(kaprodiNotif.notifications[0]).toMatchObject({ title: "Proposal menunggu persetujuan", link: `/pengajuan/${id}` });
    tasks = (await req("GET", "/api/tasks", t.kaprodi)).json().tasks;
    expect(tasks[0]).toMatchObject({ status: "menunggu_persetujuan" });

    // Dashboard: Agent HIMA berdiri di depan Ruang Kaprodi.
    const dash = (await req("GET", "/api/dashboard", t.mhs)).json();
    expect(dash.agents.find((a: { id: string }) => a.id === "hima").status).toBe("waiting_approval");
    expect(dash.stats.pendingApprovals).toBe(1);

    // Tidak bisa diedit saat menunggu.
    expect((await req("PUT", `/api/submissions/${id}`, t.hima, { content: DRAFT })).statusCode).toBe(409);

    // 5. Dosen memberi masukan â†’ pemilik dapat notifikasi.
    expect((await req("POST", `/api/submissions/${id}/comments`, t.dosen, { body: "Tambahkan sesi tanya jawab." })).statusCode).toBe(200);

    // 6. Kaprodi minta revisi tanpa catatan â†’ ditolak validasi; dengan catatan â†’ berhasil.
    expect((await req("POST", `/api/submissions/${id}/decision`, t.kaprodi, { decision: "revisi" })).statusCode).toBe(400);
    const revised = await req("POST", `/api/submissions/${id}/decision`, t.kaprodi, { decision: "revisi", note: "Rinci anggaran konsumsi." });
    expect(revised.json().submission.status).toBe("revisi");
    tasks = (await req("GET", "/api/tasks", t.hima)).json().tasks;
    expect(tasks[0].status).toBe("diproses");

    // 7. Revisi, ajukan ulang, lalu disetujui.
    await req("PUT", `/api/submissions/${id}`, t.hima, { content: DRAFT, note: "Anggaran dirinci" });
    await req("POST", `/api/submissions/${id}/submit`, t.hima);
    const approved = await req("POST", `/api/submissions/${id}/decision`, t.kaprodi, { decision: "disetujui" });
    detail = approved.json().submission;
    expect(detail.status).toBe("disetujui");
    expect(detail.approvals.map((a: { decision: string }) => a.decision)).toEqual(["revisi", "disetujui"]);
    expect(detail.versions).toHaveLength(3);

    const himaNotif = (await req("GET", "/api/notifications", t.hima)).json();
    expect(himaNotif.notifications.map((n: { title: string }) => n.title)).toEqual(
      expect.arrayContaining(["Draf proposal siap", "Masukan baru pada proposal", "Proposal perlu revisi", "Proposal disetujui"]),
    );
    tasks = (await req("GET", "/api/tasks", t.hima)).json().tasks;
    expect(tasks[0].status).toBe("selesai");

    // Audit: siapa meminta, apa yang dilakukan, siapa menyetujui.
    const decided = db.select().from(auditLogs).all().filter((l) => l.action === "submission.decided");
    expect(decided.at(-1)).toMatchObject({ approvedByUserId: expect.any(Number), actorUserId: expect.any(Number) });
    expect(db.select().from(auditLogs).all().some((l) => l.action === "agent.drafted" && l.actorAgent === "hima")).toBe(true);
  });

  it("hanya pengurus HIMA yang bisa meminta proposal", async () => {
    const t = await setup();
    const res = await t.app.inject({ method: "POST", url: "/api/proposals", headers: { cookie: t.mhs }, payload: BRIEF });
    expect(res.statusCode).toBe(403);
  });

  it("dosen tidak bisa memutuskan", async () => {
    const t = await setup();
    const id = (await t.app.inject({ method: "POST", url: "/api/proposals", headers: { cookie: t.hima }, payload: BRIEF })).json().submission.id;
    await t.jobs.idle();
    await t.app.inject({ method: "POST", url: `/api/submissions/${id}/submit`, headers: { cookie: t.hima } });
    const res = await t.app.inject({
      method: "POST",
      url: `/api/submissions/${id}/decision`,
      headers: { cookie: t.dosen },
      payload: { decision: "disetujui" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("agent mencoba ulang sekali, lalu gagal dan bisa diulang pengurus", async () => {
    const t = await setup([new LlmError("timeout"), "no-tool", DRAFT]);
    const id = (await t.app.inject({ method: "POST", url: "/api/proposals", headers: { cookie: t.hima }, payload: BRIEF })).json().submission.id;
    await t.jobs.idle();
    let detail = (await t.app.inject({ method: "GET", url: `/api/submissions/${id}`, headers: { cookie: t.hima } })).json().submission;
    expect(detail).toMatchObject({ status: "gagal", can: { retry: true } });
    expect(t.provider.requests).toHaveLength(2);

    await t.app.inject({ method: "POST", url: `/api/submissions/${id}/retry`, headers: { cookie: t.hima } });
    await t.jobs.idle();
    detail = (await t.app.inject({ method: "GET", url: `/api/submissions/${id}`, headers: { cookie: t.hima } })).json().submission;
    expect(detail.status).toBe("draft");
  });

  it("draf tidak lengkap dari agent dianggap gagal", async () => {
    const t = await setup([{ ...DRAFT, anggaran: [] }, { ...DRAFT, tujuan: [] }]);
    const id = (await t.app.inject({ method: "POST", url: "/api/proposals", headers: { cookie: t.hima }, payload: BRIEF })).json().submission.id;
    await t.jobs.idle();
    const row = db.select().from(submissions).all().find((s) => s.id === id)!;
    expect(row).toMatchObject({ status: "gagal", error: "Draf dari agent tidak lengkap" });
  });

  it("penyusunan yang terputus restart ditandai gagal", async () => {
    const t = await setup();
    await t.app.inject({ method: "POST", url: "/api/proposals", headers: { cookie: t.hima }, payload: BRIEF });
    await t.jobs.idle();
    db.update(submissions).set({ status: "menyusun" }).run();
    expect(failInterruptedDrafts(db)).toBe(1);
  });
});
