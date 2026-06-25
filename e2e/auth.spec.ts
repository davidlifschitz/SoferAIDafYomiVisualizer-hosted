import { expect, test } from "playwright/test";

import { signInTestUser } from "./helpers/session";
import {
  createTestEmail,
  getCreditBalanceForUser,
  getUserIdByEmail,
  supabaseConfigured,
} from "./helpers/supabase";

test.describe("authentication", () => {
  test("renders the sign-in page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /access your workspace/i })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test.describe("local Supabase", () => {
    test.skip(!supabaseConfigured(), "Supabase env vars are not configured.");

    test("verified signup receives five credits", async ({ page }) => {
      const email = createTestEmail("signup");
      await signInTestUser(page, email);

      const userId = await getUserIdByEmail(email);
      expect(userId).toBeTruthy();

      const balance = await getCreditBalanceForUser(userId!);
      expect(balance).toBe(5);
      await expect(page.getByLabel("5 credits available")).toBeVisible();
    });
  });
});