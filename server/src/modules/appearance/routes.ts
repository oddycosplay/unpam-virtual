import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { AGENT_IDS, isAgentAppearance, isAvatarLook, type AgentAppearanceMap } from "@unpam/shared";
import type { AppContext } from "../../app";
import { SETTING_AGENT_APPEARANCE, getAgentAppearance } from "../../agents/appearance";
import { setSetting } from "../../agents/quota";
import { audit } from "../../audit/log";
import { requireAuth, requirePermission, toPublicUser } from "../../auth/auth";
import { users } from "../../db/schema";

export function appearanceRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db } = ctx;

  // Avatar kampus 3D milik pengguna sendiri. null = kembali ke bawaan peran.
  app.put("/api/me/avatar", { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as { avatar?: unknown } | undefined;
    const avatar = body?.avatar ?? null;
    if (avatar !== null && !isAvatarLook(avatar)) return reply.code(400).send({ error: "Data avatar tidak valid" });
    const row = db.update(users).set({ avatar }).where(eq(users.id, request.user!.id)).returning().get();
    const user = toPublicUser(row);
    ctx.onAvatarChange?.(user.id, user.avatar ?? null);
    return { user };
  });

  app.get("/api/agents/appearance", { preHandler: requireAuth }, async () => ({ appearance: getAgentAppearance(db) }));

  app.put("/api/admin/agent-appearance", { preHandler: requirePermission("admin:config") }, async (request, reply) => {
    const body = (request.body as { appearance?: Record<string, unknown> } | undefined)?.appearance;
    if (!body || typeof body !== "object") return reply.code(400).send({ error: "Data tampilan agent tidak valid" });
    const next: AgentAppearanceMap = getAgentAppearance(db);
    for (const id of AGENT_IDS) {
      if (body[id] === undefined) continue;
      if (!isAgentAppearance(body[id])) return reply.code(400).send({ error: `Tampilan ${id} tidak valid` });
      next[id] = body[id];
    }
    setSetting(db, SETTING_AGENT_APPEARANCE, JSON.stringify(next), request.user!.id);
    audit(db, { actorType: "user", actorUserId: request.user!.id, action: "config.agent_appearance_updated", details: { appearance: next } });
    return { appearance: next };
  });
}
