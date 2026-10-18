// Uji beban kampus 3D: N bot berjalan dan mengobrol bersamaan lewat Socket.IO.
//
//   node scripts/load-test.mjs --bots 20 --seconds 60
//
// Bot login memakai akun contoh (SEED_PASSWORD dari .env). Server harus sedang berjalan (npm run dev).
// Diukur: jeda antar snapshot posisi yang diterima tiap bot, dan latensi gerak
// (waktu dari mengirim posisi sampai posisi itu terlihat di snapshot server).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "server", "package.json"));
const { io } = require("socket.io-client");

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(" ")
    .split("--")
    .filter(Boolean)
    .map((a) => a.trim().split(/\s+/)),
);
const BOTS = Number(args.bots ?? 20);
const SECONDS = Number(args.seconds ?? 60);
const URL = args.url ?? "http://127.0.0.1:3001";

function envValue(key, fallback) {
  try {
    const line = readFileSync(path.join(root, ".env"), "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() || fallback : fallback;
  } catch {
    return fallback;
  }
}
const PASSWORD = process.env.LOAD_TEST_PASSWORD ?? envValue("SEED_PASSWORD", "unpam123");
const ACCOUNTS = ["mahasiswa", "hima", "dosen", "kaprodi", "admin"].map((r) => `${r}@unpam.test`);

const percentile = (xs, p) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const ms = (v) => (Number.isFinite(v) ? `${v.toFixed(0)} ms` : "-");

async function login(email) {
  const res = await fetch(`${URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login ${email} gagal (${res.status}). Periksa SEED_PASSWORD / LOAD_TEST_PASSWORD.`);
  return res.headers.get("set-cookie").split(";")[0];
}

console.log(`[uji beban] ${BOTS} bot selama ${SECONDS} detik ke ${URL}`);
const cookies = {};
for (const email of ACCOUNTS) cookies[email] = await login(email);

const gaps = [];
const latencies = [];
let snapshots = 0;
let chatsSent = 0;
let chatsReceived = 0;
let maxPlayersSeen = 0;
let errors = 0;

const bots = await Promise.all(
  Array.from({ length: BOTS }, (_, i) => {
    const socket = io(URL, {
      path: "/socket.io",
      transports: ["websocket"],
      extraHeaders: { cookie: cookies[ACCOUNTS[i % ACCOUNTS.length]] },
      reconnection: false,
    });
    const bot = { socket, id: null, x: -6 + Math.random() * 12, z: -2 + Math.random() * 10, heading: Math.random() * Math.PI * 2, lastSnap: 0, probe: null };
    socket.on("welcome", (w) => (bot.id = w.id));
    socket.on("connect_error", (e) => {
      errors++;
      console.error(`[bot ${i}] gagal terhubung: ${e.message}`);
    });
    socket.on("snapshot", (s) => {
      const now = performance.now();
      if (bot.lastSnap) gaps.push(now - bot.lastSnap);
      bot.lastSnap = now;
      snapshots++;
      maxPlayersSeen = Math.max(maxPlayersSeen, s.players.length);
      if (bot.probe) {
        const me = s.players.find((p) => p.id === bot.id);
        if (me && Math.abs(me.x - bot.probe.x) < 1e-6) {
          latencies.push(now - bot.probe.at);
          bot.probe = null;
        }
      }
    });
    socket.on("chat:message", (m) => {
      if (m.fromId !== bot.id) chatsReceived++;
    });
    return new Promise((resolve) => {
      socket.once("welcome", () => resolve(bot));
      socket.once("connect_error", () => resolve(bot));
    });
  }),
);
console.log(`[uji beban] ${bots.filter((b) => b.id).length}/${BOTS} bot terhubung`);

const tick = setInterval(() => {
  for (const b of bots) {
    if (!b.id) continue;
    b.heading += (Math.random() - 0.5) * 0.6;
    b.x = Math.max(-11, Math.min(11, b.x + Math.sin(b.heading) * 0.32));
    b.z = Math.max(-10, Math.min(10, b.z + Math.cos(b.heading) * 0.32));
    if (Math.abs(b.x) > 10.5 || Math.abs(b.z) > 9.5) b.heading += Math.PI;
    // Sesekali kirim posisi penanda untuk mengukur latensi bolak-balik.
    if (!b.probe && Math.random() < 0.05) b.probe = { x: b.x, at: performance.now() };
    b.socket.emit("move", { x: b.x, z: b.z, rot: b.heading, moving: true });
  }
}, 100);

const talk = setInterval(() => {
  const b = bots[Math.floor(Math.random() * bots.length)];
  if (!b?.id) return;
  b.socket.emit("chat:send", `Halo dari bot ${bots.indexOf(b) + 1}`);
  chatsSent++;
}, 1500);

const progress = setInterval(() => {
  process.stdout.write(`  snapshot ${snapshots}, latensi p95 ${ms(percentile(latencies, 95))}\r`);
}, 2000);

await new Promise((r) => setTimeout(r, SECONDS * 1000));
clearInterval(tick);
clearInterval(talk);
clearInterval(progress);
for (const b of bots) b.socket.disconnect();

const perSecond = snapshots / SECONDS / Math.max(1, bots.filter((b) => b.id).length);
console.log("\n");
console.log("Hasil uji beban kampus");
console.log("----------------------");
console.log(`Bot terhubung           : ${bots.filter((b) => b.id).length}/${BOTS} (pemain terbanyak terlihat: ${maxPlayersSeen})`);
console.log(`Snapshot per bot/detik  : ${perSecond.toFixed(1)} (target server: 10)`);
console.log(`Jeda snapshot p50 / p95 : ${ms(percentile(gaps, 50))} / ${ms(percentile(gaps, 95))}`);
console.log(`Latensi gerak p50 / p95 : ${ms(percentile(latencies, 50))} / ${ms(percentile(latencies, 95))} (${latencies.length} sampel)`);
console.log(`Chat terkirim / diterima: ${chatsSent} / ${chatsReceived} (hanya dalam radius 6 m)`);
console.log(`Error koneksi           : ${errors}`);
const ok = errors === 0 && percentile(latencies, 95) < 300 && percentile(gaps, 95) < 250;
console.log(ok ? "Kesimpulan: LULUS (p95 latensi < 300 ms, jeda snapshot p95 < 250 ms)" : "Kesimpulan: PERLU DICEK (lihat angka di atas)");
process.exit(ok ? 0 : 1);
