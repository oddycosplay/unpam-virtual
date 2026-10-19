import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={onSubmit}>
        <div className="brand">
          <img src="/logo-unpam-192.png" alt="Logo Universitas Pamulang" className="brand-logo large" width={60} height={60} />
          <div>
            <h1>Unpam Virtual</h1>
            <p className="muted">Kampus virtual Prodi Sistem Informasi</p>
          </div>
        </div>
        <label>
          Email
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "Memeriksa…" : "Masuk"}
        </button>
        <footer className="login-license">
          <p>
            © 2026 oddycosplay · Kode sumber berlisensi{" "}
            <a href="https://github.com/oddycosplay/unpam-virtual/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">
              MIT
            </a>
          </p>
          <p>Logo Universitas Pamulang milik Universitas Pamulang, tidak termasuk lisensi MIT.</p>
        </footer>
      </form>
    </main>
  );
}
