import { defineConfig } from "playwright/test";

import { loadEnvLocal, turnstileTestKeys } from "./e2e/helpers/env";

loadEnvLocal();

const turnstile = turnstileTestKeys();
process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = turnstile.siteKey;
process.env.TURNSTILE_SECRET_KEY = turnstile.secretKey;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    reuseExistingServer: false,
    env: {
      ...process.env,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: turnstile.siteKey,
      TURNSTILE_SECRET_KEY: turnstile.secretKey,
    },
  },
});