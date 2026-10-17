import bcrypt from "bcryptjs";
import { ROLE_INFO, ROLES, type Role } from "@unpam/shared";
import type { Db } from "./client";
import { roles, users } from "./schema";

/** Akun contoh, satu per peran. Data fiktif, bukan data mahasiswa asli. */
export const SEED_USERS: { email: string; name: string; role: Role }[] = [
  { email: "mahasiswa@unpam.test", name: "Rina Mahasiswa", role: "mahasiswa" },
  { email: "hima@unpam.test", name: "Bayu Pengurus HIMA", role: "hima" },
  { email: "dosen@unpam.test", name: "Dr. Sari Dosen", role: "dosen" },
  { email: "kaprodi@unpam.test", name: "Dr. Hendra Kaprodi", role: "kaprodi" },
  { email: "admin@unpam.test", name: "Admin Prodi", role: "admin" },
];

export function seed(db: Db, seedPassword: string): { createdUsers: number } {
  db.insert(roles)
    .values(ROLES.map((id) => ({ id, label: ROLE_INFO[id].label })))
    .onConflictDoNothing()
    .run();

  const existing = db.select({ id: users.id }).from(users).limit(1).all();
  if (existing.length > 0) return { createdUsers: 0 };

  const passwordHash = bcrypt.hashSync(seedPassword, 10);
  db.insert(users)
    .values(SEED_USERS.map((u) => ({ email: u.email, name: u.name, roleId: u.role, passwordHash })))
    .run();
  return { createdUsers: SEED_USERS.length };
}
