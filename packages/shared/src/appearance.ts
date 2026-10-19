import { ROLE_INFO, type Role } from "./roles";

// Tampilan avatar pengguna dan robot agent. Warna disimpan sebagai hex #rrggbb.

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const HAIR_STYLES = ["pendek", "panjang", "hijab", "botak"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export const HAIR_STYLE_LABEL: Record<HairStyle, string> = { pendek: "Pendek", panjang: "Panjang", hijab: "Hijab", botak: "Botak" };

export const ACCESSORIES = ["none", "kacamata", "topi"] as const;
export type Accessory = (typeof ACCESSORIES)[number];
export const ACCESSORY_LABEL: Record<Accessory, string> = { none: "Tanpa", kacamata: "Kacamata", topi: "Topi" };

/** Avatar pengguna di kampus 3D. Garis warna peran dan cincin di kaki tetap mengikuti peran. */
export interface AvatarLook {
  shirt: string;
  accent: string;
  skin: string;
  /** Warna rambut, atau warna hijab bila gaya rambut "hijab". */
  hair: string;
  hairStyle: HairStyle;
  accessory: Accessory;
}

export const SHIRT_COLORS = ["#1E5BB8", "#C8102E", "#F5C400", "#2E8B57", "#6B4FBB", "#E07A2E", "#1F2937", "#F3F4F6"];
export const SKIN_TONES = ["#F2D2B6", "#E3B48F", "#C68A5E", "#9A6440", "#6E4529"];
export const HAIR_COLORS = ["#1F1A17", "#3B2A20", "#6B4A2E", "#A67C52", "#D9D9D9", "#1E5BB8", "#C8102E", "#F3F4F6"];

export function defaultAvatar(role: Role): AvatarLook {
  const [shirt = "#1E5BB8", accent] = ROLE_INFO[role].colors;
  return { shirt, accent: accent ?? shirt, skin: SKIN_TONES[0]!, hair: HAIR_COLORS[0]!, hairStyle: "pendek", accessory: "none" };
}

export function isAvatarLook(v: unknown): v is AvatarLook {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return (
    [a.shirt, a.accent, a.skin, a.hair].every((c) => typeof c === "string" && HEX_COLOR.test(c)) &&
    HAIR_STYLES.includes(a.hairStyle as HairStyle) &&
    ACCESSORIES.includes(a.accessory as Accessory)
  );
}

export const AGENT_IDS = ["orkestrator", "akademik", "hima"] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export const ROBOT_STYLES = ["pod", "antena", "kotak"] as const;
export type RobotStyle = (typeof ROBOT_STYLES)[number];
export const ROBOT_STYLE_LABEL: Record<RobotStyle, string> = { pod: "Pod", antena: "Pod + antena", kotak: "Kepala kotak" };

/** Tampilan robot agent, diatur admin. Warna sabuk cahaya tetap menunjukkan status agent. */
export interface AgentAppearance {
  body: string;
  visor: string;
  style: RobotStyle;
}

export type AgentAppearanceMap = Record<AgentId, AgentAppearance>;

export const DEFAULT_AGENT_APPEARANCE: AgentAppearanceMap = {
  orkestrator: { body: "#DFE8EE", visor: "#20313B", style: "pod" },
  akademik: { body: "#DFE8EE", visor: "#20313B", style: "pod" },
  hima: { body: "#DFE8EE", visor: "#20313B", style: "pod" },
};

export const ROBOT_COLORS = ["#DFE8EE", "#1E5BB8", "#F5C400", "#C8102E", "#2EE6D6", "#5EE08A", "#B48CFF", "#20313B"];

export function isAgentAppearance(v: unknown): v is AgentAppearance {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return typeof a.body === "string" && HEX_COLOR.test(a.body) && typeof a.visor === "string" && HEX_COLOR.test(a.visor) && ROBOT_STYLES.includes(a.style as RobotStyle);
}
