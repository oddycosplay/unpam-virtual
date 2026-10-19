import type { FastifyInstance } from "fastify";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { OrganizationView } from "@unpam/shared";
import type { AppContext } from "../../app";
import { audit } from "../../audit/log";
import { requireAuth, requirePermission } from "../../auth/auth";
import { organizations } from "../../db/schema";

const LinkBody = z.object({
  // Hanya tautan https agar tidak bisa dipakai untuk javascript: atau tautan tidak aman.
  url: z
    .string()
    .trim()
    .max(500)
    .url("URL tidak valid")
    .refine((u) => u.startsWith("https://"), "URL harus diawali https://")
    .nullable(),
});

function toView(row: typeof organizations.$inferSelect): OrganizationView {
  return { id: row.id, kind: row.kind, number: row.number, name: row.name, linkType: row.linkType, url: row.url };
}

export function organizationRoutes(app: FastifyInstance, { db }: AppContext): void {
  app.get("/api/organizations", { preHandler: requireAuth }, async () => ({
    organizations: db.select().from(organizations).orderBy(asc(organizations.kind), asc(organizations.number)).all().map(toView),
  }));

  app.patch<{ Params: { id: string } }>(
    "/api/admin/organizations/:id",
    { preHandler: requirePermission("admin:documents") },
    async (request, reply) => {
      const body = LinkBody.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? "URL tidak valid" });
      const id = Number(request.params.id);
      const row = db.select().from(organizations).where(eq(organizations.id, id)).get();
      if (!row) return reply.code(404).send({ error: "Organisasi tidak ditemukan" });

      const updated = db
        .update(organizations)
        .set({ url: body.data.url, updatedByUserId: request.user!.id, updatedAt: sql`(CURRENT_TIMESTAMP)` })
        .where(eq(organizations.id, id))
        .returning()
        .get();
      audit(db, {
        actorType: "user",
        actorUserId: request.user!.id,
        action: "document.organization_link_updated",
        targetType: "organization",
        targetId: id,
        details: { title: row.name, kind: row.kind, before: row.url, after: body.data.url },
      });
      return { organization: toView(updated) };
    },
  );
}
