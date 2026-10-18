import type { FastifyInstance } from "fastify";
import { desc, inArray, sql } from "drizzle-orm";
import type { ActivityItem, DashboardSummary } from "@unpam/shared";
import type { AppContext } from "../../app";
import { requireAuth } from "../../auth/auth";
import { auditLogs, users } from "../../db/schema";

const HOURS = 12;
const AGENT_NAMES: Record<string, string> = { akademik: "Agent Akademik", hima: "Agent HIMA", orkestrator: "Orkestrator" };
/** Peristiwa yang boleh dilihat semua peran. Peristiwa akun dan konfigurasi hanya untuk admin. */
const PUBLIC_ACTIONS = ["agent.answered", "agent.error_escalated", "document.uploaded", "document.deleted"];

type AuditRow = typeof auditLogs.$inferSelect & { actorName: string | null };

/** created_at disimpan UTC "YYYY-MM-DD HH:MM:SS". */
function parseUtc(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

function describe(row: AuditRow): Pick<ActivityItem, "text" | "kind"> {
  const d = (row.details ?? {}) as Record<string, unknown>;
  const agent = AGENT_NAMES[row.actorAgent ?? ""] ?? "Agent";
  const who = row.actorName ?? "Seseorang";
  switch (row.action) {
    case "agent.answered":
      return d.usedLlm
        ? { kind: "agent", text: `${agent} menjawab pertanyaan (${(Number(d.latencyMs) / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} dtk)` }
        : { kind: "agent", text: `${agent}: pertanyaan di luar dokumen, dijawab "tidak tahu"` };
    case "agent.error_escalated":
      return { kind: "error", text: `${agent} gagal menjawab dan dieskalasi ke admin` };
    case "document.uploaded":
      return { kind: "system", text: `Dokumen "${d.title}" diindeks (${d.chunkCount} potongan)` };
    case "document.deleted":
      return { kind: "system", text: `Dokumen "${d.title}" dihapus` };
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
    default:
      return { kind: "system", text: row.action };
  }
}

export function dashboardRoutes(app: FastifyInstance, { db, agents }: AppContext): void {
  app.get("/api/dashboard", { preHandler: requireAuth }, async (request) => {
    const isAdmin = request.user!.role === "admin";

    const today = db.get<{
      questions: number;
      answers: number;
      errors: number;
      avgLatency: number | null;
    }>(sql`
      SELECT
        (SELECT count(*) FROM chat_messages WHERE role = 'user'
           AND date(created_at, 'localtime') = date('now', 'localtime')) AS questions,
        (SELECT count(*) FROM audit_logs WHERE action = 'agent.answered'
           AND date(created_at, 'localtime') = date('now', 'localtime')) AS answers,
        (SELECT count(*) FROM audit_logs WHERE action = 'agent.error_escalated'
           AND date(created_at, 'localtime') = date('now', 'localtime')) AS errors,
        (SELECT avg(json_extract(details, '$.latencyMs')) FROM audit_logs WHERE action = 'agent.answered'
           AND json_extract(details, '$.usedLlm') = 1
           AND date(created_at, 'localtime') = date('now', 'localtime')) AS avgLatency
    `)!;

    const totals = db.get<{ documents: number; chunks: number; users: number }>(sql`
      SELECT (SELECT count(*) FROM knowledge_documents) AS documents,
             (SELECT count(*) FROM document_chunks) AS chunks,
             (SELECT count(*) FROM users WHERE is_active = 1) AS users
    `)!;

    const answersPerHour = new Array<number>(HOURS).fill(0);
    const now = Date.now();
    const answered = db.all<{ createdAt: string }>(sql`
      SELECT created_at AS createdAt FROM audit_logs
      WHERE action = 'agent.answered' AND created_at >= datetime('now', ${`-${HOURS} hours`})
    `);
    for (const { createdAt } of answered) {
      const hoursAgo = Math.floor((now - parseUtc(createdAt).getTime()) / 3_600_000);
      if (hoursAgo >= 0 && hoursAgo < HOURS) answersPerHour[HOURS - 1 - hoursAgo]! += 1;
    }

    const base = db
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
      })
      .from(auditLogs)
      .leftJoin(users, sql`${users.id} = ${auditLogs.actorUserId}`);
    const rows: AuditRow[] = (isAdmin ? base : base.where(inArray(auditLogs.action, PUBLIC_ACTIONS)))
      .orderBy(desc(auditLogs.id))
      .limit(10)
      .all();

    const summary: DashboardSummary = {
      agents: agents.list(),
      stats: {
        questionsToday: today.questions,
        answersToday: today.answers,
        errorsToday: today.errors,
        avgLatencyMs: today.avgLatency === null ? null : Math.round(today.avgLatency),
        documents: totals.documents,
        chunks: totals.chunks,
        users: totals.users,
      },
      answersPerHour,
      recentActivity: rows.map((r) => ({ id: r.id, at: parseUtc(r.createdAt).toISOString(), ...describe(r) })),
    };
    return summary;
  });
}
