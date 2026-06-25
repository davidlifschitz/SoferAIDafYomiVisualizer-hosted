import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BrowserlessClient,
  mercavaMetanavId,
  mercavaPageUrl,
  DEFAULT_VIEWPORT,
} from "@/lib/services/browserless";

describe("mercava mapping", () => {
  it("maps Shabbat half-pages to metanav ids incrementing by four", () => {
    expect(mercavaMetanavId("Shabbat 2a")).toBe(2180);
    expect(mercavaMetanavId("Shabbat 2b")).toBe(2184);
    expect(mercavaMetanavId("Shabbat 3a")).toBe(2188);
  });

  it("builds the Mercava metanav URL", () => {
    expect(mercavaPageUrl("Shabbat 2a")).toBe(
      "https://themercava.com/app/books/metanav/2180",
    );
  });
});

describe("BrowserlessClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests a viewport screenshot and waits for the daf label", async () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71]);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => pngBytes.buffer,
    }));

    const client = new BrowserlessClient({
      apiToken: "test-token",
      baseUrl: "https://production-sfo.browserless.io",
      fetchImpl: fetchMock as unknown as typeof fetch,
      timeoutMs: 15_000,
    });

    const result = await client.captureDafPage("Shabbat 2a");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://production-sfo.browserless.io/screenshot?token=test-token",
    );

    const body = JSON.parse(String(init.body));
    expect(body.url).toBe("https://themercava.com/app/books/metanav/2180");
    expect(body.options).toEqual(
      expect.objectContaining({
        type: "png",
        fullPage: false,
      }),
    );
    expect(body.viewport).toEqual(DEFAULT_VIEWPORT);
    expect(body.waitForSelector).toEqual(
      expect.objectContaining({
        selector: expect.stringContaining("2"),
        timeout: 15_000,
      }),
    );
    expect(result.bytes).toEqual(Buffer.from(pngBytes));
    expect(result.width).toBe(DEFAULT_VIEWPORT.width);
    expect(result.height).toBe(DEFAULT_VIEWPORT.height);
    expect(result.dafRef).toBe("Shabbat 2a");
  });

  it("retries retryable failures", async () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: "Unavailable" })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png" }),
        arrayBuffer: async () => pngBytes.buffer,
      });

    const client = new BrowserlessClient({
      apiToken: "test-token",
      fetchImpl: fetchMock as unknown as typeof fetch,
      maxRetries: 2,
    });

    await client.captureDafPage("Shabbat 2b");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});