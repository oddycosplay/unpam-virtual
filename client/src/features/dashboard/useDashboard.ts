import { useEffect, useState } from "react";
import type { DashboardSummary } from "@unpam/shared";
import { api } from "../../api/http";
import { usePreferences } from "../../app/preferences";

const POLL_MS = 5000;

export const EMPTY_SUMMARY: DashboardSummary = {
  agents: [
    { id: "orkestrator", name: "Orkestrator", status: "idle", activity: "Memuat…", active: true },
    { id: "akademik", name: "Agent Akademik", status: "idle", activity: "Memuat…", active: true },
    { id: "hima", name: "Agent HIMA", status: "idle", activity: "Memuat…", active: true },
  ],
  stats: {
    questionsToday: 0,
    answersToday: 0,
    errorsToday: 0,
    avgLatencyMs: null,
    documents: 0,
    chunks: 0,
    users: 0,
    pendingApprovals: 0,
    decidedToday: 0,
    tasks: { baru: 0, diproses: 0, menunggu_persetujuan: 0, selesai: 0 },
    organizations: { hima: 0, ukm: 0 },
  },
  answersPerHour: new Array(12).fill(0),
  recentActivity: [],
};

/** Ringkasan dashboard, diperbarui tiap 5 detik selama tab terlihat. */
export function useDashboard() {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function tick() {
      if (document.visibilityState === "visible") {
        try {
          const s = await api<DashboardSummary>("/api/dashboard");
          if (!cancelled) {
            setSummary(s);
            setError(null);
            setLoaded(true);
          }
        } catch (e) {
          if (!cancelled) setError((e as Error).message);
        }
      }
      if (!cancelled) timer = window.setTimeout(tick, POLL_MS);
    }
    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return { summary, error, loaded };
}

/** Animasi dikurangi bila sistem memintanya atau pengguna memilihnya di Pengaturan. */
export function useReducedMotion(): boolean {
  const { prefs } = usePreferences();
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced || prefs.reduceMotion;
}
