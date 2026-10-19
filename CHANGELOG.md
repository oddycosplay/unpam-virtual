# Changelog

## Unreleased

### Added

- halaman Kelola Akun: buat akun dengan password sementara, ubah peran, aktif/nonaktif, reset password
- halaman Akun untuk ganti password dan melihat pemakaian AI harian
- batas token AI harian per pengguna (khusus, global di panel, atau `DAILY_TOKEN_LIMIT`)
- backup SQLite otomatis (tiap 24 jam, 7 terakhir) dan manual, bisa diunduh admin
- skrip uji beban kampus `npm run load-test` dan penghitung FPS di Kampus 3D
- direktori Organisasi Mahasiswa: 21 HIMA dan 18 UKM UNPAM, bisa dicari, tautan diisi admin
- area Pusat Kegiatan Mahasiswa di Kampus 3D; papan organisasi bisa diklik
- dokumen pengetahuan organisasi untuk Agent Akademik
- logo Universitas Pamulang di aplikasi, favicon, dan README

### Security

- batas 5 percobaan login gagal per 15 menit (per IP + email)
- sesi lama batal saat password diganti/direset, peran diubah, atau akun dinonaktifkan
- cek Origin untuk permintaan yang mengubah data (CSRF); proxy Vite meneruskan `X-Forwarded-Host`
- cookie `Secure` otomatis saat diakses lewat HTTPS, header keamanan dasar, password minimal 8 karakter

## v0.1.0 - 2026-10-18

### Added

- inisialisasi proyek `unpam-virtual` dengan struktur monorepo
- aplikasi frontend React + Vite untuk antarmuka kampus digital
- backend Fastify + SQLite untuk autentikasi, data, dan API
- real-time integration melalui Socket.IO
- ruang kampus 3D dengan navigasi dan avatar multi-user
- fitur agent AI akademik berbasis dokumentasi kampus
- log audit untuk monitoring tindakan sistem
- workflow proposal HIMA dan persetujuan Kaprodi
- konfigurasi provider AI dengan dukungan Anthropic dan OpenAI-compatible
- seed data dan akun contoh untuk pengembangan lokal

### Updated

- dokumentasi proyek diperbarui agar lebih jelas untuk onboarding developer
- struktur README ditulis dalam bahasa Indonesia dengan panduan setup dan penggunaan
- release notes dibuat untuk mempermudah tracking perubahan versi

### Notes

- Proyek masih dalam tahap MVP/pengembangan awal.
- Database SQLite dibuat otomatis saat runtime pertama kali dijalankan.
- Untuk environment produksi atau deployment lanjutan, perlu evaluasi keamanan, konfigurasi deployment, dan backup data.

---

## Rencana berikutnya

- optimasi performa 3D dan networking
- penguatan keamanan autentikasi dan enkripsi
- pengembangan modul evaluasi dan rekap akademik
- penambahan fitur notifikasi yang lebih kaya
- distribusi dan deployment staging/production
