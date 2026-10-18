import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AUDIT_CATEGORIES, AUDIT_CATEGORY_LABEL, type AuditEntryView, type AuditFilters, type AuditPage as AuditPageData } from "@unpam/shared";
import { api } from "../../api/http";
import { Icon } from "../../components/ui/Icon";

const PAGE_SIZE = 50;
const AGENT_NAME: Record<string, string> = { akademik: "Agent Akademik", hima: "Agent HIMA", orkestrator: "Orkestrator" };
const TYPE_LABEL: Record<AuditEntryView["actorType"], string> = { user: "Pengguna", agent: "Agent", system: "Sistem" };

function toQuery(f: AuditFilters, extra: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v !== undefined && v !== "") params.set(k, String(v));
  return params.toString();
}

function formatAt(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

function Actor({ e }: { e: AuditEntryView }) {
  // Keputusan dicatat atas nama pemohon dengan penyetuju terpisah; tampilkan pemutusnya lebih dulu.
  if (e.approverName) {
    return (
      <>
        <strong>{e.approverName}</strong>
        {e.actorName && <span className="muted small">pemohon: {e.actorName}</span>}
      </>
    );
  }
  if (e.actorType === "agent") {
    return (
      <>
        <strong>{AGENT_NAME[e.actorAgent ?? ""] ?? e.actorAgent ?? "Agent"}</strong>
        {e.actorName && <span className="muted small">atas permintaan {e.actorName}</span>}
      </>
    );
  }
  return <strong>{e.actorName ?? TYPE_LABEL[e.actorType]}</strong>;
}

export function AuditPage() {
  const [filters, setFilters] = useState<AuditFilters>({});
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<AuditEntryView[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Kata kunci diterapkan setelah pengguna berhenti mengetik sebentar.
  useEffect(() => {
    const t = window.setTimeout(() => setFilters((f) => (f.q === (search.trim() || undefined) ? f : { ...f, q: search.trim() || undefined })), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (before?: number) => {
      setLoading(true);
      setError(null);
      try {
        const page = await api<AuditPageData>(`/api/admin/audit?${toQuery(filters, { limit: PAGE_SIZE, before })}`);
        setEntries((prev) => (before ? [...prev, ...page.entries] : page.entries));
        setTotal(page.total);
        setNextBefore(page.nextBefore);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    setExpanded(new Set());
    void load();
  }, [load]);

  const csvHref = useMemo(() => `/api/admin/audit.csv?${toQuery(filters)}`, [filters]);
  const hasFilter = Object.values(filters).some((v) => v !== undefined && v !== "");

  const set = <K extends keyof AuditFilters>(key: K, value: AuditFilters[K] | "") =>
    setFilters((f) => ({ ...f, [key]: value === "" ? undefined : value }));

  const toggle = (id: number) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section className="stack audit">
      <header className="page-head">
        <div>
          <h1>Log Audit</h1>
          <p className="muted">Siapa meminta, apa yang dilakukan, dan siapa yang menyetujui. Catatan ini hanya bisa dibaca.</p>
        </div>
        <a className="button-link secondary-link" href={csvHref} download>
          <Icon name="download" size={18} /> Ekspor CSV
        </a>
      </header>

      <form className="card audit-filters" onSubmit={(e) => e.preventDefault()} role="search" aria-label="Saring log audit">
        <label className="grow">
          Cari
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nama, agent, judul, email…" />
        </label>
        <label>
          Aktor
          <select value={filters.type ?? ""} onChange={(e) => set("type", e.target.value as AuditFilters["type"] | "")}>
            <option value="">Semua</option>
            <option value="user">Pengguna</option>
            <option value="agent">Agent</option>
            <option value="system">Sistem</option>
          </select>
        </label>
        <label>
          Kategori
          <select value={filters.category ?? ""} onChange={(e) => set("category", e.target.value as AuditFilters["category"] | "")}>
            <option value="">Semua</option>
            {AUDIT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {AUDIT_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dari
          <input type="date" value={filters.from ?? ""} max={filters.to} onChange={(e) => set("from", e.target.value)} />
        </label>
        <label>
          Sampai
          <input type="date" value={filters.to ?? ""} min={filters.from} onChange={(e) => set("to", e.target.value)} />
        </label>
        {hasFilter && (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setSearch("");
              setFilters({});
            }}
          >
            Reset
          </button>
        )}
      </form>

      <div className="card audit-list">
        <p className="muted small audit-count" aria-live="polite">
          {total === null ? "Memuat…" : `${total.toLocaleString("id-ID")} catatan${hasFilter ? " cocok dengan filter" : ""}`}
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {total === 0 && <p className="muted">Tidak ada catatan.</p>}
        <ol>
          {entries.map((e) => {
            const at = formatAt(e.at);
            const open = expanded.has(e.id);
            return (
              <li key={e.id} className={`audit-row kind-${e.kind}`}>
                <div className="audit-when">
                  <time dateTime={e.at}>{at.time}</time>
                  <span className="muted small">{at.date}</span>
                </div>
                <div className="audit-who">
                  <span className={`actor-chip actor-${e.actorType}`}>{TYPE_LABEL[e.actorType]}</span>
                  <Actor e={e} />
                </div>
                <div className="audit-what">
                  <span>{e.summary}</span>
                  <code className="small">{e.action}</code>
                </div>
                <div className="audit-actions">
                  {e.link && (
                    <Link to={e.link} className="small">
                      Buka
                    </Link>
                  )}
                  {e.details && (
                    <button type="button" className="link-button" aria-expanded={open} onClick={() => toggle(e.id)}>
                      {open ? "Tutup" : "Detail"}
                    </button>
                  )}
                </div>
                {open && e.details && <pre className="audit-details">{JSON.stringify(e.details, null, 2)}</pre>}
              </li>
            );
          })}
        </ol>
        {nextBefore !== null && (
          <button type="button" className="secondary load-more" disabled={loading} onClick={() => void load(nextBefore)}>
            {loading ? "Memuat…" : "Muat lebih banyak"}
          </button>
        )}
      </div>
    </section>
  );
}
