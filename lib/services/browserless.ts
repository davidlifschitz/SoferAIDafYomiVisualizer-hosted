import { formatHalfPageRef, parseDafRef } from "@/lib/domain/daf-ref";

export const MERCAVA_BASE_URL = "https://themercava.com/app/books/metanav";
export const SHABBAT_2A_METANAV_ID = 2180;
export const METANAV_ID_STEP = 4;

export const DEFAULT_VIEWPORT = {
  width: 1240,
  height: 1280,
} as const;

export const DEFAULT_CAPTURE_TIMEOUT_MS = 45_000;
export const DEFAULT_MAX_RETRIES = 3;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export type BrowserlessCaptureResult = {
  dafRef: string;
  bytes: Buffer;
  width: number;
  height: number;
};

export type BrowserlessClientOptions = {
  apiToken?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
};

function halfPageOffsetFromShabbat2a(dafRef: string): number {
  const parsed = parseDafRef(dafRef);
  const start = parseDafRef("Shabbat 2a");
  const index = parsed.daf * 2 + (parsed.side === "b" ? 1 : 0);
  const startIndex = start.daf * 2 + (start.side === "b" ? 1 : 0);
  return index - startIndex;
}

export function mercavaMetanavId(dafRef: string): number {
  return SHABBAT_2A_METANAV_ID + halfPageOffsetFromShabbat2a(dafRef) * METANAV_ID_STEP;
}

export function mercavaPageUrl(dafRef: string): string {
  return `${MERCAVA_BASE_URL}/${mercavaMetanavId(dafRef)}`;
}

function dafLabelSelector(dafRef: string): string {
  const halfPage = formatHalfPageRef(parseDafRef(dafRef));
  const [, dafSide] = halfPage.split(" ");
  return `[data-daf-label*="${dafSide}"], .daf-label:has-text("${dafSide}")`;
}

function retryDelayMs(attempt: number): number {
  return 250 * 2 ** attempt;
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status) || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class BrowserlessClient {
  private readonly apiToken?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor({
    apiToken,
    baseUrl = "https://production-sfo.browserless.io",
    fetchImpl = fetch,
    timeoutMs = DEFAULT_CAPTURE_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
  }: BrowserlessClientOptions = {}) {
    this.apiToken = apiToken;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
  }

  requireToken(): void {
    if (!this.apiToken) {
      throw new Error("BROWSERLESS_API_TOKEN is required for page capture");
    }
  }

  async captureDafPage(dafRef: string): Promise<BrowserlessCaptureResult> {
    this.requireToken();

    const url = `${this.baseUrl}/screenshot?token=${encodeURIComponent(this.apiToken!)}`;
    const body = {
      url: mercavaPageUrl(dafRef),
      viewport: DEFAULT_VIEWPORT,
      waitForSelector: {
        selector: dafLabelSelector(dafRef),
        timeout: this.timeoutMs,
      },
      options: {
        type: "png",
        fullPage: false,
      },
      gotoOptions: {
        waitUntil: "networkidle2",
        timeout: this.timeoutMs,
      },
    };

    let lastError: unknown;

    for (let attempt = 0; attempt < this.maxRetries; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "cache-control": "no-cache",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          if (!isRetryableStatus(response.status) || attempt === this.maxRetries - 1) {
            throw new Error(
              `Browserless screenshot failed (${response.status}) for ${dafRef}`,
            );
          }
        } else {
          const bytes = Buffer.from(await response.arrayBuffer());
          return {
            dafRef,
            bytes,
            width: DEFAULT_VIEWPORT.width,
            height: DEFAULT_VIEWPORT.height,
          };
        }
      } catch (error) {
        lastError = error;
        if (attempt === this.maxRetries - 1) {
          throw error;
        }
      }

      await sleep(retryDelayMs(attempt));
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Browserless screenshot failed for ${dafRef}`);
  }
}

export function createBrowserlessClient(
  options: BrowserlessClientOptions = {},
): BrowserlessClient {
  return new BrowserlessClient({
    apiToken: options.apiToken ?? process.env.BROWSERLESS_API_TOKEN,
    ...options,
  });
}