import { lazy, Suspense, useState } from "react";
import { FACULTIES, PRODI_LIST, UKM_LIST } from "@unpam/shared";
import { SceneBoundary } from "../dashboard/DashboardPage";
import { UNITS, WINGS, type SelectionId } from "../../world/concept/plan";

const ConceptScene = lazy(() =>
  import("../../world/concept/ConceptScene").then((m) => ({
    default: m.ConceptScene,
  })),
);

const BUILDINGS: { id: SelectionId; label: string; accent: string }[] = [
  { id: "rektorat", label: "Gedung Rektorat", accent: "#f5c400" },
  { id: "lka", label: "LKA", accent: "#f5c400" },
  { id: "lsp", label: "LSP", accent: "#f5c400" },
  ...WINGS.map((w) => ({
    id: `fakultas:${w.faculty.id}` as SelectionId,
    label: w.faculty.short,
    accent: w.faculty.accent,
  })),
  { id: "ukm", label: "Student Center", accent: "#ff8c42" },
];

/** Alur yang sama untuk setiap prodi; hanya nama prodi yang berbeda. */
function OrchestratorFlow({ prodi }: { prodi: string }) {
  const steps = [
    {
      who: "Mahasiswa · Dosen · Pengurus HIMA",
      what: "mengirim pertanyaan atau tugas",
    },
    {
      who: `Orkestrator ${prodi}`,
      what: "membaca maksud, memilih agent, mencatat log audit",
      hub: true,
    },
    {
      who: `Agent Akademik ${prodi}`,
      what: "menjawab dari dokumen prodi",
      branch: `Agent HIMA ${prodi}`,
      branchWhat: "menyusun proposal kegiatan",
    },
    {
      who: `Kaprodi ${prodi}`,
      what: "meninjau, menyetujui, atau meminta revisi",
    },
  ];
  return (
    <ol className="concept-flow" aria-label={`Alur orkestrator ${prodi}`}>
      {steps.map((s) => (
        <li key={s.who} className={s.hub ? "hub" : undefined}>
          {s.branch ? (
            <div className="concept-flow-branch">
              <div>
                <strong>{s.who}</strong>
                <span>{s.what}</span>
              </div>
              <div>
                <strong>{s.branch}</strong>
                <span>{s.branchWhat}</span>
              </div>
            </div>
          ) : (
            <div>
              <strong>{s.who}</strong>
              <span>{s.what}</span>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function Details({
  selected,
  prodiNumber,
  onProdi,
}: {
  selected: SelectionId;
  prodiNumber: number | null;
  onProdi: (n: number | null) => void;
}) {
  if (selected === "ukm") {
    return (
      <>
        <h2>Student Center</h2>
        <p className="hud-muted">Satu ruang untuk tiap Unit Kegiatan Mahasiswa, terbuka bagi semua prodi.</p>
        <ul className="concept-rooms columns">
          {UKM_LIST.map((n) => (
            <li key={n}>{n.replace(/^UKM /, "")}</li>
          ))}
        </ul>
      </>
    );
  }
  if (selected === "rektorat" || selected === "lka" || selected === "lsp") {
    const u = UNITS[selected];
    return (
      <>
        <h2>{u.name}</h2>
        {"fullName" in u && <p className="hud-muted">{u.fullName}</p>}
        <ul className="concept-rooms">
          {u.rooms.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </>
    );
  }
  const faculty = FACULTIES.find((f) => `fakultas:${f.id}` === selected)!;
  const prodi = PRODI_LIST.filter((p) => p.facultyId === faculty.id);
  const active = prodi.find((p) => p.number === prodiNumber) ?? null;
  return (
    <>
      <h2>{faculty.name}</h2>
      <p className="hud-muted">Tiap prodi punya ruang prodi, ruang HIMA, dan orkestrator sendiri. Pilih prodi untuk melihat alurnya.</p>
      <ul className="concept-prodi">
        {prodi.map((p) => (
          <li key={p.number}>
            <button
              type="button"
              aria-pressed={active?.number === p.number}
              onClick={() => onProdi(active?.number === p.number ? null : p.number)}
            >
              {p.name}
            </button>
          </li>
        ))}
      </ul>
      {active && (
        <>
          <h3>Ruangan {active.name}</h3>
          <ul className="concept-rooms">
            <li>Ruang Prodi (Kaprodi &amp; dosen)</li>
            <li>Ruang HIMA {active.name}</li>
            <li>Hub Orkestrator</li>
          </ul>
          <h3>Alur orkestrator</h3>
          <OrchestratorFlow prodi={active.name} />
        </>
      )}
    </>
  );
}

export function ConceptPage() {
  const [selected, setSelected] = useState<SelectionId | null>(null);
  const [prodiNumber, setProdiNumber] = useState<number | null>(null);

  const select = (id: SelectionId | null) => {
    setSelected(id);
    setProdiNumber(null);
  };
  const selectProdi = (n: number) => {
    const p = PRODI_LIST.find((x) => x.number === n);
    if (!p) return;
    setSelected(`fakultas:${p.facultyId}`);
    setProdiNumber(n);
  };

  return (
    <div className="concept">
      <div className="concept-scene">
        <SceneBoundary>
          <Suspense fallback={<p className="scene-fallback">Menyiapkan denah kampus…</p>}>
            <ConceptScene selected={selected} onSelect={select} onSelectProdi={selectProdi} />
          </Suspense>
        </SceneBoundary>
        <p className="dash-hint">Klik gedung untuk fokus · seret untuk memutar · klik kanan untuk menggeser · gulir untuk zoom</p>
      </div>

      <section className="hud concept-head" aria-labelledby="concept-title">
        <p className="eyebrow">Konsep · belum terhubung ke data</p>
        <h1 id="concept-title">Kampus Multi-Prodi</h1>
        <p className="hud-muted">
          {PRODI_LIST.length} prodi dalam {FACULTIES.length} fakultas, {UKM_LIST.length} UKM, serta Rektorat, LKA, dan LSP.
        </p>
        <ul className="concept-legend">
          <li>
            <i style={{ background: "#58a6ff" }} /> Ruang prodi
          </li>
          <li>
            <i style={{ background: "#c8102e" }} /> Ruang HIMA
          </li>
          <li>
            <i style={{ background: "#2ee6d6" }} /> Orkestrator prodi
          </li>
        </ul>
        <div className="concept-buildings" role="group" aria-label="Pilih gedung">
          {BUILDINGS.map((b) => (
            <button
              key={b.id}
              type="button"
              aria-pressed={selected === b.id}
              style={{ borderColor: selected === b.id ? b.accent : undefined }}
              onClick={() => select(selected === b.id ? null : b.id)}
            >
              <i style={{ background: b.accent }} />
              {b.label}
            </button>
          ))}
        </div>
        <p className="concept-note">Pengelompokan prodi ke fakultas bersifat umum dan dapat dikoreksi.</p>
      </section>

      {selected && (
        <aside className="hud concept-detail" aria-live="polite">
          <button type="button" className="concept-close" aria-label="Tutup detail" onClick={() => select(null)}>
            ×
          </button>
          <Details selected={selected} prodiNumber={prodiNumber} onProdi={setProdiNumber} />
        </aside>
      )}
    </div>
  );
}
