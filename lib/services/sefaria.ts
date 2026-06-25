import type { TextPage } from "@/lib/domain/report";

export interface SefariaClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
}

export interface SefariaTextPage extends TextPage {
  versionTitle?: string;
  versionSource?: string;
  heVersionTitle?: string;
  heVersionSource?: string;
}

interface SefariaApiTextResponse {
  ref: string;
  heRef?: string;
  text?: string | string[];
  he?: string | string[];
  versionTitle?: string;
  versionSource?: string;
  heVersionTitle?: string;
  heVersionSource?: string;
}

const DEFAULT_BASE_URL = "https://www.sefaria.org";
const DEFAULT_MAX_RETRIES = 3;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export function stripSefariaHtml(value: unknown): string {
  return String(value ?? "").replace(/<[^>]+>/g, "");
}

export function toSefariaApiRef(ref: string): string {
  const base = ref.trim().replace(/:\d+$/, "");
  if (base.includes(".")) {
    return base;
  }

  const match = base.match(/^(\S+)\s+(\d+[ab])$/i);
  if (match) {
    return `${match[1]}.${match[2]}`;
  }

  return base;
}

function normalizeTextArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
}

function buildTextUrl(baseUrl: string, apiRef: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  return `${normalizedBase}/api/texts/${apiRef}?context=0&commentary=0&pad=0`;
}

function retryDelayMs(attempt: number): number {
  return 250 * 2 ** attempt;
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status) || status >= 500;
}

class SefariaHttpError extends Error {
  readonly status: number;

  constructor(status: number, url: string) {
    super(`Sefaria request failed (${status}) for ${url}`);
    this.name = "SefariaHttpError";
    this.status = status;
  }
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    error.name === "TypeError" ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("failed to fetch")
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function mapSefariaApiResponse(
  payload: SefariaApiTextResponse,
  sourceUrl: string,
): SefariaTextPage {
  const english = normalizeTextArray(payload.text);
  const hebrew = normalizeTextArray(payload.he);

  return {
    ref: payload.ref,
    heRef: payload.heRef,
    source: sourceUrl,
    versionTitle: payload.versionTitle,
    versionSource: payload.versionSource,
    heVersionTitle: payload.heVersionTitle,
    heVersionSource: payload.heVersionSource,
    segments: english.map((en, index) => ({
      ref: `${payload.ref}:${index + 1}`,
      en: stripSefariaHtml(en),
      he: stripSefariaHtml(hebrew[index] ?? ""),
    })),
  };
}

async function fetchSefariaResponse(
  url: string,
  fetchImpl: typeof fetch,
  maxRetries: number,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { accept: "application/json" },
      });

      if (response.ok) {
        return response;
      }

      if (!isRetryableStatus(response.status) || attempt === maxRetries - 1) {
        throw new SefariaHttpError(response.status, url);
      }
    } catch (error) {
      lastError = error;
      const shouldRetry =
        isNetworkError(error) ||
        (error instanceof SefariaHttpError && isRetryableStatus(error.status));

      if (!shouldRetry || attempt === maxRetries - 1) {
        throw error;
      }
    }

    await sleep(retryDelayMs(attempt));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Sefaria request failed for ${url}`);
}

export class SefariaClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;

  constructor({
    baseUrl = DEFAULT_BASE_URL,
    fetchImpl = fetch,
    maxRetries = DEFAULT_MAX_RETRIES,
  }: SefariaClientOptions = {}) {
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
    this.maxRetries = maxRetries;
  }

  async fetchTextPage(ref: string): Promise<SefariaTextPage> {
    const apiRef = toSefariaApiRef(ref);
    const url = buildTextUrl(this.baseUrl, apiRef);
    const response = await fetchSefariaResponse(url, this.fetchImpl, this.maxRetries);
    const payload = (await response.json()) as SefariaApiTextResponse;

    if (!payload.ref) {
      throw new Error(`Sefaria response missing ref for ${apiRef}`);
    }

    return mapSefariaApiResponse(payload, url);
  }

  async fetchTextPages(refs: string[]): Promise<SefariaTextPage[]> {
    const pages: SefariaTextPage[] = [];

    for (const ref of refs) {
      pages.push(await this.fetchTextPage(ref));
    }

    return pages;
  }
}

export async function fetchTextPages(
  refs: string[],
  options: SefariaClientOptions = {},
): Promise<SefariaTextPage[]> {
  const client = new SefariaClient(options);
  return client.fetchTextPages(refs);
}