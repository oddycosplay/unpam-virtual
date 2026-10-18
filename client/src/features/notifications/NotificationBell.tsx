import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { NotificationView } from "@unpam/shared";
import { api } from "../../api/http";
import { timeAgo } from "../../lib/format";

const POLL_MS = 15_000;

export function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ notifications: NotificationView[]; unread: number }>("/api/notifications");
      setItems(r.notifications);
      setUnread(r.unread);
    } catch {
      // Abaikan; dicoba lagi pada siklus berikutnya.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function openItem(n: NotificationView) {
    if (!n.read) await api(`/api/notifications/${n.id}/read`, { method: "POST" });
    setOpen(false);
    void load();
    if (n.link) navigate(n.link);
  }

  async function readAll() {
    await api("/api/notifications/read-all", { method: "POST" });
    void load();
  }

  return (
    <div className="bell" ref={root}>
      <button
        type="button"
        className="bell-button"
        aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          void load();
        }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path
            d="M12 3a6 6 0 0 0-6 6v3.6L4.3 15.3A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .9-1.7L18 12.6V9a6 6 0 0 0-6-6Zm0 18a2.5 2.5 0 0 0 2.4-2h-4.8A2.5 2.5 0 0 0 12 21Z"
            fill="currentColor"
          />
        </svg>
        {unread > 0 && <span className="bell-count">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifikasi">
          <header>
            <strong>Notifikasi</strong>
            {unread > 0 && (
              <button type="button" className="link-button" onClick={() => void readAll()}>
                Tandai semua dibaca
              </button>
            )}
          </header>
          {items.length === 0 ? (
            <p className="muted small bell-empty">Belum ada notifikasi.</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" className={n.read ? "" : "unread"} onClick={() => void openItem(n)}>
                    <strong>{n.title}</strong>
                    <span>{n.body}</span>
                    <time>{timeAgo(n.createdAt)}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
