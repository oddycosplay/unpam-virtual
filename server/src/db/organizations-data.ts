import type { OrganizationKind, OrganizationLinkType } from "@unpam/shared";

export interface OrganizationSeed {
  kind: OrganizationKind;
  number: number;
  name: string;
  linkType: OrganizationLinkType;
}

// Daftar HIMA dan UKM Universitas Pamulang (urutan sesuai daftar resmi). URL diisi admin lewat aplikasi.
const HIMA: [string, OrganizationLinkType][] = [
  ["Administrasi Perkantoran D-3", "instagram"],
  ["Akuntansi Perpajakan D-4", "instagram"],
  ["Akuntansi S-1", "instagram"],
  ["Manajemen S-1", "instagram"],
  ["Ekonomi Syariah S-1", "instagram"],
  ["Manajemen Pendidikan Islam S-1", "kegiatan"],
  ["Ilmu Komunikasi S-1", "kegiatan"],
  ["Matematika S-1", "kegiatan"],
  ["Penjas S-1", "kegiatan"],
  ["PGSD S-1", "kegiatan"],
  ["PPKN S-1", "kegiatan"],
  ["PEKO S-1", "kegiatan"],
  ["Sastra Indonesia S-1", "kegiatan"],
  ["Sastra Inggris S-1", "kegiatan"],
  ["Sistem Informasi S-1", "kegiatan"],
  ["Teknik Elektro S-1", "kegiatan"],
  ["Teknik Industri S-1", "kegiatan"],
  ["Teknik Informatika S-1", "kegiatan"],
  ["Teknik Kimia S-1", "kegiatan"],
  ["Teknik Mesin S-1", "kegiatan"],
  ["Ilmu Hukum S-1", "kegiatan"],
];

const UKM = [
  "UKM Archa Buana",
  "UKM Disabilitas",
  "UKM Galeri Investasi",
  "UKM Menwa",
  "UKM Nuanza Bicara",
  "UKM Komunitas Peradilan Semu",
  "UKM PSM Gita Sasmita",
  "UKM Racana Putra",
  "UKM Racana Putri",
  "UKM Rumus",
  "UKM Scooter",
  "UKM Sepak Bola",
  "UKM Tax Center",
  "UKM Teater Patri",
  "UKM UKO",
  "UKM UPBC Basket",
  "UKM ASY-SYIFA",
  "UKM LINGKAR KREATIF",
];

export const ORGANIZATION_SEED: OrganizationSeed[] = [
  ...HIMA.map(([name, linkType], i) => ({ kind: "hima" as const, number: i + 1, name, linkType })),
  ...UKM.map((name, i) => ({ kind: "ukm" as const, number: i + 1, name, linkType: "kegiatan" as const })),
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
