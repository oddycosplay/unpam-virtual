import { sql } from "drizzle-orm";
import type { AgentStatusView } from "@unpam/shared";
import type { Db } from "../db/client";
import type { AgentRuntime } from "./runtime";
import { getAgentAppearance } from "./appearance";

export function pendingApprovals(db: Db): number {
  return db.get<{ n: number }>(sql`SELECT count(*) AS n FROM submissions WHERE status = 'menunggu_persetujuan'`)!.n;
}

/** Status agent untuk ditampilkan: status runtime, plus Agent HIMA menunggu di gerbang Kaprodi (PRD §7). */
export function currentAgentViews(db: Db, runtime: AgentRuntime, pending = pendingApprovals(db)): AgentStatusView[] {
  const appearance = getAgentAppearance(db);
  return runtime.list().map((a) => {
    const view = { ...a, appearance: appearance[a.id] };
    return a.id === "hima" && (a.status === "idle" || a.status === "completed") && pending > 0
      ? { ...view, status: "waiting_approval" as const, activity: `${pending} proposal menunggu Kaprodi` }
      : view;
  });
}
