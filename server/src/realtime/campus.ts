import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import {
  CAMPUS_BOUNDS,
  CHAT_MAX_LENGTH,
  CHAT_RADIUS,
  SPAWN,
  type ClientToServerEvents,
  type PlayerState,
  type PublicUser,
  type ServerToClientEvents,
} from "@unpam/shared";
import type { AppContext } from "../app";
import { currentAgentViews } from "../agents/status";
import { SESSION_COOKIE, resolveSession, toPublicUser } from "../auth/auth";

const ROOM = "campus";
const SNAPSHOT_MS = 100;
const AGENTS_MS = 1000;
const CHAT_COOLDOWN_MS = 1000;
const MAX_PLAYERS = 60;

interface SocketData {
  user: PublicUser;
  state: PlayerState;
  lastChatAt: number;
}

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Kampus multiplayer: posisi pemain, status agent, dan proximity chat lewat Socket.IO.
 * Posisi disiarkan berkala; pesan chat hanya dikirim ke pemain dalam CHAT_RADIUS menurut posisi di server.
 * Pesan chat sengaja tidak disimpan di database.
 */
export function attachCampus(app: FastifyInstance, ctx: AppContext): Server<ClientToServerEvents, ServerToClientEvents, object, SocketData> {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>(app.server, {
    path: "/socket.io",
    serveClient: false,
  });

  // Autentikasi memakai cookie sesi yang sama dengan API HTTP.
  io.use((socket, next) => {
    const row = resolveSession(ctx.db, readCookie(socket.handshake.headers.cookie, SESSION_COOKIE), ctx.config.JWT_SECRET);
    if (!row) return next(new Error("unauthorized"));
    if (io.of("/").sockets.size >= MAX_PLAYERS) return next(new Error("full"));
    const user = toPublicUser(row);
    // Sebar sedikit di sekitar gerbang agar pemain baru tidak bertumpuk.
    const x = SPAWN.x + (Math.random() - 0.5) * 1.6;
    const z = SPAWN.z + (Math.random() - 0.5) * 0.6;
    socket.data = {
      user,
      state: { id: socket.id, userId: user.id, name: user.name, role: user.role, x, z, rot: Math.PI, moving: false },
      lastChatAt: 0,
    };
    next();
  });

  io.on("connection", (socket) => {
    void socket.join(ROOM);
    socket.emit("welcome", { id: socket.id, spawn: { x: socket.data.state.x, z: socket.data.state.z } });
    socket.emit("agents", currentAgentViews(ctx.db, ctx.agents));
    dirty = true;

    socket.on("move", (p) => {
      if (!p || !finite(p.x) || !finite(p.z) || !finite(p.rot)) return;
      const s = socket.data.state;
      s.x = clamp(p.x, CAMPUS_BOUNDS.minX, CAMPUS_BOUNDS.maxX);
      s.z = clamp(p.z, CAMPUS_BOUNDS.minZ, CAMPUS_BOUNDS.maxZ);
      s.rot = p.rot;
      s.moving = Boolean(p.moving);
      dirty = true;
    });

    socket.on("chat:send", (raw) => {
      if (typeof raw !== "string") return;
      const text = raw.trim().slice(0, CHAT_MAX_LENGTH);
      if (!text) return;
      const now = Date.now();
      if (now - socket.data.lastChatAt < CHAT_COOLDOWN_MS) {
        socket.emit("chat:error", { error: "Terlalu cepat. Tunggu sebentar sebelum mengirim lagi." });
        return;
      }
      socket.data.lastChatAt = now;

      const from = socket.data.state;
      const nearby = [...io.of("/").sockets.values()].filter(
        (s) => s.id !== socket.id && s.data.state && Math.hypot(s.data.state.x - from.x, s.data.state.z - from.z) <= CHAT_RADIUS,
      );
      const message = {
        id: randomUUID(),
        fromId: socket.id,
        name: from.name,
        role: from.role,
        text,
        at: new Date(now).toISOString(),
        heardBy: nearby.length,
      };
      socket.emit("chat:message", message);
      for (const s of nearby) s.emit("chat:message", message);
    });

    socket.on("disconnect", () => {
      dirty = true;
    });
  });

  // Siarkan posisi bila ada perubahan, dan status agent bila berubah.
  let dirty = false;
  let lastAgents = "";
  const snapshotTimer = setInterval(() => {
    if (!dirty) return;
    dirty = false;
    const players = [...io.of("/").sockets.values()].map((s) => s.data.state).filter(Boolean);
    io.to(ROOM).emit("snapshot", { players });
  }, SNAPSHOT_MS);
  const agentsTimer = setInterval(() => {
    if (io.of("/").sockets.size === 0) return;
    const agents = currentAgentViews(ctx.db, ctx.agents);
    const key = JSON.stringify(agents);
    if (key === lastAgents) return;
    lastAgents = key;
    io.to(ROOM).emit("agents", agents);
  }, AGENTS_MS);

  app.addHook("onClose", async () => {
    clearInterval(snapshotTimer);
    clearInterval(agentsTimer);
    await io.close();
  });
  return io;
}
