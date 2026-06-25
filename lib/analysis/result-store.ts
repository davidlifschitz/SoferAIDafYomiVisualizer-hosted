import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { CorrectionError, applyManualCorrection } from "@/lib/analysis/correction";
import type { PublicationMode } from "@/lib/analysis/publication";
import type { DafYomiReport } from "@/lib/domain/report";
import { createAdminClient } from "@/lib/supabase/admin";

export type UserResultRecord = {
  id: string;
  userId: string;
  analysisId: string;
  publicationMode: PublicationMode;
  publicId: string;
  title: string;
  manualStartRef: string | null;
  manualEndRef: string | null;
};

export function createResultStore(admin: SupabaseClient = createAdminClient()) {
  return {
    async getByAnalysisId(analysisId: string): Promise<UserResultRecord | null> {
      const { data } = await admin
        .from("user_results")
        .select(
          "id, user_id, analysis_id, publication_mode, public_id, title, manual_start_ref, manual_end_ref",
        )
        .eq("analysis_id", analysisId)
        .maybeSingle();

      if (!data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        analysisId: data.analysis_id,
        publicationMode: data.publication_mode,
        publicId: data.public_id,
        title: data.title,
        manualStartRef: data.manual_start_ref,
        manualEndRef: data.manual_end_ref,
      };
    },

    async getByPublicId(publicId: string): Promise<UserResultRecord | null> {
      const { data } = await admin
        .from("user_results")
        .select(
          "id, user_id, analysis_id, publication_mode, public_id, title, manual_start_ref, manual_end_ref",
        )
        .eq("public_id", publicId)
        .maybeSingle();

      if (!data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        analysisId: data.analysis_id,
        publicationMode: data.publication_mode,
        publicId: data.public_id,
        title: data.title,
        manualStartRef: data.manual_start_ref,
        manualEndRef: data.manual_end_ref,
      };
    },

    async getAnalysisReport(analysisId: string): Promise<DafYomiReport | null> {
      const { data } = await admin
        .from("analyses")
        .select("report_payload")
        .eq("id", analysisId)
        .maybeSingle();

      return (data?.report_payload as DafYomiReport | null) ?? null;
    },

    async listPublicResults(): Promise<UserResultRecord[]> {
      const { data } = await admin
        .from("user_results")
        .select(
          "id, user_id, analysis_id, publication_mode, public_id, title, manual_start_ref, manual_end_ref",
        )
        .eq("publication_mode", "public")
        .order("created_at", { ascending: false });

      return (data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        analysisId: row.analysis_id,
        publicationMode: row.publication_mode,
        publicId: row.public_id,
        title: row.title,
        manualStartRef: row.manual_start_ref,
        manualEndRef: row.manual_end_ref,
      }));
    },

    async applyCorrection(input: {
      analysisId: string;
      userId: string;
      manualStartRef: string;
      manualEndRef: string;
    }) {
      const result = await this.getByAnalysisId(input.analysisId);
      if (!result || result.userId !== input.userId) {
        throw new CorrectionError("invalid_ref", "Analysis result was not found.");
      }

      const report = await this.getAnalysisReport(input.analysisId);
      if (!report?.range) {
        throw new CorrectionError("invalid_ref", "Generated analysis report is unavailable.");
      }

      const corrected = applyManualCorrection({
        generatedRange: report.range,
        manualStartRef: input.manualStartRef,
        manualEndRef: input.manualEndRef,
        pages: report.sefaria.pages,
      });

      const { error } = await admin
        .from("user_results")
        .update({
          manual_start_ref: corrected.manualStartRef,
          manual_end_ref: corrected.manualEndRef,
        })
        .eq("analysis_id", input.analysisId)
        .eq("user_id", input.userId);

      if (error) {
        throw new Error(`Failed to save manual correction: ${error.message}`);
      }

      return corrected;
    },

    async updatePublicationMode(input: {
      resultId: string;
      userId: string;
      mode: PublicationMode;
    }) {
      const { data, error } = await admin
        .from("user_results")
        .update({ publication_mode: input.mode })
        .eq("id", input.resultId)
        .eq("user_id", input.userId)
        .select(
          "id, user_id, analysis_id, publication_mode, public_id, title, manual_start_ref, manual_end_ref",
        )
        .maybeSingle();

      if (error || !data) {
        throw new Error("Failed to update publication mode.");
      }

      return {
        id: data.id,
        userId: data.user_id,
        analysisId: data.analysis_id,
        publicationMode: data.publication_mode,
        publicId: data.public_id,
        title: data.title,
        manualStartRef: data.manual_start_ref,
        manualEndRef: data.manual_end_ref,
      } satisfies UserResultRecord;
    },
  };
}