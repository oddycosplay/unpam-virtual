import { useEffect, useState, type FormEvent } from "react";
import { ROLES, ROLE_INFO, type AdminUserView, type AppSettingsView, type Role } from "@unpam/shared";
import { api } from "../../api/http";
import { useAuth } from "../auth/AuthContext";
import { UsageBar } from "../../components/ui/UsageBar";

interface Issued {
  email: string;
  password: string;
  reason: "baru" | "reset";
}

export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUserView[] | null>(null);
  const [settings, setSettings] = useState<AppSettingsView | null>(null);
  const [limitDraft, setLimitDraft] = useState("");
  const [form, setForm] = useState({ email: "", name: "", role: "mahasiswa" as Role });
  const [issued, setIssued] = useState<Issued | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [u, s] = await Promise.all([
      api<{ users: AdminUserView[] }>("/api/admin/users"),
      api<{ settings: AppSettingsView }>("/api/admin/settings"),
    ]);
    setUsers(u.users);
    setSettings(s.settings);
    setLimitDraft(String(s.settings.dailyTokenLimit));
  }

  useEffect(() => {
    void load();
  }, []);

  async function run<T>(fn: () => Promise<T>, ok?: string): Promise<T | null> {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fn();
      if (ok) setMessage({ kind: "ok", text: ok });
      await load();
      return r;
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    const r = await run(() => api<{ user: AdminUserView; tempPassword: string }>("/api/admin/users", { method: "POST", body: form }));
    if (r) {
      setIssued({ email: r.user.email, password: r.tempPassword, reason: "baru" });
      setCopied(false);
      setForm({ email: "", name: "", role: form.role });
    }
  }

  const patch = (u: AdminUserView, body: Record<string, unknown>, ok: string) =>
    run(() => api(`/api/admin/users/${u.id}`, { method: "PATCH", body }), ok);

  async function resetPassword(u: AdminUserView) {
    if (!window.confirm(`Reset password ${u.name}? Password lama tidak berlaku lagi dan semua sesinya keluar.`)) return;
    const r = await run(() => api<{ tempPassword: string }>(`/api/admin/users/${u.id}/reset-password`, { method: "POST" }));
    if (r) {
      setIssued({ email: u.email, password: r.tempPassword, reason: "reset" });
      setCopied(false);
    }
  }

  async function saveLimit(e: FormEvent) {
    e.preventDefault();
    await run(() => api("/api/admin/settings", { method: "PUT", body: { dailyTokenLimit: Number(limitDraft) } }), "Batas token global disimpan.");
  }

  async function copy() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="stack">
      <header className="page-head">
        <div>
          <h1>Kelola Akun</h1>
          <p className="muted">Akun, peran, status, dan batas pemakaian AI harian setiap pengguna.</p>
        </div>
      </header>

      {issued && (
        <div className="callout warn temp-password" role="status">
          <p>
            <strong>Password sementara untuk {issued.email}</strong> ({issued.reason === "baru" ? "akun baru" : "setelah reset"}). Hanya ditampilkan
            sekali; sampaikan langsung ke pemiliknya. Mereka akan diminta menggantinya.
          </p>
          <div className="row">
            <code>{issued.password}</code>
            <button type="button" className="secondary small-btn" onClick={() => void copy()}>
              {copied ? "Tersalin" : "Salin"}
            </button>
            <button type="button" className="ghost small-btn" onClick={() => setIssued(null)}>
              Tutup
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className={message.kind === "ok" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      <div className="admin-grid">
        <form className="card" onSubmit={create}>
          <h2>Tambah akun</h2>
          <label>
            Nama
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={100} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label>
            Peran
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_INFO[r].label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy}>
            Buat akun
          </button>
        </form>

        <form className="card" onSubmit={saveLimit}>
          <h2>Batas AI harian (global)</h2>
          <p className="muted small">
            Total token input + output per pengguna per hari. Berlaku untuk pengguna yang tidak punya batas khusus. Kuota direset tiap tengah malam.
          </p>
          <label>
            Token per hari
            <input type="number" min={1} step={1000} value={limitDraft} onChange={(e) => setLimitDraft(e.target.value)} required />
          </label>
          {settings && (
            <p className="muted small">Sumber saat ini: {settings.dailyTokenLimitSource === "setting" ? "panel admin" : "default .env (DAILY_TOKEN_LIMIT)"}</p>
          )}
          <button type="submit" className="secondary" disabled={busy}>
            Simpan batas
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Daftar akun</h2>
        {users === null ? (
          <p className="muted">Memuat…</p>
        ) : (
          <div className="table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Peran</th>
                  <th>Status</th>
                  <th>AI hari ini</th>
                  <th>Batas khusus</th>
                  <th aria-label="Aksi" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const self = u.id === me?.id;
                  return (
                    <tr key={u.id} className={u.isActive ? "" : "inactive-row"}>
                      <td>
                        <strong>{u.name}</strong>
                        {self && <span className="muted small"> (Anda)</span>}
                        <div className="muted small">{u.email}</div>
                        {u.mustChangePassword && <span className="tag warn">password sementara</span>}
                      </td>
                      <td>
                        <select
                          aria-label={`Peran ${u.name}`}
                          value={u.role}
                          disabled={busy || self}
                          onChange={(e) => void patch(u, { role: e.target.value }, `Peran ${u.name} diubah. Sesinya perlu login ulang.`)}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_INFO[r].label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={u.isActive}
                            disabled={busy || self}
                            onChange={(e) =>
                              void patch(u, { isActive: e.target.checked }, `${u.name} ${e.target.checked ? "diaktifkan" : "dinonaktifkan"}.`)
                            }
                          />
                          {u.isActive ? "Aktif" : "Nonaktif"}
                        </label>
                      </td>
                      <td>
                        <UsageBar usage={u.usage} compact />
                      </td>
                      <td>
                        <LimitInput
                          value={u.dailyTokenLimit}
                          disabled={busy}
                          onSave={(v) => void patch(u, { dailyTokenLimit: v }, v === null ? `Batas khusus ${u.name} dihapus.` : `Batas ${u.name} disimpan.`)}
                        />
                      </td>
                      <td>
                        <button type="button" className="ghost small-btn" disabled={busy} onClick={() => void resetPassword(u)}>
                          Reset password
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function LimitInput({ value, disabled, onSave }: { value: number | null; disabled: boolean; onSave: (v: number | null) => void }) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);
  const changed = draft !== (value === null ? "" : String(value));
  return (
    <form
      className="limit-input"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft.trim() === "" ? null : Number(draft));
      }}
    >
      <input
        type="number"
        min={1}
        step={1000}
        placeholder="Global"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label="Batas token khusus"
        disabled={disabled}
      />
      {changed && (
        <button type="submit" className="secondary small-btn" disabled={disabled}>
          Simpan
        </button>
      )}
    </form>
  );
}
