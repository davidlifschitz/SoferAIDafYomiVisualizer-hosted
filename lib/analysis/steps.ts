import {
  buildWorkflowReport,
  captureRequiredPages,
  candidateSefariaRefsFromRange,
  ensureSoferSubmission,
  resolveSoferTranscriptionId,
} from "@/lib/analysis/workflow-actions";
import { createBrowserlessClient } from "@/lib/services/browserless";
import { createAnalysisStorageClient } from "@/lib/services/storage-runtime";
import { createDefaultWorkflowStore } from "@/lib/analysis/workflow-store-supabase";
import type { WorkflowStore } from "@/lib/analysis/workflow-store";
import type { ResolvedLecture } from "@/lib/analysis/workflow-types";
import { createSoferClient } from "@/lib/analysis/workflow-runtime";
import { detectRange } from "@/lib/domain/range-aligner";
import { SefariaClient } from "@/lib/services/sefaria";
import {
  extractSoferTranscriptText,
  type SoferJobStatus,
} from "@/lib/services/sofer";
import { resolveYutorahLecture } from "@/lib/services/yutorah";

async function workflowStore(): Promise<WorkflowStore> {
  return createDefaultWorkflowStore();
}

export async function resolveLectureStep(analysisId: string): Promise<ResolvedLecture> {
  "use step";

  const store = await workflowStore();
  const context = await store.getAnalysisContext(analysisId);
  if (!context) {
    throw new Error(`Analysis ${analysisId} was not found`);
  }

  await store.setStage(analysisId, "resolving");
  await store.setStatus(analysisId, "processing");

  const resolved = await resolveYutorahLecture(context.lectureUrl);
  await store.setStage(analysisId, "transcribing");
  return resolved;
}

export async function submitOrReuseSoferStep(
  analysisId: string,
  resolved: ResolvedLecture,
): Promise<{ batchId: string; clientItemId: string }> {
  "use step";

  const store = await workflowStore();
  const sofer = createSoferClient();

  return ensureSoferSubmission(
    analysisId,
    { store, sofer },
    {
      audioUrl: resolved.audioUrl,
      title: resolved.title,
    },
  );
}

export async function pollSoferOnceStep(batchId: string): Promise<SoferJobStatus> {
  "use step";

  const sofer = createSoferClient();
  const response = await sofer.getBatchStatus(batchId);
  return response.status ?? "pending";
}

export async function markSoferFailedStep(analysisId: string): Promise<void> {
  "use step";

  const store = await workflowStore();
  await store.setWorkflowError(analysisId, "Sofer transcription failed");
  await store.setStatus(analysisId, "failed");
}

export async function fetchTranscriptStep(
  analysisId: string,
  batchId: string,
  clientItemId: string,
): Promise<{ transcriptText: string; transcriptionId: string }> {
  "use step";

  const store = await workflowStore();
  const sofer = createSoferClient();
  const existing = await store.getSoferState(analysisId);
  let transcriptionId = existing?.transcriptionId;

  if (!transcriptionId) {
    transcriptionId = await resolveSoferTranscriptionId(
      batchId,
      clientItemId,
      sofer,
    );
    await store.saveSoferState(analysisId, {
      batchId,
      clientItemId,
      transcriptionId,
    });
  }

  const transcription = await sofer.getTranscription(transcriptionId);
  const transcriptText = extractSoferTranscriptText(transcription);
  if (!transcriptText) {
    throw new Error("Sofer transcription did not include text");
  }

  await store.setStage(analysisId, "matching");
  return { transcriptText, transcriptionId };
}

export async function matchRangeStep(
  analysisId: string,
  resolved: ResolvedLecture,
  transcriptText: string,
  transcriptionId: string,
) {
  "use step";

  const store = await workflowStore();
  const sefaria = new SefariaClient();
  const fallbackRefs = ["Shabbat 2a", "Shabbat 2b"];
  const pages = await sefaria.fetchTextPages(fallbackRefs);
  const report = buildWorkflowReport({
    resolved,
    transcriptText,
    transcriptionId,
    pages,
    candidateRefs: fallbackRefs,
  });

  const refs = candidateSefariaRefsFromRange(
    report.range.start?.id,
    report.range.end?.id,
    fallbackRefs,
  );

  if (refs.join(",") !== fallbackRefs.join(",")) {
    const expandedPages = await sefaria.fetchTextPages(refs);
    report.sefaria.refs = expandedPages.map((page) => page.ref);
    report.sefaria.pages = expandedPages;
    report.range = detectRange(transcriptText, expandedPages, {
      preferredStartRef: "Shabbat 2a",
      preferredEndRef: "Shabbat 2b",
    });
    report.source.candidateRefs = refs;
  }

  await store.saveReport(analysisId, report);
  await store.setStage(analysisId, "capturing");
  return report;
}

export async function capturePagesStep(
  analysisId: string,
  candidateRefs: string[],
) {
  "use step";

  const store = await workflowStore();
  const capture = await captureRequiredPages(candidateRefs, {
    analysisId,
    browserless: createBrowserlessClient(),
    storage: createAnalysisStorageClient(),
    store,
  });
  const status = capture.captured === capture.total ? "complete" : "partial";
  await store.setStatus(analysisId, status);
  await store.setStage(analysisId, "complete");
  return capture;
}