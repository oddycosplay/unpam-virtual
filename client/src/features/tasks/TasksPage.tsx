import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TASK_STATUSES, hasPermission, type TaskStatus, type TaskView } from "@unpam/shared";
import { api } from "../../api/http";
import { useAuth } from "../auth/AuthContext";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { timeAgo } from "../../lib/format";

const COLUMN_LABEL: Record<TaskStatus, string> = {
  baru: "Baru",
  diproses: "Diproses",
  menunggu_persetujuan: "Menunggu Persetujuan",
  selesai: "Selesai",
};
const AGENT_LABEL: Record<string, string> = { hima: "Agent HIMA", akademik: "Agent Akademik" };

export function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      api<{ tasks: TaskView[] }>("/api/tasks")
        .then((r) => setTasks(r.tasks))
        .catch((e: Error) => setError(e.message));
    void load();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void load(), 8000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="stack">
      <header className="page-head">
        <div>
          <h1>Papan Tugas</h1>
          <p className="muted">Pekerjaan agent dan pengajuan yang butuh tindak lanjut.</p>
        </div>
        {user && hasPermission(user.role, "proposal:create") && (
          <Link to="/proposal/baru" className="button-link">
            Minta proposal baru
          </Link>
        )}
      </header>
      {error && <p className="error">{error}</p>}
      <div className="board">
        {TASK_STATUSES.map((col) => {
          const items = (tasks ?? []).filter((t) => t.status === col);
          return (
            <section key={col} className={`board-col col-${col}`} aria-label={COLUMN_LABEL[col]}>
              <h2>
                {COLUMN_LABEL[col]} <span className="count">{tasks ? items.length : "…"}</span>
              </h2>
              {tasks && items.length === 0 && <p className="muted small board-empty">Kosong</p>}
              <ul>
                {items.map((t) => (
                  <li key={t.id} className="task-card">
                    {t.submissionId ? (
                      <Link to={`/pengajuan/${t.submissionId}`}>{t.title}</Link>
                    ) : (
                      <span>{t.title}</span>
                    )}
                    <div className="task-meta">
                      {t.submissionStatus && <StatusBadge status={t.submissionStatus} />}
                      {t.agentId && <span className="agent-chip">{AGENT_LABEL[t.agentId] ?? t.agentId}</span>}
                    </div>
                    <p className="muted small">
                      {t.owner} · {timeAgo(t.updatedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
