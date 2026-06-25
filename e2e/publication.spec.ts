import { expect, test } from "playwright/test";

import { seedPublicationFixture } from "./helpers/publication-seed";
import { supabaseConfigured } from "./helpers/supabase";

test.describe("publication access matrix", () => {
  test("library lists fixture demos without signing in", async ({ page }) => {
    await page.goto("/library");
    await expect(page.getByRole("heading", { name: /listed results/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /fixture demos/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Shabbat 2 demo/i })).toBeVisible();
  });

  test.describe("seeded database results", () => {
    test.skip(!supabaseConfigured(), "Supabase env vars are not configured.");

    test("public results appear in the library and share route", async ({ page }) => {
      const fixture = await seedPublicationFixture(
        "public",
        `E2E Public Result ${Date.now()}`,
      );

      await page.goto("/library");
      await expect(page.getByRole("heading", { name: fixture.title })).toBeVisible();

      await page.goto(`/r/${fixture.publicId}`);
      await expect(page.getByRole("heading", { name: fixture.title })).toBeVisible();
    });

    test("unlisted results are reachable only through the share route", async ({ page }) => {
      const fixture = await seedPublicationFixture("unlisted", "E2E Unlisted Result");

      await page.goto("/library");
      await expect(page.getByText(fixture.title)).toHaveCount(0);

      await page.goto(`/r/${fixture.publicId}`);
      await expect(page.getByRole("heading", { name: fixture.title })).toBeVisible();
    });

    test("private results are not reachable anonymously", async ({ page }) => {
      const fixture = await seedPublicationFixture("private", "E2E Private Result");

      const response = await page.goto(`/r/${fixture.publicId}`);
      expect(response?.status()).toBe(404);
      await expect(page.getByText(fixture.title)).toHaveCount(0);
    });
  });
});