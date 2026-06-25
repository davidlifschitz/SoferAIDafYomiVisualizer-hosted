const DAF_YOMI_SHABBAT_MASSECHET_ID = 284;
const DAF_YOMI_SHABBAT_2A_PAGE_ID = 126;
const MIN_SHABBAT_DAF = 2;
const MAX_SHABBAT_DAF = 157;

export const MAX_ENUMERATED_HALF_PAGES =
  (MAX_SHABBAT_DAF - MIN_SHABBAT_DAF + 1) * 2;

export type DafSide = "a" | "b";

export interface DafRef {
  tractate: string;
  daf: number;
  side: DafSide;
  segment?: number;
}

export interface ParsedDafRef extends DafRef {
  tractate: "Shabbat";
}

export type DafRefInput = string | DafRef;

export function parseDafRef(ref: string): ParsedDafRef {
  const match = String(ref)
    .trim()
    .match(/^(?:Shabbat|Shabbos)[ .]+(\d+)([ab])(?:[:#](\d+))?$/i);

  if (!match) throw new Error(`Unsupported daf ref: ${ref}`);

  const daf = Number(match[1]);
  const segment = match[3] === undefined ? undefined : Number(match[3]);
  if (
    !Number.isSafeInteger(daf) ||
    daf < MIN_SHABBAT_DAF ||
    daf > MAX_SHABBAT_DAF ||
    (segment !== undefined && (!Number.isSafeInteger(segment) || segment <= 0))
  ) {
    throw new RangeError(`Shabbat daf ref is out of range: ${ref}`);
  }

  return {
    tractate: "Shabbat",
    daf,
    side: match[2].toLowerCase() as DafSide,
    ...(segment === undefined ? {} : { segment }),
  };
}

function coerceDafRef(ref: DafRefInput): DafRef {
  const parsed = typeof ref === "string" ? parseDafRef(ref) : ref;
  if (
    !Number.isSafeInteger(parsed.daf) ||
    parsed.daf < MIN_SHABBAT_DAF ||
    parsed.daf > MAX_SHABBAT_DAF ||
    (parsed.segment !== undefined &&
      (!Number.isSafeInteger(parsed.segment) || parsed.segment <= 0))
  ) {
    throw new RangeError(
      `Daf ref is out of range: ${parsed.tractate} ${parsed.daf}${parsed.side}`,
    );
  }
  return parsed;
}

export function formatDafRef(ref: DafRefInput, includeSegment = true): string {
  const parsed = coerceDafRef(ref);
  const halfPage = `${parsed.tractate} ${parsed.daf}${parsed.side}`;
  return includeSegment && parsed.segment !== undefined
    ? `${halfPage}:${parsed.segment}`
    : halfPage;
}

export function formatHalfPageRef(ref: DafRefInput): string {
  return formatDafRef(ref, false);
}

function halfPageIndex(ref: DafRef): number {
  return ref.daf * 2 + (ref.side === "b" ? 1 : 0);
}

export function dafYomiMassechetId(ref: DafRefInput): number {
  const parsed = coerceDafRef(ref);
  if (parsed.tractate !== "Shabbat") {
    throw new Error(`Unsupported daf-yomi tractate: ${parsed.tractate}`);
  }

  return DAF_YOMI_SHABBAT_MASSECHET_ID;
}

export function dafYomiAmud(ref: DafRefInput): number {
  return halfPageIndex(coerceDafRef(ref)) - 1;
}

export function dafYomiPageId(ref: DafRefInput): number {
  const parsed = coerceDafRef(ref);
  if (parsed.tractate !== "Shabbat") {
    throw new Error(`Unsupported daf-yomi tractate: ${parsed.tractate}`);
  }

  return (
    DAF_YOMI_SHABBAT_2A_PAGE_ID +
    (halfPageIndex(parsed) - halfPageIndex(parseDafRef("Shabbat 2a")))
  );
}

export const DAF_YOMI_PAGE_URL_BASE = "https://daf-yomi.com/Dafyomi_Page.aspx";
export const DAF_YOMI_PDF_URL_BASE =
  "https://daf-yomi.com/Data/UploadedFiles/DY_Page";

export function dafYomiPageUrl(ref: DafRefInput): string {
  const massechet = dafYomiMassechetId(ref);
  const amud = dafYomiAmud(ref);
  return `${DAF_YOMI_PAGE_URL_BASE}?massechet=${massechet}&amud=${amud}&fs=1`;
}

export function dafYomiPdfUrl(ref: DafRefInput): string {
  return `${DAF_YOMI_PDF_URL_BASE}/${dafYomiPageId(ref)}.pdf`;
}

export function previousHalfPageRef(ref: DafRefInput): string | null {
  const parsed = coerceDafRef(ref);
  const startIndex = halfPageIndex(parseDafRef("Shabbat 2a"));
  const currentIndex = halfPageIndex(parsed);
  if (currentIndex <= startIndex) {
    return null;
  }

  const previousIndex = currentIndex - 1;
  const daf = Math.floor(previousIndex / 2);
  const side: DafSide = previousIndex % 2 === 0 ? "a" : "b";
  return formatHalfPageRef({ tractate: parsed.tractate, daf, side });
}

export function enumerateHalfPages(startRef: DafRefInput, endRef: DafRefInput): string[] {
  const start = coerceDafRef(startRef);
  const end = coerceDafRef(endRef);

  if (start.tractate !== end.tractate) {
    throw new Error(`Cannot enumerate a cross-tractate range: ${start.tractate} to ${end.tractate}`);
  }

  const startIndex = halfPageIndex(start);
  const endIndex = halfPageIndex(end);
  if (endIndex < startIndex) throw new Error("Cannot enumerate a reversed daf range");
  const halfPageCount = endIndex - startIndex + 1;
  if (halfPageCount > MAX_ENUMERATED_HALF_PAGES) {
    throw new RangeError(
      `Daf range exceeds maximum of ${MAX_ENUMERATED_HALF_PAGES} half-pages`,
    );
  }

  return Array.from({ length: halfPageCount }, (_, offset) => {
    const index = startIndex + offset;
    const daf = Math.floor(index / 2);
    const side: DafSide = index % 2 === 0 ? "a" : "b";
    return formatHalfPageRef({ tractate: start.tractate, daf, side });
  });
}
