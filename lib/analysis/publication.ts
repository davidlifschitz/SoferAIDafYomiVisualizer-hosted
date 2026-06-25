import type { DafYomiReport, RangeDetectionResult } from "@/lib/domain/report";

export type PublicationMode = "private" | "unlisted" | "public";

export type PublicAnalysisView = {
  title: string;
  speaker?: string;
  lectureUrl: string;
  candidateRefs: string[];
  range: RangeDetectionResult;
  transcriptPreview?: string;
};

const INTERNAL_SOURCE_KEYS = new Set([
  "soferBatchId",
  "soferTranscriptionId",
  "workflowId",
  "accountEmail",
  "billing",
  "stripeCustomerId",
]);

export function canViewInLibrary(mode: PublicationMode): boolean {
  return mode === "public";
}

export function canViewWithShareLink(mode: PublicationMode): boolean {
  return mode === "public" || mode === "unlisted";
}

export function sanitizePublicAnalysisPayload(
  report: DafYomiReport,
): PublicAnalysisView {
  const source = report.source ?? {};
  const sanitizedSource = Object.fromEntries(
    Object.entries(source).filter(([key]) => !INTERNAL_SOURCE_KEYS.has(key)),
  );

  return {
    title: String(sanitizedSource.title ?? "Daf shiur analysis"),
    speaker:
      typeof sanitizedSource.speaker === "string"
        ? sanitizedSource.speaker
        : undefined,
    lectureUrl: String(sanitizedSource.lectureUrl ?? ""),
    candidateRefs: Array.isArray(sanitizedSource.candidateRefs)
      ? sanitizedSource.candidateRefs.map(String)
      : report.sefaria.refs,
    range: report.range,
    transcriptPreview: report.transcript?.textPreview,
  };
}

export function parsePublicationMode(value: string): PublicationMode | null {
  if (value === "private" || value === "unlisted" || value === "public") {
    return value;
  }
  return null;
}