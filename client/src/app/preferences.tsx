import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../features/auth/AuthContext";

export type DashPanel = "head" | "agents" | "activity";

export interface Preferences {
  /** "auto": sidebar menjadi rel ikon dan melebar saat diarahkan; "pinned": selalu tampil penuh. */
  sidebar: "auto" | "pinned";
  /** Lebar maksimum isi halaman biasa. */
  pageWidth: "wide" | "normal";
  /** Panel dashboard yang sedang dilipat. */
  collapsed: Record<DashPanel, boolean>;
  /** Kurangi animasi 3D walau sistem tidak memintanya. */
  reduceMotion: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  sidebar: "auto",
  pageWidth: "wide",
  collapsed: { head: false, agents: false, activity: false },
  reduceMotion: false,
};

const storageKey = (userId: number) => `unpam:prefs:${userId}`;

function load(userId: number | undefined): Preferences {
  if (userId === undefined) return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return DEFAULT_PREFERENCES;
    const saved = JSON.parse(raw) as Partial<Preferences>;
    return { ...DEFAULT_PREFERENCES, ...saved, collapsed: { ...DEFAULT_PREFERENCES.collapsed, ...saved.collapsed } };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

interface PreferencesValue {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
  togglePanel: (panel: DashPanel) => void;
  reset: () => void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

/** Preferensi tampilan per akun, disimpan di browser ini (tiap pengguna punya kunci sendiri). */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [prefs, setPrefs] = useState(() => load(userId));

  useEffect(() => {
    setPrefs(load(userId));
  }, [userId]);

  const save = useCallback(
    (next: Preferences) => {
      setPrefs(next);
      if (userId === undefined) return;
      try {
        localStorage.setItem(storageKey(userId), JSON.stringify(next));
      } catch {
        // Penyimpanan diblokir (mode privat): preferensi tetap berlaku sampai halaman ditutup.
      }
    },
    [userId],
  );

  const value = useMemo<PreferencesValue>(
    () => ({
      prefs,
      update: (patch) => save({ ...prefs, ...patch }),
      togglePanel: (panel) => save({ ...prefs, collapsed: { ...prefs.collapsed, [panel]: !prefs.collapsed[panel] } }),
      reset: () => save(DEFAULT_PREFERENCES),
    }),
    [prefs, save],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences harus di dalam PreferencesProvider");
  return value;
}
