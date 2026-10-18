# Changelog

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
