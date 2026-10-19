import { sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { ActivityItem } from "@unpam/shared";
import type { Db } from "../db/client";
import { auditLogs, users } from "../db/schema";

export const AGENT_NAMES: Record<string, string> = { akademik: "Agent Akademik", hima: "Agent HIMA", orkestrator: "Orkestrator" };
const DECISION_TEXT: Record<string, string> = { disetujui: "menyetujui", ditolak: "menolak", revisi: "meminta revisi" };

const approver = alias(users, "approver");

export type AuditRow = typeof auditLogs.$inferSelect & { actorName: string | null; approverName: string | null };

/** created_at disimpan UTC "YYYY-MM-DD HH:MM:SS". */
export function parseUtc(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

/** Query log audit beserta nama aktor dan penyetuju; tambahkan where/order/limit sendiri. */
export function auditRowsQuery(db: Db) {
  return db
    .select({
      id: auditLogs.id,
      actorType: auditLogs.actorType,
      actorUserId: auditLogs.actorUserId,
      actorAgent: auditLogs.actorAgent,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      approvedByUserId: auditLogs.approvedByUserId,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
      approverName: approver.name,
    })
    .from(auditLogs)
    .leftJoin(users, sql`${users.id} = ${auditLogs.actorUserId}`)
    .leftJoin(approver, sql`${approver.id} = ${auditLogs.approvedByUserId}`)
    .$dynamic();
}

/** Kalimat yang mudah dibaca untuk satu baris audit. */
export function describe(row: AuditRow): Pick<ActivityItem, "text" | "kind"> {
  const d = (row.details ?? {}) as Record<string, unknown>;
  const agent = AGENT_NAMES[row.actorAgent ?? ""] ?? "Agent";
  const who = row.actorName ?? "Seseorang";
  switch (row.action) {
    case "agent.answered":
      return d.usedLlm
        ? { kind: "agent", text: `${agent} menjawab pertanyaan (${(Number(d.latencyMs) / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} dtk)` }
        : { kind: "agent", text: `${agent}: pertanyaan di luar dokumen, dijawab "tidak tahu"` };
    case "agent.error_escalated":
      return { kind: "error", text: `${agent} gagal ${row.actorAgent === "hima" ? "menyusun proposal" : "menjawab"} dan dieskalasi` };
    case "agent.drafted":
      return { kind: "agent", text: `${agent} menyelesaikan draf "${d.title}"` };
    case "task.created":
      return { kind: "agent", text: `Orkestrator mencatat tugas "${d.title}" untuk ${AGENT_NAMES[String(d.agent)] ?? "agent"}` };
    case "submission.submitted":
      return { kind: "user", text: `"${d.title}" diajukan ke Kaprodi` };
    case "submission.decided":
      return {
        kind: d.decision === "ditolak" ? "error" : "user",
        text: `${row.approverName ?? "Kaprodi"} ${DECISION_TEXT[String(d.decision)] ?? "memutuskan"} "${d.title}"`,
      };
    case "submission.edited":
      return { kind: "user", text: `${who} menyunting "${d.title}" (versi ${d.version})` };
    case "submission.commented":
      return { kind: "user", text: `${who} memberi masukan pada proposal` };
    case "document.uploaded":
      return { kind: "system", text: `Dokumen "${d.title}" diindeks (${d.chunkCount} potongan)` };
    case "document.deleted":
      return { kind: "system", text: `Dokumen "${d.title}" dihapus` };
    case "document.organization_link_updated":
      return { kind: "system", text: `${who} ${d.after ? "memperbarui" : "menghapus"} tautan ${d.kind === "ukm" ? "" : "HIMA "}${d.title}` };
    case "auth.login":
      return { kind: "user", text: `${who} masuk` };
    case "auth.logout":
      return { kind: "user", text: `${who} keluar` };
    case "auth.login_failed":
      return { kind: "error", text: `Login gagal untuk ${String(d.email ?? "akun tak dikenal")}` };
    case "config.llm_updated":
      return { kind: "system", text: `${who} mengubah provider AI (${d.provider}, ${d.model})` };
    case "config.llm_tested":
      return d.ok
        ? { kind: "system", text: `Uji koneksi provider AI berhasil (${d.latencyMs} ms)` }
        : { kind: "error", text: "Uji koneksi provider AI gagal" };
    case "config.agent_appearance_updated":
      return { kind: "system", text: `${who} mengubah tampilan robot agent` };
    default:
      return { kind: "system", text: row.action };
  }
}
