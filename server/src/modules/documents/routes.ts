import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import type { KnowledgeDocumentView } from "@unpam/shared";
import type { AppContext } from "../../app";
import { audit } from "../../audit/log";
import { requirePermission } from "../../auth/auth";
import { knowledgeDocuments } from "../../db/schema";
import { ingestDocument, mimeTypeFor } from "../../rag/ingest";

const SCOPES = new Set(["akademik", "hima"]);

function toView(row: typeof knowledgeDocuments.$inferSelect): KnowledgeDocumentView {
  return {
    id: row.id,
    title: row.title,
    fileName: row.fileName,
    mimeType: row.mimeType,
    agentScope: row.agentScope,
    chunkCount: row.chunkCount,
    createdAt: row.createdAt,
  };
}

export function documentRoutes(app: FastifyInstance, { db }: AppContext): void {
  const guard = { preHandler: requirePermission("admin:documents") };

  app.get("/api/admin/documents", guard, async () => ({
    documents: db.select().from(knowledgeDocuments).orderBy(desc(knowledgeDocuments.id)).all().map(toView),
  }));

  app.post("/api/admin/documents", guard, async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "Pilih file terlebih dahulu" });

    const mimeType = mimeTypeFor(file.filename);
    if (!mimeType) return reply.code(400).send({ error: "Format didukung: .pdf, .md, .txt" });

    const field = (name: string) => {
      const f = file.fields[name];
      return f && !Array.isArray(f) && f.type === "field" ? String(f.value).trim() : "";
    };
    const title = field("title") || file.filename.replace(/\.[^.]+$/, "");
    const agentScope = field("agentScope") || "akademik";
    if (!SCOPES.has(agentScope)) return reply.code(400).send({ error: "Agent tujuan tidak dikenal" });

    const buffer = await file.toBuffer();
    if (file.file.truncated) return reply.code(413).send({ error: "File maksimal 10 MB" });

    let doc;
    try {
      doc = await ingestDocument(db, {
        title,
        fileName: file.filename,
        mimeType,
        buffer,
        agentScope,
        uploadedByUserId: request.user!.id,
      });
    } catch (error) {
      return reply.code(422).send({ error: `Gagal membaca dokumen: ${(error as Error).message}` });
    }

    audit(db, {
      actorType: "user",
      actorUserId: request.user!.id,
      action: "document.uploaded",
      targetType: "knowledge_document",
      targetId: doc.id,
      details: { title, fileName: file.filename, agentScope, chunkCount: doc.chunkCount },
    });
    return { document: toView(doc) };
  });

  app.delete<{ Params: { id: string } }>("/api/admin/documents/:id", guard, async (request, reply) => {
    const id = Number(request.params.id);
    const doc = db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, id)).get();
    if (!doc) return reply.code(404).send({ error: "Dokumen tidak ditemukan" });
    db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, id)).run();
    audit(db, {
      actorType: "user",
      actorUserId: request.user!.id,
      action: "document.deleted",
      targetType: "knowledge_document",
      targetId: id,
      details: { title: doc.title, fileName: doc.fileName },
    });
    return { ok: true };
  });
}
