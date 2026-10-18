import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CHAT_MAX_LENGTH, CHAT_RADIUS, ROLE_INFO, SPAWN, hasPermission } from "@unpam/shared";
import { useAuth } from "../auth/AuthContext";
import { useDashboard, useReducedMotion } from "../dashboard/useDashboard";
import { ChatPage } from "../chat/ChatPage";
import { Icon } from "../../components/ui/Icon";
import type { FloorTarget, SelfState } from "../../world/CampusScene";
import { Minimap } from "./Minimap";
import { useCampusSocket } from "./useCampusSocket";

const CampusScene = lazy(() => import("../../world/CampusScene").then((m) => ({ default: m.CampusScene })));

const BUBBLE_MS = 6000;

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="scene-fallback">Kampus 3D tidak bisa dimuat di perangkat ini (WebGL tidak tersedia). Chat jarak dekat tetap bisa dipakai.</p>
    ) : (
      this.props.children
    );
  }
}

const CONNECTION_TEXT = {
  connecting: "Menghubungkan…",
  online: "Terhubung",
  offline: "Terputus, mencoba lagi…",
  full: "Kampus penuh, coba lagi nanti",
  unauthorized: "Sesi berakhir, silakan login ulang",
} as const;

export function CampusPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { summary } = useDashboard();
  const reducedMotion = useReducedMotion();
  const campus = useCampusSocket();
  const selfRef = useRef<SelfState>({ x: SPAWN.x, z: SPAWN.z, rot: Math.PI, moving: false });
  const targetRef = useRef<FloorTarget | null>(null);
  const [placed, setPlaced] = useState(false);
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(Date.now());
  const [nearby, setNearby] = useState(0);
  const [agentPanel, setAgentPanel] = useState(false);
  const chatInput = useRef<HTMLInputElement>(null);
  const logEnd = useRef<HTMLLIElement>(null);
  const fpsEl = useRef<HTMLSpanElement>(null);
  // FPS ditulis langsung ke DOM agar tidak me-render ulang halaman tiap detik.
  const showFps = useCallback((fps: number) => {
    if (!fpsEl.current) return;
    fpsEl.current.textContent = `· ${fps} FPS`;
    fpsEl.current.dataset.low = fps < 30 ? "true" : "false";
  }, []);

  // Posisi awal dari server sebelum scene dibuat.
  useEffect(() => {
    if (campus.spawn && !placed) {
      selfRef.current = { ...selfRef.current, x: campus.spawn.x, z: campus.spawn.z };
      setPlaced(true);
    }
  }, [campus.spawn, placed]);

  // Hitung pemain lain dalam radius chat dan perbarui gelembung tiap detik.
  useEffect(() => {
    const t = window.setInterval(() => {
      setNow(Date.now());
      const s = selfRef.current;
      let n = 0;
      for (const p of campus.playersRef.current.values()) {
        if (p.id !== campus.selfId && Math.hypot(p.x - s.x, p.z - s.z) <= CHAT_RADIUS) n++;
      }
      setNearby(n);
    }, 1000);
    return () => window.clearInterval(t);
  }, [campus.playersRef, campus.selfId]);

  // Kurung kurawal wajib: scrollIntoView di Chrome baru mengembalikan Promise, bukan undefined.
  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "end" });
  }, [campus.messages.length]);

  // Enter memfokuskan kolom chat; Escape menutup panel agent.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.tagName === "INPUT" || (e.target as HTMLElement | null)?.tagName === "TEXTAREA";
      if (e.key === "Enter" && !typing) {
        e.preventDefault();
        chatInput.current?.focus();
      }
      if (e.key === "Escape") {
        if (agentPanel) setAgentPanel(false);
        else if (typing) (e.target as HTMLElement).blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [agentPanel]);

  const bubbles = useMemo(() => {
    const out: Record<string, string> = {};
    for (const m of campus.messages) if (now - new Date(m.at).getTime() < BUBBLE_MS) out[m.fromId] = m.text;
    return out;
  }, [campus.messages, now]);

  const onSelectAgent = useCallback(
    (id: string) => {
      if (!user) return;
      if (id === "akademik" && hasPermission(user.role, "agent:chat")) setAgentPanel(true);
      if (id === "hima" && hasPermission(user.role, "proposal:create")) navigate("/proposal/baru");
    },
    [user, navigate],
  );

  if (!user) return null;

  function send(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    campus.sendChat(text);
    setDraft("");
  }

  const online = campus.connection === "online";

  return (
    <div className="campus">
      <div className="campus-scene">
        <SceneBoundary>
          {placed ? (
            <Suspense fallback={<p className="scene-fallback">Menyiapkan kampus…</p>}>
              <CampusScene
                summary={summary}
                agents={campus.agents}
                self={{ role: user.role, name: user.name }}
                playersRef={campus.playersRef}
                playerIds={campus.playerIds}
                selfId={campus.selfId}
                selfRef={selfRef}
                targetRef={targetRef}
                bubbles={bubbles}
                reducedMotion={reducedMotion}
                onMove={campus.sendMove}
                onSelectAgent={onSelectAgent}
                onFps={showFps}
              />
            </Suspense>
          ) : (
            <p className="scene-fallback">{CONNECTION_TEXT[campus.connection]}</p>
          )}
        </SceneBoundary>
      </div>

      <div className="campus-status hud">
        <span className={`conn conn-${campus.connection}`} aria-hidden />
        <span>{CONNECTION_TEXT[campus.connection]}</span>
        <span className="hud-muted">· {campus.playerIds.length} pemain di kampus</span>
        <span className="hud-muted fps" ref={fpsEl} title="Frame per detik (target PRD: 30+)" />
      </div>

      <div className="campus-help hud">
        <strong>Kontrol</strong>
        <span>WASD / panah: berjalan · klik lantai: menuju titik</span>
        <span>seret: putar kamera · scroll: zoom · Enter: chat</span>
        {hasPermission(user.role, "agent:chat") && <span>Klik Agent Akademik untuk bertanya</span>}
      </div>

      <div className="campus-minimap hud">
        <Minimap
          selfRef={selfRef}
          playersRef={campus.playersRef}
          selfId={campus.selfId}
          agents={campus.agents}
          onPick={(x, z) => (targetRef.current = { x, y: z })}
        />
      </div>

      <section className="campus-chat hud" aria-label="Chat jarak dekat">
        <header>
          <h2>Chat jarak dekat</h2>
          <span className="hud-muted small">
            radius {CHAT_RADIUS} m · {nearby} orang di dekat Anda
          </span>
        </header>
        <ol className="campus-log" aria-live="polite">
          {campus.messages.length === 0 && <li className="hud-muted small">Belum ada percakapan. Dekati pemain lain lalu sapa mereka.</li>}
          {campus.messages.map((m) => (
            <li key={m.id} className={m.fromId === campus.selfId ? "mine" : ""}>
              <span className="dot" style={{ background: ROLE_INFO[m.role].colors[0] }} aria-hidden />
              <strong>{m.fromId === campus.selfId ? "Anda" : m.name}</strong>
              <span className="text">{m.text}</span>
              {m.fromId === campus.selfId && m.heardBy === 0 && <em className="hud-muted small">tidak ada yang mendengar</em>}
            </li>
          ))}
          <li ref={logEnd} aria-hidden className="log-end" />
        </ol>
        {campus.chatError && <p className="hud-error">{campus.chatError}</p>}
        <form onSubmit={send}>
          <input
            ref={chatInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={CHAT_MAX_LENGTH}
            placeholder={online ? "Ketik pesan, Enter untuk kirim" : "Tidak terhubung"}
            aria-label="Pesan untuk pemain di dekat Anda"
            disabled={!online}
          />
          <button type="submit" className="hud-button" disabled={!online || !draft.trim()}>
            Kirim
          </button>
        </form>
        <p className="hud-muted small campus-privacy">Pesan tidak disimpan dan hanya terdengar oleh pemain di dekat Anda.</p>
      </section>

      {agentPanel && (
        <>
          <div className="drawer-backdrop" onClick={() => setAgentPanel(false)} aria-hidden />
          <aside className="agent-drawer" aria-label="Chat Agent Akademik">
            <button type="button" className="icon-button drawer-close" aria-label="Tutup chat agent" onClick={() => setAgentPanel(false)}>
              <Icon name="close" />
            </button>
            <ChatPage />
          </aside>
        </>
      )}
    </div>
  );
}
