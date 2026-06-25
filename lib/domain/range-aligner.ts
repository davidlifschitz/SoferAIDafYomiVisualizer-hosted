import { previousHalfPageRef } from "./daf-ref";
import type {
  RangeChunk,
  RangeDetectionResult,
  ScoredRangeChunk,
  TextPage,
  TranscriptWindow,
  TranscriptWindows,
} from "./report";
import { stripHtml, tokenize } from "./text-normalizer";

export interface RangeAlignerOptions {
  size?: number;
  step?: number;
  windowWords?: number;
  preferredStartRef?: string;
  preferredEndRef?: string;
  priorShiurEndSegmentRef?: string;
  refBiasMargin?: number;
  introAnchorScore?: number;
  continuationAnchorScore?: number;
  endLatestWithinMargin?: number;
}

interface WordChunk {
  startWord: number;
  endWord: number;
  text: string;
}

function requirePositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function chunksFromWords(words: string[], size = 90, step = 45): WordChunk[] {
  const chunks: WordChunk[] = [];
  if (words.length === 0) return chunks;
  if (words.length <= size) {
    return [{ startWord: 0, endWord: words.length, text: words.join(" ") }];
  }

  for (let start = 0; start < words.length; start += step) {
    const end = Math.min(start + size, words.length);
    chunks.push({ startWord: start, endWord: end, text: words.slice(start, end).join(" ") });
    if (end === words.length) break;
  }
  return chunks;
}

export function buildCandidateChunks(
  pages: TextPage[],
  options: Pick<RangeAlignerOptions, "size" | "step"> = {},
): RangeChunk[] {
  const size = options.size ?? 90;
  const step = options.step ?? 45;
  requirePositiveInteger(size, "size");
  requirePositiveInteger(step, "step");
  const chunks: RangeChunk[] = [];
  let ordinal = 0;

  for (const page of pages) {
    if (Array.isArray(page.segments) && page.segments.length) {
      page.segments.forEach((segment, index) => {
        const text = stripHtml(segment.en || "");
        const he = stripHtml(segment.he || "");
        chunks.push({
          id: segment.ref || `${page.ref}:${index + 1}`,
          ref: page.ref,
          chunkIndex: index + 1,
          ordinal: ordinal++,
          startWord: 0,
          endWord: text.split(/\s+/).filter(Boolean).length,
          text,
          he,
          tokens: tokenize(`${text} ${he}`),
        });
      });
      continue;
    }

    const english = stripHtml(
      Array.isArray(page.en) ? page.en.join(" ") : page.en || page.text || "",
    );
    const hebrew = stripHtml(Array.isArray(page.he) ? page.he.join(" ") : page.he || "");
    const words = english.split(/\s+/).filter(Boolean);
    const pageChunks = chunksFromWords(words, size, step);

    pageChunks.forEach((chunk, index) => {
      chunks.push({
        id: `${page.ref}#chunk-${index + 1}`,
        ref: page.ref,
        chunkIndex: index + 1,
        ordinal: ordinal++,
        startWord: chunk.startWord,
        endWord: chunk.endWord,
        text: chunk.text,
        he: hebrew,
        tokens: tokenize(`${chunk.text} ${hebrew}`),
      });
    });
  }

  return chunks;
}

export function scoreTokens(queryTokens: string[], candidateTokens: string[]): number {
  if (!queryTokens.length || !candidateTokens.length) return 0;
  const query = new Set(queryTokens);
  const candidate = new Set(candidateTokens);
  let overlap = 0;
  for (const token of query) {
    if (candidate.has(token)) overlap += 1;
  }
  const containment = overlap / Math.max(1, Math.min(query.size, candidate.size));
  const jaccard = overlap / Math.max(1, query.size + candidate.size - overlap);
  return Number((0.75 * containment + 0.25 * jaccard).toFixed(4));
}

function phraseBonus(queryText: string, candidateText: string): number {
  const queryTokens = new Set(tokenize(queryText));
  const candidateTokens = new Set(tokenize(candidateText));
  let bonus = 0;
  const bothHave = (token: string) => queryTokens.has(token) && candidateTokens.has(token);

  if (bothHave("רשויות")) bonus += 0.06;
  if (bothHave("קתני")) bonus += 0.06;
  if (bothHave("רבא") || (queryTokens.has("rava") && candidateTokens.has("rava"))) {
    bonus += 0.04;
  }
  if (bothHave("domains")) bonus += 0.03;
  if (bothHave("שבת") && bothHave("שתים")) bonus += 0.02;

  return bonus;
}

export function transcriptWindows(transcriptText: string, windowWords = 180): TranscriptWindows {
  const words = stripHtml(transcriptText).split(/\s+/).filter(Boolean);
  const first = words.slice(0, windowWords).join(" ");
  const last = words.slice(Math.max(0, words.length - windowWords)).join(" ");
  const middleStart = Math.max(
    0,
    Math.floor(words.length / 2) - Math.floor(windowWords / 2),
  );
  const middle = words.slice(middleStart, middleStart + windowWords).join(" ");

  return {
    first: { label: "first", text: first, tokens: tokenize(first) },
    middle: { label: "middle", text: middle, tokens: tokenize(middle) },
    last: { label: "last", text: last, tokens: tokenize(last) },
  };
}

export function rankChunks(
  window: TranscriptWindow,
  chunks: RangeChunk[],
): ScoredRangeChunk[] {
  return chunks
    .map((chunk) => ({
      ...chunk,
      score: Number(
        Math.min(
          1,
          scoreTokens(window.tokens, chunk.tokens) +
            phraseBonus(window.text, `${chunk.text} ${chunk.he}`),
        ).toFixed(4),
      ),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

function selectCandidate(
  candidates: ScoredRangeChunk[],
  {
    preferredRef,
    margin = 0.08,
    mode = "start",
  }: {
    preferredRef?: string;
    margin?: number;
    mode?: "start" | "end";
  } = {},
): ScoredRangeChunk | null {
  const top = candidates[0] ?? null;
  if (!top || !preferredRef) return top;

  const preferred = candidates
    .filter((candidate) => candidate.ref === preferredRef && top.score - candidate.score <= margin)
    .sort((left, right) => {
      if (mode === "end") {
        return right.chunkIndex - left.chunkIndex || right.score - left.score;
      }
      return left.chunkIndex - right.chunkIndex || right.score - left.score;
    })[0];

  return preferred || top;
}

function selectLatestCloseCandidate(
  candidates: ScoredRangeChunk[],
  margin = 0.03,
  preferredRef?: string,
): ScoredRangeChunk | null {
  const top = candidates[0] ?? null;
  if (!top) return null;
  const closeCandidates = candidates.filter(
    (candidate) => top.score - candidate.score <= margin,
  );
  const preferredCandidates = preferredRef
    ? closeCandidates.filter((candidate) => candidate.ref === preferredRef)
    : [];
  return (preferredCandidates.length ? preferredCandidates : closeCandidates)
    .sort((left, right) => right.ordinal - left.ordinal || right.score - left.score)[0];
}

export function looksLikeDafIntro(windowText: string): boolean {
  const lower = windowText.toLowerCase();
  return (
    lower.includes("today") &&
    (lower.includes("daf") || lower.includes("דף")) &&
    (lower.includes("shabbos") || lower.includes("shabbat") || lower.includes("שבת"))
  );
}

export function looksLikeContinuation(windowText: string): boolean {
  const lower = windowText.toLowerCase();
  const hasPriorDayCue =
    lower.includes("yesterday we") ||
    lower.includes("ended with") ||
    lower.includes("we ended") ||
    lower.includes("left off") ||
    lower.includes("where we ended") ||
    lower.includes("pick up where") ||
    lower.includes("picked up where");
  const hasResumeCue =
    lower.includes("continue where") ||
    lower.includes("continuing where") ||
    lower.includes("continue from") ||
    lower.includes("continuing from") ||
    lower.includes("resume") ||
    lower.includes("pick up");

  return hasPriorDayCue || hasResumeCue;
}

function findIntroStart(
  windowText: string,
  chunks: RangeChunk[],
  preferredRef?: string,
): RangeChunk | null {
  if (!preferredRef || !looksLikeDafIntro(windowText)) return null;
  if (looksLikeContinuation(windowText)) return null;
  return (
    chunks.find((chunk) => chunk.ref === preferredRef && chunk.chunkIndex === 1) || null
  );
}

function findContinuationStart(
  startCandidates: ScoredRangeChunk[],
  chunks: RangeChunk[],
  preferredStartRef: string,
  priorShiurEndSegmentRef?: string,
): ScoredRangeChunk | null {
  const priorHalfPage = previousHalfPageRef(preferredStartRef);
  if (!priorHalfPage) return null;

  let minChunkIndex = 1;
  if (priorShiurEndSegmentRef) {
    const priorEnd = chunks.find((chunk) => chunk.id === priorShiurEndSegmentRef);
    if (priorEnd?.ref === priorHalfPage) {
      minChunkIndex = priorEnd.chunkIndex + 1;
    }
  }

  const priorCandidates = startCandidates.filter(
    (candidate) =>
      candidate.ref === priorHalfPage && candidate.chunkIndex >= minChunkIndex,
  );
  if (!priorCandidates.length) return null;

  return priorCandidates.sort(
    (left, right) =>
      right.score - left.score ||
      left.chunkIndex - right.chunkIndex ||
      left.ordinal - right.ordinal,
  )[0];
}

export function detectRange(
  transcriptText: string,
  pages: TextPage[],
  options: RangeAlignerOptions = {},
): RangeDetectionResult {
  const chunks = buildCandidateChunks(pages, options);
  const windows = transcriptWindows(transcriptText, options.windowWords ?? 180);
  const startCandidates = rankChunks(windows.first, chunks);
  const endCandidates = rankChunks(windows.last, chunks);
  const start =
    (() => {
      if (
        options.preferredStartRef &&
        looksLikeDafIntro(windows.first.text) &&
        looksLikeContinuation(windows.first.text)
      ) {
        const continuationStart = findContinuationStart(
          startCandidates,
          chunks,
          options.preferredStartRef,
          options.priorShiurEndSegmentRef,
        );
        if (continuationStart) {
          return {
            ...continuationStart,
            score: options.continuationAnchorScore ?? 0.78,
            selectionReason: "daf-continuation-anchor" as const,
          };
        }
      }

      const introStart = findIntroStart(
        windows.first.text,
        chunks,
        options.preferredStartRef,
      );
      return introStart
        ? {
            ...introStart,
            score: options.introAnchorScore ?? 0.8,
            selectionReason: "daf-intro-anchor" as const,
          }
        : null;
    })() ||
    selectCandidate(startCandidates, {
      preferredRef: options.preferredStartRef,
      margin: options.refBiasMargin,
      mode: "start",
    });
  const orderedEndCandidates = start
    ? endCandidates.filter((candidate) => candidate.ordinal >= start.ordinal)
    : endCandidates;
  if (start && orderedEndCandidates.length === 0) {
    throw new RangeError("No end candidate occurs at or after the selected start");
  }
  const endPool = orderedEndCandidates;
  const end =
    selectLatestCloseCandidate(
      endPool,
      options.endLatestWithinMargin ?? 0.03,
      options.preferredEndRef,
    ) ||
    selectCandidate(endPool, {
      preferredRef: options.preferredEndRef,
      margin: options.refBiasMargin,
      mode: "end",
    });
  const confidence = start && end ? Number(((start.score + end.score) / 2).toFixed(4)) : 0;

  return {
    start,
    end,
    confidence,
    startCandidates,
    endCandidates,
    windows: {
      first: windows.first.text,
      last: windows.last.text,
    },
  };
}
