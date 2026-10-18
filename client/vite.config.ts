import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // xfwd: kirim X-Forwarded-Host/Proto agar server bisa mencocokkan Origin dengan host asli (cek CSRF).
      "/api": { target: "http://localhost:3001", xfwd: true },
      "/socket.io": { target: "http://localhost:3001", ws: true, xfwd: true },
    },
  },
});
