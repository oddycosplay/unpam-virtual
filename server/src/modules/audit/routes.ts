import type { FastifyInstance } from "fastify";
import { and, desc, eq, like, lt, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { AUDIT_CATEGORIES, type AuditCategory, type AuditEntryView, type AuditPage } from "@unpam/shared";
import type { AppContext } from "../../app";
import { AGENT_NAMES, auditRowsQuery, describe, parseUtc, type AuditRow } from "../../audit/describe";
import { requirePermission } from "../../auth/auth";
import { auditLogs, users } from "../../db/schema";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const Query = z.object({
  type: z.enum(["user", "agent", "system"]).optional(),
  category: z.enum(AUDIT_CATEGORIES).optional(),
  q: z.string().trim().max(100).optional(),
  from: z.string().regex(DATE).optional(),
  to: z.string().regex(DATE).optional(),
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
type QueryInput = z.infer<typeof Query>;

const CSV_MAX_ROWS = 10_000;

function categoryOf(action: string): AuditCategory | null {
  const prefix = action.split(".")[0] as AuditCategory;
  return AUDIT_CATEGORIES.includes(prefix) ? prefix : null;
}

function linkFor(row: AuditRow): string | null {
  const d = (row.details ?? {}) as Record<string, unknown>;
  if (row.targetType === "submission" && row.targetId) return `/pengajuan/${row.targetId}`;
  if (row.action === "task.created" && d.submissionId) return `/pengajuan/${d.submissionId}`;
  if (row.targetType === "knowledge_document" && row.action !== "document.deleted") return "/admin/documents";
  if (row.targetType === "llm_provider_config") return "/admin/llm";
  return null;
}

export function toEntry(row: AuditRow): AuditEntryView {
  const { text, kind } = describe(row);
  return {
    id: row.id,
    at: parseUtc(row.createdAt).toISOString(),
    actorType: row.actorType,
    actorName: row.actorName,
    actorAgent: row.actorAgent,
    action: row.action,
    category: categoryOf(row.action),
    summary: text,
    kind,
    targetType: row.targetType,
    targetId: row.targetId,
    link: linkFor(row),
    approverName: row.approverName,
    details: row.details ?? null,
  };
}

/** Kondisi WHERE dari filter. `before` sengaja tidak termasuk agar total tetap untuk seluruh filter. */
function conditions(q: QueryInput): SQL | undefined {
  const parts: (SQL | undefined)[] = [];
  if (q.type) parts.push(eq(auditLogs.actorType, q.type));
  if (q.category) parts.push(like(auditLogs.action, `${q.category}.%`));
  if (q.from) parts.push(sql`date(${auditLogs.createdAt}, 'localtime') >= ${q.from}`);
  if (q.to) parts.push(sql`date(${auditLogs.createdAt}, 'localtime') <= ${q.to}`);
  if (q.q) {
    const term = `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const agentIds = Object.entries(AGENT_NAMES)
      .filter(([, name]) => name.toLowerCase().includes(q.q!.toLowerCase()))
      .map(([id]) => id);
    parts.push(
      or(
        sql`${auditLogs.action} LIKE ${term} ESCAPE '\\'`,
        sql`${auditLogs.details} LIKE ${term} ESCAPE '\\'`,
        sql`${users.name} LIKE ${term} ESCAPE '\\'`,
        ...agentIds.map((id) => eq(auditLogs.actorAgent, id)),
      ),
    );
  }
  return parts.length ? and(...parts) : undefined;
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : typeof value === "string" ? value : JSON.stringify(value);
  // Cegah formula injection saat dibuka di Excel/Sheets.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function auditRoutes(app: FastifyInstance, { db }: AppContext): void {
  const guard = { preHandler: requirePermission("audit:view") };

  app.get("/api/admin/audit", guard, async (request, reply) => {
    const parsed = Query.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Filter tidak valid" });
    const q = parsed.data;
    const where = conditions(q);

    const total = db
      .select({ n: sql<number>`count(*)` })
      .from(auditLogs)
      .leftJoin(users, sql`${users.id} = ${auditLogs.actorUserId}`)
      .where(where)
      .get()!.n;

    const rows = auditRowsQuery(db)
      .where(and(where, q.before ? lt(auditLogs.id, q.before) : undefined))
      .orderBy(desc(auditLogs.id))
      .limit(q.limit + 1)
      .all();
    const hasMore = rows.length > q.limit;
    const page = rows.slice(0, q.limit);

    const result: AuditPage = {
      entries: page.map(toEntry),
      total,
      nextBefore: hasMore ? page.at(-1)!.id : null,
    };
    return result;
  });

  app.get("/api/admin/audit.csv", guard, async (request, reply) => {
    const parsed = Query.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Filter tidak valid" });
    const rows = auditRowsQuery(db).where(conditions(parsed.data)).orderBy(desc(auditLogs.id)).limit(CSV_MAX_ROWS).all();

    const header = ["id", "waktu", "jenis_aktor", "pengguna", "agent", "aksi", "ringkasan", "target", "penyetuju", "detail"];
    const lines = rows.map((r) => {
      const e = toEntry(r);
      return [
        e.id,
        parseUtc(r.createdAt).toLocaleString("sv-SE"),
        e.actorType,
        e.actorName,
        e.actorAgent ? (AGENT_NAMES[e.actorAgent] ?? e.actorAgent) : "",
        e.action,
        e.summary,
        e.targetType ? `${e.targetType}#${e.targetId ?? ""}` : "",
        e.approverName,
        e.details,
      ]
        .map(csvCell)
        .join(",");
    });
    const stamp = new Date().toLocaleDateString("sv-SE").replace(/-/g, "");
    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", `attachment; filename="audit-unpam-${stamp}.csv"`)
      .send(`﻿${[header.join(","), ...lines].join("\r\n")}\r\n`);
  });
}
