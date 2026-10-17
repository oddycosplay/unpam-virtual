# Unpam Virtual

Kampus virtual 3D Prodi Sistem Informasi Unpam dengan agent AI. Spesifikasi lengkap: [PRD Unpam Virtual (MVP).md](PRD%20Unpam%20Virtual%20(MVP).md).

Status: **tahap 1 (Fondasi)**: struktur proyek, SQLite, login, peran, dan LLM provider layer.

## Menjalankan

Butuh Node.js 20+ (diuji dengan Node 24). Di Windows, `better-sqlite3` dikompilasi saat install, jadi Visual Studio Build Tools (C++) dan Python harus tersedia.

```bash
npm install
npm run dev
```

- Saat pertama kali jalan, `.env` dibuat otomatis dari `.env.example` dengan `JWT_SECRET` dan `ENCRYPTION_KEY` acak.
- Database SQLite ada di `data/unpam.db`, dimigrasi dan diisi akun contoh otomatis.
- Buka http://localhost:5173. Dari perangkat lain di Wi-Fi yang sama, buka `http://<IP-laptop>:5173` (IP LAN tercetak di log server).

## Akun contoh

Semua akun memakai password dari `SEED_PASSWORD` di `.env` (default `unpam123`). Akun hanya dibuat bila tabel users masih kosong.

| Email | Peran |
| --- | --- |
| mahasiswa@unpam.test | Mahasiswa |
| hima@unpam.test | Pengurus HIMA |
| dosen@unpam.test | Dosen |
| kaprodi@unpam.test | Kaprodi |
| admin@unpam.test | Admin |

## Provider AI

Atur lewat menu **Provider AI** (login sebagai admin) atau variabel `LLM_*` di `.env`. Konfigurasi panel admin diutamakan.

- **Anthropic (default):** kosongkan Base URL, model default `claude-opus-5-5`. Di endpoint resmi, request memakai fallback refusal sisi server (`fallbacks: "default"`).
- **OpenAI-compatible:** isi Base URL, misalnya `https://openrouter.ai/api/v1` atau `http://localhost:11434/v1` (Ollama).

API key disimpan terenkripsi AES-256-GCM di database dan tidak pernah dikirim balik ke browser. Tombol **Uji koneksi** mengirim satu prompt pendek dan hasilnya tercatat di log audit.

## Perintah lain

```bash
npm test            # tes server (vitest)
npm run typecheck   # cek tipe server + client
npm run db:generate # buat migrasi baru setelah mengubah server/src/db/schema.ts
```

## Struktur

```
packages/shared   tipe & konstanta bersama (peran, izin, status)
server            Fastify + SQLite (Drizzle) + auth + LLM layer
client            React + Vite
```
