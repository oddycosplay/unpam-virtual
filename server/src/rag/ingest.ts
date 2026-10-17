import { extractText, getDocumentProxy } from "unpdf";
import type { Db } from "../db/client";
import { documentChunks, knowledgeDocuments } from "../db/schema";

export const SUPPORTED_EXTENSIONS = [".pdf", ".md", ".txt"] as const;
const MAX_CHUNK_CHARS = 900;

export interface TextBlock {
  page: number | null;
  text: string;
}

export interface Chunk {
  section: string | null;
  page: number | null;
  content: string;
}

export function mimeTypeFor(fileName: string): string | null {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".md") return "text/markdown";
  if (ext === ".txt") return "text/plain";
  return null;
}

export async function extractBlocks(buffer: Buffer, mimeType: string): Promise<TextBlock[]> {
  if (mimeType === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: false });
    return text.map((t, i) => ({ page: i + 1, text: t }));
  }
  return [{ page: null, text: buffer.toString("utf8").replace(/^﻿/, "") }];
}

/** Pecah teks per paragraf, maksimal ~900 karakter per potongan, dengan judul bagian (heading markdown) terdekat. */
export function chunkBlocks(blocks: TextBlock[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const block of blocks) {
    let section: string | null = block.page ? `Halaman ${block.page}` : null;
    let buffer: string[] = [];

    const flush = () => {
      const content = buffer.join("\n\n").trim();
      if (content) chunks.push({ section, page: block.page, content });
      buffer = [];
    };

    const paragraphs = block.text.replace(/\r\n/g, "\n").split(/\n\s*\n/);
    for (const raw of paragraphs) {
      const para = raw.trim();
      if (!para) continue;

      const heading = para.match(/^#{1,6}\s+(.+)$/m);
      if (heading && para.startsWith("#")) {
        flush();
        section = heading[1]!.trim();
        const rest = para.replace(/^#{1,6}\s+.+$/m, "").trim();
        if (rest) buffer.push(rest);
        continue;
      }

      for (const piece of splitLong(para)) {
        const size = buffer.reduce((n, p) => n + p.length + 2, 0);
        if (size + piece.length > MAX_CHUNK_CHARS) flush();
        buffer.push(piece);
      }
    }
    flush();
  }
  return chunks;
}

function splitLong(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const sentences = text.match(/[^.!?\n]+[.!?]?\s*/g) ?? [text];
  const out: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (current && current.length + s.length > MAX_CHUNK_CHARS) {
      out.push(current.trim());
      current = "";
    }
    current += s;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

export interface IngestInput {
  title: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  agentScope: string;
  uploadedByUserId: number | null;
}

export async function ingestDocument(db: Db, input: IngestInput) {
  const chunks = chunkBlocks(await extractBlocks(input.buffer, input.mimeType));
  if (chunks.length === 0) throw new Error("Dokumen tidak berisi teks yang bisa dibaca");

  return db.transaction((tx) => {
    const doc = tx
      .insert(knowledgeDocuments)
      .values({
        title: input.title,
        fileName: input.fileName,
        mimeType: input.mimeType,
        agentScope: input.agentScope,
        chunkCount: chunks.length,
        uploadedByUserId: input.uploadedByUserId,
      })
      .returning()
      .get();
    tx.insert(documentChunks)
      .values(chunks.map((c, i) => ({ documentId: doc.id, ordinal: i, ...c })))
      .run();
    return doc;
  });
}
