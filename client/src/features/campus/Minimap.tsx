import { useEffect, useRef, type MutableRefObject } from "react";
import type { AgentStatusView, PlayerState } from "@unpam/shared";
import { CHAT_RADIUS } from "@unpam/shared";
import { EDGES, NODES, STATUS_COLOR, ZONES, targetNode } from "../../world/layout";
import type { SelfState } from "../../world/CampusScene";

const W = 24;
const D = 22;
const SIZE = 184;
const SCALE = SIZE / W;
const HEIGHT = Math.round(D * SCALE);

const toPx = (x: number, z: number): [number, number] => [(x + W / 2) * SCALE, (z + D / 2) * SCALE];

/** Peta mini 2D (utara di atas). Klik untuk berjalan ke titik itu. */
export function Minimap({
  selfRef,
  playersRef,
  selfId,
  agents,
  onPick,
}: {
  selfRef: MutableRefObject<SelfState>;
  playersRef: MutableRefObject<Map<string, PlayerState>>;
  selfId: string | null;
  agents: AgentStatusView[];
  onPick: (x: number, z: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = SIZE * dpr;
    c.height = HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 100) return; // 10 fps cukup untuk peta mini
      last = t;
      ctx.clearRect(0, 0, SIZE, HEIGHT);
      ctx.fillStyle = "rgba(10, 18, 26, 0.92)";
      ctx.fillRect(0, 0, SIZE, HEIGHT);

      for (const z of ZONES) {
        const [x, y] = toPx(z.center[0] - z.size[0] / 2, z.center[1] - z.size[1] / 2);
        ctx.fillStyle = `${z.accent}33`;
        ctx.strokeStyle = `${z.accent}aa`;
        ctx.lineWidth = 1;
        ctx.fillRect(x, y, z.size[0] * SCALE, z.size[1] * SCALE);
        ctx.strokeRect(x, y, z.size[0] * SCALE, z.size[1] * SCALE);
      }
      ctx.strokeStyle = "rgba(46, 230, 214, 0.55)";
      ctx.lineWidth = 2;
      for (const [a, b] of EDGES) {
        const [x1, y1] = toPx(...NODES[a]);
        const [x2, y2] = toPx(...NODES[b]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Agent: belah ketupat warna status.
      agentsRef.current.forEach((a, i) => {
        const [nx, nz] = NODES[targetNode(a)];
        const [x, y] = toPx(nx + i * 0.25, nz);
        ctx.fillStyle = STATUS_COLOR[a.status];
        ctx.beginPath();
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x + 4, y);
        ctx.lineTo(x, y + 4);
        ctx.lineTo(x - 4, y);
        ctx.fill();
      });

      // Radius chat di sekitar diri sendiri.
      const s = selfRef.current;
      const [sx, sy] = toPx(s.x, s.z);
      ctx.strokeStyle = "rgba(245, 196, 0, 0.35)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(sx, sy, CHAT_RADIUS * SCALE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const p of playersRef.current.values()) {
        if (p.id === selfId) continue;
        const [x, y] = toPx(p.x, p.z);
        ctx.fillStyle = "#58a6ff";
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Diri sendiri: segitiga kuning searah hadap.
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-s.rot + Math.PI);
      ctx.fillStyle = "#f5c400";
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4.5, 4.5);
      ctx.lineTo(-4.5, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [selfRef, playersRef, selfId]);

  return (
    <canvas
      ref={canvas}
      className="minimap"
      style={{ width: SIZE, height: HEIGHT }}
      role="img"
      aria-label="Peta mini kampus. Klik untuk berjalan ke titik itu."
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onPick((e.clientX - r.left) / SCALE - W / 2, (e.clientY - r.top) / SCALE - D / 2);
      }}
    />
  );
}
