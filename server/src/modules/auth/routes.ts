import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { AppContext } from "../../app";
import { audit } from "../../audit/log";
import { SESSION_COOKIE, requireAuth, setSessionCookie, signSession, toPublicUser } from "../../auth/auth";
import { users } from "../../db/schema";

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export function authRoutes(app: FastifyInstance, { db, config }: AppContext): void {
  app.post("/api/auth/login", async (request, reply) => {
    const body = LoginBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Email atau password tidak valid" });

    const row = db.select().from(users).where(eq(users.email, body.data.email)).get();
    const ok = row?.isActive && (await bcrypt.compare(body.data.password, row.passwordHash));
    if (!row || !ok) {
      audit(db, { actorType: "user", actorUserId: row?.id ?? null, action: "auth.login_failed", details: { email: body.data.email } });
      return reply.code(401).send({ error: "Email atau password salah" });
    }

    const user = toPublicUser(row);
    setSessionCookie(reply, signSession(user, config.JWT_SECRET));
    audit(db, { actorType: "user", actorUserId: user.id, action: "auth.login" });
    return { user };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    if (request.user) audit(db, { actorType: "user", actorUserId: request.user.id, action: "auth.logout" });
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", { preHandler: requireAuth }, async (request) => ({ user: request.user }));
}
