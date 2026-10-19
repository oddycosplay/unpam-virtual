import type { OrganizationLinkType } from "./api-types";

// Data kampus Universitas Pamulang yang dipakai bersama oleh server (seed HIMA/UKM) dan client (konsep 3D).

export interface Faculty {
  id: string;
  name: string;
  short: string;
  /** Warna aksen gedung fakultas di denah. */
  accent: string;
}

/**
 * Pengelompokan prodi ke fakultas untuk denah konsep.
 * Ini pengelompokan umum dan belum diverifikasi dengan data resmi kampus; koreksi bila ada yang salah.
 */
export const FACULTIES: Faculty[] = [
  { id: "feb", name: "Fakultas Ekonomi dan Bisnis", short: "FEB", accent: "#f5c400" },
  { id: "fai", name: "Fakultas Agama Islam", short: "FAI", accent: "#5ee08a" },
  { id: "fisip", name: "Fakultas Ilmu Sosial dan Ilmu Politik", short: "FISIP", accent: "#ff8c42" },
  { id: "fkip", name: "Fakultas Keguruan dan Ilmu Pendidikan", short: "FKIP", accent: "#58a6ff" },
  { id: "sastra", name: "Fakultas Sastra", short: "Sastra", accent: "#b48cff" },
  { id: "fasilkom", name: "Fakultas Ilmu Komputer", short: "Fasilkom", accent: "#2ee6d6" },
  { id: "ft", name: "Fakultas Teknik", short: "FT", accent: "#c8102e" },
  { id: "fh", name: "Fakultas Hukum", short: "FH", accent: "#e6edf2" },
];

export interface Prodi {
  /** Nomor sesuai daftar HIMA resmi. */
  number: number;
  name: string;
  facultyId: string;
  /** Jenis tautan HIMA pada daftar resmi. */
  himaLink: OrganizationLinkType;
}

export const PRODI_LIST: Prodi[] = [
  { number: 1, name: "Administrasi Perkantoran D-3", facultyId: "feb", himaLink: "instagram" },
  { number: 2, name: "Akuntansi Perpajakan D-4", facultyId: "feb", himaLink: "instagram" },
  { number: 3, name: "Akuntansi S-1", facultyId: "feb", himaLink: "instagram" },
  { number: 4, name: "Manajemen S-1", facultyId: "feb", himaLink: "instagram" },
  { number: 5, name: "Ekonomi Syariah S-1", facultyId: "fai", himaLink: "instagram" },
  { number: 6, name: "Manajemen Pendidikan Islam S-1", facultyId: "fai", himaLink: "kegiatan" },
  { number: 7, name: "Ilmu Komunikasi S-1", facultyId: "fisip", himaLink: "kegiatan" },
  { number: 8, name: "Matematika S-1", facultyId: "fkip", himaLink: "kegiatan" },
  { number: 9, name: "Penjas S-1", facultyId: "fkip", himaLink: "kegiatan" },
  { number: 10, name: "PGSD S-1", facultyId: "fkip", himaLink: "kegiatan" },
  { number: 11, name: "PPKN S-1", facultyId: "fkip", himaLink: "kegiatan" },
  { number: 12, name: "PEKO S-1", facultyId: "fkip", himaLink: "kegiatan" },
  { number: 13, name: "Sastra Indonesia S-1", facultyId: "sastra", himaLink: "kegiatan" },
  { number: 14, name: "Sastra Inggris S-1", facultyId: "sastra", himaLink: "kegiatan" },
  { number: 15, name: "Sistem Informasi S-1", facultyId: "fasilkom", himaLink: "kegiatan" },
  { number: 16, name: "Teknik Elektro S-1", facultyId: "ft", himaLink: "kegiatan" },
  { number: 17, name: "Teknik Industri S-1", facultyId: "ft", himaLink: "kegiatan" },
  { number: 18, name: "Teknik Informatika S-1", facultyId: "fasilkom", himaLink: "kegiatan" },
  { number: 19, name: "Teknik Kimia S-1", facultyId: "ft", himaLink: "kegiatan" },
  { number: 20, name: "Teknik Mesin S-1", facultyId: "ft", himaLink: "kegiatan" },
  { number: 21, name: "Ilmu Hukum S-1", facultyId: "fh", himaLink: "kegiatan" },
];

export const UKM_LIST: string[] = [
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

/** Unit tingkat universitas di plaza tengah. */
export const UNIVERSITY_UNITS = [
  { id: "rektorat", name: "Gedung Rektorat", rooms: ["Ruang Rektor", "Ruang Wakil Rektor", "Ruang Rapat Pimpinan"] },
  { id: "lka", name: "LKA", fullName: "Lembaga Kemahasiswaan & Alumni", rooms: ["Layanan Kemahasiswaan", "Pusat Karier & Alumni"] },
  { id: "lsp", name: "LSP", fullName: "Lembaga Sertifikasi Profesi", rooms: ["Ruang Uji Kompetensi", "Sekretariat LSP"] },
] as const;
