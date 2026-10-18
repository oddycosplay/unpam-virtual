import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { AppContext } from "../../app";
import { parseProposal } from "../../agents/hima";
import { audit } from "../../audit/log";
import { requireAuth, requirePermission } from "../../auth/auth";
import { approvals, submissionComments, submissions } from "../../db/schema";
import {
  canView,
  createProposalRequest,
  getDetail,
  isReviewer,
  notify,
  runDraftJob,
  saveVersion,
  setStatus,
  userIdsWithPermission,
  visibleSubmissions,
} from "./service";

const BriefBody = z.object({
  namaKegiatan: z.string().trim().min(3, "Nama kegiatan minimal 3 karakter").max(150),
  deskripsi: z.string().trim().min(20, "Ceritakan kegiatannya minimal 20 karakter").max(3000),
  tanggal: z.string().trim().max(100).optional(),
  tempat: z.string().trim().max(150).optional(),
  perkiraanPeserta: z.coerce.number().int().positive().max(100_000).optional(),
  anggaranMaksimal: z.coerce.number().int().positive().max(10_000_000_000).optional(),
});

const UpdateBody = z.object({
  content: z.unknown(),
  note: z.string().trim().max(300).optional(),
});

const DecisionBody = z
  .object({
    decision: z.enum(["disetujui", "ditolak", "revisi"]),
    note: z.string().trim().max(2000).optional(),
  })
  .refine((b) => b.decision === "disetujui" || (b.note && b.note.length >= 5), {
    message: "Tulis catatan (minimal 5 karakter) saat menolak atau meminta revisi",
  });

const CommentBody = z.object({ body: z.string().trim().min(1, "Komentar kosong").max(2000) });

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Data tidak valid";
}

function emptyToUndefined(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== "" && v !== null));
}

export function submissionRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db } = ctx;

  /** Ambil pengajuan bila boleh dilihat; kirim 404 bila tidak (tanpa membocorkan keberadaannya). */
  function load(id: string, request: FastifyRequest, reply: FastifyReply) {
    const row = db.select().from(submissions).where(eq(submissions.id, Number(id))).get();
    if (!row || !canView(request.user!, row)) {
      reply.code(404).send({ error: "Pengajuan tidak ditemukan" });
      return null;
    }
    return row;
  }

  app.post("/api/proposals", { preHandler: requirePermission("proposal:create") }, async (request, reply) => {
    const body = BriefBody.safeParse(emptyToUndefined(request.body));
    if (!body.success) return reply.code(400).send({ error: firstIssue(body.error) });
    const row = createProposalRequest(ctx, request.user!, body.data);
    return reply.code(202).send({ submission: getDetail(db, row, request.user!) });
  });

  app.get("/api/submissions", { preHandler: requireAuth }, async (request) => ({
    submissions: visibleSubmissions(db, request.user!),
  }));

  app.get<{ Params: { id: string } }>("/api/submissions/:id", { preHandler: requireAuth }, async (request, reply) => {
    const row = load(request.params.id, request, reply);
    if (!row) return reply;
    return { submission: getDetail(db, row, request.user!) };
  });

  // Simpan suntingan pengurus sebagai versi baru.
  app.put<{ Params: { id: string } }>("/api/submissions/:id", { preHandler: requireAuth }, async (request, reply) => {
    const row = load(request.params.id, request, reply);
    if (!row) return reply;
    if (!getDetail(db, row, request.user!).can.edit) return reply.code(409).send({ error: "Pengajuan ini tidak bisa disunting sekarang" });
    const body = UpdateBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: firstIssue(body.error) });
    let content;
    try {
      content = parseProposal(body.data.content);
    } catch {
      return reply.code(400).send({ error: "Lengkapi semua bagian proposal (judul, latar belakang, tujuan, rencana, anggaran, dll.)" });
    }
    const version = saveVersion(db, row, content, { userId: request.user!.id, note: body.data.note ?? "Disunting pengurus" });
    audit(db, {
      actorType: "user",
      actorUserId: request.user!.id,
      action: "submission.edited",
      targetType: "submission",
      targetId: row.id,
      details: { version, title: content.judul },
    });
    const fresh = db.select().from(submissions).where(eq(submissions.id, row.id)).get()!;
    return { submission: getDetail(db, fresh, request.user!) };
  });

  // Hanya manusia (pemilik) yang bisa mengajukan ke Kaprodi.
  app.post<{ Params: { id: string } }>("/api/submissions/:id/submit", { preHandler: requireAuth }, async (request, reply) => {
    const row = load(request.params.id, request, reply);
    if (!row) return reply;
    if (!getDetail(db, row, request.user!).can.submit) return reply.code(409).send({ error: "Pengajuan ini tidak bisa diajukan sekarang" });

    setStatus(db, row.id, "menunggu_persetujuan", { submittedAt: new Date().toISOString().replace("T", " ").slice(0, 19) });
    notify(db, userIdsWithPermission(db, "submission:decide"), {
      title: "Proposal menunggu persetujuan",
      body: `${request.user!.name} mengajukan "${row.title}" (versi ${row.currentVersion}).`,
      link: `/pengajuan/${row.id}`,
    });
    audit(db, {
      actorType: "user",
      actorUserId: request.user!.id,
      action: "submission.submitted",
      targetType: "submission",
      targetId: row.id,
      details: { title: row.title, version: row.currentVersion },
    });
    const fresh = db.select().from(submissions).where(eq(submissions.id, row.id)).get()!;
    return { submission: getDetail(db, fresh, request.user!) };
  });

  app.post<{ Params: { id: string } }>(
    "/api/submissions/:id/decision",
    { preHandler: requirePermission("submission:decide") },
    async (request, reply) => {
      const row = load(request.params.id, request, reply);
      if (!row) return reply;
      if (row.status !== "menunggu_persetujuan") return reply.code(409).send({ error: "Pengajuan ini tidak sedang menunggu persetujuan" });
      const body = DecisionBody.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: firstIssue(body.error) });
      const { decision, note } = body.data;

      db.insert(approvals)
        .values({ submissionId: row.id, version: row.currentVersion, decision, note: note ?? null, deciderUserId: request.user!.id })
        .run();
      setStatus(db, row.id, decision);

      const verb = decision === "disetujui" ? "menyetujui" : decision === "ditolak" ? "menolak" : "meminta revisi untuk";
      notify(db, [row.createdByUserId], {
        title: decision === "disetujui" ? "Proposal disetujui" : decision === "ditolak" ? "Proposal ditolak" : "Proposal perlu revisi",
        body: `${request.user!.name} ${verb} "${row.title}".${note ? ` Catatan: ${note}` : ""}`,
        link: `/pengajuan/${row.id}`,
      });
      audit(db, {
        actorType: "user",
        actorUserId: row.createdByUserId,
        approvedByUserId: request.user!.id,
        action: "submission.decided",
        targetType: "submission",
        targetId: row.id,
        details: { decision, note: note ?? null, version: row.currentVersion, title: row.title },
      });
      const fresh = db.select().from(submissions).where(eq(submissions.id, row.id)).get()!;
      return { submission: getDetail(db, fresh, request.user!) };
    },
  );

  app.post<{ Params: { id: string } }>("/api/submissions/:id/comments", { preHandler: requireAuth }, async (request, reply) => {
    const row = load(request.params.id, request, reply);
    if (!row) return reply;
    if (!getDetail(db, row, request.user!).can.comment) return reply.code(403).send({ error: "Anda tidak bisa berkomentar di pengajuan ini" });
    const body = CommentBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: firstIssue(body.error) });

    db.insert(submissionComments).values({ submissionId: row.id, userId: request.user!.id, body: body.data.body }).run();
    // Beri tahu pemilik bila yang berkomentar orang lain, dan reviewer bila pemilik yang membalas.
    const recipients =
      request.user!.id === row.createdByUserId
        ? userIdsWithPermission(db, "submission:comment").filter((id) => id !== request.user!.id)
        : [row.createdByUserId];
    notify(db, recipients, {
      title: "Masukan baru pada proposal",
      body: `${request.user!.name}: ${body.data.body.slice(0, 140)}`,
      link: `/pengajuan/${row.id}`,
    });
    audit(db, {
      actorType: "user",
      actorUserId: request.user!.id,
      action: "submission.commented",
      targetType: "submission",
      targetId: row.id,
      details: { reviewer: isReviewer(request.user!) },
    });
    const fresh = db.select().from(submissions).where(eq(submissions.id, row.id)).get()!;
    return { submission: getDetail(db, fresh, request.user!) };
  });

  app.post<{ Params: { id: string } }>("/api/submissions/:id/retry", { preHandler: requireAuth }, async (request, reply) => {
    const row = load(request.params.id, request, reply);
    if (!row) return reply;
    if (!getDetail(db, row, request.user!).can.retry || !row.brief) return reply.code(409).send({ error: "Tidak ada yang perlu diulang" });
    setStatus(db, row.id, "menyusun", { error: null });
    runDraftJob(ctx, row.id, request.user!.id, row.brief);
    const fresh = db.select().from(submissions).where(eq(submissions.id, row.id)).get()!;
    return reply.code(202).send({ submission: getDetail(db, fresh, request.user!) });
  });
}
