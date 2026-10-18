import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppContext } from "../../app";
import { audit } from "../../audit/log";
import { SESSION_COOKIE, requireAuth, setSessionCookie, signSession, toPublicUser } from "../../auth/auth";
import { MIN_PASSWORD_LENGTH, isHttps } from "../../auth/security";
import { users } from "../../db/schema";

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const ChangePasswordBody = z
  .object({
    currentPassword: z.string().min(1, "Isi password saat ini"),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter`).max(200),
  })
  .refine((b) => b.currentPassword !== b.newPassword, { message: "Password baru harus berbeda dari yang lama" });

export function authRoutes(app: FastifyInstance, { db, config, loginLimiter }: AppContext): void {
  const secureCookie = (request: Parameters<typeof isHttps>[0]) =>
    config.COOKIE_SECURE === "true" || (config.COOKIE_SECURE === "auto" && isHttps(request));

  app.post("/api/auth/login", async (request, reply) => {
    const body = LoginBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Email atau password tidak valid" });
    const { email, password } = body.data;

    const locked = loginLimiter.lockedFor(request.ip, email);
    if (locked > 0) {
      audit(db, { actorType: "system", action: "auth.login_locked", details: { email, ip: request.ip, retryAfterSec: locked } });
      return reply
        .code(429)
        .header("retry-after", String(locked))
        .send({ error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${Math.ceil(locked / 60)} menit.` });
    }

    const row = db.select().from(users).where(eq(users.email, email)).get();
    const ok = row?.isActive && (await bcrypt.compare(password, row.passwordHash));
    if (!row || !ok) {
      loginLimiter.fail(request.ip, email);
      audit(db, { actorType: "user", actorUserId: row?.id ?? null, action: "auth.login_failed", details: { email, ip: request.ip } });
      return reply.code(401).send({ error: "Email atau password salah" });
    }

    loginLimiter.succeed(request.ip, email);
    setSessionCookie(reply, signSession(row, config.JWT_SECRET), secureCookie(request));
    audit(db, { actorType: "user", actorUserId: row.id, action: "auth.login" });
    return { user: toPublicUser(row) };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    if (request.user) audit(db, { actorType: "user", actorUserId: request.user.id, action: "auth.logout" });
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", { preHandler: requireAuth }, async (request) => ({ user: request.user }));

  // Ganti password sendiri. Sesi lain milik pengguna ini otomatis batal; sesi ini diperbarui.
  app.post("/api/auth/change-password", { preHandler: requireAuth }, async (request, reply) => {
    const body = ChangePasswordBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? "Data tidak valid" });
    const row = db.select().from(users).where(eq(users.id, request.user!.id)).get()!;
    if (!(await bcrypt.compare(body.data.currentPassword, row.passwordHash))) {
      return reply.code(400).send({ error: "Password saat ini salah" });
    }
    const updated = db
      .update(users)
      .set({
        passwordHash: await bcrypt.hash(body.data.newPassword, config.BCRYPT_ROUNDS),
        mustChangePassword: false,
        tokenVersion: sql`${users.tokenVersion} + 1`,
      })
      .where(eq(users.id, row.id))
      .returning()
      .get();
    setSessionCookie(reply, signSession(updated, config.JWT_SECRET), secureCookie(request));
    audit(db, { actorType: "user", actorUserId: row.id, action: "auth.password_changed" });
    return { user: toPublicUser(updated) };
  });
}
