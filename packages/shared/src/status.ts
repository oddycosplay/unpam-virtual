/** Status kerja agent (PRD §4), juga menentukan posisinya di peta 3D. */
export const AGENT_STATUSES = [
  "idle",
  "planning",
  "running",
  "rapat",
  "waiting_approval",
  "completed",
  "error",
] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

/** Kolom papan tugas (PRD §5 no. 7). Terpisah dari status agent. */
export const TASK_STATUSES = ["baru", "diproses", "menunggu_persetujuan", "selesai"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
