import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { hasPermission, isAvatarLook, type Permission, type PublicUser, type Role } from "@unpam/shared";
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
  /** users.token_version saat login; sesi batal bila versi di DB sudah naik. */
  ver: number;
}

type UserRow = typeof users.$inferSelect;

export function signSession(row: UserRow, secret: string): string {
  const payload: SessionPayload = { sub: row.id, role: row.roleId, ver: row.tokenVersion };
  return jwt.sign(payload, secret, { expiresIn: SESSION_TTL_SECONDS });
}

/** Pakai cookie Secure bila COOKIE_SECURE=true, atau otomatis bila permintaan datang lewat HTTPS. */
export function setSessionCookie(reply: FastifyReply, token: string, secure: boolean): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    secure,
  });
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.roleId,
    mustChangePassword: row.mustChangePassword,
    avatar: isAvatarLook(row.avatar) ? row.avatar : null,
  };
}

/** Verifikasi token sesi dan kembalikan baris pengguna yang masih aktif dengan versi sesi yang sama. */
export function resolveSession(db: Db, token: string | undefined, secret: string): UserRow | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret) as unknown as SessionPayload;
    const row = db.select().from(users).where(eq(users.id, Number(payload.sub))).get();
    if (!row?.isActive || (payload.ver ?? 0) !== row.tokenVersion) return null;
    return row;
  } catch {
    return null; // kedaluwarsa atau rusak
  }
}

/** Membaca cookie sesi di setiap request. User diambil ulang dari DB agar peran/status selalu terbaru. */
export function registerAuth(app: FastifyInstance, db: Db, secret: string): void {
  app.decorateRequest("user", null);
  app.addHook("onRequest", async (request) => {
    const row = resolveSession(db, request.cookies[SESSION_COOKIE], secret);
    if (row) request.user = toPublicUser(row);
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
