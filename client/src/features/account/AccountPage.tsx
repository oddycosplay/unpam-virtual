import { useEffect, useState, type FormEvent } from "react";
import { ROLE_INFO, type PublicUser, type UsageView } from "@unpam/shared";
import { api } from "../../api/http";
import { useAuth } from "../auth/AuthContext";
import { RoleBadge } from "../../components/ui/RoleBadge";
import { UsageBar } from "../../components/ui/UsageBar";

const MIN_LENGTH = 8;

export function AccountPage() {
  const { user, setUser } = useAuth();
  const [usage, setUsage] = useState<UsageView | null>(null);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ usage: UsageView }>("/api/me/usage").then((r) => setUsage(r.usage));
  }, []);

  if (!user) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setMessage({ kind: "error", text: "Konfirmasi password tidak sama" });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const r = await api<{ user: PublicUser }>("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      setUser(r.user);
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      setMessage({ kind: "ok", text: "Password diganti. Sesi di perangkat lain otomatis keluar." });
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack account">
      <header className="page-head">
        <div>
          <h1>Akun saya</h1>
          <p className="muted">
            {user.name} · {user.email}
          </p>
        </div>
        <RoleBadge role={user.role} />
      </header>

      <div className="admin-grid">
        <form className="card" onSubmit={submit}>
          <h2>Ganti password</h2>
          {user.mustChangePassword && (
            <p className="callout warn">Anda masih memakai password sementara dari admin. Ganti sekarang dengan password milik Anda sendiri.</p>
          )}
          <label>
            Password saat ini
            <input
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              required
            />
          </label>
          <label>
            Password baru <span className="muted">(minimal {MIN_LENGTH} karakter)</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={MIN_LENGTH}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              required
            />
          </label>
          <label>
            Ulangi password baru
            <input
              type="password"
              autoComplete="new-password"
              minLength={MIN_LENGTH}
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              required
            />
          </label>
          {message && (
            <p className={message.kind === "ok" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
              {message.text}
            </p>
          )}
          <button type="submit" disabled={busy}>
            {busy ? "Menyimpan…" : "Ganti password"}
          </button>
        </form>

        <section className="card">
          <h2>Pemakaian AI hari ini</h2>
          <p className="muted small">
            Token yang dipakai Agent Akademik dan Agent HIMA atas permintaan Anda. Direset tiap tengah malam.
          </p>
          {usage ? (
            <>
              <UsageBar usage={usage} />
              <dl className="usage-detail">
                <div>
                  <dt>Input</dt>
                  <dd>{usage.input.toLocaleString("id-ID")}</dd>
                </div>
                <div>
                  <dt>Output</dt>
                  <dd>{usage.output.toLocaleString("id-ID")}</dd>
                </div>
                <div>
                  <dt>Batas</dt>
                  <dd>
                    {usage.limit.toLocaleString("id-ID")}
                    <span className="muted small"> ({usage.limitSource === "user" ? "khusus untuk Anda" : "batas umum"})</span>
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="muted">Memuat…</p>
          )}
          <p className="muted small">Peran: {ROLE_INFO[user.role].label}</p>
        </section>
      </div>
    </section>
  );
}
