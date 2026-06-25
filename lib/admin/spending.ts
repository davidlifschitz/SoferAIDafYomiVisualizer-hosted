export const DEFAULT_SOFER_ANALYSIS_COST_CENTS = 50;

export function getSoferAnalysisCostCents(): number {
  const raw = process.env.SOFER_ANALYSIS_COST_CENTS;
  const parsed = raw ? Number(raw) : DEFAULT_SOFER_ANALYSIS_COST_CENTS;
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_SOFER_ANALYSIS_COST_CENTS;
}

export function estimateMonthlySpendCents(
  analysisChargeCount: number,
  costPerAnalysisCents = getSoferAnalysisCostCents(),
): number {
  return analysisChargeCount * costPerAnalysisCents;
}

export function isSpendCapReached(
  monthlySpendCapCents: number | null,
  currentSpendCents: number,
): boolean {
  if (monthlySpendCapCents == null) {
    return false;
  }

  return currentSpendCents >= monthlySpendCapCents;
}