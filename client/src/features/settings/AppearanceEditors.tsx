import { lazy, Suspense, useEffect, useState } from "react";
import {
  ACCESSORIES,
  ACCESSORY_LABEL,
  AGENT_IDS,
  DEFAULT_AGENT_APPEARANCE,
  HAIR_COLORS,
  HAIR_STYLES,
  HAIR_STYLE_LABEL,
  ROBOT_COLORS,
  ROBOT_STYLES,
  ROBOT_STYLE_LABEL,
  SHIRT_COLORS,
  SKIN_TONES,
  defaultAvatar,
  type AgentAppearanceMap,
  type AgentId,
  type AvatarLook,
  type PublicUser,
} from "@unpam/shared";
import { api } from "../../api/http";
import { useAuth } from "../auth/AuthContext";

// Three.js dimuat terpisah; halaman Pengaturan tetap ringan bila pratinjau belum tampil.
const AvatarPreview = lazy(() => import("../../world/AppearancePreview").then((m) => ({ default: m.AvatarPreview })));
const RobotPreview = lazy(() => import("../../world/AppearancePreview").then((m) => ({ default: m.RobotPreview })));

const AGENT_NAMES: Record<AgentId, string> = { orkestrator: "Orkestrator", akademik: "Agent Akademik", hima: "Agent HIMA" };

function Swatches({ label, value, colors, onChange }: { label: string; value: string; colors: string[]; onChange: (c: string) => void }) {
  return (
    <fieldset className="swatches">
      <legend>{label}</legend>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className="swatch"
          style={{ background: c }}
          aria-label={c}
          aria-pressed={value.toLowerCase() === c.toLowerCase()}
          onClick={() => onChange(c)}
        />
      ))}
      <label className="swatch custom" title="Warna lain">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label}: warna lain`} />
      </label>
    </fieldset>
  );
}

function Options<T extends string>({ label, value, options, labels, onChange }: { label: string; value: T; options: readonly T[]; labels: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <fieldset className="option-pills">
      <legend>{label}</legend>
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)}>
          {labels[o]}
        </button>
      ))}
    </fieldset>
  );
}

type Status = { kind: "ok" | "error"; text: string } | null;

export function AvatarEditor() {
  const { user, setUser } = useAuth();
  const [look, setLook] = useState<AvatarLook>(() => user?.avatar ?? defaultAvatar(user?.role ?? "mahasiswa"));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  if (!user) return null;

  const set = (patch: Partial<AvatarLook>) => {
    setLook((l) => ({ ...l, ...patch }));
    setStatus(null);
  };

  async function save(avatar: AvatarLook | null) {
    setBusy(true);
    try {
      const r = await api<{ user: PublicUser }>("/api/me/avatar", { method: "PUT", body: { avatar } });
      setUser(r.user);
      if (!avatar) setLook(defaultAvatar(r.user.role));
      setStatus({ kind: "ok", text: avatar ? "Avatar disimpan. Pengguna lain di kampus langsung melihatnya." : "Avatar kembali ke bawaan peran." });
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card appearance-card" aria-labelledby="set-avatar">
      <h2 id="set-avatar">Avatar saya</h2>
      <p className="muted small">Tampil di Kampus 3D dan dashboard. Garis warna di dada dan cincin di kaki tetap menunjukkan peran Anda.</p>
      <div className="appearance-layout">
        <div className="appearance-stage">
          <Suspense fallback={<div className="appearance-preview" />}>
            <AvatarPreview look={look} role={user.role} />
          </Suspense>
        </div>
        <div className="appearance-controls">
          <Swatches label="Baju" value={look.shirt} colors={SHIRT_COLORS} onChange={(shirt) => set({ shirt })} />
          <Swatches label="Kerah" value={look.accent} colors={SHIRT_COLORS} onChange={(accent) => set({ accent })} />
          <Swatches label="Kulit" value={look.skin} colors={SKIN_TONES} onChange={(skin) => set({ skin })} />
          <Options label="Rambut" value={look.hairStyle} options={HAIR_STYLES} labels={HAIR_STYLE_LABEL} onChange={(hairStyle) => set({ hairStyle })} />
          {look.hairStyle !== "botak" && (
            <Swatches label={look.hairStyle === "hijab" ? "Warna hijab" : "Warna rambut"} value={look.hair} colors={HAIR_COLORS} onChange={(hair) => set({ hair })} />
          )}
          <Options label="Aksesori" value={look.accessory} options={ACCESSORIES} labels={ACCESSORY_LABEL} onChange={(accessory) => set({ accessory })} />
        </div>
      </div>
      {status && (
        <p className={status.kind === "ok" ? "success" : "error"} role={status.kind === "error" ? "alert" : "status"}>
          {status.text}
        </p>
      )}
      <div className="row-actions">
        <button type="button" disabled={busy} onClick={() => void save(look)}>
          {busy ? "Menyimpan…" : "Simpan avatar"}
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={() => void save(null)}>
          Pakai bawaan peran
        </button>
      </div>
    </section>
  );
}

/** Khusus admin: tampilan robot ketiga agent, berlaku untuk semua pengguna. */
export function RobotEditor() {
  const [map, setMap] = useState<AgentAppearanceMap | null>(null);
  const [agent, setAgent] = useState<AgentId>("akademik");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    void api<{ appearance: AgentAppearanceMap }>("/api/agents/appearance")
      .then((r) => setMap(r.appearance))
      .catch(() => setMap(DEFAULT_AGENT_APPEARANCE));
  }, []);

  if (!map) return <section className="card"><p className="muted">Memuat tampilan agent…</p></section>;
  const look = map[agent];
  const set = (patch: Partial<typeof look>) => {
    setMap({ ...map, [agent]: { ...look, ...patch } });
    setStatus(null);
  };

  async function save() {
    setBusy(true);
    try {
      const r = await api<{ appearance: AgentAppearanceMap }>("/api/admin/agent-appearance", { method: "PUT", body: { appearance: map } });
      setMap(r.appearance);
      setStatus({ kind: "ok", text: "Tampilan robot disimpan untuk semua pengguna." });
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card appearance-card" aria-labelledby="set-robot">
      <h2 id="set-robot">Robot agent</h2>
      <p className="muted small">Khusus admin, berlaku untuk semua pengguna. Warna sabuk cahaya tetap menunjukkan status agent.</p>
      <Options label="Agent" value={agent} options={AGENT_IDS} labels={AGENT_NAMES} onChange={setAgent} />
      <div className="appearance-layout">
        <div className="appearance-stage">
          <Suspense fallback={<div className="appearance-preview" />}>
            <RobotPreview look={look} />
          </Suspense>
        </div>
        <div className="appearance-controls">
          <Options label="Bentuk" value={look.style} options={ROBOT_STYLES} labels={ROBOT_STYLE_LABEL} onChange={(style) => set({ style })} />
          <Swatches label="Badan" value={look.body} colors={ROBOT_COLORS} onChange={(body) => set({ body })} />
          <Swatches label="Kaca/visor" value={look.visor} colors={ROBOT_COLORS} onChange={(visor) => set({ visor })} />
        </div>
      </div>
      {status && (
        <p className={status.kind === "ok" ? "success" : "error"} role={status.kind === "error" ? "alert" : "status"}>
          {status.text}
        </p>
      )}
      <div className="row-actions">
        <button type="button" disabled={busy} onClick={() => void save()}>
          {busy ? "Menyimpan…" : "Simpan tampilan robot"}
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={() => set(DEFAULT_AGENT_APPEARANCE[agent])}>
          Bawaan untuk {AGENT_NAMES[agent]}
        </button>
      </div>
    </section>
  );
}
