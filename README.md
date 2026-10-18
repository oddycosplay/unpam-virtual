[![CI](https://github.com/oddycosplay/unpam-virtual/actions/workflows/ci.yml/badge.svg)](https://github.com/oddycosplay/unpam-virtual/actions)
[![Release](https://img.shields.io/badge/release-v0.1.0-blue.svg)](https://github.com/oddycosplay/unpam-virtual/releases)
[![License](https://img.shields.io/badge/license-UNSPECIFIED-lightgrey.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/oddycosplay/unpam-virtual?style=social)](https://github.com/oddycosplay/unpam-virtual/stargazers)

# Unpam Virtual

Kampus virtual 3D untuk Program Studi Sistem Informasi Universitas Pamulang (UNPAM) dengan integrasi agent AI, workflow akademik, dan simulasi ruang kampus multi-user.

Versi saat ini: v0.1.0 — lihat juga CHANGELOG.md untuk catatan rilis.

## Ringkasan singkat

Unpam Virtual adalah platform web yang menggabungkan kampus 3D interaktif, agen AI untuk layanan akademik, dan alat administrasi (proposal, persetujuan, log audit). Dirancang sebagai MVP untuk simulasikan lingkungan kampus modern berbasis web dan mudah dijalankan secara lokal untuk pengembangan.

---

## Mengapa proyek ini penting

- Memfasilitasi prototyping pengalaman kampus virtual (pengajaran, open day, simulasi proses administrasi).
- Menyediakan integrasi AI berbasis dokumen untuk mendukung layanan akademik.
- Menjadi basis untuk eksperimen real-time multiplayer yang ringan.

---

## Fitur utama

- Kampus 3D interaktif dan multi-user (Socket.IO)
- Agent AI Akademik dengan RAG terhadap dokumen (SQLite FTS5)
- Proximity chat dan avatar per peran
- Workflow proposal HIMA → persetujuan Kaprodi
- Log audit terperinci
- Kelola akun dan peran, batas pemakaian AI harian per pengguna
- Backup database otomatis dan manual
- Pengamanan dasar: batas percobaan login, sesi yang batal saat password/peran berubah, cek Origin (CSRF), cookie Secure via HTTPS

---

## Quick start (pengembang)

Prasyarat:
- Node.js 20+
- npm

Jalankan:

```bash
npm install
npm run dev
```

Buka http://localhost:5173

Catatan: Pada Windows, `better-sqlite3` perlu alat build (Visual Studio Build Tools + Python).

---

## Struktur repository

```
.
├── client/              # aplikasi frontend (React + Vite)
├── packages/
│   └── shared/          # tipe & konstanta bersama
├── server/              # backend Fastify + SQLite + AI layer
├── scripts/
├── .env.example
├── README.md
├── CHANGELOG.md
└── tsconfig.base.json
```

---

## Akun demo

Semua akun demo memakai password dari variabel `SEED_PASSWORD` (default: `unpam123`).

| Email | Peran |
| --- | --- |
| mahasiswa@unpam.test | Mahasiswa |
| hima@unpam.test | Pengurus HIMA |
| dosen@unpam.test | Dosen |
| kaprodi@unpam.test | Kaprodi |
| admin@unpam.test | Admin |

---

## Konfigurasi Provider AI

Pengaturan melalui panel admin atau variabel `LLM_*` di `.env`. API key disimpan terenkripsi di database.

- Default: Anthropic
- Dukungan endpoint OpenAI-compatible (OpenRouter, Ollama)

---

## Administrasi

- **Kelola Akun** (menu Admin): buat akun dengan password sementara (tampil sekali), ubah peran, aktif/nonaktif, reset password, dan batas token AI khusus. Pengguna mengganti password di halaman **Akun**.
- **Batas pemakaian AI**: token input + output per pengguna per hari. Urutan: batas khusus pengguna → pengaturan di panel → `DAILY_TOKEN_LIMIT` di `.env` (default 100.000).
- **Backup** (menu Admin): SQLite online backup tiap `BACKUP_INTERVAL_HOURS` (default 24 jam), `BACKUP_KEEP` terakhir disimpan di `data/backups/`, bisa juga manual dan diunduh. Langkah pemulihan ada di halaman Backup.
- **Log Audit** (menu Admin): siapa meminta, apa yang dilakukan, dan siapa yang menyetujui; bisa disaring dan diekspor ke CSV.

---

## Pengujian

```bash
npm test                                   # tes server (vitest)
npm run typecheck                          # cek tipe server + client
npm run load-test -- --bots 30 --seconds 60   # uji beban kampus (server harus berjalan)
```

Hasil uji beban di laptop pengembangan: 31 pemain bersamaan (30 bot + 1 browser) dengan latensi gerak p95 120 ms, jeda snapshot p95 118 ms, tanpa error. FPS browser tampil di bilah status Kampus 3D.

---

## Contributing

1. Fork dan buat branch untuk fitur/bugfix: `git checkout -b feat/penjelasan-singkat`
2. Tulis kode, tambahkan test jika perlu
3. Buka pull request ke branch `main`

Lihat juga `PRD Unpam Virtual (MVP).md` untuk spesifikasi fitur.

---

## Rilis & Changelog

Release notes utama tersedia di `CHANGELOG.md`. Untuk membuat release GitHub formal, lihat `.github/release-draft.md` (draft yang bisa dipakai untuk membuat release di web).

---

## Lisensi

Belum ditentukan. Jika Anda berencana membuka proyek ini ke publik, tambahkan file LICENSE.
