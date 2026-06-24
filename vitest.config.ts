import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    exclude: ["test/**", "e2e/**", "node_modules/**", ".next/**"],
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    setupFiles: [],
  },
});
