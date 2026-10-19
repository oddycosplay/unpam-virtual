import { AGENT_IDS, DEFAULT_AGENT_APPEARANCE, isAgentAppearance, type AgentAppearanceMap } from "@unpam/shared";
import type { Db } from "../db/client";
import { getSetting } from "./quota";

export const SETTING_AGENT_APPEARANCE = "agent_appearance";

/** Tampilan robot agent dari pengaturan admin; nilai yang hilang atau rusak memakai bawaan. */
export function getAgentAppearance(db: Db): AgentAppearanceMap {
  let saved: Record<string, unknown> = {};
  try {
    saved = JSON.parse(getSetting(db, SETTING_AGENT_APPEARANCE) ?? "{}") as Record<string, unknown>;
  } catch {
    // Nilai rusak: kembali ke bawaan.
  }
  const result = { ...DEFAULT_AGENT_APPEARANCE };
  for (const id of AGENT_IDS) {
    const v = saved[id];
    if (isAgentAppearance(v)) result[id] = v;
  }
  return result;
}
