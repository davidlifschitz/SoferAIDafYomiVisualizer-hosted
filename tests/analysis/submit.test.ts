import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RateLimiter } from "@/lib/analysis/rate-limit";
import {
  estimateMonthlySpendCents,
} from "@/lib/admin/spending";
import {
  SubmitError,
  type AnalysisRecord,
  type CanonicalLectureRecord,
  type SubmitStore,
  resolveIdempotencyKey,
  submitAnalysis,
} from "@/lib/analysis/submit";
import type { TurnstileClient } from "@/lib/services/turnstile";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const LECTURE_URL = "https://www.yutorah.org/lectures/lecture.cfm/948110";
const SOURCE_KEY = "yutorah:948110";

function createMemoryStore() {
  let balance = 5;
  let chargeCount = 0;
  let monthlySpendCapCents: number | null = null;
  let analysisChargesThisMonth = 0;
  const analyses = new Map<string, AnalysisRecord>();
  const canonicalLectures = new Map<string, CanonicalLectureRecord>();

  const store: SubmitStore = {
    async getAppSettings() {
      return {
        submissions_paused: false,
        monthly_spend_cap_cents: monthlySpendCapCents,
      };
    },
    async countMonthlyAnalysisCharges() {
      return analysisChargesThisMonth;
    },
    async findCanonicalLecture(sourceKey) {
      return canonicalLectures.get(sourceKey) ?? null;
    },
    async upsertCanonicalLecture(sourceKey, sourceUrl, title) {
      const existing = canonicalLectures.get(sourceKey);
      if (existing) {
        return existing;
      }

      const lecture: CanonicalLectureRecord = {
        id: `canonical-${sourceKey}`,
        source_key: sourceKey,
        source_url: sourceUrl,
        title,
      };
      canonicalLectures.set(sourceKey, lecture);
      return lecture;
    },
    async findCompletedAnalysis(canonicalLectureId) {
      for (const analysis of analyses.values()) {
        if (
          analysis.canonical_lecture_id === canonicalLectureId &&
          analysis.status === "complete"
        ) {
          return analysis;
        }
      }

      return null;
    },
    async findAnalysisByIdempotencyKey(idempotencyKey) {
      for (const analysis of analyses.values()) {
        if (analysis.idempotency_key === idempotencyKey) {
          return analysis;
        }
      }

      return null;
    },
    async countActiveAnalyses(userId) {
      let count = 0;
      for (const analysis of analyses.values()) {
        if (
          analysis.requested_by === userId &&
          (analysis.status === "pending" || analysis.status === "processing")
        ) {
          count += 1;
        }
      }

      return count;
    },
    async getBalance() {
      return balance;
    },
    async createAnalysis({ canonicalLectureId, userId, idempotencyKey }) {
      const analysis: AnalysisRecord = {
        id: `analysis-${analyses.size + 1}`,
        canonical_lecture_id: canonicalLectureId,
        requested_by: userId,
        idempotency_key: idempotencyKey,
        status: "pending",
      };
      analyses.set(analysis.id, analysis);
      return analysis;
    },
    async deleteAnalysis(analysisId) {
      analyses.delete(analysisId);
    },
    async chargeCredit() {
      if (balance < 1) {
        throw new Error("insufficient_credits");
      }

      if (chargeCount === 0) {
        balance -= 1;
        analysisChargesThisMonth += 1;
      }
      chargeCount += 1;
      return balance;
    },
  };

  return {
    store,
    getBalance: () => balance,
    getChargeCount: () => chargeCount,
    getAnalyses: () => [...analyses.values()],
    seedCompletedAnalysis(canonicalLectureId: string, analysisId = "completed-1") {
      analyses.set(analysisId, {
        id: analysisId,
        canonical_lecture_id: canonicalLectureId,
        requested_by: "other-user",
        idempotency_key: "completed-key",
        status: "complete",
      });
    },
    markFailed(analysisId: string) {
      const analysis = analyses.get(analysisId);
      if (analysis) {
        analysis.status = "failed";
      }
    },
    setBalance(nextBalance: number) {
      balance = nextBalance;
    },
    setMonthlySpendCap(cents: number | null) {
      monthlySpendCapCents = cents;
    },
    setMonthlyAnalysisCharges(count: number) {
      analysisChargesThisMonth = count;
    },
  };
}

function createDeps(overrides?: {
  turnstileValid?: boolean;
  store?: SubmitStore;
  rateLimiter?: RateLimiter;
}) {
  const turnstile: TurnstileClient = {
    verify: vi.fn().mockResolvedValue(overrides?.turnstileValid ?? true),
  };

  const rateLimiter: RateLimiter = overrides?.rateLimiter ?? {
    allowUser: () => true,
    allowIp: () => true,
  };

  return {
    turnstile,
    rateLimiter,
    store: overrides?.store,
    enqueue: vi.fn().mockResolvedValue(undefined),
  };
}

describe("resolveIdempotencyKey", () => {
  it("prefers the client-provided key", () => {
    expect(resolveIdempotencyKey(USER_ID, SOURCE_KEY, "client-key")).toBe(
      "client-key",
    );
  });

  it("falls back to a stable submit key", () => {
    expect(resolveIdempotencyKey(USER_ID, SOURCE_KEY)).toBe(
      `submit:${USER_ID}:${SOURCE_KEY}`,
    );
  });
});

describe("submitAnalysis", () => {
  let memory: ReturnType<typeof createMemoryStore>;

  beforeEach(() => {
    memory = createMemoryStore();
  });

  it("charges one credit for a new lecture (5 -> 4)", async () => {
    const deps = createDeps({ store: memory.store });

    const result = await submitAnalysis(
      {
        userId: USER_ID,
        lectureUrl: LECTURE_URL,
        turnstileToken: "valid-token",
      },
      { ...deps, store: memory.store },
    );

    expect(result).toEqual({
      analysisId: "analysis-1",
      status: "pending",
    });
    expect(memory.getBalance()).toBe(4);
    expect(memory.getChargeCount()).toBe(1);
    expect(deps.enqueue).toHaveBeenCalledWith("analysis-1");
  });

  it("reuses a completed canonical lecture without charging", async () => {
    const lecture = await memory.store.upsertCanonicalLecture(
      SOURCE_KEY,
      LECTURE_URL,
      "Existing lecture",
    );
    memory.seedCompletedAnalysis(lecture.id, "completed-analysis");

    const deps = createDeps({ store: memory.store });
    const result = await submitAnalysis(
      {
        userId: USER_ID,
        lectureUrl: LECTURE_URL,
        turnstileToken: "valid-token",
      },
      { ...deps, store: memory.store },
    );

    expect(result).toEqual({
      analysisId: "completed-analysis",
      status: "complete",
      reused: true,
    });
    expect(memory.getBalance()).toBe(5);
    expect(memory.getChargeCount()).toBe(0);
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("retries the same POST with one charge", async () => {
    const deps = createDeps({ store: memory.store });
    const input = {
      userId: USER_ID,
      lectureUrl: LECTURE_URL,
      turnstileToken: "valid-token",
      idempotencyKey: "retry-key",
    };

    const first = await submitAnalysis(input, { ...deps, store: memory.store });
    const second = await submitAnalysis(input, { ...deps, store: memory.store });

    expect(first.analysisId).toBe(second.analysisId);
    expect(memory.getBalance()).toBe(4);
    expect(memory.getChargeCount()).toBe(1);
    expect(memory.getAnalyses()).toHaveLength(1);
  });

  it("keeps the original charge after workflow failure", async () => {
    const deps = createDeps({ store: memory.store });
    const input = {
      userId: USER_ID,
      lectureUrl: LECTURE_URL,
      turnstileToken: "valid-token",
      idempotencyKey: "failed-workflow-key",
    };

    const first = await submitAnalysis(input, { ...deps, store: memory.store });
    memory.markFailed(first.analysisId);

    const second = await submitAnalysis(input, { ...deps, store: memory.store });

    expect(second.analysisId).toBe(first.analysisId);
    expect(second.status).toBe("failed");
    expect(memory.getBalance()).toBe(4);
    expect(memory.getChargeCount()).toBe(1);
  });

  it("rejects zero-balance users without creating an analysis", async () => {
    memory.setBalance(0);
    const deps = createDeps({ store: memory.store });

    await expect(
      submitAnalysis(
        {
          userId: USER_ID,
          lectureUrl: LECTURE_URL,
          turnstileToken: "valid-token",
        },
        { ...deps, store: memory.store },
      ),
    ).rejects.toMatchObject({
      code: "insufficient_credits",
    } satisfies Partial<SubmitError>);

    expect(memory.getAnalyses()).toHaveLength(0);
    expect(memory.getChargeCount()).toBe(0);
  });

  it("rejects invalid Turnstile tokens", async () => {
    const deps = createDeps({ turnstileValid: false, store: memory.store });

    await expect(
      submitAnalysis(
        {
          userId: USER_ID,
          lectureUrl: LECTURE_URL,
          turnstileToken: "bad-token",
        },
        { ...deps, store: memory.store },
      ),
    ).rejects.toMatchObject({
      code: "invalid_turnstile",
    } satisfies Partial<SubmitError>);

    expect(memory.getAnalyses()).toHaveLength(0);
    expect(memory.getChargeCount()).toBe(0);
  });

  it("rejects unsupported lecture URLs", async () => {
    const deps = createDeps({ store: memory.store });

    await expect(
      submitAnalysis(
        {
          userId: USER_ID,
          lectureUrl: "https://evil.example/lectures/lecture.cfm/1",
          turnstileToken: "valid-token",
        },
        { ...deps, store: memory.store },
      ),
    ).rejects.toMatchObject({
      code: "invalid_lecture_url",
    } satisfies Partial<SubmitError>);
  });

  it("rejects when the monthly spending cap is reached", async () => {
    memory.setMonthlySpendCap(100);
    memory.setMonthlyAnalysisCharges(
      Math.ceil(100 / estimateMonthlySpendCents(1, 50)),
    );

    const deps = createDeps({ store: memory.store });

    await expect(
      submitAnalysis(
        {
          userId: USER_ID,
          lectureUrl: LECTURE_URL,
          turnstileToken: "valid-token",
        },
        { ...deps, store: memory.store },
      ),
    ).rejects.toMatchObject({
      code: "spending_cap_reached",
    } satisfies Partial<SubmitError>);

    expect(memory.getAnalyses()).toHaveLength(0);
    expect(memory.getChargeCount()).toBe(0);
  });

  it("rejects when rate limits are exceeded", async () => {
    const deps = createDeps({
      store: memory.store,
      rateLimiter: {
        allowUser: () => false,
        allowIp: () => true,
      },
    });

    await expect(
      submitAnalysis(
        {
          userId: USER_ID,
          lectureUrl: LECTURE_URL,
          turnstileToken: "valid-token",
        },
        { ...deps, store: memory.store },
      ),
    ).rejects.toMatchObject({
      code: "rate_limited",
    } satisfies Partial<SubmitError>);
  });
});