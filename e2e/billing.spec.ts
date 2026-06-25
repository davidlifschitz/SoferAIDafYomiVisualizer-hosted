import { expect, test } from "playwright/test";

import { hasStripeConfig } from "./helpers/env";
import { signInTestUser } from "./helpers/session";
import { createTestEmail, supabaseConfigured } from "./helpers/supabase";

test.describe("billing", () => {
  test.skip(!supabaseConfigured(), "Supabase env vars are not configured.");

  test("billing page shows the signed-in balance", async ({ page }) => {
    const email = createTestEmail("billing");
    await signInTestUser(page, email);
    await page.goto("/billing");

    await expect(page.getByRole("heading", { name: /billing/i })).toBeVisible();
    await expect(page.getByText(/current balance/i)).toBeVisible();
  });

  test("checkout requires authentication", async ({ request }) => {
    const response = await request.post("/api/stripe/checkout", {
      data: { product: "pack_5" },
    });
    expect(response.status()).toBe(401);
  });

  test.describe("Stripe test mode", () => {
    test.skip(!hasStripeConfig(), "Stripe env vars are not configured.");

    test("starts a checkout session for credit packs", async ({ page }) => {
      const email = createTestEmail("checkout");
      await signInTestUser(page, email);

      const response = await page.request.post("/api/stripe/checkout", {
        data: { product: "pack_5" },
      });

      expect(response.status()).toBe(200);
      const payload = (await response.json()) as { url?: string };
      expect(payload.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    });
  });
});