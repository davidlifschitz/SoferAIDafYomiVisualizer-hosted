import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createInMemoryRateLimiter } from "@/lib/analysis/rate-limit";
import {
  SubmitError,
  type SubmitDependencies,
  type SubmitStore,
} from "@/lib/analysis/submit";
import { createTurnstileClient, getTurnstileSecret } from "@/lib/services/turnstile";
import { createAdminClient } from "@/lib/supabase/admin";

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function createSupabaseSubmitStore(admin: SupabaseClient): SubmitStore {
  return {
    async getAppSettings() {
      const { data, error } = await admin
        .from("app_settings")
        .select("submissions_paused, monthly_spend_cap_cents")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        return null;
      }

      return data;
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

    async findCanonicalLecture(sourceKey) {
      const { data } = await admin
        .from("canonical_lectures")
        .select("id, source_key, source_url, title")
        .eq("source_key", sourceKey)
        .maybeSingle();

      return data;
    },

    async upsertCanonicalLecture(sourceKey, sourceUrl, title) {
      const { data, error } = await admin
        .from("canonical_lectures")
        .upsert(
          {
            source_key: sourceKey,
            source_url: sourceUrl,
            title,
          },
          { onConflict: "source_key" },
        )
        .select("id, source_key, source_url, title")
        .single();

      if (error || !data) {
        throw new SubmitError("internal_error", "Failed to save lecture metadata.");
      }

      return data;
    },

    async findCompletedAnalysis(canonicalLectureId) {
      const { data } = await admin
        .from("analyses")
        .select("id, canonical_lecture_id, requested_by, idempotency_key, status")
        .eq("canonical_lecture_id", canonicalLectureId)
        .eq("status", "complete")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      return data;
    },

    async findAnalysisByIdempotencyKey(idempotencyKey) {
      const { data } = await admin
        .from("analyses")
        .select("id, canonical_lecture_id, requested_by, idempotency_key, status")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      return data;
    },

    async countActiveAnalyses(userId) {
      const { count, error } = await admin
        .from("analyses")
        .select("id", { count: "exact", head: true })
        .eq("requested_by", userId)
        .in("status", ["pending", "processing"]);

      if (error) {
        return 0;
      }

      return count ?? 0;
    },

    async getBalance(userId) {
      const { data, error } = await admin
        .from("credit_ledger")
        .select("amount")
        .eq("user_id", userId);

      if (error) {
        throw new SubmitError("internal_error", "Failed to read credit balance.");
      }

      return (data ?? []).reduce((total, entry) => total + entry.amount, 0);
    },

    async createAnalysis({ canonicalLectureId, userId, idempotencyKey }) {
      const { data, error } = await admin
        .from("analyses")
        .insert({
          canonical_lecture_id: canonicalLectureId,
          requested_by: userId,
          idempotency_key: idempotencyKey,
          status: "pending",
        })
        .select("id, canonical_lecture_id, requested_by, idempotency_key, status")
        .single();

      if (error || !data) {
        throw new SubmitError("internal_error", "Failed to create analysis.");
      }

      return data;
    },

    async deleteAnalysis(analysisId) {
      await admin.from("analyses").delete().eq("id", analysisId);
    },

    async chargeCredit(userId, idempotencyKey, analysisId) {
      const { data, error } = await admin.rpc("charge_credit", {
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
        p_analysis_id: analysisId,
      });

      if (error) {
        throw error;
      }

      return Number(data);
    },
  };
}

export function createDefaultSubmitDependencies(): SubmitDependencies {
  const admin = createAdminClient();

  return {
    turnstile: createTurnstileClient(getTurnstileSecret()),
    rateLimiter: createInMemoryRateLimiter(),
    store: createSupabaseSubmitStore(admin),
  };
}