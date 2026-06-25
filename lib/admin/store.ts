import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminStore, ProblemAnalysisRecord } from "@/lib/admin/operations";
import { createAdminClient } from "@/lib/supabase/admin";

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function createSupabaseAdminStore(
  admin: SupabaseClient = createAdminClient(),
): AdminStore {
  return {
    async getSettings() {
      const { data, error } = await admin
        .from("app_settings")
        .select("submissions_paused, monthly_spend_cap_cents")
        .eq("id", 1)
        .single();

      if (error || !data) {
        throw new Error("Failed to load app settings.");
      }

      return data;
    },

    async saveSettings({ submissionsPaused, monthlySpendCapCents, adminId }) {
      const patch: Record<string, boolean | number | null | string> = {
        updated_by: adminId,
      };

      if (submissionsPaused !== undefined) {
        patch.submissions_paused = submissionsPaused;
      }

      if (monthlySpendCapCents !== undefined) {
        patch.monthly_spend_cap_cents = monthlySpendCapCents;
      }

      const { data, error } = await admin
        .from("app_settings")
        .update(patch)
        .eq("id", 1)
        .select("submissions_paused, monthly_spend_cap_cents")
        .single();

      if (error || !data) {
        throw new Error("Failed to update app settings.");
      }

      return data;
    },

    async getUserBalance(userId) {
      const { data, error } = await admin
        .from("credit_ledger")
        .select("amount")
        .eq("user_id", userId);

      if (error) {
        throw new Error("Failed to read user balance.");
      }

      return (data ?? []).reduce((total, entry) => total + entry.amount, 0);
    },

    async insertCreditAdjustment({
      userId,
      amount,
      reason,
      idempotencyKey,
    }) {
      const { error } = await admin.from("credit_ledger").insert({
        user_id: userId,
        amount,
        reason: "admin_adjustment",
        idempotency_key: idempotencyKey,
        note: reason,
      });

      if (error && !error.message.includes("duplicate key")) {
        throw new Error(`Failed to adjust credits: ${error.message}`);
      }

      return this.getUserBalance(userId);
    },

    async countMonthlyAnalysisCharges() {
      const { count, error } = await admin
        .from("credit_ledger")
        .select("id", { count: "exact", head: true })
        .eq("reason", "analysis_charge")
        .gte("created_at", monthStartIso());

      if (error) {
        return 0;
      }

      return count ?? 0;
    },

    async listProblemAnalyses(limit = 20) {
      const { data, error } = await admin
        .from("analyses")
        .select(
          "id, status, workflow_error, created_at, canonical_lectures(title, source_key)",
        )
        .in("status", ["failed", "partial"])
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return [];
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        status: row.status as ProblemAnalysisRecord["status"],
        workflow_error: row.workflow_error,
        created_at: row.created_at,
        canonical_lectures: Array.isArray(row.canonical_lectures)
          ? row.canonical_lectures[0] ?? null
          : row.canonical_lectures,
      }));
    },
  };
}

export function createDefaultAdminStore(): AdminStore {
  return createSupabaseAdminStore();
}