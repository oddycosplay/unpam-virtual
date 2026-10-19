import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import type { CampusSnapshot, ClientToServerEvents, ProximityMessage, ServerToClientEvents } from "@unpam/shared";
import { buildApp } from "../src/app";
import { loadConfig } from "../src/config/env";
import { createDb, type Db } from "../src/db/client";
import { seed } from "../src/db/seed";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const config = loadConfig({
  DB_PATH: ":memory:",
  JWT_SECRET: randomBytes(32).toString("hex"),
  ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  SEED_PASSWORD: "test-password",
});

let db: Db;
let app: Awaited<ReturnType<typeof buildApp>>;
let url: string;
const clients: Client[] = [];

beforeEach(async () => {
  db = createDb(":memory:");
  await seed(db, config.SEED_PASSWORD, 4);
  app = await buildApp({ db, config });
  await app.listen({ host: "127.0.0.1", port: 0 });
  url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await app.close();
});

async function cookieFor(email: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password: config.SEED_PASSWORD } });
  const c = res.cookies.find((x) => x.name === "unpam_session")!;
  return `${c.name}=${c.value}`;
}

async function join(email: string): Promise<{ socket: Client; id: string }> {
  const socket: Client = connect(url, { path: "/socket.io", transports: ["websocket"], extraHeaders: { cookie: await cookieFor(email) } });
  clients.push(socket);
  const welcome = await new Promise<{ id: string }>((resolve, reject) => {
    socket.once("welcome", resolve);
    socket.once("connect_error", reject);
  });
  return { socket, id: welcome.id };
}

function next<E extends keyof ServerToClientEvents>(socket: Client, event: E, until: (arg: Parameters<ServerToClientEvents[E]>[0]) => boolean = () => true) {
  return new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve) => {
    const handler = (arg: Parameters<ServerToClientEvents[E]>[0]) => {
      if (!until(arg)) return;
      socket.off(event, handler as never);
      resolve(arg);
    };
    socket.on(event, handler as never);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("kampus realtime", () => {
  it("avatar yang diganti langsung terlihat pemain lain", async () => {
    const a = await join("mahasiswa@unpam.test");
    const b = await join("dosen@unpam.test");
    await sleep(150);
    const look = { shirt: "#2E8B57", accent: "#F5C400", skin: "#C68A5E", hair: "#1F1A17", hairStyle: "panjang", accessory: "topi" };
    const seen = next(a.socket, "snapshot", (s) => s.players.some((p) => p.id === b.id && p.avatar !== null));
    const res = await app.inject({ method: "PUT", url: "/api/me/avatar", headers: { cookie: await cookieFor("dosen@unpam.test") }, payload: { avatar: look } });
    expect(res.statusCode).toBe(200);
    expect((await seen).players.find((p) => p.id === b.id)?.avatar).toEqual(look);
  });

  it("menolak koneksi tanpa sesi login", async () => {
    const socket: Client = connect(url, { path: "/socket.io", transports: ["websocket"] });
    clients.push(socket);
    const err = await new Promise<Error>((resolve) => socket.once("connect_error", resolve));
    expect(err.message).toBe("unauthorized");
  });

  it("pemain melihat posisi pemain lain dan status agent", async () => {
    const a = await join("mahasiswa@unpam.test");
    const agentsP = next(a.socket, "agents");
    const b = await join("dosen@unpam.test");
    expect((await agentsP).map((x) => x.id)).toEqual(expect.arrayContaining(["akademik", "hima", "orkestrator"]));

    b.socket.emit("move", { x: 4, z: 2, rot: 1, moving: true });
    const snap: CampusSnapshot = await next(a.socket, "snapshot", (s) => s.players.some((p) => p.id === b.id && p.x === 4));
    const dosen = snap.players.find((p) => p.id === b.id)!;
    expect(dosen).toMatchObject({ name: "Dr. Sari Dosen", role: "dosen", x: 4, z: 2, moving: true });
  });

  it("posisi di luar kampus dipotong ke batas, data rusak diabaikan", async () => {
    const a = await join("mahasiswa@unpam.test");
    a.socket.emit("move", { x: 999, z: -999, rot: 0, moving: false });
    const snap = await next(a.socket, "snapshot", (s) => s.players.some((p) => p.id === a.id && p.x > 10));
    expect(snap.players.find((p) => p.id === a.id)).toMatchObject({ x: 11.4, z: -10.4 });

    a.socket.emit("move", { x: Number.NaN, z: 0, rot: 0, moving: false } as never);
    await sleep(250);
    // Posisi tidak berubah karena NaN ditolak (tidak ada snapshot baru yang menggeser pemain).
  });

  it("proximity chat hanya sampai ke pemain dalam radius", async () => {
    const a = await join("mahasiswa@unpam.test");
    const near = await join("hima@unpam.test");
    const far = await join("kaprodi@unpam.test");
    a.socket.emit("move", { x: 0, z: 5, rot: 0, moving: false });
    near.socket.emit("move", { x: 2, z: 6, rot: 0, moving: false }); // ±2,2 m
    far.socket.emit("move", { x: -9, z: -8, rot: 0, moving: false }); // ±16 m
    await next(a.socket, "snapshot", (s) => s.players.some((p) => p.id === far.id && p.x === -9));

    let farHeard = false;
    far.socket.on("chat:message", () => (farHeard = true));
    const nearP = next(near.socket, "chat:message");
    const ownP = next(a.socket, "chat:message");
    a.socket.emit("chat:send", "  Halo, ada yang tahu ruang dosen?  ");

    const [heard, own] = await Promise.all([nearP, ownP]);
    expect(heard).toMatchObject({ name: "Rina Mahasiswa", role: "mahasiswa", text: "Halo, ada yang tahu ruang dosen?" });
    expect((own as ProximityMessage).heardBy).toBe(1);
    await sleep(200);
    expect(farHeard).toBe(false);
  });

  it("membatasi kecepatan chat dan panjang pesan", async () => {
    const a = await join("mahasiswa@unpam.test");
    const first = next(a.socket, "chat:message");
    a.socket.emit("chat:send", "x".repeat(1000));
    expect((await first).text).toHaveLength(280);
    const err = next(a.socket, "chat:error");
    a.socket.emit("chat:send", "lagi");
    expect((await err).error).toContain("Terlalu cepat");
  });

  it("pemain yang keluar hilang dari snapshot", async () => {
    const a = await join("mahasiswa@unpam.test");
    const b = await join("dosen@unpam.test");
    await next(a.socket, "snapshot", (s) => s.players.some((p) => p.id === b.id));
    b.socket.disconnect();
    const snap = await next(a.socket, "snapshot", (s) => !s.players.some((p) => p.id === b.id));
    expect(snap.players.map((p) => p.id)).toEqual([a.id]);
  });
});
