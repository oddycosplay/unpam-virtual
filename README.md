# Unpam Virtual

Kampus virtual 3D Prodi Sistem Informasi Unpam dengan agent AI. Spesifikasi lengkap: [PRD Unpam Virtual (MVP).md](PRD%20Unpam%20Virtual%20(MVP).md).

Status: **tahap 3 (Papan tugas dan Agent HIMA)** selesai.

- Tahap 1: struktur proyek, SQLite, login, peran, dan LLM provider layer.
- Tahap 2: chat Agent Akademik dengan RAG dokumen (SQLite FTS5) dan sumber ditampilkan.
- Dashboard ruang kendali 3D (bagian dari tahap 4–5, dikerjakan lebih awal).
- Tahap 3: papan tugas, Agent HIMA menyusun proposal, alur persetujuan Kaprodi, dan notifikasi.

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

## Dashboard ruang kendali 3D

Halaman utama setelah login adalah ruang kendali isometrik 3D (React Three Fiber, semua objek dari bentuk primitif):

- Hub Orkestrator di tengah dengan jalur bercahaya ke Ruang Akademik & Dosen, Sekretariat HIMA, Ruang Kaprodi, Perpustakaan, dan Kantin & Taman.
- Robot agent bergerak di sepanjang jalur sesuai statusnya (PRD §7): Running ke meja kerja, Waiting Approval ke gerbang Kaprodi, Idle ke kantin. Label di atasnya menampilkan nama, status, dan aktivitas. Klik Agent Akademik untuk membuka chat.
- Layar hologram dan panel samping menampilkan data nyata dari `GET /api/dashboard` (diperbarui tiap 5 detik): pertanyaan dan jawaban hari ini, rata-rata waktu jawab, error, jawaban per jam, basis pengetahuan, dan aktivitas terbaru dari log audit. Aktivitas akun dan konfigurasi hanya terlihat oleh admin.
- Seret untuk memutar, scroll atau cubit untuk zoom. Gerakan dikurangi bila sistem meminta *reduced motion*. Bila WebGL tidak tersedia, data tetap tampil di panel.

## Proposal HIMA dan persetujuan Kaprodi

1. Pengurus HIMA mengisi **Minta proposal baru** (nama kegiatan, deskripsi, opsional tanggal/tempat/peserta/batas anggaran). Orkestrator mencatat tugas di papan (kolom *Diproses*).
2. Agent HIMA menyusun draf di latar belakang mengikuti SOP HIMA, lewat tool call terstruktur (`simpan_draf_proposal`). Data yang tidak diketahui diberi penanda `[isi …]`. Gagal → coba ulang sekali → status *Gagal disusun* dan tombol **Coba lagi**.
3. Draf muncul di **Hasil Kerja**. Pengurus menyuntingnya; setiap simpanan menjadi versi baru.
4. Hanya pengurus (manusia) yang bisa **Ajukan ke Kaprodi**. Agent tidak punya jalur untuk mengajukan sendiri (PRD §6). Kaprodi mendapat notifikasi, dan robot Agent HIMA di dashboard berdiri di gerbang Ruang Kaprodi.
5. Kaprodi **Setujui**, **Tolak**, atau **Minta revisi** (catatan wajib untuk tolak/revisi). Pemohon mendapat notifikasi. Dosen dan Kaprodi bisa memberi masukan.
6. Kartu tugas berpindah otomatis: Diproses → Menunggu Persetujuan → Selesai (atau kembali ke Diproses saat revisi).

Draf tetap privat milik pemohon sampai diajukan. Semua langkah tercatat di log audit, termasuk siapa yang menyetujui. Penyusunan yang terputus karena server restart ditandai gagal saat server dimulai lagi.

## Agent Akademik

Menu **Agent Akademik** tersedia untuk mahasiswa, pengurus HIMA, dosen, dan Kaprodi.

- Pertanyaan dicari di potongan dokumen dengan BM25 (SQLite FTS5). Bila tidak ada potongan yang relevan, agent langsung menjawab "tidak tahu" tanpa memanggil LLM.
- Agent hanya menjawab dari kutipan dokumen dan wajib memberi rujukan [n]. Sumber yang dirujuk tampil di bawah jawaban.
- NIM, nomor telepon, dan email disamarkan sebelum teks dikirim ke provider AI.
- Gagal → coba ulang sekali → pesan eskalasi ke pengguna dan `agent.error_escalated` di log audit.
- Setiap jawaban tercatat di log audit (`agent.answered`) dengan latensi, jumlah token, dan dokumen sumber.

## Dokumen

Admin mengunggah dokumen lewat menu **Dokumen** (.pdf, .md, .txt, maks 10 MB) dan memilih agent yang boleh memakainya. Dua dokumen contoh fiktif di `server/seed-docs/` diindeks otomatis bila basis pengetahuan masih kosong. Hapus keduanya setelah dokumen resmi diunggah.

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
