import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../app";
import { requirePermission, toPublicUser } from "../../auth/auth";
import { users } from "../../db/schema";

export function userRoutes(app: FastifyInstance, { db }: AppContext): void {
  app.get("/api/users", { preHandler: requirePermission("admin:users") }, async () => ({
    users: db.select().from(users).all().map(toPublicUser),
  }));
}
