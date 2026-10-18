import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import type { BackupView } from "@unpam/shared";
import type { Db } from "../db/client";

/** Nama file yang valid; juga dipakai untuk mencegah path traversal saat unduh. */
export const BACKUP_NAME = /^unpam-\d{8}-\d{6}-(otomatis|manual)\.db$/;
const MANUAL_KEEP = 20;

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function listBackups(dir: string): BackupView[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => BACKUP_NAME.test(n))
    .map((name) => {
      const st = statSync(path.join(dir, name));
      return {
        name,
        sizeBytes: st.size,
        createdAt: st.mtime.toISOString(),
        kind: name.endsWith("-manual.db") ? ("manual" as const) : ("otomatis" as const),
      };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
}

/**
 * Salin database dengan SQLite online backup API: aman walau aplikasi sedang menulis.
 * Backup otomatis disimpan `keep` terakhir; backup manual disimpan 20 terakhir.
 */
export async function createBackup(db: Db, dir: string, kind: "otomatis" | "manual", keep: number): Promise<BackupView> {
  mkdirSync(dir, { recursive: true });
  let name = `unpam-${stamp()}-${kind}.db`;
  // Dua backup dalam detik yang sama: tunggu sebentar agar nama unik.
  while (listBackups(dir).some((b) => b.name === name)) {
    await new Promise((r) => setTimeout(r, 1000));
    name = `unpam-${stamp()}-${kind}.db`;
  }
  await db.$client.backup(path.join(dir, name));

  const sameKind = listBackups(dir).filter((b) => b.kind === kind);
  const limit = kind === "otomatis" ? keep : MANUAL_KEEP;
  for (const old of sameKind.slice(limit)) rmSync(path.join(dir, old.name), { force: true });

  return listBackups(dir).find((b) => b.name === name)!;
}

/** Jadwalkan backup otomatis: segera bila backup terakhir lebih tua dari interval, lalu dicek tiap jam. */
export function scheduleBackups(
  db: Db,
  opts: { dir: string; keep: number; intervalHours: number; onDone?: (b: BackupView) => void; onError?: (e: unknown) => void },
): () => void {
  if (opts.intervalHours <= 0) return () => undefined;
  const intervalMs = opts.intervalHours * 3_600_000;
  const check = () => {
    const last = listBackups(opts.dir).find((b) => b.kind === "otomatis");
    if (last && Date.now() - new Date(last.createdAt).getTime() < intervalMs) return;
    createBackup(db, opts.dir, "otomatis", opts.keep).then(opts.onDone, opts.onError);
  };
  check();
  const timer = setInterval(check, Math.min(intervalMs, 3_600_000));
  timer.unref();
  return () => clearInterval(timer);
}
