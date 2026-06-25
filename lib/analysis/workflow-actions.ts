import {
  enumerateHalfPages,
  formatHalfPageRef,
  parseDafRef,
} from "@/lib/domain/daf-ref";
import { detectRange } from "@/lib/domain/range-aligner";
import type { DafYomiReport, TextPage } from "@/lib/domain/report";
import {
  extractSoferBatchId,
  isTerminalSoferStatus,
  type SoferClient,
  type SoferJobStatus,
} from "@/lib/services/sofer";
import type { ResolvedLecture } from "@/lib/analysis/workflow-types";
import type { WorkflowStore } from "@/lib/analysis/workflow-store";

export const DEFAULT_SOFER_CLIENT_ITEM_ID = "yutorah-lecture";
export const DEFAULT_SOFER_POLL_INTERVAL_MS = 30_000;
export const DEFAULT_SOFER_MAX_POLLS = 120;

export type WorkflowSoferDependencies = {
  store: WorkflowStore;
  sofer: SoferClient;
};

export async function ensureSoferSubmission(
  analysisId: string,
  deps: WorkflowSoferDependencies,
  input: {
    audioUrl: string;
    title: string;
    clientItemId?: string;
  },
): Promise<{ batchId: string; clientItemId: string }> {
  const clientItemId = input.clientItemId ?? DEFAULT_SOFER_CLIENT_ITEM_ID;
  const existing = await deps.store.getSoferState(analysisId);
  if (existing?.batchId) {
    return {
      batchId: existing.batchId,
      clientItemId: existing.clientItemId ?? clientItemId,
    };
  }

  const created = await deps.sofer.createExpressBatch({
    audioUrl: input.audioUrl,
    title: input.title,
    clientItemId,
  });
  const batchId = extractSoferBatchId(created);
  if (!batchId) {
    throw new Error("Sofer batch create did not return batch_id");
  }

  await deps.store.saveSoferState(analysisId, {
    batchId,
    clientItemId,
  });

  return { batchId, clientItemId };
}

export async function pollSoferBatchStatus(
  batchId: string,
  sofer: SoferClient,
  options: {
    maxPolls?: number;
    pollIntervalMs?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<SoferJobStatus> {
  const maxPolls = options.maxPolls ?? DEFAULT_SOFER_MAX_POLLS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_SOFER_POLL_INTERVAL_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  let lastStatus: SoferJobStatus | undefined;

  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    const statusResponse = await sofer.getBatchStatus(batchId);
    lastStatus = statusResponse.status;
    if (lastStatus && isTerminalSoferStatus(lastStatus)) {
      return lastStatus;
    }

    if (attempt < maxPolls - 1) {
      await sleep(pollIntervalMs);
    }
  }

  throw new Error(
    `Sofer batch ${batchId} did not finish before deadline (last status: ${lastStatus ?? "unknown"})`,
  );
}

export async function resolveSoferTranscriptionId(
  batchId: string,
  clientItemId: string,
  sofer: SoferClient,
): Promise<string> {
  const item = await sofer.getByClientItemId(batchId, clientItemId);
  const transcriptionId =
    typeof item.transcription_id === "string"
      ? item.transcription_id
      : typeof item.id === "string"
        ? item.id
        : undefined;

  if (!transcriptionId) {
    throw new Error("Sofer client item did not include a transcription id");
  }

  return transcriptionId;
}

export function candidateSefariaRefsFromRange(
  startRef: string | undefined,
  endRef: string | undefined,
  fallbackRefs: string[],
): string[] {
  if (!startRef || !endRef) {
    return fallbackRefs;
  }

  return enumerateHalfPages(
    formatHalfPageRef(parseDafRef(startRef)),
    formatHalfPageRef(parseDafRef(endRef)),
  );
}

export function buildWorkflowReport(input: {
  resolved: ResolvedLecture;
  transcriptText: string;
  transcriptionId: string;
  pages: TextPage[];
  candidateRefs: string[];
}): DafYomiReport {
  const range = detectRange(input.transcriptText, input.pages, {
    preferredStartRef: "Shabbat 2a",
    preferredEndRef: "Shabbat 2b",
  });
  const startRef = range.start?.id;
  const endRef = range.end?.id;

  return {
    generatedAt: new Date().toISOString(),
    status: "matched",
    source: {
      lectureUrl: input.resolved.lectureUrl,
      title: input.resolved.title,
      speaker: input.resolved.speaker,
      daf: input.resolved.dafLabel,
      candidateRefs: candidateSefariaRefsFromRange(
        startRef,
        endRef,
        input.candidateRefs,
      ),
    },
    transcript: {
      source: "sofer",
      title: input.resolved.title,
      transcriptionId: input.transcriptionId,
      textPreview: input.transcriptText.slice(0, 280),
    },
    sefaria: {
      refs: input.pages.map((page) => page.ref),
      pages: input.pages,
    },
    range,
  };
}

export type CapturePagesResult = {
  captured: number;
  total: number;
};

export async function captureRequiredPages(
  halfPages: string[],
): Promise<CapturePagesResult> {
  // Task 7 wires Browserless capture and Supabase Storage uploads.
  return {
    captured: 0,
    total: halfPages.length,
  };
}