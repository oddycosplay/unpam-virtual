import { Link } from "react-router-dom";
import { usePreferences, type DashPanel, type Preferences } from "../../app/preferences";
import { useAuth } from "../auth/AuthContext";

const PANELS: { id: DashPanel; label: string }[] = [
  { id: "head", label: "Pusat Kendali (statistik hari ini)" },
  { id: "agents", label: "Status agent" },
  { id: "activity", label: "Aktivitas terbaru" },
];

function Choice<K extends "sidebar" | "pageWidth">({
  name,
  value,
  options,
  onChange,
}: {
  name: K;
  value: Preferences[K];
  options: { value: Preferences[K]; label: string; hint: string }[];
  onChange: (v: Preferences[K]) => void;
}) {
  return (
    <div className="choices" role="radiogroup">
      {options.map((o) => (
        <label key={o.value} className="choice">
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>
            <strong>{o.label}</strong>
            <span className="muted small">{o.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const { prefs, update, reset } = usePreferences();
  if (!user) return null;

  return (
    <section className="stack settings">
      <header className="page-head">
        <div>
          <h1>Pengaturan</h1>
          <p className="muted">Tampilan untuk akun {user.name}. Disimpan di browser ini dan langsung berlaku.</p>
        </div>
      </header>

      <div className="admin-grid">
        <section className="card" aria-labelledby="set-layout">
          <h2 id="set-layout">Tata letak</h2>
          <h3>Sidebar</h3>
          <Choice
            name="sidebar"
            value={prefs.sidebar}
            onChange={(sidebar) => update({ sidebar })}
            options={[
              { value: "auto", label: "Sembunyi otomatis", hint: "Hanya ikon; melebar saat kursor diarahkan. Layar lebih luas." },
              { value: "pinned", label: "Selalu tampil", hint: "Menu lengkap dengan nama selalu terlihat." },
            ]}
          />
          <h3>Lebar halaman</h3>
          <Choice
            name="pageWidth"
            value={prefs.pageWidth}
            onChange={(pageWidth) => update({ pageWidth })}
            options={[
              { value: "wide", label: "Lebar", hint: "Isi halaman memakai hampir seluruh layar." },
              { value: "normal", label: "Standar", hint: "Isi halaman dibatasi agar baris teks tidak terlalu panjang." },
            ]}
          />
        </section>

        <section className="card" aria-labelledby="set-dash">
          <h2 id="set-dash">Dashboard</h2>
          <p className="muted small">Panel yang tidak dicentang tampil terlipat. Panel juga bisa dilipat langsung dari judulnya di dashboard.</p>
          {PANELS.map((p) => (
            <label key={p.id} className="check">
              <input
                type="checkbox"
                checked={!prefs.collapsed[p.id]}
                onChange={(e) => update({ collapsed: { ...prefs.collapsed, [p.id]: !e.target.checked } })}
              />
              {p.label}
            </label>
          ))}
          <h3>Animasi</h3>
          <label className="check">
            <input type="checkbox" checked={prefs.reduceMotion} onChange={(e) => update({ reduceMotion: e.target.checked })} />
            Kurangi animasi 3D (robot dan layar diam)
          </label>
        </section>

        <section className="card" aria-labelledby="set-account">
          <h2 id="set-account">Akun</h2>
          <p className="muted small">Password dan pemakaian AI harian ada di halaman Akun saya.</p>
          <Link to="/akun" className="button-link">
            Buka Akun saya
          </Link>
          <hr />
          <button type="button" className="ghost" onClick={reset}>
            Kembalikan pengaturan awal
          </button>
        </section>
      </div>
    </section>
  );
}
