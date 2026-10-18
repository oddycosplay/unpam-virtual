import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { SubmissionDetail } from "@unpam/shared";
import { api } from "../../api/http";

export function NewProposalPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ namaKegiatan: "", deskripsi: "", tanggal: "", tempat: "", perkiraanPeserta: "", anggaranMaksimal: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ submission: SubmissionDetail }>("/api/proposals", { method: "POST", body: form });
      navigate(`/pengajuan/${r.submission.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="card narrow">
      <h1>Minta proposal ke Agent HIMA</h1>
      <p className="muted">
        Ceritakan kegiatannya. Agent HIMA akan menyusun draf lengkap mengikuti SOP proposal. Anda bisa menyunting drafnya
        sebelum diajukan ke Kaprodi.
      </p>
      <form onSubmit={onSubmit}>
        <label>
          Nama kegiatan
          <input value={form.namaKegiatan} onChange={set("namaKegiatan")} required minLength={3} maxLength={150} placeholder="Seminar Karier IT 2026" />
        </label>
        <label>
          Deskripsi singkat
          <textarea
            value={form.deskripsi}
            onChange={set("deskripsi")}
            required
            minLength={20}
            maxLength={3000}
            rows={5}
            placeholder="Apa kegiatannya, untuk siapa, siapa pembicaranya, dan apa yang ingin dicapai."
          />
        </label>
        <div className="grid-2">
          <label>
            Tanggal <span className="muted">(opsional)</span>
            <input value={form.tanggal} onChange={set("tanggal")} placeholder="Sabtu, 14 November 2026" />
          </label>
          <label>
            Tempat <span className="muted">(opsional)</span>
            <input value={form.tempat} onChange={set("tempat")} placeholder="Aula Gedung B" />
          </label>
          <label>
            Perkiraan peserta <span className="muted">(opsional)</span>
            <input type="number" min={1} inputMode="numeric" value={form.perkiraanPeserta} onChange={set("perkiraanPeserta")} />
          </label>
          <label>
            Batas anggaran (Rp) <span className="muted">(opsional)</span>
            <input type="number" min={1} inputMode="numeric" value={form.anggaranMaksimal} onChange={set("anggaranMaksimal")} />
          </label>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? "Mengirim ke Agent HIMA…" : "Susun draf"}
        </button>
      </form>
    </section>
  );
}
