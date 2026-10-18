import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { audit } from "../src/audit/log";
import { loadConfig } from "../src/config/env";
import { createDb, type Db } from "../src/db/client";
import { auditLogs } from "../src/db/schema";
import { seed } from "../src/db/seed";

const config = loadConfig({
  DB_PATH: ":memory:",
  JWT_SECRET: randomBytes(32).toString("hex"),
  ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  SEED_PASSWORD: "test-password",
});

let db: Db;
beforeEach(async () => {
  db = createDb(":memory:");
  await seed(db, config.SEED_PASSWORD, 4);
});

async function setup() {
  const app = await buildApp({ db, config });
  const login = async (email: string, password = config.SEED_PASSWORD) => {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
    const c = res.cookies.find((x) => x.name === "unpam_session");
    return c ? `${c.name}=${c.value}` : "";
  };
  return { app, login };
}

describe("log audit", () => {
  it("hanya admin yang bisa membuka", async () => {
    const { app, login } = await setup();
    for (const email of ["mahasiswa@unpam.test", "hima@unpam.test", "dosen@unpam.test", "kaprodi@unpam.test"]) {
      const cookie = await login(email);
      expect((await app.inject({ method: "GET", url: "/api/admin/audit", headers: { cookie } })).statusCode).toBe(403);
      expect((await app.inject({ method: "GET", url: "/api/admin/audit.csv", headers: { cookie } })).statusCode).toBe(403);
    }
    expect((await app.inject({ method: "GET", url: "/api/admin/audit" })).statusCode).toBe(401);
  });

  it("menyaring per jenis aktor, kategori, dan kata kunci", async () => {
    const { app, login } = await setup();
    await login("mahasiswa@unpam.test", "salah");
    audit(db, { actorType: "agent", actorAgent: "akademik", actorUserId: 1, action: "agent.answered", details: { usedLlm: true, latencyMs: 4200 } });
    audit(db, { actorType: "agent", actorAgent: "hima", actorUserId: 2, action: "agent.drafted", targetType: "submission", targetId: 7, details: { title: "Seminar 100% Seru_Tes" } });
    const admin = await login("admin@unpam.test");
    const get = async (qs: string) => (await app.inject({ method: "GET", url: `/api/admin/audit?${qs}`, headers: { cookie: admin } })).json();

    const agents = await get("type=agent");
    expect(agents.total).toBe(2);
    expect(agents.entries.every((e: { actorType: string }) => e.actorType === "agent")).toBe(true);

    const auth = await get("category=auth");
    expect(auth.entries.map((e: { action: string }) => e.action).sort()).toEqual(["auth.login", "auth.login_failed"]);
    expect(auth.entries.find((e: { action: string }) => e.action === "auth.login_failed").summary).toContain("mahasiswa@unpam.test");

    // Kata kunci mencari nama agent, nama pengguna, dan isi detail; % dan _ dianggap huruf biasa.
    expect((await get("q=Agent%20HIMA")).total).toBe(1);
    expect((await get("q=Admin%20Prodi")).entries[0].action).toBe("auth.login");
    expect((await get(`q=${encodeURIComponent("100% Seru_")}`)).total).toBe(1);
    expect((await get(`q=${encodeURIComponent("100%x")}`)).total).toBe(0);

    const drafted = (await get("q=Seminar")).entries[0];
    expect(drafted).toMatchObject({ category: "agent", link: "/pengajuan/7", summary: 'Agent HIMA menyelesaikan draf "Seminar 100% Seru_Tes"' });

    const today = new Date().toLocaleDateString("sv-SE");
    expect((await get(`from=${today}&to=${today}`)).total).toBe(4);
    expect((await get("to=2000-01-01")).total).toBe(0);
    expect((await app.inject({ method: "GET", url: "/api/admin/audit?from=kemarin", headers: { cookie: admin } })).statusCode).toBe(400);
  });

  it("paginasi dengan cursor before", async () => {
    const { app, login } = await setup();
    for (let i = 0; i < 7; i++) audit(db, { actorType: "system", action: "document.uploaded", details: { title: `Doc ${i}`, chunkCount: 1 } });
    const admin = await login("admin@unpam.test");
    const page1 = (await app.inject({ method: "GET", url: "/api/admin/audit?category=document&limit=3", headers: { cookie: admin } })).json();
    expect(page1).toMatchObject({ total: 7 });
    expect(page1.entries).toHaveLength(3);
    const page2 = (await app.inject({ method: "GET", url: `/api/admin/audit?category=document&limit=3&before=${page1.nextBefore}`, headers: { cookie: admin } })).json();
    const page3 = (await app.inject({ method: "GET", url: `/api/admin/audit?category=document&limit=3&before=${page2.nextBefore}`, headers: { cookie: admin } })).json();
    expect(page3.entries).toHaveLength(1);
    expect(page3.nextBefore).toBeNull();
    const ids = [...page1.entries, ...page2.entries, ...page3.entries].map((e: { id: number }) => e.id);
    expect(new Set(ids).size).toBe(7);
  });

  it("ekspor CSV aman dibuka di spreadsheet", async () => {
    const { app, login } = await setup();
    audit(db, { actorType: "system", action: "document.uploaded", details: { title: '=HYPERLINK("x"), "kutip"', chunkCount: 2 } });
    const admin = await login("admin@unpam.test");
    const res = await app.inject({ method: "GET", url: "/api/admin/audit.csv?category=document", headers: { cookie: admin } });
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="audit-unpam-\d{8}\.csv"/);
    const lines = res.body.replace(/^ï»¿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("id,waktu,jenis_aktor,pengguna,agent,aksi,ringkasan,target,penyetuju,detail");
    expect(lines).toHaveLength(2);
    // Ringkasan diawali tanda kutip, tidak diawali "=" sehingga tidak dieksekusi sebagai formula.
    expect(lines[1]).not.toMatch(/,=HYPERLINK/);
    expect(lines[1]).toContain('""kutip""');
  });

  it("baris audit tidak bisa diubah lewat API (hanya baca)", async () => {
    const { app, login } = await setup();
    const admin = await login("admin@unpam.test");
    for (const method of ["POST", "PUT", "DELETE"] as const) {
      expect((await app.inject({ method, url: "/api/admin/audit", headers: { cookie: admin } })).statusCode).toBe(404);
    }
    expect(db.select().from(auditLogs).all().length).toBeGreaterThan(0);
  });
});
