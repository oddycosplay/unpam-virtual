import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  AgentStatusView,
  AvatarLook,
  ClientToServerEvents,
  PlayerState,
  ProximityMessage,
  ServerToClientEvents,
} from "@unpam/shared";

type CampusSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ConnectionState = "connecting" | "online" | "offline" | "full" | "unauthorized";

const MAX_MESSAGES = 60;

/** Koneksi Socket.IO ke kampus. Posisi pemain lain disimpan di ref agar tidak memicu render 10×/detik. */
export function useCampusSocket() {
  const socketRef = useRef<CampusSocket | null>(null);
  const playersRef = useRef<Map<string, PlayerState>>(new Map());
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  // Avatar per pemain sebagai state (bukan ref) agar avatar yang diganti langsung digambar ulang.
  const [avatars, setAvatars] = useState<Record<string, AvatarLook | null>>({});
  const avatarKey = useRef("");
  const [selfId, setSelfId] = useState<string | null>(null);
  const [spawn, setSpawn] = useState<{ x: number; z: number } | null>(null);
  const [agents, setAgents] = useState<AgentStatusView[]>([]);
  const [messages, setMessages] = useState<ProximityMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");

  useEffect(() => {
    const socket: CampusSocket = io({ path: "/socket.io", withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => setConnection("online"));
    socket.on("disconnect", () => setConnection("offline"));
    socket.on("connect_error", (err) => {
      if (err.message === "unauthorized") setConnection("unauthorized");
      else if (err.message === "full") setConnection("full");
      else setConnection("offline");
    });
    socket.on("welcome", (w) => {
      setSelfId(w.id);
      setSpawn(w.spawn);
    });
    socket.on("snapshot", (s) => {
      const map = new Map(s.players.map((p) => [p.id, p]));
      playersRef.current = map;
      const key = s.players.map((p) => `${p.id}:${JSON.stringify(p.avatar)}`).join("|");
      if (key !== avatarKey.current) {
        avatarKey.current = key;
        setAvatars(Object.fromEntries(s.players.map((p) => [p.id, p.avatar])));
      }
      setPlayerIds((prev) => {
        const next = [...map.keys()].sort();
        return prev.length === next.length && prev.every((id, i) => id === next[i]) ? prev : next;
      });
    });
    socket.on("agents", setAgents);
    socket.on("chat:message", (m) => setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), m]));
    socket.on("chat:error", (e) => {
      setChatError(e.error);
      window.setTimeout(() => setChatError(null), 2500);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const sendMove = useCallback((p: { x: number; z: number; rot: number; moving: boolean }) => {
    socketRef.current?.emit("move", p);
  }, []);

  const sendChat = useCallback((text: string) => {
    socketRef.current?.emit("chat:send", text);
  }, []);

  return { playersRef, playerIds, avatars, selfId, spawn, agents, messages, chatError, connection, sendMove, sendChat };
}
