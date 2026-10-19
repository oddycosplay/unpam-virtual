import { Component, lazy, Suspense, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hasPermission } from "@unpam/shared";
import { useAuth } from "../auth/AuthContext";
import { STATUS_COLOR, STATUS_LABEL } from "../../world/layout";
import { useDashboard, useReducedMotion } from "./useDashboard";

// Three.js cukup besar; dimuat terpisah agar halaman login tetap ringan.
const ControlRoomScene = lazy(() => import("../../world/ControlRoomScene").then((m) => ({ default: m.ControlRoomScene })));

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="scene-fallback">
          <p>Tampilan 3D gagal dimuat (WebGL tidak tersedia atau GPU sedang sibuk). Data tetap tampil di panel.</p>
          <button type="button" className="hud-button" onClick={() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))}>
            Coba lagi
          </button>
        </div>
      );
    }
    return <div key={this.state.attempt} className="scene-host">{this.props.children}</div>;
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { summary, error } = useDashboard();
  const reducedMotion = useReducedMotion();
  if (!user) return null;

  const canChat = hasPermission(user.role, "agent:chat");
  const { stats } = summary;
  const latency = stats.avgLatencyMs === null ? "–" : `${(stats.avgLatencyMs / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} dtk`;

  return (
    <div className="dash">
      <div className="dash-scene">
        <SceneBoundary>
          <Suspense fallback={<p className="scene-fallback">Menyiapkan ruang kendali…</p>}>
            <ControlRoomScene
              summary={summary}
              viewerRole={user.role}
              reducedMotion={reducedMotion}
              onSelectAgent={() => canChat && navigate("/chat")}
              onOpenOrganizations={() => navigate("/organisasi")}
            />
          </Suspense>
        </SceneBoundary>
        <p className="dash-hint">Seret untuk memutar · scroll atau cubit untuk zoom{canChat && " · klik Agent Akademik untuk chat"}</p>
      </div>

      <header className="dash-head hud">
        <p className="eyebrow">Pusat Kendali</p>
        <h1>Unpam Virtual</h1>
        <dl className="kpis">
          <div>
            <dt>Pertanyaan hari ini</dt>
            <dd>{stats.questionsToday}</dd>
          </div>
          <div>
            <dt>Dijawab</dt>
            <dd>{stats.answersToday}</dd>
          </div>
          <div>
            <dt>Rata-rata respons</dt>
            <dd>{latency}</dd>
          </div>
          <div>
            <dt>Error</dt>
            <dd className={stats.errorsToday > 0 ? "bad" : ""}>{stats.errorsToday}</dd>
          </div>
        </dl>
        {error && <p className="hud-error">Gagal memperbarui: {error}</p>}
      </header>

      <aside className="dash-agents hud" aria-label="Status agent">
        <h2>Status agent</h2>
        <ul>
          {summary.agents.map((a) => (
            <li key={a.id} className={a.active ? "" : "inactive"}>
              <span className="dot" style={{ background: STATUS_COLOR[a.status] }} aria-hidden />
              <div>
                <strong>{a.name}</strong>
                <span>{a.activity}</span>
              </div>
              <em style={{ color: STATUS_COLOR[a.status] }}>{STATUS_LABEL[a.status]}</em>
            </li>
          ))}
        </ul>
        <div className="hud-actions">
          {canChat && (
            <Link to="/chat" className="hud-button">
              Tanya Agent Akademik
            </Link>
          )}
          {hasPermission(user.role, "proposal:create") && (
            <Link to="/proposal/baru" className="hud-button secondary">
              Minta proposal
            </Link>
          )}
          {hasPermission(user.role, "submission:decide") && stats.pendingApprovals > 0 && (
            <Link to="/hasil-kerja" className="hud-button warn">
              {stats.pendingApprovals} proposal menunggu
            </Link>
          )}
        </div>
      </aside>

      <aside className="dash-activity hud" aria-label="Aktivitas terbaru">
        <h2>Aktivitas terbaru</h2>
        {summary.recentActivity.length === 0 ? (
          <p className="hud-muted">Belum ada aktivitas.</p>
        ) : (
          <ol>
            {summary.recentActivity.map((item) => (
              <li key={item.id} className={`kind-${item.kind}`}>
                <time dateTime={item.at}>{formatTime(item.at)}</time>
                <span>{item.text}</span>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}
