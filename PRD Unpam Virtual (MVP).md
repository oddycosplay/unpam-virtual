# PRD Unpam Virtual (MVP)

Oct 17, 2026 · @JALA

## 1. Ringkasan

Unpam Virtual adalah web app kampus 3D bergaya voxel isometrik untuk Program Studi Sistem Informasi Unpam. Mahasiswa, dosen, pengurus HIMA, dan Kaprodi bergerak sebagai avatar, berinteraksi dengan sesama pemain dan dengan agent AI yang membantu urusan akademik dan organisasi.

Status kerja agent tampil langsung di peta 3D, dan semua pengajuan penting tetap disetujui manusia.

## 2. Tujuan dan non-tujuan

MVP menargetkan satu kampus 3D yang berfungsi dengan dua agent nyata dan satu alur persetujuan lengkap.

**Tujuan MVP**

- Satu kampus 3D yang bisa dijelajahi, dengan avatar yang berjalan.
- Dua agent yang benar-benar berfungsi: Agent Akademik dan Agent HIMA.
- Alur pengajuan proposal kegiatan HIMA dengan persetujuan Kaprodi.
- Dashboard dengan papan tugas dan status agent.
- Ringan: satu laptop, tanpa instalasi database terpisah.

**Bukan tujuan MVP**

- Integrasi SIAKAD atau data akademik asli (butuh izin kampus).
- Voice chat, mobile app native, dan marketplace agent.
- Multiplayer skala besar (target 20–30 pemain bersamaan).

## 3. Pengguna dan peran

Lima peran dengan hak akses dan warna avatar berbeda.

| Peran | Warna avatar | Hak utama |
| --- | --- | --- |
| Mahasiswa | Biru | Chat agent, ajukan permintaan, lihat status |
| Pengurus HIMA | Merah-biru-putih | Buat proposal kegiatan, kelola pengumuman HIMA |
| Dosen | Biru-putih | Chat agent, lihat dan beri masukan pengajuan |
| Kaprodi | Biru-putih-kuning | Setujui atau tolak pengajuan |
| Admin | Netral | Kelola akun, agent, ruangan, dan konfigurasi |

Identitas visual: tema Prodi SI memakai biru, putih, dan kuning. HIMA memakai merah, biru, dan putih. Mahasiswa memakai biru. Warna ini dipakai untuk UI, avatar, dan label area di peta.

## 4. Agent di MVP

MVP memakai tiga agent: Akademik, HIMA, dan Orkestrator.

1. **Agent Akademik:** menjawab pertanyaan jadwal, prosedur, dan kalender akademik dari dokumen yang diunggah admin. Wajib menyebut sumbernya, dan bila tidak ada jawabannya harus bilang tidak tahu.
2. **Agent HIMA:** membantu menyusun proposal kegiatan (latar belakang, tujuan, rencana kegiatan, anggaran kasar), lalu mengajukannya.
3. **Orkestrator:** menerima pesan, memilih agent yang tepat, dan mencatat tugas di papan tugas.

Agent tahap berikutnya: Kaprodi (perangkum), Riset/Perpustakaan, dan Layanan Mahasiswa.

**Status agent:** Idle, Planning, Running, Rapat, Waiting Approval, Completed, Error.

## 5. Fitur MVP (user stories)

Sepuluh user stories mencakup login, kampus 3D, chat agent, proposal, persetujuan, dan administrasi.

1. Sebagai pengguna, saya login dan masuk ke kampus sesuai peran saya.
2. Sebagai pengguna, saya berjalan dengan WASD atau klik dan melihat pemain lain bergerak real-time.
3. Sebagai mahasiswa, saya klik agent untuk membuka panel chat dan bertanya.
4. Sebagai pengurus HIMA, saya meminta Agent HIMA menyusun proposal. Hasilnya muncul di Hasil Kerja sebagai draf yang bisa saya edit.
5. Sebagai pengurus HIMA, saya mengajukan draf. Statusnya menjadi "Menunggu Persetujuan" dan Kaprodi mendapat notifikasi.
6. Sebagai Kaprodi, saya menyetujui, menolak, atau meminta revisi dengan catatan. Pemohon mendapat notifikasi.
7. Sebagai pengguna, saya melihat papan tugas dengan kolom Baru, Diproses, Menunggu Persetujuan, dan Selesai.
8. Sebagai pengguna, saya melihat label di atas agent yang menampilkan nama dan aktivitasnya.
9. Sebagai admin, saya mengunggah dokumen kampus (panduan akademik, SOP proposal) sebagai basis pengetahuan agent.
10. Sebagai admin, saya mengelola akun dan peran, serta memasukkan API key provider.

## 6. Aturan agent (wajib)

Agent tidak boleh bertindak penting tanpa konfirmasi manusia.

- Agent tidak boleh mengirim, menyetujui, atau mengubah data penting tanpa konfirmasi manusia.
- Agent hanya memakai tools sesuai izin perannya.
- Jawaban faktual harus berdasarkan dokumen resmi, dengan sumber disebut.
- Agent mengaku sebagai asisten AI, bukan sumber resmi kampus.
- Data pribadi (NIM, nilai) tidak dikirim ke provider AI kecuali benar-benar perlu.
- Setiap tindakan agent dicatat di log audit: siapa meminta, apa yang dilakukan, siapa menyetujui.
- Bila gagal, agent mencoba ulang sekali, lalu eskalasi ke manusia dan status menjadi Error.

## 7. Dunia 3D

Kampus voxel low-poly dengan tujuh area, target 30+ FPS di laptop biasa.

**Area MVP:** gerbang dan lobby, gedung kelas, ruang dosen, sekretariat HIMA, ruang Kaprodi, perpustakaan, kantin dan taman.

**Perilaku agent di peta**

| Status | Posisi agent |
| --- | --- |
| Running | Berjalan ke meja kerjanya |
| Waiting Approval | Berdiri di depan ruang Kaprodi |
| Idle | Ke kantin atau taman |
| Rapat | Ke ruang rapat |

**Kontrol:** kamera isometrik yang bisa diputar dan di-zoom, minimap, dan proximity chat (chat dengan pemain di dekat saya).

## 8. Arsitektur dan stack

Stack dipilih agar ringan di satu laptop dan provider AI mudah diganti.

| Komponen | Pilihan |
| --- | --- |
| Frontend | React + TypeScript + Vite + React Three Fiber (Three.js) |
| Backend | Node.js + TypeScript dengan WebSocket (Socket.IO atau ws) |
| Database | SQLite (satu file, tanpa instalasi) |
| LLM layer | Satu modul provider dengan adapter Anthropic (Claude) dan adapter OpenAI-compatible (9router, OpenRouter, Ollama) |
| RAG | Dokumen dipecah jadi potongan di SQLite, dicari dengan kata kunci atau embedding ringan |
| Auth | Email dan password dengan sesi atau JWT, kontrol akses berbasis peran |
| Menjalankan | Satu perintah (`npm run dev`), bisa diakses dari perangkat lain di Wi-Fi yang sama |

Konfigurasi provider lewat `.env` (`LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`) dan panel admin. Default: Claude API. API key disimpan terenkripsi, tidak pernah di kode.

## 9. Model data (garis besar)

Dua belas entitas inti menopang pengguna, agent, pengajuan, dan jejak audit:

- Pengguna dan Peran
- Agent dan Tugas
- Pengajuan (draf, status, riwayat versi)
- Persetujuan (penyetuju, keputusan, catatan)
- Dokumen Pengetahuan dan Potongan Dokumen
- Pesan Chat dan Notifikasi
- Log Audit
- Konfigurasi Provider

## 10. Metrik keberhasilan MVP

Empat ukuran menentukan apakah MVP dianggap berhasil.

- Mahasiswa mendapat jawaban Agent Akademik dengan sumber dokumen dalam kurang dari 10 detik.
- Proposal HIMA dari permintaan sampai keputusan Kaprodi dapat diselesaikan penuh dalam aplikasi.
- Minimal 10 pemain bergerak bersamaan tanpa lag yang mengganggu.
- Seluruh tindakan agent tercatat di log audit.

## 11. Tahap kerja untuk Claude Code

Kerjakan enam tahap berurutan. Jalankan dan uji tiap tahap sebelum lanjut, dan minta konfirmasi sebelum mengubah arsitektur.

1. **Fondasi:** struktur proyek, SQLite, login, peran, dan LLM provider layer.
2. **Agent Akademik:** chat berfungsi, RAG dokumen, dan sumber ditampilkan.
3. **Papan tugas dan Agent HIMA:** pembuatan proposal, Hasil Kerja, dan alur persetujuan Kaprodi dengan notifikasi.
4. **Dashboard:** sidebar, status agent, dan log audit.
5. **Kampus 3D:** peta voxel, avatar, multiplayer WebSocket, dan agent bergerak sesuai status.
6. **Pengerasan:** panel admin, batas biaya per pengguna, backup, dan keamanan dasar.

Prompt pembuka yang disarankan: "Baca PRD ini, ringkas pemahamanmu dan usulkan struktur folder, lalu tunggu persetujuan saya sebelum menulis kode tahap 1."

## 12. Risiko dan catatan

Empat risiko utama perlu dipantau sejak tahap awal.

- Tool calling berbeda antar provider, jadi uji ulang tiap ganti provider.
- Biaya API perlu dibatasi per pengguna.
- Aset 3D sebaiknya dibuat dari bentuk primitif atau aset gratis berlisensi jelas.
- Data mahasiswa asli hanya dipakai dengan izin kampus. Mulai dengan data contoh.
