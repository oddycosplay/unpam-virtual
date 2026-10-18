import { useEffect, useMemo } from "react";
import * as THREE from "three";

const PX_PER_UNIT = 220;
const SCREEN_BOOST = new THREE.Color(1.35, 1.35, 1.35);
const CYAN = "#2ee6d6";
const TEXT = "#d9fbf8";
const MUTED = "rgba(190, 240, 236, 0.65)";

export type HoloContent =
  | { kind: "stats"; title: string; items: { label: string; value: string; tone?: "ok" | "warn" | "bad" }[] }
  | { kind: "bars"; title: string; values: number[]; caption: string }
  | { kind: "gauge"; title: string; value: number | null; max: number; unit: string; caption: string }
  | { kind: "text"; title: string; lines: string[] };

const TONE: Record<"ok" | "warn" | "bad", string> = { ok: "#5ee08a", warn: "#f5c400", bad: "#ff6b6b" };

function frame(ctx: CanvasRenderingContext2D, w: number, h: number, title: string) {
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "rgba(24, 92, 98, 0.78)");
  bg.addColorStop(1, "rgba(10, 44, 52, 0.62)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  // Sudut tebal ala HUD
  ctx.lineWidth = 7;
  const c = 22;
  for (const [x, y, dx, dy] of [
    [0, 0, 1, 1],
    [w, 0, -1, 1],
    [0, h, 1, -1],
    [w, h, -1, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x + dx * c, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * c);
    ctx.stroke();
  }
  ctx.fillStyle = CYAN;
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(title.toUpperCase(), 22, 18);
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, content: HoloContent) {
  frame(ctx, w, h, content.title);
  ctx.textBaseline = "alphabetic";

  if (content.kind === "stats") {
    const cols = content.items.length;
    const colW = (w - 44) / cols;
    content.items.forEach((item, i) => {
      const x = 22 + i * colW;
      ctx.fillStyle = item.tone ? TONE[item.tone] : TEXT;
      ctx.font = `700 ${Math.min(76, h * 0.34)}px system-ui, sans-serif`;
      ctx.fillText(item.value, x, h * 0.66);
      ctx.fillStyle = MUTED;
      ctx.font = "500 22px system-ui, sans-serif";
      ctx.fillText(item.label, x, h * 0.66 + 34);
    });
  }

  if (content.kind === "bars") {
    const max = Math.max(1, ...content.values);
    const left = 22;
    const bottom = h - 46;
    const top = 64;
    const gap = 8;
    const barW = (w - 44 - gap * (content.values.length - 1)) / content.values.length;
    content.values.forEach((v, i) => {
      const bh = Math.max(3, ((bottom - top) * v) / max);
      const x = left + i * (barW + gap);
      const g = ctx.createLinearGradient(0, bottom - bh, 0, bottom);
      g.addColorStop(0, CYAN);
      g.addColorStop(1, "rgba(46, 230, 214, 0.25)");
      ctx.fillStyle = g;
      ctx.fillRect(x, bottom - bh, barW, bh);
    });
    ctx.fillStyle = MUTED;
    ctx.font = "500 20px system-ui, sans-serif";
    ctx.fillText(content.caption, 22, h - 16);
  }

  if (content.kind === "gauge") {
    const cx = w / 2;
    const cy = h * 0.78;
    const r = Math.min(w * 0.32, h * 0.5);
    ctx.lineWidth = 18;
    ctx.strokeStyle = "rgba(46, 230, 214, 0.18)";
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.stroke();
    if (content.value !== null) {
      const ratio = Math.min(1, content.value / content.max);
      ctx.strokeStyle = ratio < 0.6 ? TONE.ok : ratio < 0.9 ? TONE.warn : TONE.bad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * ratio);
      ctx.stroke();
    }
    ctx.fillStyle = TEXT;
    ctx.textAlign = "center";
    ctx.font = "700 54px system-ui, sans-serif";
    ctx.fillText(content.value === null ? "–" : `${content.value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}${content.unit}`, cx, cy - 10);
    ctx.fillStyle = MUTED;
    ctx.font = "500 20px system-ui, sans-serif";
    ctx.fillText(content.caption, cx, cy + 30);
    ctx.textAlign = "left";
  }

  if (content.kind === "text") {
    ctx.font = "500 26px system-ui, sans-serif";
    content.lines.forEach((line, i) => {
      ctx.fillStyle = i === 0 ? TEXT : MUTED;
      ctx.fillText(line, 22, 92 + i * 38, w - 44);
    });
  }
}

/** Panel hologram transparen bercahaya. size dalam satuan dunia. */
export function HoloScreen({
  position,
  rotation = [0, 0, 0],
  size,
  content,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number];
  content: HoloContent;
}) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = Math.round(size[0] * PX_PER_UNIT);
    c.height = Math.round(size[1] * PX_PER_UNIT);
    return c;
  }, [size]);

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);

  const key = JSON.stringify(content);
  useEffect(() => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    draw(ctx, canvas.width, canvas.height, content);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, canvas, texture]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <planeGeometry args={size} />
        {/* Warna > 1 membuat bagian terang layar ikut berpendar lewat bloom */}
        <meshBasicMaterial map={texture} color={SCREEN_BOOST} transparent side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Pancaran cahaya tipis dari bawah layar */}
      <mesh position={[0, -size[1] / 2 - 0.25, 0]}>
        <planeGeometry args={[size[0] * 0.9, 0.5]} />
        <meshBasicMaterial color="#2ee6d6" transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
