import { describe, expect, it } from "vitest";

import {
  adjustCredits,
  type AdminStore,
  updateAppSettings,
} from "@/lib/admin/operations";
import {
  estimateMonthlySpendCents,
  isSpendCapReached,
} from "@/lib/admin/spending";

const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "11111111-1111-1111-1111-111111111111";

type MemoryAdminStore = AdminStore & {
  setAnalysisCharges(count: number): void;
  getAdjustments(): Map<string, { amount: number; reason: string }>;
  getBalance(): number;
};

function createMemoryAdminStore(): MemoryAdminStore {
  let submissionsPaused = false;
  let monthlySpendCapCents: number | null = null;
  let balance = 5;
  const adjustments = new Map<string, { amount: number; reason: string }>();
  let analysisChargesThisMonth = 0;

  const store: MemoryAdminStore = {
    async getSettings() {
      return {
        submissions_paused: submissionsPaused,
        monthly_spend_cap_cents: monthlySpendCapCents,
      };
    },
    async saveSettings(input) {
      if (input.submissionsPaused !== undefined) {
        submissionsPaused = input.submissionsPaused;
      }
      if (input.monthlySpendCapCents !== undefined) {
        monthlySpendCapCents = input.monthlySpendCapCents;
      }
      return {
        submissions_paused: submissionsPaused,
        monthly_spend_cap_cents: monthlySpendCapCents,
      };
    },
    async getUserBalance() {
      return balance;
    },
    async insertCreditAdjustment({ amount, idempotencyKey, reason }) {
      if (adjustments.has(idempotencyKey)) {
        return balance;
      }

      balance += amount;
      adjustments.set(idempotencyKey, { amount, reason });
      return balance;
    },
    async countMonthlyAnalysisCharges() {
      return analysisChargesThisMonth;
    },
    async listProblemAnalyses() {
      return [
        {
          id: "failed-1",
          status: "failed" as const,
          workflow_error: "Sofer timed out",
          created_at: "2026-06-25T12:00:00.000Z",
          canonical_lectures: { title: "Shabbat 2", source_key: "yutorah:948110" },
        },
      ];
    },
    setAnalysisCharges(count: number) {
      analysisChargesThisMonth = count;
    },
    getAdjustments() {
      return adjustments;
    },
    getBalance() {
      return balance;
    },
  };

  return store;
}

describe("spending cap helpers", () => {
  it("estimates monthly spend from analysis charges", () => {
    expect(estimateMonthlySpendCents(3, 50)).toBe(150);
  });

  it("blocks submissions when the cap is reached", () => {
    expect(isSpendCapReached(200, 200)).toBe(true);
    expect(isSpendCapReached(200, 150)).toBe(false);
    expect(isSpendCapReached(null, 999)).toBe(false);
  });
});

describe("updateAppSettings", () => {
  it("pauses and resumes submissions", async () => {
    const store = createMemoryAdminStore();

    const paused = await updateAppSettings(
      { submissionsPaused: true },
      { store, adminId: ADMIN_ID },
    );
    expect(paused.submissions_paused).toBe(true);

    const resumed = await updateAppSettings(
      { submissionsPaused: false },
      { store, adminId: ADMIN_ID },
    );
    expect(resumed.submissions_paused).toBe(false);
  });

  it("sets and clears the monthly spending cap", async () => {
    const store = createMemoryAdminStore();

    const capped = await updateAppSettings(
      { monthlySpendCapCents: 500 },
      { store, adminId: ADMIN_ID },
    );
    expect(capped.monthly_spend_cap_cents).toBe(500);

    const cleared = await updateAppSettings(
      { monthlySpendCapCents: null },
      { store, adminId: ADMIN_ID },
    );
    expect(cleared.monthly_spend_cap_cents).toBeNull();
  });
});

describe("adjustCredits", () => {
  it("adds credits with a required reason and idempotency key", async () => {
    const store = createMemoryAdminStore();

    const result = await adjustCredits(
      {
        userId: USER_ID,
        amount: 3,
        reason: "Support goodwill grant",
        idempotencyKey: "admin-grant-1",
      },
      { store, adminId: ADMIN_ID },
    );

    expect(result.balance).toBe(8);
    expect(store.getAdjustments().get("admin:admin-grant-1")).toEqual({
      amount: 3,
      reason: "Support goodwill grant",
    });
  });

  it("applies compensating removals idempotently", async () => {
    const store = createMemoryAdminStore();
    const input = {
      userId: USER_ID,
      amount: -2,
      reason: "Correct duplicate grant",
      idempotencyKey: "admin-remove-1",
    };

    const first = await adjustCredits(input, { store, adminId: ADMIN_ID });
    const second = await adjustCredits(input, { store, adminId: ADMIN_ID });

    expect(first.balance).toBe(3);
    expect(second.balance).toBe(3);
    expect(store.getAdjustments().size).toBe(1);
  });

  it("rejects empty reasons and zero amounts", async () => {
    const store = createMemoryAdminStore();

    await expect(
      adjustCredits(
        {
          userId: USER_ID,
          amount: 0,
          reason: "noop",
          idempotencyKey: "admin-zero",
        },
        { store, adminId: ADMIN_ID },
      ),
    ).rejects.toThrow(/amount/i);

    await expect(
      adjustCredits(
        {
          userId: USER_ID,
          amount: 1,
          reason: "  ",
          idempotencyKey: "admin-empty-reason",
        },
        { store, adminId: ADMIN_ID },
      ),
    ).rejects.toThrow(/reason/i);
  });
});