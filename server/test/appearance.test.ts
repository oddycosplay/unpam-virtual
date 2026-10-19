import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { defaultAvatar, type AvatarLook } from "@unpam/shared";
import { buildApp } from "../src/app";
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
  const login = async (email: string) => {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password: config.SEED_PASSWORD } });
    const c = res.cookies.find((x) => x.name === "unpam_session")!;
    return `${c.name}=${c.value}`;
  };
  return { app, login };
}

const LOOK: AvatarLook = { ...defaultAvatar("mahasiswa"), shirt: "#C8102E", hairStyle: "hijab", hair: "#1E5BB8", accessory: "kacamata" };

describe("tampilan avatar dan robot agent", () => {
  it("pengguna menyimpan avatarnya sendiri dan bisa kembali ke bawaan", async () => {
    const { app, login } = await setup();
    const cookie = await login("mahasiswa@unpam.test");
    const saved = await app.inject({ method: "PUT", url: "/api/me/avatar", headers: { cookie }, payload: { avatar: LOOK } });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().user.avatar).toEqual(LOOK);
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(me.json().user.avatar).toEqual(LOOK);

    const reset = await app.inject({ method: "PUT", url: "/api/me/avatar", headers: { cookie }, payload: { avatar: null } });
    expect(reset.json().user.avatar).toBeNull();
  });

  it("menolak avatar dengan warna atau gaya yang tidak dikenal", async () => {
    const { app, login } = await setup();
    const cookie = await login("dosen@unpam.test");
    for (const avatar of [{ ...LOOK, shirt: "red" }, { ...LOOK, hairStyle: "mohawk" }, { ...LOOK, shirt: "#fff;}" }]) {
      const res = await app.inject({ method: "PUT", url: "/api/me/avatar", headers: { cookie }, payload: { avatar } });
      expect(res.statusCode).toBe(400);
    }
  });

  it("hanya admin yang mengubah robot agent; tampilannya ikut di status agent", async () => {
    const { app, login } = await setup();
    const mhs = await login("mahasiswa@unpam.test");
    const admin = await login("admin@unpam.test");
    const look = { body: "#F5C400", visor: "#1E5BB8", style: "antena" };

    const denied = await app.inject({ method: "PUT", url: "/api/admin/agent-appearance", headers: { cookie: mhs }, payload: { appearance: { akademik: look } } });
    expect(denied.statusCode).toBe(403);

    const bad = await app.inject({ method: "PUT", url: "/api/admin/agent-appearance", headers: { cookie: admin }, payload: { appearance: { akademik: { ...look, style: "ufo" } } } });
    expect(bad.statusCode).toBe(400);

    const ok = await app.inject({ method: "PUT", url: "/api/admin/agent-appearance", headers: { cookie: admin }, payload: { appearance: { akademik: look } } });
    expect(ok.statusCode).toBe(200);

    const status = (await app.inject({ method: "GET", url: "/api/agents/status", headers: { cookie: mhs } })).json().agents;
    expect(status.find((a: { id: string }) => a.id === "akademik").appearance).toEqual(look);
    expect(status.find((a: { id: string }) => a.id === "hima").appearance.style).toBe("pod");
    expect(db.select().from(auditLogs).all().some((l) => l.action === "config.agent_appearance_updated")).toBe(true);
  });
});
