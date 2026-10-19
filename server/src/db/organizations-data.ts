import { PRODI_LIST, UKM_LIST, type OrganizationKind, type OrganizationLinkType } from "@unpam/shared";

export interface OrganizationSeed {
  kind: OrganizationKind;
  number: number;
  name: string;
  linkType: OrganizationLinkType;
}

// Daftar HIMA dan UKM Universitas Pamulang (urutan sesuai daftar resmi) dari data kampus bersama.
// URL diisi admin lewat aplikasi.
export const ORGANIZATION_SEED: OrganizationSeed[] = [
  ...PRODI_LIST.map((p) => ({ kind: "hima" as const, number: p.number, name: p.name, linkType: p.himaLink })),
  ...UKM_LIST.map((name, i) => ({ kind: "ukm" as const, number: i + 1, name, linkType: "kegiatan" as const })),
];

export const ORGANIZATION_DOC = {
  title: "Daftar Organisasi Mahasiswa UNPAM (HIMA dan UKM)",
  fileName: "organisasi-mahasiswa.md",
};

/** Dokumen pengetahuan untuk Agent Akademik, dibangun dari data yang sama dengan halaman Organisasi. */
export function organizationMarkdown(rows: OrganizationSeed[] = ORGANIZATION_SEED): string {
  const hima = rows.filter((r) => r.kind === "hima");
  const ukm = rows.filter((r) => r.kind === "ukm");
  return [
    `# ${ORGANIZATION_DOC.title}`,
    "",
    `Universitas Pamulang memiliki ${hima.length} Himpunan Mahasiswa (HIMA) tingkat program studi dan ${ukm.length} Unit Kegiatan Mahasiswa (UKM). Tautan Instagram dan bukti kegiatan setiap organisasi dapat dilihat di menu Organisasi Mahasiswa pada aplikasi Unpam Virtual.`,
    "",
    "## Himpunan Mahasiswa (HIMA)",
    "",
    "HIMA adalah organisasi mahasiswa di tingkat program studi.",
    "",
    ...hima.map((r) => `${r.number}. HIMA ${r.name}`),
    "",
    "## HIMA Sistem Informasi",
    "",
    "HIMA Sistem Informasi S-1 adalah himpunan mahasiswa Program Studi Sistem Informasi. Proposal kegiatan HIMA SI disusun bersama Agent HIMA di Unpam Virtual dan diajukan ke Kaprodi untuk persetujuan.",
    "",
    "## Unit Kegiatan Mahasiswa (UKM)",
    "",
    "UKM adalah organisasi minat dan bakat tingkat universitas yang terbuka untuk mahasiswa semua program studi.",
    "",
    ...ukm.map((r) => `${r.number}. ${r.name}`),
    "",
  ].join("\n");
}
