import { expect, test } from "playwright/test";

const SHABBAT_2_DEMO_ANALYSIS_ID = "fixture-shabbat-2";

import { signInTestUser } from "./helpers/session";
import {
  createTestEmail,
  getCreditBalanceForUser,
  getUserIdByEmail,
  supabaseConfigured,
} from "./helpers/supabase";

const LECTURE_URL = "https://www.yutorah.org/lectures/lecture.cfm/948110";
/** Use a separate lecture so prior E2E runs cannot leave 948110 complete and skip charging. */
const NEW_ANALYSIS_LECTURE_URL =
  "https://www.yutorah.org/lectures/lecture.cfm/948111";

test.describe("fixture analysis visualizer", () => {
  test("Shabbos Daf 2 starts on 2a and ends on 2b", async ({ page }) => {
    await page.goto(`/analyses/${SHABBAT_2_DEMO_ANALYSIS_ID}`);
    await expect(page.getByLabel("Start Shabbat 2a:1")).toBeVisible();
    await expect(page.getByLabel(/End Shabbat 2b:14/i)).toBeVisible();
    await expect(page.getByText(/Start Shabbat 2a:1 · End Shabbat 2b:14/i)).toBeVisible();
  });
});

test.describe("protected submissions", () => {
  test.skip(!supabaseConfigured(), "Supabase env vars are not configured.");

  test("new analysis costs one credit", async ({ page }) => {
    const email = createTestEmail("submit-new");
    await signInTestUser(page, email);

    const userId = await getUserIdByEmail(email);
    expect(userId).toBeTruthy();
    const balanceBefore = await getCreditBalanceForUser(userId!);

    const response = await page.request.post("/api/analyses", {
      data: {
        lectureUrl: NEW_ANALYSIS_LECTURE_URL,
        turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
        idempotencyKey: `e2e-new-${Date.now()}`,
      },
    });

    expect(response.status()).toBe(200);
    const payload = (await response.json()) as { reused?: boolean };
    expect(payload.reused).not.toBe(true);
    const balanceAfter = await getCreditBalanceForUser(userId!);
    expect(balanceAfter).toBe(balanceBefore - 1);
  });

  test("duplicate completed lecture costs zero", async ({ page }) => {
    const email = createTestEmail("submit-dup");
    await signInTestUser(page, email);

    const userId = await getUserIdByEmail(email);
    expect(userId).toBeTruthy();

    const idempotencyKey = `e2e-dup-${Date.now()}`;
    const first = await page.request.post("/api/analyses", {
      data: {
        lectureUrl: LECTURE_URL,
        turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
        idempotencyKey,
      },
    });
    expect(first.status()).toBe(200);
    const firstPayload = (await first.json()) as { analysisId: string };
    const balanceAfterFirst = await getCreditBalanceForUser(userId!);

    const { createE2EAdminClient } = await import("./helpers/supabase");
    const client = createE2EAdminClient();
    await client
      .from("analyses")
      .update({ status: "complete" })
      .eq("id", firstPayload.analysisId);

    const second = await page.request.post("/api/analyses", {
      data: {
        lectureUrl: LECTURE_URL,
        turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
        idempotencyKey: `e2e-dup-retry-${Date.now()}`,
      },
    });
    expect(second.status()).toBe(200);
    const secondPayload = (await second.json()) as { reused?: boolean };
    expect(secondPayload.reused).toBe(true);

    const balanceAfterSecond = await getCreditBalanceForUser(userId!);
    expect(balanceAfterSecond).toBe(balanceAfterFirst);
  });

  test("rejects invalid Turnstile tokens", async ({ page }) => {
    const email = createTestEmail("submit-turnstile");
    await signInTestUser(page, email);

    const response = await page.request.post("/api/analyses", {
      data: {
        lectureUrl: LECTURE_URL,
        turnstileToken: "",
        idempotencyKey: `e2e-bad-turnstile-${Date.now()}`,
      },
    });

    expect(response.status()).toBe(400);
  });
});