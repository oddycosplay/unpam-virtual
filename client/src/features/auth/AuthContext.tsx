import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { PublicUser } from "@unpam/shared";
import { HttpError, api } from "../../api/http";

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    // Hanya 401 berarti belum login. Error jaringan/5xx (mis. server sedang restart) dicoba ulang
    // agar pengguna tidak terlempar ke halaman login.
    const check = (attempt: number) =>
      api<{ user: PublicUser }>("/api/auth/me")
        .then((r) => {
          if (cancelled) return;
          setUser(r.user);
          setLoading(false);
        })
        .catch((e) => {
          if (cancelled) return;
          if ((e instanceof HttpError && e.status === 401) || attempt >= 10) {
            setUser(null);
            setLoading(false);
          } else {
            timer = window.setTimeout(() => void check(attempt + 1), 1500);
          }
        });
    void check(1);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ user: PublicUser }>("/api/auth/login", { method: "POST", body: { email, password } });
    setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}
