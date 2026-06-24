const VARIANTS = new Map<string, string>([
  ["shabbos", "shabbat"],
  ["shabbes", "shabbat"],
  ["shabbas", "shabbat"],
  ["hashabbos", "shabbat"],
  ["hashabbat", "shabbat"],
  ["mishna", "mishnah"],
  ["mishnayos", "mishnah"],
  ["mishnayot", "mishnah"],
  ["reshus", "reshut"],
  ["reshuyos", "reshut"],
  ["reshuyot", "reshut"],
  ["yetzios", "yetziot"],
  ["yetzias", "yetziot"],
  ["yetziyos", "yetziot"],
  ["baal", "owner"],
  ["habayis", "house"],
  ["habayit", "house"],
  ["ani", "poor"],
  ["akore", "uproot"],
  ["akira", "uproot"],
  ["hanacha", "place"],
  ["hachnasa", "bringing"],
  ["hotzaah", "carrying"],
]);

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "is",
  "are",
  "was",
  "were",
  "be",
  "it",
  "that",
  "this",
  "there",
  "we",
  "you",
  "he",
  "she",
  "they",
  "i",
  "so",
  "now",
  "okay",
  "right",
  "basically",
  "actually",
]);

export function stripHtml(input: unknown = ""): string {
  return String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeToken(token: string): string {
  const normalized = token
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u0591-\u05c7]/g, "")
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, "");

  if (!normalized || STOP_WORDS.has(normalized)) return "";
  return VARIANTS.get(normalized) ?? normalized;
}

export function tokenize(input: unknown = ""): string[] {
  return stripHtml(input)
    .split(/[\s,.;:!?()[\]{}"“”'’/\-\u05be]+/)
    .map(normalizeToken)
    .filter(Boolean);
}

export function tokenSet(input: unknown = ""): Set<string> {
  return new Set(tokenize(input));
}

export function wordCount(input: unknown = ""): number {
  return tokenize(input).length;
}
