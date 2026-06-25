import "server-only";

import { applyManualCorrection } from "@/lib/analysis/correction";
import { createResultStore } from "@/lib/analysis/result-store";
import {
  canViewWithShareLink,
  sanitizePublicAnalysisPayload,
  type PublicAnalysisView,
} from "@/lib/analysis/publication";
import type { VisualizerPage } from "@/lib/fixtures/demo-analysis-types";
import { createAnalysisStorageClient } from "@/lib/services/storage-runtime";
import { createAdminClient } from "@/lib/supabase/admin";

export type SharedResultView = {
  publicId: string;
  publicationMode: "unlisted" | "public";
  publicView: PublicAnalysisView;
  pages: VisualizerPage[];
};

export async function loadSharedResultView(
  publicId: string,
): Promise<SharedResultView | null> {
  const store = createResultStore();
  const result = await store.getByPublicId(publicId);
  if (!result || !canViewWithShareLink(result.publicationMode)) {
    return null;
  }

  const report = await store.getAnalysisReport(result.analysisId);
  if (!report) {
    return null;
  }

  let range = report.range;
  if (result.manualStartRef && result.manualEndRef) {
    range = applyManualCorrection({
      generatedRange: report.range,
      manualStartRef: result.manualStartRef,
      manualEndRef: result.manualEndRef,
      pages: report.sefaria.pages,
    }).effectiveRange;
  }

  const admin = createAdminClient();
  const { data: pageRows } = await admin
    .from("analysis_pages")
    .select("daf_ref, storage_path, image_width, image_height, page_number")
    .eq("analysis_id", result.analysisId)
    .order("page_number", { ascending: true });

  const storage = createAnalysisStorageClient();
  const pages: VisualizerPage[] = [];

  for (const row of pageRows ?? []) {
    let imageUrl = "";
    try {
      imageUrl = await storage.getSignedUrl(row.storage_path);
    } catch {
      imageUrl = "";
    }

    pages.push({
      dafRef: row.daf_ref,
      imageUrl,
      width: row.image_width,
      height: row.image_height,
      markers: [],
    });
  }

  const publicView = sanitizePublicAnalysisPayload({
    ...report,
    range,
    source: {
      ...report.source,
      title: result.title,
    },
  });

  return {
    publicId,
    publicationMode: result.publicationMode as "unlisted" | "public",
    publicView,
    pages,
  };
}