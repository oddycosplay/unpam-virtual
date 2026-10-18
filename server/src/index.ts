import { networkInterfaces } from "node:os";
import { buildApp } from "./app";
import { loadConfig } from "./config/env";
import { createDb } from "./db/client";
import { seed } from "./db/seed";
import { failInterruptedDrafts } from "./modules/submissions/service";

const config = loadConfig();
const db = createDb(config.DB_PATH);
const { createdUsers, createdDocuments } = await seed(db, config.SEED_PASSWORD, config.BCRYPT_ROUNDS);
if (createdUsers > 0) console.log(`[seed] ${createdUsers} akun contoh dibuat (lihat README).`);
if (createdDocuments > 0) console.log(`[seed] ${createdDocuments} dokumen contoh diindeks.`);
const interrupted = failInterruptedDrafts(db);
if (interrupted > 0) console.log(`[agent] ${interrupted} penyusunan proposal terputus ditandai gagal (bisa diulang).`);

const app = await buildApp({ db, config }, { logger: true });
await app.listen({ host: config.HOST, port: config.API_PORT });

const lanIps = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal)
  .map((n) => n!.address);
console.log(`[server] API siap di port ${config.API_PORT}. Buka aplikasi di http://localhost:5173`);
console.log(`[server] Dari perangkat lain di Wi-Fi yang sama: ${lanIps.map((ip) => `http://${ip}:5173`).join(", ") || "-"}`);
