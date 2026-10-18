import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  SUBMISSION_STATUS_LABEL,
  hasPermission,
  type ProposalBrief,
  type ProposalContent,
  type PublicUser,
  type SubmissionDetail,
  type SubmissionStatus,
  type SubmissionSummary,
  type TaskStatus,
} from "@unpam/shared";
import type { AppContext } from "../../app";
import { DraftError, HIMA_AGENT_ID, draftProposal } from "../../agents/hima";
import { audit } from "../../audit/log";
import type { Db } from "../../db/client";
import {
  approvals,
  notifications,
  submissionComments,
  submissionVersions,
  submissions,
  tasks,
  users,
} from "../../db/schema";

type SubmissionRow = typeof submissions.$inferSelect;

/** Status yang boleh dilihat dosen/Kaprodi. Draf tetap privat milik pengurus HIMA. */
export const REVIEWABLE: SubmissionStatus[] = ["menunggu_persetujuan", "revisi", "disetujui", "ditolak"];
const EDITABLE: SubmissionStatus[] = ["draft", "revisi"];

const TASK_FOR: Record<SubmissionStatus, TaskStatus> = {
  menyusun: "diproses",
  gagal: "baru",
  draft: "diproses",
  revisi: "diproses",
  menunggu_persetujuan: "menunggu_persetujuan",
  disetujui: "selesai",
  ditolak: "selesai",
};

const now = sql`(CURRENT_TIMESTAMP)`;

export function isReviewer(user: PublicUser): boolean {
  return hasPermission(user.role, "submission:decide") || hasPermission(user.role, "submission:comment");
}

export function canView(user: PublicUser, row: SubmissionRow): boolean {
  return row.createdByUserId === user.id || (isReviewer(user) && REVIEWABLE.includes(row.status));
}

export function notify(db: Db, userIds: number[], n: { title: string; body: string; link?: string }): void {
  if (userIds.length === 0) return;
  db.insert(notifications)
    .values(userIds.map((userId) => ({ userId, title: n.title, body: n.body, link: n.link ?? null })))
    .run();
}

export function userIdsWithPermission(db: Db, permission: "submission:decide" | "submission:comment"): number[] {
  return db
    .select({ id: users.id, role: users.roleId })
    .from(users)
    .where(eq(users.isActive, true))
    .all()
    .filter((u) => hasPermission(u.role, permission))
    .map((u) => u.id);
}

/** Ubah status pengajuan dan kartu tugasnya sekaligus. */
export function setStatus(db: Db, id: number, status: SubmissionStatus, extra: Partial<typeof submissions.$inferInsert> = {}): void {
  db.update(submissions).set({ status, updatedAt: now, ...extra }).where(eq(submissions.id, id)).run();
  db.update(tasks).set({ status: TASK_FOR[status], updatedAt: now }).where(eq(tasks.submissionId, id)).run();
}

export function saveVersion(
  db: Db,
  row: SubmissionRow,
  content: ProposalContent,
  by: { agent?: string; userId?: number; note?: string },
): number {
  const version = row.currentVersion + 1;
  db.insert(submissionVersions)
    .values({
      submissionId: row.id,
      version,
      content,
      createdByAgent: by.agent ?? null,
      createdByUserId: by.userId ?? null,
      note: by.note ?? null,
    })
    .run();
  db.update(submissions)
    .set({ content, title: content.judul, currentVersion: version, updatedAt: now })
    .where(eq(submissions.id, row.id))
    .run();
  return version;
}

export function toSummary(row: SubmissionRow, ownerName: string): SubmissionSummary {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    version: row.currentVersion,
    owner: { id: row.createdByUserId, name: ownerName },
    updatedAt: row.updatedAt,
    submittedAt: row.submittedAt,
  };
}

export function getDetail(db: Db, row: SubmissionRow, viewer: PublicUser): SubmissionDetail {
  const owner = db.select({ name: users.name }).from(users).where(eq(users.id, row.createdByUserId)).get();
  const versions = db
    .select({ v: submissionVersions, author: users.name })
    .from(submissionVersions)
    .leftJoin(users, eq(users.id, submissionVersions.createdByUserId))
    .where(eq(submissionVersions.submissionId, row.id))
    .orderBy(asc(submissionVersions.version))
    .all();
  const decisions = db
    .select({ a: approvals, decider: users.name })
    .from(approvals)
    .innerJoin(users, eq(users.id, approvals.deciderUserId))
    .where(eq(approvals.submissionId, row.id))
    .orderBy(asc(approvals.id))
    .all();
  const comments = db
    .select({ c: submissionComments, author: users.name, role: users.roleId })
    .from(submissionComments)
    .innerJoin(users, eq(users.id, submissionComments.userId))
    .where(eq(submissionComments.submissionId, row.id))
    .orderBy(asc(submissionComments.id))
    .all();

  const isOwner = row.createdByUserId === viewer.id;
  return {
    ...toSummary(row, owner?.name ?? "-"),
    content: row.content,
    brief: row.brief,
    error: row.error,
    versions: versions.map(({ v, author }) => ({
      version: v.version,
      author: v.createdByAgent ? "Agent HIMA" : (author ?? "-"),
      byAgent: Boolean(v.createdByAgent),
      note: v.note,
      createdAt: v.createdAt,
    })),
    approvals: decisions.map(({ a, decider }) => ({
      version: a.version,
      decision: a.decision,
      note: a.note,
      decider,
      createdAt: a.createdAt,
    })),
    comments: comments.map(({ c, author, role }) => ({ id: c.id, author, role, body: c.body, createdAt: c.createdAt })),
    can: {
      edit: isOwner && EDITABLE.includes(row.status),
      submit: isOwner && EDITABLE.includes(row.status) && row.content !== null,
      decide: hasPermission(viewer.role, "submission:decide") && row.status === "menunggu_persetujuan",
      comment: (isOwner || isReviewer(viewer)) && REVIEWABLE.includes(row.status),
      retry: isOwner && row.status === "gagal",
    },
  };
}

/** Catat tugas di papan lalu jalankan Agent HIMA di latar belakang. */
export function createProposalRequest(ctx: AppContext, user: PublicUser, brief: ProposalBrief): SubmissionRow {
  const { db } = ctx;
  const row = db
    .insert(submissions)
    .values({ title: `Proposal: ${brief.namaKegiatan}`, status: "menyusun", brief, createdByUserId: user.id })
    .returning()
    .get();
  const task = db
    .insert(tasks)
    .values({ title: `Proposal ${brief.namaKegiatan}`, status: "diproses", agentId: HIMA_AGENT_ID, createdByUserId: user.id, submissionId: row.id })
    .returning()
    .get();
  ctx.agents.set("orkestrator", "completed", "Meneruskan permintaan proposal ke Agent HIMA");
  audit(db, {
    actorType: "agent",
    actorAgent: "orkestrator",
    actorUserId: user.id,
    action: "task.created",
    targetType: "task",
    targetId: task.id,
    details: { agent: HIMA_AGENT_ID, title: task.title, submissionId: row.id },
  });
  runDraftJob(ctx, row.id, user.id, brief);
  return row;
}

export function runDraftJob(ctx: AppContext, submissionId: number, userId: number, brief: ProposalBrief): void {
  const { db } = ctx;
  ctx.agents.set(HIMA_AGENT_ID, "running", `Menyusun proposal ${brief.namaKegiatan}`);
  ctx.jobs.run(async () => {
    const started = Date.now();
    const link = `/pengajuan/${submissionId}`;
    try {
      const result = await draftProposal({ db, provider: ctx.llm, brief });
      const row = db.select().from(submissions).where(eq(submissions.id, submissionId)).get();
      if (!row) return; // dihapus selama agent bekerja
      const version = saveVersion(db, row, result.content, { agent: HIMA_AGENT_ID, note: "Draf awal oleh Agent HIMA" });
      setStatus(db, submissionId, "draft", { error: null });
      ctx.agents.set(HIMA_AGENT_ID, "completed", "Draf proposal selesai, menunggu pemeriksaan pengurus");
      notify(db, [userId], {
        title: "Draf proposal siap",
        body: `Agent HIMA selesai menyusun "${result.content.judul}". Periksa dan sunting sebelum diajukan.`,
        link,
      });
      audit(db, {
        actorType: "agent",
        actorAgent: HIMA_AGENT_ID,
        actorUserId: userId,
        action: "agent.drafted",
        targetType: "submission",
        targetId: submissionId,
        details: {
          title: result.content.judul,
          version,
          attempts: result.attempts,
          sopUsed: result.sopUsed,
          latencyMs: Date.now() - started,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        },
      });
    } catch (error) {
      const message = error instanceof DraftError ? error.message : (error as Error).message;
      setStatus(db, submissionId, "gagal", { error: message });
      ctx.agents.set(HIMA_AGENT_ID, "error", "Gagal menyusun proposal, dieskalasi");
      notify(db, [userId], {
        title: "Agent HIMA gagal menyusun proposal",
        body: "Agent sudah mencoba ulang dan tetap gagal. Coba lagi nanti atau hubungi admin.",
        link,
      });
      audit(db, {
        actorType: "agent",
        actorAgent: HIMA_AGENT_ID,
        actorUserId: userId,
        action: "agent.error_escalated",
        targetType: "submission",
        targetId: submissionId,
        details: { error: message, attempts: error instanceof DraftError ? error.attempts : 1, latencyMs: Date.now() - started },
      });
    }
  });
}

/** Saat server mulai: pekerjaan yang terputus restart tidak akan selesai, tandai gagal agar bisa diulang. */
export function failInterruptedDrafts(db: Db): number {
  const stale = db.select({ id: submissions.id }).from(submissions).where(eq(submissions.status, "menyusun")).all();
  for (const { id } of stale) setStatus(db, id, "gagal", { error: "Server dimulai ulang saat agent menyusun. Silakan coba lagi." });
  return stale.length;
}

export function statusLabel(status: SubmissionStatus): string {
  return SUBMISSION_STATUS_LABEL[status];
}

export function visibleSubmissions(db: Db, user: PublicUser) {
  const rows = db
    .select({ s: submissions, owner: users.name })
    .from(submissions)
    .innerJoin(users, eq(users.id, submissions.createdByUserId))
    .where(
      isReviewer(user)
        ? sql`${submissions.createdByUserId} = ${user.id} OR ${inArray(submissions.status, REVIEWABLE)}`
        : and(eq(submissions.createdByUserId, user.id)),
    )
    .orderBy(sql`${submissions.updatedAt} DESC, ${submissions.id} DESC`)
    .all();
  return rows.map(({ s, owner }) => toSummary(s, owner));
}
