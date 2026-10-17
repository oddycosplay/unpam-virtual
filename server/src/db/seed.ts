import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { ROLE_INFO, ROLES, type Role } from "@unpam/shared";
import { ingestDocument } from "../rag/ingest";
import type { Db } from "./client";
import { knowledgeDocuments, roles, users } from "./schema";

/** Akun contoh, satu per peran. Data fiktif, bukan data mahasiswa asli. */
export const SEED_USERS: { email: string; name: string; role: Role }[] = [
  { email: "mahasiswa@unpam.test", name: "Rina Mahasiswa", role: "mahasiswa" },
  { email: "hima@unpam.test", name: "Bayu Pengurus HIMA", role: "hima" },
  { email: "dosen@unpam.test", name: "Dr. Sari Dosen", role: "dosen" },
  { email: "kaprodi@unpam.test", name: "Dr. Hendra Kaprodi", role: "kaprodi" },
  { email: "admin@unpam.test", name: "Admin Prodi", role: "admin" },
];

const SEED_DOCS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../seed-docs");

/** Dokumen contoh fiktif agar agent bisa langsung dicoba. */
export const SEED_DOCUMENTS = [
  { title: "Panduan Akademik Prodi SI (CONTOH)", fileName: "panduan-akademik-contoh.md", agentScope: "akademik" },
  { title: "SOP Proposal Kegiatan HIMA (CONTOH)", fileName: "sop-proposal-hima-contoh.md", agentScope: "hima" },
];

export async function seed(db: Db, seedPassword: string): Promise<{ createdUsers: number; createdDocuments: number }> {
  db.insert(roles)
    .values(ROLES.map((id) => ({ id, label: ROLE_INFO[id].label })))
    .onConflictDoNothing()
    .run();

  let createdUsers = 0;
  if (db.select({ id: users.id }).from(users).limit(1).all().length === 0) {
    const passwordHash = bcrypt.hashSync(seedPassword, 10);
    db.insert(users)
      .values(SEED_USERS.map((u) => ({ email: u.email, name: u.name, roleId: u.role, passwordHash })))
      .run();
    createdUsers = SEED_USERS.length;
  }

  let createdDocuments = 0;
  if (db.select({ id: knowledgeDocuments.id }).from(knowledgeDocuments).limit(1).all().length === 0) {
    for (const doc of SEED_DOCUMENTS) {
      await ingestDocument(db, {
        ...doc,
        mimeType: "text/markdown",
        buffer: readFileSync(path.join(SEED_DOCS_DIR, doc.fileName)),
        uploadedByUserId: null,
      });
      createdDocuments++;
    }
  }
  return { createdUsers, createdDocuments };
}
