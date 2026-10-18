import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { ChatMessageView, ChatReply } from "@unpam/shared";
import type { AppContext } from "../../app";
import { AKADEMIK_AGENT_ID, AgentError, answerAkademik } from "../../agents/akademik";
import { QUOTA_MESSAGE, hasQuota } from "../../agents/quota";
import { audit } from "../../audit/log";
import { requirePermission } from "../../auth/auth";
import { chatMessages } from "../../db/schema";

const AGENTS = new Set([AKADEMIK_AGENT_ID]);
const HISTORY_TURNS = 6;

const ChatBody = z.object({ message: z.string().trim().min(1, "Pesan kosong").max(2000, "Pesan maksimal 2000 karakter") });

const ESCALATION_TEXT =
  "Maaf, Agent Akademik sedang gagal menjawab setelah mencoba ulang. Kejadian ini sudah dicatat untuk ditindaklanjuti admin. Silakan coba lagi nanti.";

function toView(row: typeof chatMessages.$inferSelect): ChatMessageView {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    sources: row.sources ?? [],
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function chatRoutes(app: FastifyInstance, { db, config, llm, agents }: AppContext): void {
  const guard = { preHandler: requirePermission("agent:chat") };

  app.get<{ Params: { agentId: string } }>("/api/agents/:agentId/messages", guard, async (request, reply) => {
    const { agentId } = request.params;
    if (!AGENTS.has(agentId)) return reply.code(404).send({ error: "Agent tidak dikenal" });
    const rows = db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.userId, request.user!.id), eq(chatMessages.agentId, agentId)))
      .orderBy(desc(chatMessages.id))
      .limit(50)
      .all();
    return { messages: rows.reverse().map(toView) };
  });

  app.post<{ Params: { agentId: string } }>("/api/agents/:agentId/chat", guard, async (request, reply) => {
    const { agentId } = request.params;
    if (!AGENTS.has(agentId)) return reply.code(404).send({ error: "Agent tidak dikenal" });
    const body = ChatBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? "Pesan tidak valid" });

    const user = request.user!;
    const quota = hasQuota(db, config, user.id);
    if (!quota.ok) {
      audit(db, { actorType: "agent", actorAgent: agentId, actorUserId: user.id, action: "agent.quota_exceeded", details: { ...quota.usage } });
      return reply.code(429).send({ error: QUOTA_MESSAGE });
    }

    const history = db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.userId, user.id), eq(chatMessages.agentId, agentId), eq(chatMessages.status, "ok")))
      .orderBy(desc(chatMessages.id))
      .limit(HISTORY_TURNS)
      .all()
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));

    const userRow = db
      .insert(chatMessages)
      .values({ userId: user.id, agentId, role: "user", content: body.data.message })
      .returning()
      .get();

    const started = Date.now();
    agents.set("orkestrator", "completed", "Meneruskan pesan ke Agent Akademik");
    agents.set("akademik", "running", "Menjawab pertanyaan akademik");
    let replyRow: typeof chatMessages.$inferSelect;
    try {
      const answer = await answerAkademik({ db, provider: llm, question: body.data.message, history });
      agents.set("akademik", "completed", answer.usedLlm ? "Selesai menjawab" : "Tidak menemukan di dokumen");
      replyRow = db
        .insert(chatMessages)
        .values({ userId: user.id, agentId, role: "assistant", content: answer.text, sources: answer.sources })
        .returning()
        .get();
      audit(db, {
        actorType: "agent",
        actorAgent: agentId,
        actorUserId: user.id,
        action: "agent.answered",
        targetType: "chat_message",
        targetId: replyRow.id,
        details: {
          usedLlm: answer.usedLlm,
          attempts: answer.attempts,
          sourceDocumentIds: [...new Set(answer.sources.map((s) => s.documentId))],
          latencyMs: Date.now() - started,
          inputTokens: answer.usage.inputTokens,
          outputTokens: answer.usage.outputTokens,
        },
      });
    } catch (error) {
      const message = error instanceof AgentError ? error.message : (error as Error).message;
      agents.set("akademik", "error", "Gagal menjawab, dieskalasi ke admin");
      replyRow = db
        .insert(chatMessages)
        .values({ userId: user.id, agentId, role: "assistant", content: ESCALATION_TEXT, status: "error" })
        .returning()
        .get();
      audit(db, {
        actorType: "agent",
        actorAgent: agentId,
        actorUserId: user.id,
        action: "agent.error_escalated",
        targetType: "chat_message",
        targetId: userRow.id,
        details: { error: message, attempts: error instanceof AgentError ? error.attempts : 1, latencyMs: Date.now() - started },
      });
    }

    const result: ChatReply = { userMessage: toView(userRow), reply: toView(replyRow) };
    return result;
  });
}
