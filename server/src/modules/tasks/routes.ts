import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { NotificationView, TaskView } from "@unpam/shared";
import type { AppContext } from "../../app";
import { requireAuth } from "../../auth/auth";
import { notifications, submissions, tasks, users } from "../../db/schema";
import { REVIEWABLE, isReviewer } from "../submissions/service";

export function taskRoutes(app: FastifyInstance, { db }: AppContext): void {
  app.get("/api/tasks", { preHandler: requireAuth }, async (request) => {
    const user = request.user!;
    // Admin memantau semua tugas; reviewer melihat yang sudah diajukan; lainnya hanya miliknya.
    const scope =
      user.role === "admin"
        ? undefined
        : isReviewer(user)
          ? or(eq(tasks.createdByUserId, user.id), inArray(submissions.status, REVIEWABLE))
          : eq(tasks.createdByUserId, user.id);
    const rows = db
      .select({ t: tasks, owner: users.name, submissionStatus: submissions.status })
      .from(tasks)
      .innerJoin(users, eq(users.id, tasks.createdByUserId))
      .leftJoin(submissions, eq(submissions.id, tasks.submissionId))
      .where(scope)
      .orderBy(desc(tasks.updatedAt), desc(tasks.id))
      .limit(200)
      .all();
    const result: TaskView[] = rows.map(({ t, owner, submissionStatus }) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      agentId: t.agentId,
      owner,
      submissionId: t.submissionId,
      submissionStatus: submissionStatus ?? null,
      updatedAt: t.updatedAt,
    }));
    return { tasks: result };
  });

  app.get("/api/notifications", { preHandler: requireAuth }, async (request) => {
    const userId = request.user!.id;
    const rows = db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.id))
      .limit(30)
      .all();
    const unread = db.get<{ n: number }>(
      sql`SELECT count(*) AS n FROM notifications WHERE user_id = ${userId} AND read_at IS NULL`,
    )!.n;
    const items: NotificationView[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      link: r.link,
      read: r.readAt !== null,
      createdAt: r.createdAt,
    }));
    return { notifications: items, unread };
  });

  app.post<{ Params: { id: string } }>("/api/notifications/:id/read", { preHandler: requireAuth }, async (request) => {
    db.update(notifications)
      .set({ readAt: sql`(CURRENT_TIMESTAMP)` })
      .where(and(eq(notifications.id, Number(request.params.id)), eq(notifications.userId, request.user!.id)))
      .run();
    return { ok: true };
  });

  app.post("/api/notifications/read-all", { preHandler: requireAuth }, async (request) => {
    db.update(notifications)
      .set({ readAt: sql`(CURRENT_TIMESTAMP)` })
      .where(and(eq(notifications.userId, request.user!.id), isNull(notifications.readAt)))
      .run();
    return { ok: true };
  });
}
