import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { audit } from "../src/audit/log";
import { LoginLimiter } from "../src/auth/security";
import { createBackup, listBackups } from "../src/backup/backup";
import { loadConfig } from "../src/config/env";
import { createDb, type Db } from "../src/db/client";
import { auditLogs } from "../src/db/schema";
import { seed } from "../src/db/seed";
import type { LlmProvider } from "../src/llm/types";

let backupDir: string;
let db: Db;
let config: ReturnType<typeof loadConfig>;

beforeEach(async () => {
  backupDir = mkdtempSync(path.join(tmpdir(), "unpam-backup-"));
  config = loadConfig({
    DB_PATH: ":memory:",
    JWT_SECRET: randomBytes(32).toString("hex"),
    ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    SEED_PASSWORD: "test-password",
    BCRYPT_ROUNDS: "4",
    BACKUP_DIR: backupDir,
    BACKUP_KEEP: "2",
  });
  db = createDb(":memory:");
  await seed(db, config.SEED_PASSWORD, 4);
});

afterEach(() => rmSync(backupDir, { recursive: true, force: true }));

const neverCalled: LlmProvider = {
  kind: "anthropic",
  model: "fake",
  chat: async () => {
    throw new Error("LLM tidak boleh dipanggil");
  },
};

async function setup() {
  const app = await buildApp({ db, config, llm: () => neverCalled });
  const login = async (email: string, password = config.SEED_PASSWORD, headers: Record<string, string> = {}) => {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password }, headers });
    const c = res.cookies.find((x) => x.name === "unpam_session");
    return { res, cookie: c ? `${c.name}=${c.value}` : "", raw: c };
  };
  return { app, login };
}

describe("batas percobaan login", () => {
  it("mengunci setelah 5 kali gagal, termasuk untuk password benar", async () => {
    const { app, login } = await setup();
    for (let i = 0; i < 5; i++) expect((await login("dosen@unpam.test", "salah")).res.statusCode).toBe(401);
    const locked = await login("dosen@unpam.test");
    expect(locked.res.statusCode).toBe(429);
    expect(locked.res.headers["retry-after"]).toBeDefined();
    // Akun lain tidak ikut terkunci.
    expect((await login("kaprodi@unpam.test")).res.statusCode).toBe(200);
    expect(db.select().from(auditLogs).all().some((l) => l.action === "auth.login_locked")).toBe(true);
    void app;
  });

  it("kunci terbuka setelah 15 menit", () => {
    let t = 0;
    const limiter = new LoginLimiter(() => t);
    for (let i = 0; i < 5; i++) limiter.fail("1.1.1.1", "a@b.c");
    expect(limiter.lockedFor("1.1.1.1", "A@B.C")).toBeGreaterThan(0);
    t += 15 * 60 * 1000 + 1;
    expect(limiter.lockedFor("1.1.1.1", "a@b.c")).toBe(0);
  });
});

describe("keamanan dasar", () => {
  it("menolak permintaan dari origin lain dan memasang header keamanan", async () => {
    const { app, login } = await setup();
    const { cookie } = await login("admin@unpam.test");
    const evil = await app.inject({
      method: "POST",
      url: "/api/admin/backups",
      headers: { cookie, origin: "https://evil.example", host: "localhost:5173" },
    });
    expect(evil.statusCode).toBe(403);
    // Lewat proxy Vite: Host diganti ke port API, host asli ada di X-Forwarded-Host.
    const proxied = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { origin: "http://localhost:5173", host: "localhost:3001", "x-forwarded-host": "localhost:5173" },
    });
    expect(proxied.statusCode).toBe(200);
    const same = await app.inject({ method: "GET", url: "/api/health", headers: { origin: "http://localhost:5173", host: "localhost:5173" } });
    expect(same.headers["x-content-type-options"]).toBe("nosniff");
    expect(same.headers["x-frame-options"]).toBe("DENY");
  });

  it("cookie Secure otomatis bila lewat HTTPS", async () => {
    const { login } = await setup();
    expect((await login("dosen@unpam.test")).raw?.secure).toBeFalsy();
    expect((await login("dosen@unpam.test", config.SEED_PASSWORD, { "x-forwarded-proto": "https" })).raw?.secure).toBe(true);
  });

  it("ganti password membatalkan sesi lama", async () => {
    const { app, login } = await setup();
    const { cookie: old } = await login("mahasiswa@unpam.test");
    const post = (cookie: string, payload: object) => app.inject({ method: "POST", url: "/api/auth/change-password", headers: { cookie }, payload });

    expect((await post(old, { currentPassword: "salah", newPassword: "passwordbaru1" })).statusCode).toBe(400);
    expect((await post(old, { currentPassword: config.SEED_PASSWORD, newPassword: "pendek" })).statusCode).toBe(400);
    const ok = await post(old, { currentPassword: config.SEED_PASSWORD, newPassword: "passwordbaru1" });
    expect(ok.statusCode).toBe(200);
    const fresh = ok.cookies.find((c) => c.name === "unpam_session")!;

    expect((await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: old } })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: `${fresh.name}=${fresh.value}` } })).statusCode).toBe(200);
    expect((await login("mahasiswa@unpam.test", "passwordbaru1")).res.statusCode).toBe(200);
  });
});

describe("kelola akun", () => {
  it("admin membuat akun dengan password sementara yang tidak masuk audit", async () => {
    const { app, login } = await setup();
    const { cookie } = await login("admin@unpam.test");
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/users",
      headers: { cookie },
      payload: { email: "Baru@Unpam.Test", name: "Mahasiswa Baru", role: "mahasiswa" },
    });
    expect(res.statusCode).toBe(201);
    const { user, tempPassword } = res.json();
    expect(user).toMatchObject({ email: "baru@unpam.test", role: "mahasiswa", mustChangePassword: true, isActive: true });
    expect(tempPassword).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(JSON.stringify(db.select().from(auditLogs).all())).not.toContain(tempPassword);

    const fresh = await login("baru@unpam.test", tempPassword);
    expect(fresh.res.json().user.mustChangePassword).toBe(true);

    const dup = await app.inject({ method: "POST", url: "/api/admin/users", headers: { cookie }, payload: { email: "baru@unpam.test", name: "X Y", role: "dosen" } });
    expect(dup.statusCode).toBe(409);
  });

  it("ubah peran dan nonaktifkan membatalkan sesi pengguna itu", async () => {
    const { app, login } = await setup();
    const { cookie: admin } = await login("admin@unpam.test");
    const { cookie: dosen } = await login("dosen@unpam.test");
    const dosenId = (await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: dosen } })).json().user.id;

    const patched = await app.inject({ method: "PATCH", url: `/api/admin/users/${dosenId}`, headers: { cookie: admin }, payload: { role: "kaprodi" } });
    expect(patched.json().user.role).toBe("kaprodi");
    expect((await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: dosen } })).statusCode).toBe(401);

    await app.inject({ method: "PATCH", url: `/api/admin/users/${dosenId}`, headers: { cookie: admin }, payload: { isActive: false } });
    expect((await login("dosen@unpam.test")).res.statusCode).toBe(401);
  });

  it("admin tidak bisa mengunci dirinya sendiri, dan admin terakhir dilindungi", async () => {
    const { app, login } = await setup();
    const { cookie } = await login("admin@unpam.test");
    const me = (await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } })).json().user;
    const r1 = await app.inject({ method: "PATCH", url: `/api/admin/users/${me.id}`, headers: { cookie }, payload: { role: "dosen" } });
    expect(r1.statusCode).toBe(409);
    const r2 = await app.inject({ method: "PATCH", url: `/api/admin/users/${me.id}`, headers: { cookie }, payload: { isActive: false } });
    expect(r2.statusCode).toBe(409);
  });

  it("reset password memberi password sementara baru", async () => {
    const { app, login } = await setup();
    const { cookie } = await login("admin@unpam.test");
    const users = (await app.inject({ method: "GET", url: "/api/admin/users", headers: { cookie } })).json().users;
    const hima = users.find((u: { email: string }) => u.email === "hima@unpam.test");
    const res = await app.inject({ method: "POST", url: `/api/admin/users/${hima.id}/reset-password`, headers: { cookie } });
    const { tempPassword } = res.json();
    expect((await login("hima@unpam.test")).res.statusCode).toBe(401);
    expect((await login("hima@unpam.test", tempPassword)).res.statusCode).toBe(200);
  });

  it("hanya admin yang bisa membuka API admin", async () => {
    const { app, login } = await setup();
    const { cookie } = await login("kaprodi@unpam.test");
    for (const [method, url] of [
      ["GET", "/api/admin/users"],
      ["POST", "/api/admin/users"],
      ["GET", "/api/admin/settings"],
      ["GET", "/api/admin/backups"],
    ] as const) {
      expect((await app.inject({ method, url, headers: { cookie }, payload: method === "POST" ? {} : undefined })).statusCode).toBe(403);
    }
  });
});

describe("kuota AI harian", () => {
  it("menolak chat agent bila kuota habis tanpa memanggil LLM", async () => {
    const { app, login } = await setup();
    const { cookie: admin } = await login("admin@unpam.test");
    const { cookie: mhs } = await login("mahasiswa@unpam.test");
    const mhsId = (await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: mhs } })).json().user.id;

    // Pemakaian sebelumnya hari ini: 900 token.
    audit(db, { actorType: "agent", actorAgent: "akademik", actorUserId: mhsId, action: "agent.answered", details: { usedLlm: true, inputTokens: 700, outputTokens: 200 } });
    await app.inject({ method: "PATCH", url: `/api/admin/users/${mhsId}`, headers: { cookie: admin }, payload: { dailyTokenLimit: 800 } });

    const usage = (await app.inject({ method: "GET", url: "/api/me/usage", headers: { cookie: mhs } })).json().usage;
    expect(usage).toMatchObject({ used: 900, input: 700, output: 200, limit: 800, limitSource: "user" });

    const res = await app.inject({ method: "POST", url: "/api/agents/akademik/chat", headers: { cookie: mhs }, payload: { message: "Kapan UTS?" } });
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toContain("Batas pemakaian AI harian");
    expect(db.select().from(auditLogs).all().some((l) => l.action === "agent.quota_exceeded")).toBe(true);

    // Batas pengguna dihapus → kembali ke batas global yang bisa diatur admin.
    await app.inject({ method: "PATCH", url: `/api/admin/users/${mhsId}`, headers: { cookie: admin }, payload: { dailyTokenLimit: null } });
    await app.inject({ method: "PUT", url: "/api/admin/settings", headers: { cookie: admin }, payload: { dailyTokenLimit: 5000 } });
    const after = (await app.inject({ method: "GET", url: "/api/me/usage", headers: { cookie: mhs } })).json().usage;
    expect(after).toMatchObject({ limit: 5000, limitSource: "setting" });
  });

  it("menolak permintaan proposal HIMA bila kuota habis", async () => {
    const { app, login } = await setup();
    const { cookie: admin } = await login("admin@unpam.test");
    await app.inject({ method: "PUT", url: "/api/admin/settings", headers: { cookie: admin }, payload: { dailyTokenLimit: 1 } });
    const { cookie: hima } = await login("hima@unpam.test");
    const himaId = (await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: hima } })).json().user.id;
    audit(db, { actorType: "agent", actorAgent: "hima", actorUserId: himaId, action: "agent.drafted", details: { inputTokens: 1, outputTokens: 1 } });
    const res = await app.inject({
      method: "POST",
      url: "/api/proposals",
      headers: { cookie: hima },
      payload: { namaKegiatan: "Seminar", deskripsi: "Seminar karier untuk mahasiswa SI semester akhir." },
    });
    expect(res.statusCode).toBe(429);
  });
});

describe("backup", () => {
  it("membuat, mendaftar, dan mengunduh backup; nama aneh ditolak", async () => {
    const { app, login } = await setup();
    const { cookie } = await login("admin@unpam.test");
    const created = await app.inject({ method: "POST", url: "/api/admin/backups", headers: { cookie } });
    expect(created.statusCode).toBe(201);
    const { backup } = created.json();
    expect(backup.name).toMatch(/^unpam-\d{8}-\d{6}-manual\.db$/);
    expect(backup.sizeBytes).toBeGreaterThan(0);

    const list = (await app.inject({ method: "GET", url: "/api/admin/backups", headers: { cookie } })).json();
    expect(list.backups.map((b: { name: string }) => b.name)).toContain(backup.name);

    const dl = await app.inject({ method: "GET", url: `/api/admin/backups/${backup.name}`, headers: { cookie } });
    expect(dl.statusCode).toBe(200);
    expect(dl.rawPayload.subarray(0, 15).toString()).toBe("SQLite format 3");

    for (const bad of ["..%2F..%2F.env", "unpam.db", "unpam-20260101-000000-manual.db"]) {
      expect((await app.inject({ method: "GET", url: `/api/admin/backups/${bad}`, headers: { cookie } })).statusCode).toBe(404);
    }
  });

  it("backup otomatis hanya menyimpan N terakhir", async () => {
    for (let i = 0; i < 3; i++) await createBackup(db, backupDir, "otomatis", 2);
    expect(listBackups(backupDir).filter((b) => b.kind === "otomatis")).toHaveLength(2);
  });
});
