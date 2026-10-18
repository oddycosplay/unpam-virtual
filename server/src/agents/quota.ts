import { eq, sql } from "drizzle-orm";
import type { UsageView } from "@unpam/shared";
import type { AppConfig } from "../config/env";
import type { Db } from "../db/client";
import { appSettings, users } from "../db/schema";

export const SETTING_DAILY_TOKEN_LIMIT = "daily_token_limit";

export function getSetting(db: Db, key: string): string | null {
  return db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, key)).get()?.value ?? null;
}

export function setSetting(db: Db, key: string, value: string, userId: number): void {
  db.insert(appSettings)
    .values({ key, value, updatedByUserId: userId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedByUserId: userId, updatedAt: sql`(CURRENT_TIMESTAMP)` } })
    .run();
}

export function globalDailyLimit(db: Db, config: AppConfig): { limit: number; source: "setting" | "env" } {
  const v = Number(getSetting(db, SETTING_DAILY_TOKEN_LIMIT));
  return Number.isFinite(v) && v > 0 ? { limit: v, source: "setting" } : { limit: config.DAILY_TOKEN_LIMIT, source: "env" };
}

/**
 * Token AI yang dipakai pengguna hari ini (zona waktu lokal server), dihitung dari log audit
 * yang sudah mencatat inputTokens/outputTokens setiap kali agent memanggil LLM atas permintaannya.
 */
export function tokensUsedToday(db: Db): Map<number, { input: number; output: number }>;
export function tokensUsedToday(db: Db, userId: number): { input: number; output: number };
export function tokensUsedToday(db: Db, userId?: number) {
  const rows = db.all<{ userId: number; input: number; output: number }>(sql`
    SELECT actor_user_id AS userId,
           coalesce(sum(json_extract(details, '$.inputTokens')), 0) AS input,
           coalesce(sum(json_extract(details, '$.outputTokens')), 0) AS output
    FROM audit_logs
    WHERE actor_type = 'agent' AND actor_user_id IS NOT NULL
      AND action IN ('agent.answered', 'agent.drafted')
      AND date(created_at, 'localtime') = date('now', 'localtime')
      ${userId === undefined ? sql`` : sql`AND actor_user_id = ${userId}`}
    GROUP BY actor_user_id
  `);
  if (userId !== undefined) return { input: rows[0]?.input ?? 0, output: rows[0]?.output ?? 0 };
  return new Map(rows.map((r) => [r.userId, { input: r.input, output: r.output }]));
}

export function usageFor(db: Db, config: AppConfig, userId: number, tokens = tokensUsedToday(db, userId)): UsageView {
  const override = db.select({ limit: users.dailyTokenLimit }).from(users).where(eq(users.id, userId)).get()?.limit ?? null;
  const global = globalDailyLimit(db, config);
  return {
    used: tokens.input + tokens.output,
    input: tokens.input,
    output: tokens.output,
    limit: override ?? global.limit,
    limitSource: override !== null ? "user" : global.source,
  };
}

export const QUOTA_MESSAGE = "Batas pemakaian AI harian Anda sudah tercapai. Kuota direset besok pukul 00.00, atau minta admin menaikkan batas Anda.";

/** True bila pengguna masih boleh memakai agent yang memanggil LLM. */
export function hasQuota(db: Db, config: AppConfig, userId: number): { ok: boolean; usage: UsageView } {
  const usage = usageFor(db, config, userId);
  return { ok: usage.used < usage.limit, usage };
}
