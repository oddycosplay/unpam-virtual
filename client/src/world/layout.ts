import type { AgentStatus, AgentStatusView } from "@unpam/shared";

// Satuan dunia: 1 = ±1 meter. Sumbu x ke timur, z ke selatan. Lantai di y = 0.

export const COLORS = {
  floor: "#0d141b",
  floorTile: "#111b24",
  platform: "#18232d",
  platformEdge: "#223240",
  wall: "#141d26",
  desk: "#c9d3dc",
  deskDark: "#2a3742",
  glow: "#2ee6d6",
  glowSoft: "#1b8f88",
  siBlue: "#1e5bb8",
  siYellow: "#f5c400",
  himaRed: "#c8102e",
  skin: "#e0b48c",
  hair: "#2b1d16",
} as const;

export const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: "#5fd3c9",
  planning: "#58a6ff",
  running: "#2ee6d6",
  rapat: "#b48cff",
  waiting_approval: "#f5c400",
  completed: "#5ee08a",
  error: "#ff5a5a",
};

export const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "Idle",
  planning: "Planning",
  running: "Running",
  rapat: "Rapat",
  waiting_approval: "Waiting Approval",
  completed: "Completed",
  error: "Error",
};

export type Vec2 = [x: number, z: number];

export interface Zone {
  id: string;
  name: string;
  center: Vec2;
  size: Vec2;
  accent: string;
}

/** Area di ruang kontrol, dinamai sesuai area kampus di PRD §7. */
export const ZONES: Zone[] = [
  { id: "akademik", name: "Ruang Akademik & Dosen", center: [0, -7.2], size: [8, 4], accent: COLORS.glow },
  { id: "hima", name: "Sekretariat HIMA", center: [7.6, 0], size: [4.4, 6.4], accent: COLORS.himaRed },
  { id: "kaprodi", name: "Ruang Kaprodi", center: [-7.6, 0], size: [4.4, 6.4], accent: COLORS.siYellow },
  { id: "perpustakaan", name: "Perpustakaan", center: [7.2, -7.2], size: [4.6, 4], accent: "#58a6ff" },
  { id: "kantin", name: "Kantin & Taman", center: [-7.2, 7], size: [4.6, 4], accent: "#5ee08a" },
];

// Graf jalan: agent hanya bergerak di sepanjang jalur bercahaya.
export const NODES = {
  hub: [0, 0],
  north: [0, -3.6],
  east: [3.6, 0],
  west: [-3.6, 0],
  south: [0, 3.4],
  akademikDesk: [0, -4.9],
  library: [4.9, -4.6],
  himaDesk: [5.1, -1.2],
  rapat: [5.1, 1.4],
  kaprodiGate: [-5.1, 0],
  kantin: [-5.2, 5.2],
  komando: [3.7, 3.7],
} satisfies Record<string, Vec2>;

export type NodeId = keyof typeof NODES;

export const EDGES: [NodeId, NodeId][] = [
  ["hub", "north"],
  ["hub", "east"],
  ["hub", "west"],
  ["hub", "south"],
  ["north", "akademikDesk"],
  ["north", "library"],
  ["east", "himaDesk"],
  ["east", "rapat"],
  ["west", "kaprodiGate"],
  ["south", "kantin"],
  ["hub", "komando"],
];

/** Rute terpendek (BFS, graf kecil) dari satu node ke node lain. */
export function route(from: NodeId, to: NodeId): NodeId[] {
  const prev = new Map<NodeId, NodeId | null>([[from, null]]);
  const queue: NodeId[] = [from];
  while (queue.length) {
    const node = queue.shift()!;
    if (node === to) break;
    for (const [a, b] of EDGES) {
      const next = a === node ? b : b === node ? a : null;
      if (next && !prev.has(next)) {
        prev.set(next, node);
        queue.push(next);
      }
    }
  }
  const path: NodeId[] = [];
  for (let n: NodeId | null | undefined = to; n; n = prev.get(n)) path.unshift(n);
  return path[0] === from ? path : [to];
}

/** Posisi agent di peta sesuai status (PRD §7). */
export function targetNode(agent: AgentStatusView): NodeId {
  const desk: NodeId = agent.id === "akademik" ? "akademikDesk" : agent.id === "hima" ? "himaDesk" : "hub";
  if (!agent.active) return desk;
  switch (agent.status) {
    case "waiting_approval":
      return "kaprodiGate";
    case "rapat":
      return "rapat";
    case "idle":
      return agent.id === "orkestrator" ? "hub" : "kantin";
    default:
      return desk;
  }
}
