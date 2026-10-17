import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { hasPermission, type Permission, type PublicUser, type Role } from "@unpam/shared";
import type { Db } from "../db/client";
import { users } from "../db/schema";

export const SESSION_COOKIE = "unpam_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

declare module "fastify" {
  interface FastifyRequest {
    user: PublicUser | null;
  }
}

interface SessionPayload {
  sub: number;
  role: Role;
}

export function signSession(user: PublicUser, secret: string): string {
  const payload: SessionPayload = { sub: user.id, role: user.role };
  return jwt.sign(payload, secret, { expiresIn: SESSION_TTL_SECONDS });
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    // Diakses lewat http di LAN; aktifkan secure saat sudah memakai HTTPS (tahap 6).
    secure: false,
  });
}

export function toPublicUser(row: typeof users.$inferSelect): PublicUser {
  return { id: row.id, email: row.email, name: row.name, role: row.roleId };
}

/** Membaca cookie sesi di setiap request. User diambil ulang dari DB agar peran/status selalu terbaru. */
export function registerAuth(app: FastifyInstance, db: Db, secret: string): void {
  app.decorateRequest("user", null);
  app.addHook("onRequest", async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) return;
    try {
      const payload = jwt.verify(token, secret) as unknown as SessionPayload;
      const row = db.select().from(users).where(eq(users.id, Number(payload.sub))).get();
      if (row?.isActive) request.user = toPublicUser(row);
    } catch {
      // Token kedaluwarsa/rusak: anggap belum login.
    }
  });
}

export function requireAuth(request: FastifyRequest, reply: FastifyReply, done: () => void): void {
  if (!request.user) {
    reply.code(401).send({ error: "Silakan login terlebih dahulu" });
    return;
  }
  done();
}

export function requirePermission(permission: Permission) {
  return (request: FastifyRequest, reply: FastifyReply, done: () => void): void => {
    if (!request.user) {
      reply.code(401).send({ error: "Silakan login terlebih dahulu" });
      return;
    }
    if (!hasPermission(request.user.role, permission)) {
      reply.code(403).send({ error: "Peran Anda tidak punya akses ke fitur ini" });
      return;
    }
    done();
  };
}
