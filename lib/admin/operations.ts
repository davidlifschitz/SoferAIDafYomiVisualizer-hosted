import {
  estimateMonthlySpendCents,
  getSoferAnalysisCostCents,
} from "@/lib/admin/spending";

export type AppSettingsRecord = {
  submissions_paused: boolean;
  monthly_spend_cap_cents: number | null;
};

export type ProblemAnalysisRecord = {
  id: string;
  status: "failed" | "partial";
  workflow_error: string | null;
  created_at: string;
  canonical_lectures: {
    title: string;
    source_key: string;
  } | null;
};

export type AdminStore = {
  getSettings(): Promise<AppSettingsRecord>;
  saveSettings(input: {
    submissionsPaused?: boolean;
    monthlySpendCapCents?: number | null;
    adminId: string;
  }): Promise<AppSettingsRecord>;
  getUserBalance(userId: string): Promise<number>;
  insertCreditAdjustment(input: {
    userId: string;
    amount: number;
    reason: string;
    idempotencyKey: string;
    adminId: string;
  }): Promise<number>;
  countMonthlyAnalysisCharges(): Promise<number>;
  listProblemAnalyses(limit?: number): Promise<ProblemAnalysisRecord[]>;
};

export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminError";
  }
}

export type UpdateSettingsInput = {
  submissionsPaused?: boolean;
  monthlySpendCapCents?: number | null;
};

export async function updateAppSettings(
  input: UpdateSettingsInput,
  deps: { store: AdminStore; adminId: string },
): Promise<AppSettingsRecord> {
  if (
    input.submissionsPaused === undefined &&
    input.monthlySpendCapCents === undefined
  ) {
    throw new AdminError("At least one setting must be provided.");
  }

  if (
    input.monthlySpendCapCents !== undefined &&
    input.monthlySpendCapCents !== null &&
    (!Number.isInteger(input.monthlySpendCapCents) ||
      input.monthlySpendCapCents < 0)
  ) {
    throw new AdminError("Spending cap must be a non-negative integer or null.");
  }

  return deps.store.saveSettings({
    submissionsPaused: input.submissionsPaused,
    monthlySpendCapCents: input.monthlySpendCapCents,
    adminId: deps.adminId,
  });
}

export type AdjustCreditsInput = {
  userId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
};

export async function adjustCredits(
  input: AdjustCreditsInput,
  deps: { store: AdminStore; adminId: string },
): Promise<{ balance: number }> {
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    throw new AdminError("Adjustment amount must be a non-zero integer.");
  }

  if (!input.reason.trim()) {
    throw new AdminError("A reason is required for credit adjustments.");
  }

  if (!input.idempotencyKey.trim()) {
    throw new AdminError("An idempotency key is required.");
  }

  const balance = await deps.store.insertCreditAdjustment({
    userId: input.userId,
    amount: input.amount,
    reason: input.reason.trim(),
    idempotencyKey: `admin:${input.idempotencyKey.trim()}`,
    adminId: deps.adminId,
  });

  return { balance };
}

export async function getOperationalSnapshot(store: AdminStore) {
  const [settings, chargeCount, problems] = await Promise.all([
    store.getSettings(),
    store.countMonthlyAnalysisCharges(),
    store.listProblemAnalyses(20),
  ]);

  const costPerAnalysisCents = getSoferAnalysisCostCents();
  const monthlySpendCents = estimateMonthlySpendCents(
    chargeCount,
    costPerAnalysisCents,
  );

  return {
    settings,
    monthlySpendCents,
    costPerAnalysisCents,
    problemAnalyses: problems,
  };
}