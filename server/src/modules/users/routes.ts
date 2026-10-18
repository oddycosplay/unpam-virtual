import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { ROLES, type AdminUserView, type AppSettingsView } from "@unpam/shared";
import type { AppContext } from "../../app";
import { SETTING_DAILY_TOKEN_LIMIT, globalDailyLimit, setSetting, tokensUsedToday, usageFor } from "../../agents/quota";
import { audit } from "../../audit/log";
import { requireAuth, requirePermission, toPublicUser } from "../../auth/auth";
import { generateTempPassword } from "../../auth/security";
import { users } from "../../db/schema";

const CreateBody = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  role: z.enum(ROLES),
});

const PatchBody = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
    dailyTokenLimit: z.number().int().positive().max(100_000_000).nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "Tidak ada perubahan" });

const SettingsBody = z.object({ dailyTokenLimit: z.number().int().positive().max(100_000_000) });

export function userRoutes(app: FastifyInstance, { db, config }: AppContext): void {
  const guard = { preHandler: requirePermission("admin:users") };

  function adminView(row: typeof users.$inferSelect, tokens = tokensUsedToday(db, row.id)): AdminUserView {
    return {
      ...toPublicUser(row),
      isActive: row.isActive,
      mustChangePassword: row.mustChangePassword,
      dailyTokenLimit: row.dailyTokenLimit,
      usage: usageFor(db, config, row.id, tokens),
      createdAt: row.createdAt,
    };
  }

  /** Jumlah admin aktif selain pengguna `exceptId`, agar admin terakhir tidak bisa dihapus aksesnya. */
  function otherActiveAdmins(exceptId: number): number {
    return db
      .select({ n: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.roleId, "admin"), eq(users.isActive, true), ne(users.id, exceptId)))
      .get()!.n;
  }

  // Daftar ringkas (dipakai sejak tahap 1).
  app.get("/api/users", guard, async () => ({ users: db.select().from(users).all().map(toPublicUser) }));

  app.get("/api/admin/users", guard, async () => {
    const usage = tokensUsedToday(db);
    const rows = db.select().from(users).orderBy(asc(users.roleId), asc(users.name)).all();
    return { users: rows.map((r) => adminView(r, usage.get(r.id) ?? { input: 0, output: 0 })) };
  });

  app.post("/api/admin/users", guard, async (request, reply) => {
    const body = CreateBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? "Data tidak valid" });
    if (db.select({ id: users.id }).from(users).where(eq(users.email, body.data.email)).get()) {
      return reply.code(409).send({ error: "Email sudah dipakai akun lain" });
    }
    const tempPassword = generateTempPassword();
    const row = db
      .insert(users)
      .values({
        email: body.data.email,
        name: body.data.name,
        roleId: body.data.role,
        passwordHash: await bcrypt.hash(tempPassword, config.BCRYPT_ROUNDS),
        mustChangePassword: true,
      })
      .returning()
      .get();
    audit(db, {
      actorType: "user",
      actorUserId: request.user!.id,
      action: "user.created",
      targetType: "user",
      targetId: row.id,
      details: { email: row.email, name: row.name, role: row.roleId },
    });
    // Password sementara hanya dikirim sekali di respons ini dan tidak dicatat di audit.
    return reply.code(201).send({ user: adminView(row), tempPassword });
  });

  app.patch<{ Params: { id: string } }>("/api/admin/users/:id", guard, async (request, reply) => {
    const body = PatchBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? "Data tidak valid" });
    const id = Number(request.params.id);
    const row = db.select().from(users).where(eq(users.id, id)).get();
    if (!row) return reply.code(404).send({ error: "Akun tidak ditemukan" });

    const { name, role, isActive, dailyTokenLimit } = body.data;
    const self = id === request.user!.id;
    const losesAdmin = row.roleId === "admin" && ((role !== undefined && role !== "admin") || isActive === false);
    if (self && losesAdmin) return reply.code(409).send({ error: "Anda tidak bisa menonaktifkan atau menurunkan peran akun sendiri" });
    if (losesAdmin && otherActiveAdmins(id) === 0) return reply.code(409).send({ error: "Harus ada minimal satu admin aktif" });

    // Peran atau status berubah → sesi lama pengguna itu dibatalkan.
    const invalidates = (role !== undefined && role !== row.roleId) || (isActive !== undefined && isActive !== row.isActive);
    const updated = db
      .update(users)
      .set({
        ...(name !== undefined && { name }),
        ...(role !== undefined && { roleId: role }),
        ...(isActive !== undefined && { isActive }),
        ...(dailyTokenLimit !== undefined && { dailyTokenLimit }),
        ...(invalidates && { tokenVersion: sql`${users.tokenVersion} + 1` }),
      })
      .where(eq(users.id, id))
      .returning()
      .get();

    audit(db, {
      actorType: "user",
      actorUserId: request.user!.id,
      action: "user.updated",
      targetType: "user",
      targetId: id,
      details: {
        email: row.email,
        changes: Object.fromEntries(
          Object.entries({ name, role, isActive, dailyTokenLimit }).filter(([, v]) => v !== undefined),
        ),
        before: { name: row.name, role: row.roleId, isActive: row.isActive, dailyTokenLimit: row.dailyTokenLimit },
      },
    });
    return { user: adminView(updated) };
  });

  app.post<{ Params: { id: string } }>("/api/admin/users/:id/reset-password", guard, async (request, reply) => {
    const id = Number(request.params.id);
    const row = db.select().from(users).where(eq(users.id, id)).get();
    if (!row) return reply.code(404).send({ error: "Akun tidak ditemukan" });
    const tempPassword = generateTempPassword();
    const updated = db
      .update(users)
      .set({
        passwordHash: await bcrypt.hash(tempPassword, config.BCRYPT_ROUNDS),
        mustChangePassword: true,
        tokenVersion: sql`${users.tokenVersion} + 1`,
      })
      .where(eq(users.id, id))
      .returning()
      .get();
    audit(db, { actorType: "user", actorUserId: request.user!.id, action: "user.password_reset", targetType: "user", targetId: id, details: { email: row.email } });
    return { user: adminView(updated), tempPassword };
  });

  app.get("/api/admin/settings", guard, async () => {
    const g = globalDailyLimit(db, config);
    const view: AppSettingsView = { dailyTokenLimit: g.limit, dailyTokenLimitSource: g.source };
    return { settings: view };
  });

  app.put("/api/admin/settings", guard, async (request, reply) => {
    const body = SettingsBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Batas token harus angka bulat positif" });
    const before = globalDailyLimit(db, config).limit;
    setSetting(db, SETTING_DAILY_TOKEN_LIMIT, String(body.data.dailyTokenLimit), request.user!.id);
    audit(db, {
      actorType: "user",
      actorUserId: request.user!.id,
      action: "config.quota_updated",
      details: { dailyTokenLimit: body.data.dailyTokenLimit, before },
    });
    const view: AppSettingsView = { dailyTokenLimit: body.data.dailyTokenLimit, dailyTokenLimitSource: "setting" };
    return { settings: view };
  });

  // Pemakaian AI milik pengguna sendiri (halaman Akun).
  app.get("/api/me/usage", { preHandler: requireAuth }, async (request) => ({ usage: usageFor(db, config, request.user!.id) }));
}
