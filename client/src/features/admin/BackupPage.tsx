import { useEffect, useState } from "react";
import type { BackupView } from "@unpam/shared";
import { api } from "../../api/http";
import { Icon } from "../../components/ui/Icon";

function size(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function BackupPage() {
  const [data, setData] = useState<{ backups: BackupView[]; keep: number; intervalHours: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = () => api<{ backups: BackupView[]; keep: number; intervalHours: number }>("/api/admin/backups").then(setData);

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await api<{ backup: BackupView }>("/api/admin/backups", { method: "POST" });
      setMessage({ kind: "ok", text: `Backup ${r.backup.name} dibuat (${size(r.backup.sizeBytes)}).` });
      await load();
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <header className="page-head">
        <div>
          <h1>Backup</h1>
          <p className="muted">
            Salinan lengkap database SQLite: akun, pengajuan, chat, dokumen, dan log audit.
            {data && data.intervalHours > 0 && ` Backup otomatis tiap ${data.intervalHours} jam, ${data.keep} terakhir disimpan.`}
          </p>
        </div>
        <button type="button" onClick={() => void create()} disabled={busy}>
          {busy ? "Membuat backup…" : "Backup sekarang"}
        </button>
      </header>

      <p className="callout warn">
        File backup berisi hash password dan API key terenkripsi. Simpan di tempat aman dan jangan dibagikan. Setiap unduhan tercatat di log audit.
      </p>
      {message && (
        <p className={message.kind === "ok" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      <div className="card">
        {data === null ? (
          <p className="muted">Memuat…</p>
        ) : data.backups.length === 0 ? (
          <p className="muted">Belum ada backup.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Jenis</th>
                  <th>Ukuran</th>
                  <th>Dibuat</th>
                  <th aria-label="Aksi" />
                </tr>
              </thead>
              <tbody>
                {data.backups.map((b) => (
                  <tr key={b.name}>
                    <td>
                      <code className="small">{b.name}</code>
                    </td>
                    <td>{b.kind === "manual" ? "Manual" : "Otomatis"}</td>
                    <td>{size(b.sizeBytes)}</td>
                    <td>{new Date(b.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td>
                      <a className="download-link" href={`/api/admin/backups/${encodeURIComponent(b.name)}`} download>
                        <Icon name="download" size={16} /> Unduh
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <details className="card restore-help">
        <summary>Cara memulihkan dari backup</summary>
        <ol>
          <li>Hentikan aplikasi (tutup terminal yang menjalankan <code>npm run dev</code>).</li>
          <li>Ganti nama <code>data/unpam.db</code> menjadi <code>unpam-lama.db</code> sebagai cadangan.</li>
          <li>
            Salin file backup ke <code>data/unpam.db</code>, lalu hapus <code>data/unpam.db-wal</code> dan <code>data/unpam.db-shm</code> bila ada.
          </li>
          <li>Jalankan lagi <code>npm run dev</code>. Pastikan file <code>.env</code> yang sama dipakai agar API key terenkripsi tetap bisa dibaca.</li>
        </ol>
      </details>
    </section>
  );
}
