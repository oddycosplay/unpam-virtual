import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { loadConfig } from "../src/config/env";
import { createDb, type Db } from "../src/db/client";
import { auditLogs, knowledgeDocuments } from "../src/db/schema";
import { seed } from "../src/db/seed";
import { searchChunks } from "../src/rag/search";

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
  const login = async (email: string) => {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password: config.SEED_PASSWORD } });
    const c = res.cookies.find((x) => x.name === "unpam_session")!;
    return `${c.name}=${c.value}`;
  };
  return { app, login };
}

describe("organisasi mahasiswa", () => {
  it("menyimpan 21 HIMA dan 18 UKM sesuai urutan daftar resmi", async () => {
    const { app, login } = await setup();
    const res = await app.inject({ method: "GET", url: "/api/organizations", headers: { cookie: await login("mahasiswa@unpam.test") } });
    const list = res.json().organizations;
    const hima = list.filter((o: { kind: string }) => o.kind === "hima");
    const ukm = list.filter((o: { kind: string }) => o.kind === "ukm");
    expect(hima).toHaveLength(21);
    expect(ukm).toHaveLength(18);
    expect(hima[0]).toMatchObject({ number: 1, name: "Administrasi Perkantoran D-3", linkType: "instagram", url: null });
    expect(hima[5]).toMatchObject({ number: 6, linkType: "kegiatan" });
    expect(hima.find((o: { name: string }) => o.name === "Sistem Informasi S-1")).toMatchObject({ number: 15 });
    expect(ukm.at(-1)).toMatchObject({ number: 18, name: "UKM LINGKAR KREATIF" });
  });

  it("seed tidak menduplikasi saat dijalankan ulang", async () => {
    await seed(db, config.SEED_PASSWORD, 4);
    const { app, login } = await setup();
    const res = await app.inject({ method: "GET", url: "/api/organizations", headers: { cookie: await login("dosen@unpam.test") } });
    expect(res.json().organizations).toHaveLength(39);
    expect(db.select().from(knowledgeDocuments).all().filter((d) => d.fileName === "organisasi-mahasiswa.md")).toHaveLength(1);
  });

  it("Agent Akademik bisa menemukan organisasi di basis pengetahuan", () => {
    const hits = searchChunks(db, "UKM sepak bola basket", { agentScope: "akademik" });
    expect(hits[0]?.documentTitle).toContain("Organisasi Mahasiswa");
    expect(hits[0]?.content).toContain("UKM Sepak Bola");
    const si = searchChunks(db, "HIMA Sistem Informasi", { agentScope: "akademik" });
    expect(si.some((h) => h.content.includes("HIMA Sistem Informasi S-1"))).toBe(true);
  });

  it("hanya admin yang bisa mengisi tautan, dan hanya https", async () => {
    const { app, login } = await setup();
    const admin = await login("admin@unpam.test");
    const hima = await login("hima@unpam.test");
    const list = (await app.inject({ method: "GET", url: "/api/organizations", headers: { cookie: admin } })).json().organizations;
    const si = list.find((o: { name: string }) => o.name === "Sistem Informasi S-1");
    const patch = (cookie: string, url: string | null) =>
      app.inject({ method: "PATCH", url: `/api/admin/organizations/${si.id}`, headers: { cookie }, payload: { url } });

    expect((await patch(hima, "https://instagram.com/himasi")).statusCode).toBe(403);
    expect((await patch(admin, "javascript:alert(1)")).statusCode).toBe(400);
    expect((await patch(admin, "http://instagram.com/himasi")).statusCode).toBe(400);

    const ok = await patch(admin, "https://www.instagram.com/himasi.unpam/");
    expect(ok.json().organization).toMatchObject({ url: "https://www.instagram.com/himasi.unpam/" });
    const log = db.select().from(auditLogs).all().find((l) => l.action === "document.organization_link_updated");
    expect(log?.details).toMatchObject({ title: "Sistem Informasi S-1", before: null });

    expect((await patch(admin, null)).json().organization.url).toBeNull();
  });
});
