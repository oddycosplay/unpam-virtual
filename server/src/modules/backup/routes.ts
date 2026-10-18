import type { FastifyInstance } from "fastify";
import { createReadStream } from "node:fs";
import path from "node:path";
import type { AppContext } from "../../app";
import { audit } from "../../audit/log";
import { requirePermission } from "../../auth/auth";
import { BACKUP_NAME, createBackup, listBackups } from "../../backup/backup";

export function backupRoutes(app: FastifyInstance, { db, config }: AppContext): void {
  const guard = { preHandler: requirePermission("admin:config") };

  app.get("/api/admin/backups", guard, async () => ({
    backups: listBackups(config.BACKUP_DIR),
    keep: config.BACKUP_KEEP,
    intervalHours: config.BACKUP_INTERVAL_HOURS,
  }));

  app.post("/api/admin/backups", guard, async (request, reply) => {
    const backup = await createBackup(db, config.BACKUP_DIR, "manual", config.BACKUP_KEEP);
    audit(db, {
      actorType: "user",
      actorUserId: request.user!.id,
      action: "config.backup_created",
      details: { name: backup.name, sizeBytes: backup.sizeBytes },
    });
    return reply.code(201).send({ backup });
  });

  app.get<{ Params: { name: string } }>("/api/admin/backups/:name", guard, async (request, reply) => {
    const { name } = request.params;
    if (!BACKUP_NAME.test(name) || !listBackups(config.BACKUP_DIR).some((b) => b.name === name)) {
      return reply.code(404).send({ error: "Backup tidak ditemukan" });
    }
    // Berisi hash password dan API key terenkripsi: unduhan dicatat di audit.
    audit(db, { actorType: "user", actorUserId: request.user!.id, action: "config.backup_downloaded", details: { name } });
    return reply
      .header("content-type", "application/vnd.sqlite3")
      .header("content-disposition", `attachment; filename="${name}"`)
      .send(createReadStream(path.join(config.BACKUP_DIR, name)));
  });
}
