import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tes alur penuh (login beberapa peran + agent palsu) bisa lambat di laptop yang sibuk.
    testTimeout: 30_000,
  },
});
