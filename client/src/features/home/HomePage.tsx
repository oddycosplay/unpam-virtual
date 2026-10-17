import { Link } from "react-router-dom";
import { ROLE_INFO, ROLE_PERMISSIONS, hasPermission } from "@unpam/shared";
import { useAuth } from "../auth/AuthContext";

const PERMISSION_LABEL: Record<string, string> = {
  "agent:chat": "Chat dengan agent",
  "request:create": "Mengajukan permintaan",
  "proposal:create": "Membuat proposal kegiatan",
  "announcement:manage": "Mengelola pengumuman HIMA",
  "submission:comment": "Memberi masukan pengajuan",
  "submission:decide": "Menyetujui atau menolak pengajuan",
  "admin:users": "Mengelola akun dan peran",
  "admin:config": "Mengatur provider AI",
  "admin:documents": "Mengunggah dokumen kampus",
};

export function HomePage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <section className="card">
      <h2>Halo, {user.name}</h2>
      <p className="muted">
        Anda masuk sebagai <strong>{ROLE_INFO[user.role].label}</strong>. Papan tugas, dashboard, dan kampus 3D
        menyusul di tahap berikutnya.
      </p>
      {hasPermission(user.role, "agent:chat") && (
        <Link to="/chat" className="button-link">
          Tanya Agent Akademik
        </Link>
      )}
      <h3>Hak akses Anda</h3>
      <ul className="perm-list">
        {ROLE_PERMISSIONS[user.role].map((p) => (
          <li key={p}>{PERMISSION_LABEL[p] ?? p}</li>
        ))}
      </ul>
    </section>
  );
}
