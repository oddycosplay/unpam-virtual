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
