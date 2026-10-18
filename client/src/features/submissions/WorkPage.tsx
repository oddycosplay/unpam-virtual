import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { hasPermission, type SubmissionSummary } from "@unpam/shared";
import { api } from "../../api/http";
import { useAuth } from "../auth/AuthContext";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { timeAgo } from "../../lib/format";

export function WorkPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<SubmissionSummary[] | null>(null);
  const canCreate = user ? hasPermission(user.role, "proposal:create") : false;
  const isDecider = user ? hasPermission(user.role, "submission:decide") : false;

  useEffect(() => {
    api<{ submissions: SubmissionSummary[] }>("/api/submissions").then((r) => setItems(r.submissions));
  }, []);

  const waiting = (items ?? []).filter((s) => s.status === "menunggu_persetujuan");

  return (
    <section className="stack">
      <header className="page-head">
        <div>
          <h1>Hasil Kerja</h1>
          <p className="muted">
            {canCreate
              ? "Draf dari Agent HIMA dan proposal yang sudah Anda ajukan."
              : "Proposal yang diajukan ke Kaprodi."}
          </p>
        </div>
        {canCreate && (
          <Link to="/proposal/baru" className="button-link">
            Minta proposal baru
          </Link>
        )}
      </header>

      {isDecider && waiting.length > 0 && (
        <p className="callout">
          <strong>{waiting.length} proposal</strong> menunggu keputusan Anda.
        </p>
      )}

      <div className="card">
        {items === null ? (
          <p className="muted">Memuat…</p>
        ) : items.length === 0 ? (
          <p className="muted">{canCreate ? "Belum ada proposal. Mulai dengan meminta Agent HIMA menyusun draf." : "Belum ada pengajuan."}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Judul</th>
                  <th>Status</th>
                  <th>Pemohon</th>
                  <th>Versi</th>
                  <th>Diperbarui</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/pengajuan/${s.id}`}>{s.title}</Link>
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td>{s.owner.name}</td>
                    <td>{s.version || "–"}</td>
                    <td>{timeAgo(s.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
