import Fastify from "fastify";
import cookie from "@fastify/cookie";
import type { AppConfig } from "./config/env";
import type { Db } from "./db/client";
import { registerAuth } from "./auth/auth";
import { authRoutes } from "./modules/auth/routes";
import { userRoutes } from "./modules/users/routes";
import { adminRoutes } from "./modules/admin/routes";

export interface AppContext {
  db: Db;
  config: AppConfig;
}

export async function buildApp(ctx: AppContext, opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(cookie);
  registerAuth(app, ctx.db, ctx.config.JWT_SECRET);

  app.get("/api/health", async () => ({ ok: true }));
  authRoutes(app, ctx);
  userRoutes(app, ctx);
  adminRoutes(app, ctx);

  return app;
}
