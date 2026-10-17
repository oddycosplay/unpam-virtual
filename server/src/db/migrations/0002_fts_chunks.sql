-- Indeks teks penuh untuk potongan dokumen (RAG kata kunci, PRD §8).
-- External-content FTS5: isi disimpan sekali di document_chunks, disinkronkan oleh trigger.
CREATE VIRTUAL TABLE `document_chunks_fts` USING fts5(
  `content`,
  `section`,
  content='document_chunks',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `document_chunks_ai` AFTER INSERT ON `document_chunks` BEGIN
  INSERT INTO document_chunks_fts(rowid, content, section) VALUES (new.id, new.content, new.section);
END;
--> statement-breakpoint
CREATE TRIGGER `document_chunks_ad` AFTER DELETE ON `document_chunks` BEGIN
  INSERT INTO document_chunks_fts(document_chunks_fts, rowid, content, section) VALUES ('delete', old.id, old.content, old.section);
END;
--> statement-breakpoint
CREATE TRIGGER `document_chunks_au` AFTER UPDATE ON `document_chunks` BEGIN
  INSERT INTO document_chunks_fts(document_chunks_fts, rowid, content, section) VALUES ('delete', old.id, old.content, old.section);
  INSERT INTO document_chunks_fts(rowid, content, section) VALUES (new.id, new.content, new.section);
END;
