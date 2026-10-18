import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ROLE_INFO, type Decision, type ProposalContent, type SubmissionDetail } from "@unpam/shared";
import { api } from "../../api/http";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDateTime } from "../../lib/format";
import { ProposalEditor, ProposalView } from "./ProposalEditor";

const DECISION_LABEL: Record<Decision, string> = { disetujui: "Disetujui", ditolak: "Ditolak", revisi: "Minta revisi" };

export function SubmissionPage() {
  const { id } = useParams();
  const [sub, setSub] = useState<SubmissionDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [draft, setDraft] = useState<ProposalContent | null>(null);
  const [dirty, setDirty] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [decision, setDecision] = useState<Decision>("disetujui");
  const [decisionNote, setDecisionNote] = useState("");
  const [comment, setComment] = useState("");

  const apply = useCallback((s: SubmissionDetail) => {
    setSub(s);
    setDraft(s.content);
    setDirty(false);
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api<{ submission: SubmissionDetail }>(`/api/submissions/${id}`);
      apply(r.submission);
    } catch {
      setNotFound(true);
    }
  }, [id, apply]);

  useEffect(() => {
    void load();
  }, [load]);

  // Selama agent menyusun, periksa ulang tiap 4 detik.
  useEffect(() => {
    if (sub?.status !== "menyusun") return;
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [sub?.status, load]);

  async function act(fn: () => Promise<{ submission: SubmissionDetail }>, ok: string) {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fn();
      apply(r.submission);
      setMessage({ kind: "ok", text: ok });
      return true;
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    act(
      () => api(`/api/submissions/${id}`, { method: "PUT", body: { content: draft, note: note || undefined } }),
      "Perubahan disimpan sebagai versi baru.",
    ).then((ok) => ok && setNote(""));

  async function submit() {
    if (dirty && !(await save())) return;
    if (!window.confirm("Ajukan proposal ini ke Kaprodi? Selama menunggu keputusan, proposal tidak bisa disunting.")) return;
    await act(() => api(`/api/submissions/${id}/submit`, { method: "POST" }), "Proposal diajukan. Kaprodi sudah diberi notifikasi.");
  }

  async function decide(e: FormEvent) {
    e.preventDefault();
    if (!window.confirm(`Kirim keputusan "${DECISION_LABEL[decision]}"? Pemohon akan diberi notifikasi.`)) return;
    const ok = await act(
      () => api(`/api/submissions/${id}/decision`, { method: "POST", body: { decision, note: decisionNote || undefined } }),
      "Keputusan tersimpan dan pemohon sudah diberi notifikasi.",
    );
    if (ok) setDecisionNote("");
  }

  async function sendComment(e: FormEvent) {
    e.preventDefault();
    const ok = await act(() => api(`/api/submissions/${id}/comments`, { method: "POST", body: { body: comment } }), "Masukan terkirim.");
    if (ok) setComment("");
  }

  if (notFound) return <p className="center muted">Pengajuan tidak ditemukan atau Anda tidak punya akses.</p>;
  if (!sub) return <p className="center muted">Memuat…</p>;

  const lastDecision = sub.approvals.at(-1);

  return (
    <div className="submission">
      <header className="page-head">
        <div>
          <p className="muted small">
            <Link to="/hasil-kerja">Hasil Kerja</Link> / Pengajuan #{sub.id}
          </p>
          <h1>{sub.title}</h1>
          <p className="muted small">
            <StatusBadge status={sub.status} /> · {sub.owner.name} · versi {sub.version || "–"}
            {sub.submittedAt && ` · diajukan ${formatDateTime(sub.submittedAt)}`}
          </p>
        </div>
      </header>

      {sub.status === "menyusun" && (
        <div className="callout working" role="status">
          <span className="spinner" aria-hidden /> Agent HIMA sedang menyusun draf dari ringkasan Anda. Biasanya kurang dari satu menit; halaman ini
          diperbarui otomatis.
        </div>
      )}
      {sub.status === "gagal" && (
        <div className="callout bad" role="alert">
          <p>
            <strong>Agent HIMA gagal menyusun draf.</strong> {sub.error}
          </p>
          {sub.can.retry && (
            <button type="button" disabled={busy} onClick={() => void act(() => api(`/api/submissions/${id}/retry`, { method: "POST" }), "Agent HIMA mencoba lagi.")}>
              Coba lagi
            </button>
          )}
        </div>
      )}
      {sub.status === "revisi" && lastDecision?.note && (
        <div className="callout warn">
          <strong>Catatan revisi dari {lastDecision.decider}:</strong> {lastDecision.note}
        </div>
      )}
      {sub.status === "draft" && sub.versions.length === 1 && sub.versions[0]?.byAgent && (
        <div className="callout">Ini draf dari Agent HIMA. Periksa, lengkapi bagian bertanda [isi …], lalu ajukan ke Kaprodi.</div>
      )}
      {message && (
        <p className={message.kind === "ok" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      <div className="submission-grid">
        <section className="card">
          {draft && sub.can.edit ? (
            <>
              <ProposalEditor
                value={draft}
                onChange={(v) => {
                  setDraft(v);
                  setDirty(true);
                }}
              />
              <div className="action-bar">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan perubahan (opsional)" aria-label="Catatan perubahan" maxLength={300} />
                <button type="button" className="secondary" disabled={busy || !dirty} onClick={() => void save()}>
                  Simpan draf
                </button>
                {sub.can.submit && (
                  <button type="button" disabled={busy} onClick={() => void submit()}>
                    Ajukan ke Kaprodi
                  </button>
                )}
              </div>
            </>
          ) : sub.content ? (
            <ProposalView content={sub.content} />
          ) : (
            <p className="muted">Belum ada isi proposal.</p>
          )}
        </section>

        <aside className="stack">
          {sub.can.decide && (
            <form className="card decision" onSubmit={decide}>
              <h2>Keputusan Kaprodi</h2>
              <div className="segmented" role="radiogroup" aria-label="Keputusan">
                {(Object.keys(DECISION_LABEL) as Decision[]).map((d) => (
                  <label key={d} className={decision === d ? `active d-${d}` : ""}>
                    <input type="radio" name="decision" value={d} checked={decision === d} onChange={() => setDecision(d)} />
                    {DECISION_LABEL[d]}
                  </label>
                ))}
              </div>
              <label>
                Catatan {decision === "disetujui" ? <span className="muted">(opsional)</span> : <span className="muted">(wajib)</span>}
                <textarea rows={3} value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} required={decision !== "disetujui"} minLength={decision === "disetujui" ? 0 : 5} />
              </label>
              <button type="submit" disabled={busy}>
                Kirim keputusan
              </button>
            </form>
          )}

          <section className="card">
            <h2>Riwayat</h2>
            <ol className="timeline">
              {[
                ...sub.versions.map((v) => ({
                  at: v.createdAt,
                  key: `v${v.version}`,
                  text: `Versi ${v.version} oleh ${v.author}`,
                  sub: v.note,
                  tone: v.byAgent ? "agent" : "user",
                })),
                ...sub.approvals.map((a, i) => ({
                  at: a.createdAt,
                  key: `a${i}`,
                  text: `${DECISION_LABEL[a.decision]} oleh ${a.decider} (versi ${a.version})`,
                  sub: a.note,
                  tone: a.decision,
                })),
              ]
                .sort((x, y) => x.at.localeCompare(y.at))
                .map((e) => (
                  <li key={e.key} className={`tl-${e.tone}`}>
                    <strong>{e.text}</strong>
                    {e.sub && <span>{e.sub}</span>}
                    <time>{formatDateTime(e.at)}</time>
                  </li>
                ))}
              {sub.versions.length === 0 && <li className="muted small">Belum ada versi.</li>}
            </ol>
          </section>

          {(sub.comments.length > 0 || sub.can.comment) && (
            <section className="card">
              <h2>Masukan</h2>
              <ul className="comments">
                {sub.comments.map((c) => (
                  <li key={c.id}>
                    <strong>
                      {c.author} <span className="muted small">· {ROLE_INFO[c.role].label}</span>
                    </strong>
                    <p>{c.body}</p>
                    <time className="muted small">{formatDateTime(c.createdAt)}</time>
                  </li>
                ))}
                {sub.comments.length === 0 && <li className="muted small">Belum ada masukan.</li>}
              </ul>
              {sub.can.comment && (
                <form onSubmit={sendComment}>
                  <label>
                    <span className="sr-only">Tulis masukan</span>
                    <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tulis masukan…" required maxLength={2000} />
                  </label>
                  <button type="submit" className="secondary" disabled={busy || !comment.trim()}>
                    Kirim masukan
                  </button>
                </form>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
