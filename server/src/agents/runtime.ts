import type { AgentStatus, AgentStatusView } from "@unpam/shared";

type AgentId = AgentStatusView["id"];

interface Entry {
  status: AgentStatus;
  activity: string;
  updatedAt: number;
}

const DEFINITIONS: { id: AgentId; name: string; active: boolean; idleActivity: string }[] = [
  { id: "orkestrator", name: "Orkestrator", active: true, idleActivity: "Menunggu pesan masuk" },
  { id: "akademik", name: "Agent Akademik", active: true, idleActivity: "Istirahat di kantin" },
  { id: "hima", name: "Agent HIMA", active: true, idleActivity: "Siap menyusun proposal" },
];

/** Status "completed" kembali ke "idle" setelah jeda ini. */
const COMPLETED_HOLD_MS = 15_000;

/** Status kerja agent yang hidup di memori proses. Dipakai dashboard dan, nanti, peta 3D. */
export class AgentRuntime {
  private readonly state = new Map<AgentId, Entry>();

  set(id: AgentId, status: AgentStatus, activity: string): void {
    this.state.set(id, { status, activity, updatedAt: Date.now() });
  }

  list(now = Date.now()): AgentStatusView[] {
    return DEFINITIONS.map((def) => {
      const entry = this.state.get(def.id);
      if (!def.active || !entry || (entry.status === "completed" && now - entry.updatedAt > COMPLETED_HOLD_MS)) {
        return { id: def.id, name: def.name, status: "idle", activity: def.idleActivity, active: def.active };
      }
      return { id: def.id, name: def.name, status: entry.status, activity: entry.activity, active: def.active };
    });
  }
}
