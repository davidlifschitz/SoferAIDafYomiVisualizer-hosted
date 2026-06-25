export type MarkerLocateSource = "vision" | "manual";

export interface MarkerLocateRequest {
  imageWidth: number;
  imageHeight: number;
  dafRef: string;
  segmentRef: string;
  hebrewSnippet: string;
}

export interface MarkerLocateResult {
  x: number;
  y: number;
  confidence: number;
  source: MarkerLocateSource;
  model?: string;
  segmentRef: string;
}

export const DEFAULT_GEMARA_COLUMN_BOUNDS = {
  left: 290,
  right: 930,
  top: 260,
  bottom: 1880,
} as const;

export function buildMarkerLocatePrompt(request: MarkerLocateRequest): string {
  const { left, right, top, bottom } = DEFAULT_GEMARA_COLUMN_BOUNDS;

  return [
    "Locate Hebrew text on a Vilna-style Talmud page image.",
    `Image size: ${request.imageWidth}x${request.imageHeight} pixels.`,
    `Daf: ${request.dafRef}`,
    `Segment: ${request.segmentRef}`,
    "",
    "Find the FIRST occurrence of this Hebrew phrase in the CENTER gemara/mishna column only.",
    "Ignore Rashi (right commentary) and Tosafot (left commentary).",
    `Phrase: ${request.hebrewSnippet}`,
    "",
    `Center column pixel bounds: x ${left}-${right}, y ${top}-${bottom}.`,
    "",
    "Return ONLY JSON with coordinates relative to the center column box:",
    '{"columnX": <0-1 from left edge of center column>, "columnY": <0-1 from top edge of center column>, "confidence": <0-1>}',
    "",
    "Place the point at the start of the phrase in the center column.",
    "If locating the mishna opening, target the large emphasized first word near the top of the column.",
    "For RTL text, columnX is where the phrase begins horizontally — often mid-column, not always at the right edge.",
  ].join("\n");
}

export function assertMarkerInGemaraColumn(
  x: number,
  y: number,
  bounds: typeof DEFAULT_GEMARA_COLUMN_BOUNDS = DEFAULT_GEMARA_COLUMN_BOUNDS,
): void {
  if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) {
    throw new Error(
      `Vision coordinates (${x}, ${y}) are outside gemara column bounds`,
    );
  }
}

export function parseMarkerLocateResponse(
  raw: string,
  imageWidth: number,
  imageHeight: number,
): Pick<MarkerLocateResult, "x" | "y" | "confidence"> {
  const jsonText = extractJsonObject(raw);
  const parsed = JSON.parse(jsonText) as {
    x?: number;
    y?: number;
    columnX?: number;
    columnY?: number;
    confidence?: number;
  };

  const confidence = clampConfidence(parsed.confidence);
  const bounds = DEFAULT_GEMARA_COLUMN_BOUNDS;

  if (parsed.columnX !== undefined && parsed.columnY !== undefined) {
    const columnX = clampUnit(parsed.columnX);
    const columnY = clampUnit(parsed.columnY);
    const x = Math.round(
      bounds.left + columnX * (bounds.right - bounds.left),
    );
    const y = Math.round(
      bounds.top + columnY * (bounds.bottom - bounds.top),
    );

    return { x, y, confidence };
  }

  if (parsed.x === undefined || parsed.y === undefined) {
    throw new Error("Vision response missing coordinates");
  }

  const x = normalizeCoordinate(parsed.x, imageWidth);
  const y = normalizeCoordinate(parsed.y, imageHeight);

  if (x < 0 || y < 0 || x > imageWidth || y > imageHeight) {
    throw new Error(`Vision coordinates out of bounds: (${x}, ${y})`);
  }

  assertMarkerInGemaraColumn(x, y);

  return { x, y, confidence };
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Vision column coordinate is not a number");
  }

  return Math.max(0, Math.min(1, value));
}

function extractJsonObject(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return raw.slice(start, end + 1);
  }

  throw new Error("Vision response did not include JSON");
}

function normalizeCoordinate(value: number, max: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Vision coordinate is not a number");
  }

  if (value >= 0 && value <= 1) {
    return Math.round(value * max);
  }

  return Math.round(value);
}

function clampConfidence(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 0.5;
  }

  return Math.max(0, Math.min(1, value));
}