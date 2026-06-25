import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { WorkflowStore } from "@/lib/analysis/workflow-store";
import type { DafYomiReport } from "@/lib/domain/report";
import { createAdminClient } from "@/lib/supabase/admin";

export function createSupabaseWorkflowStore(admin: SupabaseClient): WorkflowStore {
  return {
    async getAnalysisContext(analysisId) {
      const { data, error } = await admin
        .from("analyses")
        .select(
          `
          id,
          canonical_lectures (
            source_key,
            source_url,
            title
          )
        `,
        )
        .eq("id", analysisId)
        .maybeSingle();

      if (error || !data?.canonical_lectures) {
        return null;
      }

      const lecture = Array.isArray(data.canonical_lectures)
        ? data.canonical_lectures[0]
        : data.canonical_lectures;

      if (!lecture) {
        return null;
      }

      return {
        analysisId: data.id,
        lectureUrl: lecture.source_url,
        sourceKey: lecture.source_key,
        title: lecture.title,
      };
    },

    async getSoferState(analysisId) {
      const { data } = await admin
        .from("analyses")
        .select("sofer_batch_id, sofer_transcription_id, sofer_client_item_id")
        .eq("id", analysisId)
        .maybeSingle();

      if (!data?.sofer_batch_id) {
        return null;
      }

      return {
        batchId: data.sofer_batch_id,
        transcriptionId: data.sofer_transcription_id ?? undefined,
        clientItemId: data.sofer_client_item_id ?? "yutorah-lecture",
      };
    },

    async saveSoferState(analysisId, nextState) {
      const { error } = await admin
        .from("analyses")
        .update({
          sofer_batch_id: nextState.batchId,
          sofer_transcription_id: nextState.transcriptionId ?? null,
          sofer_client_item_id: nextState.clientItemId,
        })
        .eq("id", analysisId);

      if (error) {
        throw new Error(`Failed to persist Sofer identifiers: ${error.message}`);
      }

      return nextState;
    },

    async setStage(analysisId, stage) {
      await admin
        .from("analyses")
        .update({ workflow_stage: stage })
        .eq("id", analysisId);
    },

    async setStatus(analysisId, status) {
      await admin.from("analyses").update({ status }).eq("id", analysisId);
    },

    async saveReport(analysisId, report: DafYomiReport) {
      await admin
        .from("analyses")
        .update({ report_payload: report })
        .eq("id", analysisId);
    },

    async setWorkflowError(analysisId, message) {
      await admin
        .from("analyses")
        .update({ workflow_error: message })
        .eq("id", analysisId);
    },
  };
}

export function createDefaultWorkflowStore(): WorkflowStore {
  return createSupabaseWorkflowStore(createAdminClient());
}