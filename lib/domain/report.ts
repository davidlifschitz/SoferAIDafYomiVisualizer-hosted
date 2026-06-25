export interface TextSegment {
  ref?: string;
  en?: string;
  he?: string;
}

export interface TextPage {
  ref: string;
  heRef?: string;
  source?: string;
  segments?: TextSegment[];
  en?: string | string[];
  he?: string | string[];
  text?: string;
}

export interface RangeChunk {
  id: string;
  ref: string;
  chunkIndex: number;
  ordinal: number;
  startWord: number;
  endWord: number;
  text: string;
  he: string;
  tokens: string[];
}

export type RangeSelectionReason = "daf-intro-anchor" | "daf-continuation-anchor";

export interface ScoredRangeChunk extends RangeChunk {
  score: number;
  selectionReason?: RangeSelectionReason;
}

export interface TranscriptWindow {
  label: "first" | "middle" | "last";
  text: string;
  tokens: string[];
}

export interface TranscriptWindows {
  first: TranscriptWindow;
  middle: TranscriptWindow;
  last: TranscriptWindow;
}

export interface RangeDetectionResult {
  start: ScoredRangeChunk | null;
  end: ScoredRangeChunk | null;
  confidence: number;
  startCandidates: ScoredRangeChunk[];
  endCandidates: ScoredRangeChunk[];
  windows: {
    first: string;
    last: string;
  };
}

export interface DafYomiReport {
  generatedAt: string;
  status: string;
  source: {
    lectureUrl: string;
    title: string;
    speaker?: string;
    daf?: string;
    candidateRefs?: string[];
    [key: string]: unknown;
  };
  transcript: {
    source?: string;
    title?: string;
    transcriptionId?: string;
    textPreview?: string;
    [key: string]: unknown;
  };
  sefaria: {
    refs: string[];
    pages: TextPage[];
  };
  range: RangeDetectionResult;
  overlay?: unknown;
  blockers?: unknown[];
  nextUserAction?: unknown;
  commands?: unknown;
  [key: string]: unknown;
}
