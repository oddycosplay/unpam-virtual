import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { hasPermission, type AgentStatusView, type Permission, type Role } from "@unpam/shared";
import { api } from "../api/http";
import { Icon, type IconName } from "../components/ui/Icon";
import { STATUS_COLOR, STATUS_LABEL } from "../world/layout";

interface Item {
  to: string;
  label: string;
  icon: IconName;
  /** Tampil bila peran punya salah satu izin ini. Kosong = semua peran. */
  any?: Permission[];
  end?: boolean;
}

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Utama",
    items: [
      { to: "/", label: "Dashboard", icon: "dashboard", end: true },
      { to: "/tugas", label: "Papan Tugas", icon: "board" },
      { to: "/hasil-kerja", label: "Hasil Kerja", icon: "work", any: ["proposal:create", "submission:comment", "submission:decide"] },
    ],
  },
  {
    title: "Agent",
    items: [{ to: "/chat", label: "Agent Akademik", icon: "chat", any: ["agent:chat"] }],
  },
  {
    title: "Admin",
    items: [
      { to: "/admin/documents", label: "Dokumen", icon: "documents", any: ["admin:documents"] },
      { to: "/admin/audit", label: "Log Audit", icon: "audit", any: ["audit:view"] },
      { to: "/admin/llm", label: "Provider AI", icon: "provider", any: ["admin:config"] },
    ],
  },
];

const STATUS_POLL_MS = 10_000;

function AgentStatusWidget() {
  const [agents, setAgents] = useState<AgentStatusView[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api<{ agents: AgentStatusView[] }>("/api/agents/status")
        .then((r) => !cancelled && setAgents(r.agents))
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void load(), STATUS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="side-agents" aria-label="Status agent">
      <h2>Status agent</h2>
      {agents === null ? (
        <p className="side-muted">Memuat…</p>
      ) : (
        <ul>
          {agents.map((a) => (
            <li key={a.id} title={a.activity}>
              <span className="dot" style={{ background: STATUS_COLOR[a.status], color: STATUS_COLOR[a.status] }} aria-hidden />
              <span className="side-agent-name">{a.name}</span>
              <span className="side-agent-status">{STATUS_LABEL[a.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Sidebar({ role, open, onClose }: { role: Role; open: boolean; onClose: () => void }) {
  return (
    <aside id="sidebar" className={open ? "sidebar open" : "sidebar"} aria-label="Navigasi utama">
      <div className="side-brand">
        <Link to="/" className="brand small" onClick={onClose}>
          <span className="brand-mark" aria-hidden />
          Unpam Virtual
        </Link>
        <button type="button" className="icon-button side-close" aria-label="Tutup menu" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <nav>
        {GROUPS.map((group) => {
          const items = group.items.filter((i) => !i.any || i.any.some((p) => hasPermission(role, p)));
          if (items.length === 0) return null;
          return (
            <div key={group.title} className="side-group">
              <h2>{group.title}</h2>
              <ul>
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink to={item.to} end={item.end} onClick={onClose}>
                      <Icon name={item.icon} />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <AgentStatusWidget />
    </aside>
  );
}
