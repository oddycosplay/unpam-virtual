import { sql } from "drizzle-orm";
import type { Db } from "../db/client";

// Kata umum bahasa Indonesia yang tidak membantu pencarian.
const STOPWORDS = new Set(
  (
    "yang dan di ke dari untuk apa apakah bagaimana gimana berapa kapan siapa mana dimana adalah itu ini " +
    "dengan saya aku kami kita kamu anda bisa boleh ada tidak atau jika kalau pada dalam oleh akan sudah " +
    "belum juga saja tolong mohon caranya cara nya dong ya kah tentang mau ingin harus perlu bila agar " +
    "sebagai seperti lagi masih hal the a an of to is"
  ).split(" "),
);

export interface SearchHit {
  chunkId: number;
  documentId: number;
  documentTitle: string;
  section: string | null;
  page: number | null;
  content: string;
  score: number;
}

export function searchTerms(query: string): string[] {
  const words = query
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu);
  return [...new Set((words ?? []).filter((w) => w.length >= 2 && !STOPWORDS.has(w)))];
}

/** Cari potongan dokumen paling relevan dengan BM25 (FTS5). Kata ≥4 huruf dicari sebagai awalan, mis. "jadwal*". */
export function searchChunks(db: Db, query: string, opts: { agentScope: string; limit?: number }): SearchHit[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];
  const match = terms.map((t) => (t.length >= 4 ? `"${t}"*` : `"${t}"`)).join(" OR ");

  return db.all<SearchHit>(sql`
    SELECT c.id AS chunkId, c.document_id AS documentId, d.title AS documentTitle,
           c.section AS section, c.page AS page, c.content AS content,
           bm25(document_chunks_fts) AS score
    FROM document_chunks_fts
    JOIN document_chunks c ON c.id = document_chunks_fts.rowid
    JOIN knowledge_documents d ON d.id = c.document_id
    WHERE document_chunks_fts MATCH ${match} AND d.agent_scope = ${opts.agentScope}
    ORDER BY score
    LIMIT ${opts.limit ?? 5}
  `);
}
