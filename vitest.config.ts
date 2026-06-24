import path from "node:path";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["test/**", "e2e/**", "node_modules/**", ".next/**"],
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
