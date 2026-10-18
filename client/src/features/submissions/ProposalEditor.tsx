import type { BudgetItem, ProposalContent, ScheduleItem } from "@unpam/shared";
import { rupiah } from "../../lib/format";

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

export function budgetTotal(items: BudgetItem[]): number {
  return items.reduce((sum, b) => sum + (Number(b.jumlah) || 0) * (Number(b.hargaSatuan) || 0), 0);
}

/** Tampilan dokumen proposal (baca saja). */
export function ProposalView({ content }: { content: ProposalContent }) {
  return (
    <article className="proposal-doc">
      <h2>{content.judul}</h2>
      <h3>A. Latar Belakang</h3>
      {content.latarBelakang.split(/\n\s*\n/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <h3>B. Tujuan</h3>
      <ol>
        {content.tujuan.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
      <h3>C. Sasaran Peserta</h3>
      <p>{content.sasaran}</p>
      <h3>D. Waktu dan Tempat</h3>
      <p>
        {content.waktu}
        <br />
        {content.tempat}
      </p>
      {content.panitia.length > 0 && (
        <>
          <h3>E. Susunan Panitia</h3>
          <ul>
            {content.panitia.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </>
      )}
      <h3>F. Rencana Kegiatan</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Kegiatan</th>
            </tr>
          </thead>
          <tbody>
            {content.rencanaKegiatan.map((r, i) => (
              <tr key={i}>
                <td>{r.waktu}</td>
                <td>{r.kegiatan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>G. Rencana Anggaran Biaya</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pos</th>
              <th className="num">Jumlah</th>
              <th className="num">Harga satuan</th>
              <th className="num">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {content.anggaran.map((b, i) => (
              <tr key={i}>
                <td>{b.pos}</td>
                <td className="num">
                  {b.jumlah} {b.satuan}
                </td>
                <td className="num">{rupiah(b.hargaSatuan)}</td>
                <td className="num">{rupiah(b.jumlah * b.hargaSatuan)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={3}>Total</th>
              <th className="num">{rupiah(budgetTotal(content.anggaran))}</th>
            </tr>
          </tfoot>
        </table>
      </div>
      <h3>H. Penutup</h3>
      <p>{content.penutup}</p>
    </article>
  );
}

/** Form penyunting proposal. Daftar diketik satu butir per baris. */
export function ProposalEditor({ value, onChange }: { value: ProposalContent; onChange: (v: ProposalContent) => void }) {
  const set = <K extends keyof ProposalContent>(key: K, v: ProposalContent[K]) => onChange({ ...value, [key]: v });

  const setRow = (i: number, patch: Partial<ScheduleItem>) =>
    set("rencanaKegiatan", value.rencanaKegiatan.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setBudget = (i: number, patch: Partial<BudgetItem>) =>
    set("anggaran", value.anggaran.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  return (
    <div className="proposal-form">
      <label>
        Judul
        <input value={value.judul} onChange={(e) => set("judul", e.target.value)} />
      </label>
      <label>
        Latar belakang
        <textarea rows={8} value={value.latarBelakang} onChange={(e) => set("latarBelakang", e.target.value)} />
      </label>
      <label>
        Tujuan <span className="muted">(satu per baris)</span>
        <textarea rows={4} value={value.tujuan.join("\n")} onChange={(e) => set("tujuan", lines(e.target.value))} />
      </label>
      <label>
        Sasaran peserta
        <input value={value.sasaran} onChange={(e) => set("sasaran", e.target.value)} />
      </label>
      <div className="grid-2">
        <label>
          Waktu
          <input value={value.waktu} onChange={(e) => set("waktu", e.target.value)} />
        </label>
        <label>
          Tempat
          <input value={value.tempat} onChange={(e) => set("tempat", e.target.value)} />
        </label>
      </div>
      <label>
        Susunan panitia <span className="muted">(satu per baris)</span>
        <textarea rows={4} value={value.panitia.join("\n")} onChange={(e) => set("panitia", lines(e.target.value))} />
      </label>

      <fieldset>
        <legend>Rencana kegiatan</legend>
        {value.rencanaKegiatan.map((r, i) => (
          <div key={i} className="row-edit">
            <input aria-label={`Waktu baris ${i + 1}`} className="w-time" value={r.waktu} onChange={(e) => setRow(i, { waktu: e.target.value })} />
            <input aria-label={`Kegiatan baris ${i + 1}`} value={r.kegiatan} onChange={(e) => setRow(i, { kegiatan: e.target.value })} />
            <button type="button" className="ghost danger" aria-label={`Hapus baris ${i + 1}`} onClick={() => set("rencanaKegiatan", value.rencanaKegiatan.filter((_, j) => j !== i))}>
              Hapus
            </button>
          </div>
        ))}
        <button type="button" className="secondary small-btn" onClick={() => set("rencanaKegiatan", [...value.rencanaKegiatan, { waktu: "", kegiatan: "" }])}>
          + Tambah baris
        </button>
      </fieldset>

      <fieldset>
        <legend>Rencana anggaran</legend>
        <div className="budget-head muted small" aria-hidden>
          <span>Pos</span>
          <span>Jumlah</span>
          <span>Satuan</span>
          <span>Harga satuan</span>
          <span />
        </div>
        {value.anggaran.map((b, i) => (
          <div key={i} className="row-edit budget-row">
            <input aria-label={`Pos anggaran ${i + 1}`} value={b.pos} onChange={(e) => setBudget(i, { pos: e.target.value })} />
            <input aria-label={`Jumlah ${i + 1}`} type="number" min={0} value={b.jumlah} onChange={(e) => setBudget(i, { jumlah: Number(e.target.value) })} />
            <input aria-label={`Satuan ${i + 1}`} value={b.satuan} onChange={(e) => setBudget(i, { satuan: e.target.value })} />
            <input aria-label={`Harga satuan ${i + 1}`} type="number" min={0} value={b.hargaSatuan} onChange={(e) => setBudget(i, { hargaSatuan: Number(e.target.value) })} />
            <button type="button" className="ghost danger" aria-label={`Hapus pos ${i + 1}`} onClick={() => set("anggaran", value.anggaran.filter((_, j) => j !== i))}>
              Hapus
            </button>
          </div>
        ))}
        <div className="row-between">
          <button type="button" className="secondary small-btn" onClick={() => set("anggaran", [...value.anggaran, { pos: "", jumlah: 1, satuan: "paket", hargaSatuan: 0 }])}>
            + Tambah pos
          </button>
          <strong>Total {rupiah(budgetTotal(value.anggaran))}</strong>
        </div>
      </fieldset>

      <label>
        Penutup
        <textarea rows={3} value={value.penutup} onChange={(e) => set("penutup", e.target.value)} />
      </label>
    </div>
  );
}
