import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const EnvSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  // Bukan PORT: banyak tool (dan Vite) mengisi PORT di environment sehingga bentrok.
  API_PORT: z.coerce.number().int().default(3001),
  DB_PATH: z.string().default("./data/unpam.db"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET minimal 32 karakter"),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, "ENCRYPTION_KEY harus 64 karakter hex (32 byte)"),
  LLM_PROVIDER: z.enum(["anthropic", "openai-compatible"]).default("anthropic"),
  LLM_BASE_URL: z.string().default(""),
  LLM_API_KEY: z.string().default(""),
  LLM_MODEL: z.string().default("claude-opus-5-5"),
  SEED_PASSWORD: z.string().default("unpam123"),
  /** Putaran bcrypt untuk hash password. Tes memakai nilai kecil agar cepat. */
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(14).default(10),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Konfigurasi .env tidak valid:\n${issues}`);
  }
  const config = parsed.data;
  if (config.DB_PATH !== ":memory:" && !path.isAbsolute(config.DB_PATH)) {
    config.DB_PATH = path.resolve(REPO_ROOT, config.DB_PATH);
  }
  return config;
}
