// Membuat .env dari .env.example dengan rahasia acak bila .env belum ada.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (!existsSync(".env")) {
  const env = readFileSync(".env.example", "utf8")
    .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${randomBytes(32).toString("hex")}`)
    .replace(/^ENCRYPTION_KEY=.*$/m, `ENCRYPTION_KEY=${randomBytes(32).toString("hex")}`);
  writeFileSync(".env", env);
  console.log("[setup] .env dibuat dengan JWT_SECRET dan ENCRYPTION_KEY acak.");
}
