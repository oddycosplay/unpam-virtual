import { Component, lazy, Suspense, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hasPermission } from "@unpam/shared";
import { useAuth } from "../auth/AuthContext";
import { STATUS_COLOR, STATUS_LABEL } from "../../world/layout";
import { useDashboard, useReducedMotion } from "./useDashboard";
import { usePreferences, type DashPanel } from "../../app/preferences";
import { Icon } from "../../components/ui/Icon";

// Three.js cukup besar; dimuat terpisah agar halaman login tetap ringan.
const ControlRoomScene = lazy(() => import("../../world/ControlRoomScene").then((m) => ({ default: m.ControlRoomScene })));

export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
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

/** Panel HUD yang bisa dilipat lewat judulnya; status lipat disimpan di preferensi pengguna. */
function HudPanel({
  id,
  title,
  className,
  summary,
  children,
}: {
  id: DashPanel;
  title: string;
  className: string;
  /** Ringkasan satu baris yang tetap terlihat saat panel dilipat. */
  summary?: ReactNode;
  children: ReactNode;
}) {
  const { prefs, togglePanel } = usePreferences();
  const open = !prefs.collapsed[id];
  const bodyId = `hud-${id}`;
  return (
    <section className={`hud hud-panel ${className}${open ? "" : " collapsed"}`} aria-label={title}>
      <h2>
        <button type="button" className="hud-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => togglePanel(id)}>
          <span>{title}</span>
          {!open && summary && <span className="hud-summary">{summary}</span>}
          <Icon name="chevron" size={16} />
        </button>
      </h2>
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </section>
  );
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

      <div className="dash-left">
        <HudPanel
          id="head"
          title="Pusat Kendali"
          className="dash-head"
          summary={`${stats.questionsToday} pertanyaan${stats.errorsToday > 0 ? ` · ${stats.errorsToday} error` : ""}`}
        >
          <p className="dash-title">Unpam Virtual</p>
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
        </HudPanel>
        {error && <p className="hud hud-error">Gagal memperbarui: {error}</p>}

        <HudPanel
          id="agents"
          title="Status agent"
          className="dash-agents"
          summary={summary.agents.map((a) => (
            <span key={a.id} className="dot" style={{ background: STATUS_COLOR[a.status] }} title={`${a.name}: ${STATUS_LABEL[a.status]}`} />
          ))}
        >
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
        </HudPanel>
      </div>

      <HudPanel
        id="activity"
        title="Aktivitas terbaru"
        className="dash-activity"
        summary={summary.recentActivity.length > 0 ? `${summary.recentActivity.length} item` : undefined}
      >
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
      </HudPanel>
    </div>
  );
}
