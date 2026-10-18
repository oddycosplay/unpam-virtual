export const ROLES = ["mahasiswa", "hima", "dosen", "kaprodi", "admin"] as const;
export type Role = (typeof ROLES)[number];

export interface RoleInfo {
  label: string;
  /** Warna avatar/badge sesuai PRD §3. Lebih dari satu warna = kombinasi. */
  colors: string[];
}

export const ROLE_INFO: Record<Role, RoleInfo> = {
  mahasiswa: { label: "Mahasiswa", colors: ["#1E5BB8"] },
  hima: { label: "Pengurus HIMA", colors: ["#C8102E", "#1E5BB8", "#FFFFFF"] },
  dosen: { label: "Dosen", colors: ["#1E5BB8", "#FFFFFF"] },
  kaprodi: { label: "Kaprodi", colors: ["#1E5BB8", "#FFFFFF", "#F5C400"] },
  admin: { label: "Admin", colors: ["#6B7280"] },
};

export const PERMISSIONS = [
  "agent:chat",
  "request:create",
  "proposal:create",
  "announcement:manage",
  "submission:comment",
  "submission:decide",
  "admin:users",
  "admin:config",
  "admin:documents",
  "audit:view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  mahasiswa: ["agent:chat", "request:create"],
  hima: ["agent:chat", "request:create", "proposal:create", "announcement:manage"],
  dosen: ["agent:chat", "submission:comment"],
  kaprodi: ["agent:chat", "submission:comment", "submission:decide"],
  admin: ["admin:users", "admin:config", "admin:documents", "audit:view"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
