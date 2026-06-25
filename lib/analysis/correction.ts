import {
  enumerateHalfPages,
  formatHalfPageRef,
  parseDafRef,
} from "@/lib/domain/daf-ref";
import type { RangeDetectionResult, ScoredRangeChunk, TextPage } from "@/lib/domain/report";

export type CorrectionErrorCode = "invalid_range" | "invalid_ref";

export class CorrectionError extends Error {
  readonly code: CorrectionErrorCode;

  constructor(code: CorrectionErrorCode, message: string) {
    super(message);
    this.name = "CorrectionError";
    this.code = code;
  }
}

function segmentOrder(ref: string): number {
  const parsed = parseDafRef(ref);
  const halfIndex = parsed.daf * 2 + (parsed.side === "b" ? 1 : 0);
  const segment = parsed.segment ?? 1;
  return halfIndex * 1000 + segment;
}

export function validateCorrectionRange(
  manualStartRef: string,
  manualEndRef: string,
): void {
  try {
    parseDafRef(manualStartRef);
    parseDafRef(manualEndRef);
  } catch {
    throw new CorrectionError("invalid_ref", "Manual refs must be valid Shabbat segment refs.");
  }

  if (segmentOrder(manualStartRef) > segmentOrder(manualEndRef)) {
    throw new CorrectionError(
      "invalid_range",
      "Corrected start cannot follow corrected end.",
    );
  }
}

function chunkFromSegmentRef(
  pages: TextPage[],
  segmentRef: string,
): ScoredRangeChunk {
  for (const page of pages) {
    const segment = page.segments?.find((entry) => entry.ref === segmentRef);
    if (segment) {
      const ordinal = Number(segmentRef.split(":").at(-1) ?? 1) - 1;
      return {
        id: segmentRef,
        ref: page.ref,
        chunkIndex: ordinal,
        ordinal,
        startWord: 0,
        endWord: 1,
        text: segment.en ?? "",
        he: segment.he ?? "",
        tokens: [],
        score: 1,
      };
    }
  }

  const pageRef = formatHalfPageRef(parseDafRef(segmentRef));
  return {
    id: segmentRef,
    ref: pageRef,
    chunkIndex: 0,
    ordinal: Number(segmentRef.split(":").at(-1) ?? 1) - 1,
    startWord: 0,
    endWord: 1,
    text: segmentRef,
    he: "",
    tokens: [],
    score: 1,
  };
}

export type ManualCorrectionResult = {
  generatedRange: RangeDetectionResult;
  manualStartRef: string;
  manualEndRef: string;
  candidateRefs: string[];
  effectiveRange: RangeDetectionResult;
};

export function applyManualCorrection(input: {
  generatedRange: RangeDetectionResult;
  manualStartRef: string;
  manualEndRef: string;
  pages: TextPage[];
}): ManualCorrectionResult {
  validateCorrectionRange(input.manualStartRef, input.manualEndRef);

  const candidateRefs = enumerateHalfPages(
    formatHalfPageRef(parseDafRef(input.manualStartRef)),
    formatHalfPageRef(parseDafRef(input.manualEndRef)),
  );

  const start = chunkFromSegmentRef(input.pages, input.manualStartRef);
  const end = chunkFromSegmentRef(input.pages, input.manualEndRef);

  return {
    generatedRange: input.generatedRange,
    manualStartRef: input.manualStartRef,
    manualEndRef: input.manualEndRef,
    candidateRefs,
    effectiveRange: {
      ...input.generatedRange,
      start,
      end,
    },
  };
}