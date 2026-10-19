import { useEffect, useMemo, useState, type FormEvent } from "react";
import { hasPermission, type OrganizationKind, type OrganizationView } from "@unpam/shared";
import { api } from "../../api/http";
import { useAuth } from "../auth/AuthContext";

const SECTION: Record<OrganizationKind, { title: string; emoji: string; note: string }> = {
  hima: { title: "Himpunan Mahasiswa (HIMA)", emoji: "🎓", note: "Organisasi mahasiswa tingkat program studi." },
  ukm: { title: "Unit Kegiatan Mahasiswa (UKM)", emoji: "🤸", note: "Minat dan bakat tingkat universitas, terbuka untuk semua prodi." },
};
const LINK_LABEL = { instagram: "Instagram", kegiatan: "Lihat kegiatan" } as const;
const OWN_HIMA = "Sistem Informasi S-1";

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
}

function LinkEditor({ org, onSaved }: { org: OrganizationView; onSaved: (o: OrganizationView) => void }) {
  const [draft, setDraft] = useState(org.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const changed = draft.trim() !== (org.url ?? "");

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ organization: OrganizationView }>(`/api/admin/organizations/${org.id}`, {
        method: "PATCH",
        body: { url: draft.trim() === "" ? null : draft.trim() },
      });
      onSaved(r.organization);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="org-link-editor" onSubmit={save}>
      <input
        type="url"
        inputMode="url"
        placeholder={`https://… (${LINK_LABEL[org.linkType]})`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label={`Tautan ${LINK_LABEL[org.linkType]} ${org.name}`}
      />
      {changed && (
        <button type="submit" className="secondary small-btn" disabled={busy}>
          Simpan
        </button>
      )}
      {error && <span className="error small">{error}</span>}
    </form>
  );
}

/** Direktori HIMA dan UKM. Dipakai di halaman Organisasi dan laci Pusat Kegiatan Mahasiswa di kampus 3D. */
export function OrganizationDirectory({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<OrganizationView[] | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const canEdit = user ? hasPermission(user.role, "admin:documents") : false;

  useEffect(() => {
    void api<{ organizations: OrganizationView[] }>("/api/organizations").then((r) => setOrgs(r.organizations));
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return (orgs ?? []).filter((o) => !q || normalize(o.name).includes(q) || normalize(o.kind).includes(q));
  }, [orgs, query]);

  const replace = (o: OrganizationView) => setOrgs((prev) => prev?.map((p) => (p.id === o.id ? o : p)) ?? null);
  const missing = (orgs ?? []).filter((o) => !o.url).length;

  return (
    <div className={compact ? "org-directory compact" : "org-directory"}>
      <div className="org-toolbar">
        <label className="grow">
          <span className="sr-only">Cari organisasi</span>
          <input type="search" placeholder="Cari HIMA atau UKM, mis. Informatika, basket…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {canEdit && (
          <label className="switch">
            <input type="checkbox" checked={editing} onChange={(e) => setEditing(e.target.checked)} />
            Kelola tautan
          </label>
        )}
      </div>
      {canEdit && missing > 0 && !compact && (
        <p className="muted small">{missing} organisasi belum punya tautan. Aktifkan "Kelola tautan" untuk mengisinya.</p>
      )}

      {orgs === null ? (
        <p className="muted">Memuat…</p>
      ) : (
        (["hima", "ukm"] as OrganizationKind[]).map((kind) => {
          const items = filtered.filter((o) => o.kind === kind);
          return (
            <section key={kind} className="org-section" aria-label={SECTION[kind].title}>
              <header>
                <h2>
                  <span aria-hidden>{SECTION[kind].emoji}</span> {SECTION[kind].title}
                </h2>
                <span className="muted small">
                  {items.length} dari {orgs.filter((o) => o.kind === kind).length} · {SECTION[kind].note}
                </span>
              </header>
              {items.length === 0 ? (
                <p className="muted small">Tidak ada yang cocok.</p>
              ) : (
                <ol className="org-list">
                  {items.map((o) => {
                    const own = kind === "hima" && o.name === OWN_HIMA;
                    return (
                      <li key={o.id} className={own ? "own" : ""}>
                        <span className="org-number">{o.number}</span>
                        <span className="org-body">
                          <span className="org-name">
                            {kind === "hima" ? `HIMA ${o.name}` : o.name}
                            {own && <span className="tag own-tag">Prodi kita</span>}
                          </span>
                          {editing && canEdit ? (
                            <LinkEditor org={o} onSaved={replace} />
                          ) : o.url ? (
                            <a className="org-link" href={o.url} target="_blank" rel="noopener noreferrer">
                              {LINK_LABEL[o.linkType]} ↗
                            </a>
                          ) : (
                            <span className="org-link missing" title="Tautan belum diisi admin">
                              {LINK_LABEL[o.linkType]}: belum ada tautan
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
