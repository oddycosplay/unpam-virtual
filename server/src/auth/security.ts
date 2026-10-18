import type { FastifyInstance, FastifyRequest } from "fastify";

// ---------- Batas percobaan login ----------

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

interface Attempts {
  failures: number[];
  lockedUntil: number;
}

/**
 * Pembatas percobaan login di memori, per kombinasi IP + email.
 * 5 kali gagal dalam 15 menit → dikunci 15 menit. Cukup untuk satu server di satu laptop.
 */
export class LoginLimiter {
  private readonly attempts = new Map<string, Attempts>();

  constructor(private readonly now: () => number = Date.now) {}

  private key(ip: string, email: string): string {
    return `${ip}|${email.toLowerCase()}`;
  }

  /** Sisa detik penguncian, atau 0 bila boleh mencoba. */
  lockedFor(ip: string, email: string): number {
    const a = this.attempts.get(this.key(ip, email));
    if (!a) return 0;
    return Math.max(0, Math.ceil((a.lockedUntil - this.now()) / 1000));
  }

  fail(ip: string, email: string): void {
    const k = this.key(ip, email);
    const t = this.now();
    const a = this.attempts.get(k) ?? { failures: [], lockedUntil: 0 };
    a.failures = a.failures.filter((f) => t - f < WINDOW_MS);
    a.failures.push(t);
    if (a.failures.length >= MAX_FAILURES) {
      a.lockedUntil = t + WINDOW_MS;
      a.failures = [];
    }
    this.attempts.set(k, a);
    if (this.attempts.size > 10_000) this.prune();
  }

  succeed(ip: string, email: string): void {
    this.attempts.delete(this.key(ip, email));
  }

  private prune(): void {
    const t = this.now();
    for (const [k, a] of this.attempts) {
      if (a.lockedUntil < t && a.failures.every((f) => t - f >= WINDOW_MS)) this.attempts.delete(k);
    }
  }
}

// ---------- Password ----------

export const MIN_PASSWORD_LENGTH = 8;

/** Password sementara yang mudah dibaca (tanpa karakter mirip seperti 0/O, 1/l). */
export function generateTempPassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// ---------- Origin & header ----------

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** True bila permintaan datang lewat HTTPS (langsung atau di balik proxy yang mengirim X-Forwarded-Proto). */
export function isHttps(request: FastifyRequest): boolean {
  return request.protocol === "https" || request.headers["x-forwarded-proto"] === "https";
}

/**
 * Perlindungan dasar:
 * - Tolak permintaan yang mengubah data bila header Origin berasal dari situs lain (CSRF).
 * - Header keamanan standar di semua respons.
 */
export function registerSecurity(app: FastifyInstance): void {
  app.addHook("onRequest", async (request, reply) => {
    if (!MUTATING.has(request.method)) return;
    const origin = request.headers.origin;
    if (!origin) return; // klien non-browser (curl, tes) tidak mengirim Origin
    const host = request.headers["x-forwarded-host"] ?? request.headers.host;
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return reply.code(403).send({ error: "Origin tidak valid" });
    }
    if (originHost !== host) return reply.code(403).send({ error: "Permintaan dari situs lain ditolak" });
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "same-origin");
    reply.header("cross-origin-opener-policy", "same-origin");
    if (!reply.hasHeader("cache-control")) reply.header("cache-control", "no-store");
    return payload;
  });
}
