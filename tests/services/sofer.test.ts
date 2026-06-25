import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SoferClient,
  extractSoferTranscriptText,
} from "@/lib/services/sofer";

describe("SoferClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires an API key for live requests", () => {
    const client = new SoferClient();
    expect(() => client.requireKey()).toThrow(/SOFER_API_KEY/i);
  });

  it("creates an express batch with the expected payload", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ batch_id: "batch-1" }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = new SoferClient({ apiKey: "test-key" });
    const result = await client.createExpressBatch({
      audioUrl: "https://example.com/audio.mp3",
      title: "Shabbos Daf 03",
      clientItemId: "yutorah-948127",
    });

    expect(result).toEqual({ batch_id: "batch-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.sofer.ai/v1/transcriptions/batch",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-key",
        }),
      }),
    );

    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body));
    expect(body.processing_mode).toBe("express");
    expect(body.audio_sources[0].client_item_id).toBe("yutorah-948127");
  });

  it("extracts transcript text from common Sofer response shapes", () => {
    expect(
      extractSoferTranscriptText({
        text: "today daf shabbos",
      }),
    ).toBe("today daf shabbos");
    expect(
      extractSoferTranscriptText({
        segments: [{ text: "one " }, { text: "two" }],
      }),
    ).toBe("one two");
  });
});