import type { Db } from "../db/client";
import { auditLogs } from "../db/schema";

export interface AuditEntry {
  actorType: "user" | "agent" | "system";
  actorUserId?: number | null;
  actorAgent?: string | null;
  action: string;
  targetType?: string;
  targetId?: string | number;
  approvedByUserId?: number;
  details?: Record<string, unknown>;
}

export function audit(db: Db, entry: AuditEntry): void {
  db.insert(auditLogs)
    .values({
      ...entry,
      targetId: entry.targetId === undefined ? undefined : String(entry.targetId),
    })
    .run();
}
