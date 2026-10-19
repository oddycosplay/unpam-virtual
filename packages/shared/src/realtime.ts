import type { AgentStatusView } from "./api-types";
import type { Role } from "./roles";
import type { AvatarLook } from "./appearance";

// Protokol Socket.IO kampus 3D (tahap 5). Satuan posisi = satuan dunia 3D (±1 meter).

export const CAMPUS_BOUNDS = { minX: -11.4, maxX: 11.4, minZ: -10.4, maxZ: 10.4 } as const;
/** Titik muncul pemain: Gerbang & Lobby. */
export const SPAWN = { x: -1.5, z: 8.6 } as const;
/** Radius proximity chat dalam meter. */
export const CHAT_RADIUS = 6;
export const CHAT_MAX_LENGTH = 280;
export const MOVE_SPEED = 3.2; // meter per detik

export interface PlayerState {
  /** Id koneksi (socket). Satu pengguna bisa punya lebih dari satu tab. */
  id: string;
  userId: number;
  name: string;
  role: Role;
  x: number;
  z: number;
  /** Arah hadap (radian, sumbu y). */
  rot: number;
  moving: boolean;
  avatar: AvatarLook | null;
}

export interface CampusSnapshot {
  players: PlayerState[];
}

export interface ProximityMessage {
  id: string;
  fromId: string;
  name: string;
  role: Role;
  text: string;
  at: string;
  /** Jumlah pemain lain yang menerima pesan ini. */
  heardBy: number;
}

export interface ServerToClientEvents {
  welcome: (w: { id: string; spawn: { x: number; z: number } }) => void;
  snapshot: (s: CampusSnapshot) => void;
  agents: (agents: AgentStatusView[]) => void;
  "chat:message": (m: ProximityMessage) => void;
  "chat:error": (e: { error: string }) => void;
}

export interface ClientToServerEvents {
  move: (p: { x: number; z: number; rot: number; moving: boolean }) => void;
  "chat:send": (text: string) => void;
}
