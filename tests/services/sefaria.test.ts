import { afterEach, describe, expect, it, vi } from "vitest";

import sefariaShabbat2Fixture from "@/fixtures/sefaria-shabbat-2.json";
import {
  SefariaClient,
  fetchTextPages,
  mapSefariaApiResponse,
  stripSefariaHtml,
  toSefariaApiRef,
} from "@/lib/services/sefaria";

const shabbat2aFixture = sefariaShabbat2Fixture[0];

function buildRawShabbat2aResponse() {
  return {
    ref: shabbat2aFixture.ref,
    heRef: shabbat2aFixture.heRef,
    versionTitle: shabbat2aFixture.versionTitle,
    versionSource: shabbat2aFixture.versionSource,
    heVersionTitle: shabbat2aFixture.heVersionTitle,
    heVersionSource: shabbat2aFixture.heVersionSource,
    text: shabbat2aFixture.segments.map((segment) => `<p>${segment.en}</p>`),
    he: shabbat2aFixture.segments.map((segment) => `<span>${segment.he}</span>`),
  };
}

describe("SefariaClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("normalizes refs and strips HTML from segment text", () => {
    expect(toSefariaApiRef("Shabbat 2a")).toBe("Shabbat.2a");
    expect(toSefariaApiRef("Shabbat.2a")).toBe("Shabbat.2a");
    expect(toSefariaApiRef("Shabbat 2a:3")).toBe("Shabbat.2a");
    expect(stripSefariaHtml("<strong>MISHNA:</strong> hello")).toBe("MISHNA: hello");
  });

  it("parses Shabbat.2a fixture response into TextPage with 7 segments", async () => {
    const rawResponse = buildRawShabbat2aResponse();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => rawResponse,
    }));

    const client = new SefariaClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const [page] = await client.fetchTextPages(["Shabbat.2a"]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.sefaria.org/api/texts/Shabbat.2a?context=0&commentary=0&pad=0",
      expect.objectContaining({
        headers: { accept: "application/json" },
      }),
    );
    expect(page.ref).toBe("Shabbat 2a");
    expect(page.heRef).toBe(shabbat2aFixture.heRef);
    expect(page.versionTitle).toBe(shabbat2aFixture.versionTitle);
    expect(page.heVersionTitle).toBe(shabbat2aFixture.heVersionTitle);
    expect(page.segments).toHaveLength(7);
    expect(page.segments?.[0]).toEqual({
      ref: shabbat2aFixture.segments[0].ref,
      en: stripSefariaHtml(shabbat2aFixture.segments[0].en),
      he: stripSefariaHtml(shabbat2aFixture.segments[0].he),
    });
    expect(page.segments?.[6]?.ref).toBe("Shabbat 2a:7");
    expect(page.segments?.[0]?.en).not.toMatch(/<[^>]+>/);
  });

  it("retries retryable failures and does not retry client errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: "Service Unavailable" })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => buildRawShabbat2aResponse(),
      });
    const sleepSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation((fn) => {
      if (typeof fn === "function") {
        fn();
      }
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    const client = new SefariaClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      maxRetries: 3,
    });
    const page = await client.fetchTextPage("Shabbat.2a");

    expect(page.segments).toHaveLength(7);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalled();

    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" });

    await expect(client.fetchTextPage("Shabbat.2a")).rejects.toThrow(/404/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("exports fetchTextPages helper using the client", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => buildRawShabbat2aResponse(),
    }));

    const pages = await fetchTextPages(["Shabbat 2a"], {
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(pages).toHaveLength(1);
    expect(pages[0]?.segments).toHaveLength(7);
  });

  it("maps API payloads with scalar text fields", () => {
    const page = mapSefariaApiResponse(
      {
        ref: "Shabbat 2a",
        heRef: "שבת ב׳ א",
        text: "<b>one</b>",
        he: "<i>אחד</i>",
        versionTitle: "English",
      },
      "https://www.sefaria.org/api/texts/Shabbat.2a?context=0&commentary=0&pad=0",
    );

    expect(page.segments).toEqual([
      {
        ref: "Shabbat 2a:1",
        en: "one",
        he: "אחד",
      },
    ]);
  });
});