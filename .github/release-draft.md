# Draft Release — v0.1.0

Repository: oddycosplay/unpam-virtual
Tag: v0.1.0
Target branch: main

Tanggal: 2026-10-18

Ringkasan:
Ini adalah rilis awal (MVP) dari Unpam Virtual. Menyertakan struktur monorepo, frontend, backend, dan fitur dasar kampus 3D serta agen AI berbasis dokumen.

Perubahan utama:
- Inisialisasi proyek monorepo (client, server, packages/shared)
- Frontend: React + Vite, UI dasar untuk kampus dan kontrol avatar
- Backend: Fastify + SQLite (Drizzle), autentikasi, API agent
- Real-time: Socket.IO untuk posisi avatar dan chat proximity
- Agent AI: RAG dari dokumen dengan FTS5, sanitasi data sensitif
- Workflow: Proposal HIMA, alur persetujuan Kaprodi, board tugas
- Log audit untuk semua aksi penting

Instruksi pembuatan release di GitHub (manual):
1. Buka: https://github.com/oddycosplay/unpam-virtual/releases
2. Klik "Draft a new release"
3. Tag version: `v0.1.0`
4. Target: `main`
5. Judul: `v0.1.0 — Initial MVP`
6. Deskripsi: salin isi file ini atau `CHANGELOG.md`
7. (Opsional) Unggah binary/artifact bila perlu
8. Klik "Publish release"

Catatan:
- Repo belum menentukan LICENSE. Pertimbangkan menambahkan lisensi sebelum publikasi luas.
- Jika ingin, saya bisa membuat tag git dan membuat release via API jika Anda mengizinkan pembuatan release formal (memerlukan akses token dengan permission `repo`).
