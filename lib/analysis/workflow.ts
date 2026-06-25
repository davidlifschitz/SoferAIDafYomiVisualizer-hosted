import { FatalError, sleep } from "workflow";

import {
  capturePagesStep,
  fetchTranscriptStep,
  markSoferFailedStep,
  matchRangeStep,
  pollSoferOnceStep,
  resolveLectureStep,
  submitOrReuseSoferStep,
} from "@/lib/analysis/steps";
import { isTerminalSoferStatus } from "@/lib/services/sofer";

const MAX_SOFER_POLLS = 120;

export async function runAnalysisWorkflow(analysisId: string) {
  "use workflow";

  if (!analysisId.trim()) {
    throw new FatalError("analysisId is required");
  }

  const resolved = await resolveLectureStep(analysisId);
  const sofer = await submitOrReuseSoferStep(analysisId, resolved);

  let status = await pollSoferOnceStep(sofer.batchId);
  let polls = 1;

  while (!isTerminalSoferStatus(status) && polls < MAX_SOFER_POLLS) {
    await sleep("30s");
    status = await pollSoferOnceStep(sofer.batchId);
    polls += 1;
  }

  if (status === "failed") {
    await markSoferFailedStep(analysisId);
    return { analysisId, status: "failed" as const };
  }

  if (!isTerminalSoferStatus(status)) {
    throw new FatalError(`Analysis ${analysisId} exceeded the Sofer polling deadline`);
  }

  const transcript = await fetchTranscriptStep(
    analysisId,
    sofer.batchId,
    sofer.clientItemId,
  );
  const report = await matchRangeStep(
    analysisId,
    resolved,
    transcript.transcriptText,
    transcript.transcriptionId,
  );
  const capture = await capturePagesStep(
    analysisId,
    report.source.candidateRefs ?? [],
  );

  return {
    analysisId,
    status: capture.captured === capture.total ? "complete" : "partial",
  };
}