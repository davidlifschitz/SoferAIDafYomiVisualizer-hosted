import { describe, expect, it, vi } from "vitest";

import {
  AnalysisStorageClient,
  analysisPageStoragePath,
} from "@/lib/services/storage";

const ANALYSIS_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("analysisPageStoragePath", () => {
  it("stores pages under analyses/<id>/<daf-ref>.png", () => {
    expect(analysisPageStoragePath(ANALYSIS_ID, "Shabbat 2a")).toBe(
      "analyses/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/Shabbat-2a.png",
    );
  });
});

describe("AnalysisStorageClient", () => {
  it("uploads PNG bytes to the private analysis-pages bucket", async () => {
    const upload = vi.fn(async () => ({ data: { path: "ok" }, error: null }));
    const createSignedUrl = vi.fn(async () => ({
      data: { signedUrl: "https://signed.example/page.png" },
      error: null,
    }));

    const client = new AnalysisStorageClient({
      bucket: "analysis-pages",
      admin: {
        storage: {
          from: () => ({
            upload,
            createSignedUrl,
          }),
        },
      } as never,
    });

    const path = await client.uploadAnalysisPage(
      ANALYSIS_ID,
      "Shabbat 2a",
      Buffer.from([137, 80, 78, 71]),
      "image/png",
    );

    expect(path).toBe(analysisPageStoragePath(ANALYSIS_ID, "Shabbat 2a"));
    expect(upload).toHaveBeenCalledWith(
      path,
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/png",
        upsert: true,
      }),
    );

    const signed = await client.getSignedUrl(path, 300);
    expect(signed).toBe("https://signed.example/page.png");
    expect(createSignedUrl).toHaveBeenCalledWith(path, 300);
  });
});