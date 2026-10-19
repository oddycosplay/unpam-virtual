import type { FastifyInstance } from "fastify";
import { desc, inArray, sql } from "drizzle-orm";
import { TASK_STATUSES, type DashboardSummary, type TaskStatus } from "@unpam/shared";
import type { AppContext } from "../../app";
import { currentAgentViews } from "../../agents/status";
import { auditRowsQuery, describe, parseUtc } from "../../audit/describe";
import { requireAuth } from "../../auth/auth";
import { auditLogs } from "../../db/schema";

const HOURS = 12;
/** Peristiwa yang boleh dilihat semua peran. Peristiwa akun dan konfigurasi hanya untuk admin. */
const PUBLIC_ACTIONS = [
  "agent.answered",
  "agent.error_escalated",
  "agent.drafted",
  "task.created",
  "submission.submitted",
  "submission.decided",
  "document.uploaded",
  "document.deleted",
];

export function dashboardRoutes(app: FastifyInstance, { db, agents }: AppContext): void {
  // Ringan, dipakai widget status agent di sidebar.
  app.get("/api/agents/status", { preHandler: requireAuth }, async () => ({ agents: currentAgentViews(db, agents) }));

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

    const query = auditRowsQuery(db);
    const rows = (isAdmin ? query : query.where(inArray(auditLogs.action, PUBLIC_ACTIONS)))
      .orderBy(desc(auditLogs.id))
      .limit(10)
      .all();

    const orgs = db.get<{ hima: number; ukm: number }>(sql`
      SELECT (SELECT count(*) FROM organizations WHERE kind = 'hima') AS hima,
             (SELECT count(*) FROM organizations WHERE kind = 'ukm') AS ukm
    `)!;

    const work = db.get<{ pending: number; decided: number }>(sql`
      SELECT (SELECT count(*) FROM submissions WHERE status = 'menunggu_persetujuan') AS pending,
             (SELECT count(*) FROM approvals
                WHERE date(created_at, 'localtime') = date('now', 'localtime')) AS decided
    `)!;
    const taskCounts = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
    for (const r of db.all<{ status: TaskStatus; n: number }>(sql`SELECT status, count(*) AS n FROM tasks GROUP BY status`)) {
      taskCounts[r.status] = r.n;
    }

    const summary: DashboardSummary = {
      agents: currentAgentViews(db, agents, work.pending),
      stats: {
        pendingApprovals: work.pending,
        decidedToday: work.decided,
        tasks: taskCounts,
        organizations: orgs,
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
