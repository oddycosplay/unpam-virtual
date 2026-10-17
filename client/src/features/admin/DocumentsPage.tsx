import { useEffect, useState, type FormEvent } from "react";
import type { KnowledgeDocumentView } from "@unpam/shared";
import { api } from "../../api/http";

const SCOPE_LABEL: Record<string, string> = { akademik: "Agent Akademik", hima: "Agent HIMA" };

export function DocumentsPage() {
  const [docs, setDocs] = useState<KnowledgeDocumentView[]>([]);
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("akademik");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [inputKey, setInputKey] = useState(0);

  function load() {
    api<{ documents: KnowledgeDocumentView[] }>("/api/admin/documents").then((r) => setDocs(r.documents));
  }
  useEffect(load, []);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const form = new FormData();
    // Field teks harus dikirim sebelum file agar terbaca server.
    form.append("title", title);
    form.append("agentScope", scope);
    form.append("file", file);
    setBusy(true);
    setMessage(null);
    try {
      const r = await api<{ document: KnowledgeDocumentView }>("/api/admin/documents", { method: "POST", body: form });
      setMessage({ kind: "ok", text: `"${r.document.title}" diindeks menjadi ${r.document.chunkCount} potongan.` });
      setTitle("");
      setFile(null);
      setInputKey((k) => k + 1);
      load();
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(doc: KnowledgeDocumentView) {
    if (!window.confirm(`Hapus "${doc.title}"? Agent tidak akan bisa memakainya lagi.`)) return;
    await api(`/api/admin/documents/${doc.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="stack">
      <section className="card narrow">
        <h2>Unggah dokumen</h2>
        <p className="muted">Panduan akademik, SOP, atau kalender. Format .pdf, .md, atau .txt, maksimal 10 MB.</p>
        <form onSubmit={onUpload}>
          <label>
            Judul
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kosongkan untuk memakai nama file" />
          </label>
          <label>
            Dipakai oleh
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="akademik">Agent Akademik</option>
              <option value="hima">Agent HIMA</option>
            </select>
          </label>
          <label>
            File
            <input
              key={inputKey}
              type="file"
              accept=".pdf,.md,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </label>
          {message && <p className={message.kind === "ok" ? "success" : "error"}>{message.text}</p>}
          <button type="submit" disabled={busy || !file}>
            {busy ? "Mengindeks…" : "Unggah"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Basis pengetahuan</h2>
        {docs.length === 0 ? (
          <p className="muted">Belum ada dokumen.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Judul</th>
                  <th>Agent</th>
                  <th>Potongan</th>
                  <th>Diunggah</th>
                  <th aria-label="Aksi" />
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td>
                      {d.title}
                      <div className="muted small">{d.fileName}</div>
                    </td>
                    <td>{SCOPE_LABEL[d.agentScope] ?? d.agentScope}</td>
                    <td>{d.chunkCount}</td>
                    <td>{new Date(d.createdAt.replace(" ", "T") + "Z").toLocaleDateString("id-ID")}</td>
                    <td>
                      <button className="ghost danger" onClick={() => void onDelete(d)}>
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
