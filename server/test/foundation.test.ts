import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { loadConfig } from "../src/config/env";
import { decryptSecret, encryptSecret } from "../src/crypto/secrets";
import { createDb, type Db } from "../src/db/client";
import { auditLogs, llmProviderConfig } from "../src/db/schema";
import { seed } from "../src/db/seed";

const config = loadConfig({
  DB_PATH: ":memory:",
  JWT_SECRET: randomBytes(32).toString("hex"),
  ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  SEED_PASSWORD: "test-password",
});

let db: Db;
let app: Awaited<ReturnType<typeof buildApp>>;

beforeEach(async () => {
  db = createDb(":memory:");
  await seed(db, config.SEED_PASSWORD);
  app = await buildApp({ db, config });
});

async function loginAs(email: string, password = config.SEED_PASSWORD) {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
  const cookie = res.cookies.find((c) => c.name === "unpam_session");
  return { res, cookie: cookie ? `${cookie.name}=${cookie.value}` : "" };
}

describe("secrets", () => {
  it("mengenkripsi dan mendekripsi bolak-balik", () => {
    const enc = encryptSecret("sk-rahasia-1234", config.ENCRYPTION_KEY);
    expect(enc).not.toContain("sk-rahasia");
    expect(decryptSecret(enc, config.ENCRYPTION_KEY)).toBe("sk-rahasia-1234");
  });

  it("menolak kunci yang salah", () => {
    const enc = encryptSecret("abc", config.ENCRYPTION_KEY);
    expect(() => decryptSecret(enc, randomBytes(32).toString("hex"))).toThrow();
  });
});

describe("auth", () => {
  it("menolak password salah dan mencatat audit", async () => {
    const { res } = await loginAs("mahasiswa@unpam.test", "salah");
    expect(res.statusCode).toBe(401);
    const logs = db.select().from(auditLogs).all();
    expect(logs.some((l) => l.action === "auth.login_failed")).toBe(true);
  });

  it("login berhasil memberi cookie httpOnly dan /me mengembalikan peran", async () => {
    const { res, cookie } = await loginAs("kaprodi@unpam.test");
    expect(res.statusCode).toBe(200);
    expect(res.cookies[0]?.httpOnly).toBe(true);
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(me.json().user).toMatchObject({ email: "kaprodi@unpam.test", role: "kaprodi" });
  });

  it("/me tanpa sesi → 401", async () => {
    const me = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(me.statusCode).toBe(401);
  });
});

describe("RBAC", () => {
  it("mahasiswa tidak boleh melihat daftar pengguna", async () => {
    const { cookie } = await loginAs("mahasiswa@unpam.test");
    const res = await app.inject({ method: "GET", url: "/api/users", headers: { cookie } });
    expect(res.statusCode).toBe(403);
  });

  it("admin boleh melihat daftar pengguna", async () => {
    const { cookie } = await loginAs("admin@unpam.test");
    const res = await app.inject({ method: "GET", url: "/api/users", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().users).toHaveLength(5);
  });

  it("kaprodi tidak boleh mengubah konfigurasi LLM", async () => {
    const { cookie } = await loginAs("kaprodi@unpam.test");
    const res = await app.inject({ method: "GET", url: "/api/admin/llm-config", headers: { cookie } });
    expect(res.statusCode).toBe(403);
  });
});

describe("konfigurasi LLM", () => {
  it("menyimpan API key terenkripsi dan tidak pernah mengembalikannya", async () => {
    const { cookie } = await loginAs("admin@unpam.test");
    const res = await app.inject({
      method: "PUT",
      url: "/api/admin/llm-config",
      headers: { cookie },
      payload: { provider: "openai-compatible", baseUrl: "http://localhost:11434/v1", model: "llama3", apiKey: "key-abcd9876" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain("key-abcd9876");
    expect(res.json().config).toMatchObject({ source: "database", hasApiKey: true, apiKeyLast4: "9876" });

    const row = db.select().from(llmProviderConfig).get();
    expect(row?.apiKeyEncrypted).not.toContain("key-abcd");

    // Simpan ulang tanpa apiKey → key lama dipertahankan.
    const res2 = await app.inject({
      method: "PUT",
      url: "/api/admin/llm-config",
      headers: { cookie },
      payload: { provider: "openai-compatible", baseUrl: "http://localhost:11434/v1", model: "qwen3" },
    });
    expect(res2.json().config).toMatchObject({ model: "qwen3", hasApiKey: true, apiKeyLast4: "9876" });

    const logs = db.select().from(auditLogs).all().filter((l) => l.action === "config.llm_updated");
    expect(logs).toHaveLength(2);
    expect(JSON.stringify(logs)).not.toContain("key-abcd9876");
  });

  it("openai-compatible tanpa base URL ditolak", async () => {
    const { cookie } = await loginAs("admin@unpam.test");
    const res = await app.inject({
      method: "PUT",
      url: "/api/admin/llm-config",
      headers: { cookie },
      payload: { provider: "openai-compatible", baseUrl: "", model: "x" },
    });
    expect(res.statusCode).toBe(400);
  });
});
