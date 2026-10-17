import Fastify from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import type { AppConfig } from "./config/env";
import type { Db } from "./db/client";
import { registerAuth } from "./auth/auth";
import { getLlmProvider } from "./llm/factory";
import type { LlmProvider } from "./llm/types";
import { authRoutes } from "./modules/auth/routes";
import { userRoutes } from "./modules/users/routes";
import { adminRoutes } from "./modules/admin/routes";
import { chatRoutes } from "./modules/chat/routes";
import { documentRoutes } from "./modules/documents/routes";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface AppContext {
  db: Db;
  config: AppConfig;
  /** Provider LLM aktif. Dibaca ulang tiap panggilan agar perubahan di panel admin langsung berlaku. */
  llm: () => LlmProvider;
}

export async function buildApp(
  base: { db: Db; config: AppConfig; llm?: () => LlmProvider },
  opts: { logger?: boolean } = {},
) {
  const ctx: AppContext = { ...base, llm: base.llm ?? (() => getLlmProvider(base.db, base.config)) };
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  registerAuth(app, ctx.db, ctx.config.JWT_SECRET);

  app.get("/api/health", async () => ({ ok: true }));
  authRoutes(app, ctx);
  userRoutes(app, ctx);
  adminRoutes(app, ctx);
  chatRoutes(app, ctx);
  documentRoutes(app, ctx);

  return app;
}
