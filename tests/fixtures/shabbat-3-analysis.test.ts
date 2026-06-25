import { describe, expect, it } from "vitest";

import markerFixture from "@/lib/fixtures/shabbat-3-markers.json";
import {
  SHABBAT_3_DEMO_ANALYSIS_ID,
  buildShabbat3DemoAnalysis,
} from "@/lib/fixtures/shabbat-3-analysis";

describe("buildShabbat3DemoAnalysis", () => {
  it("stacks 2b through 3b when the shiur continues from the prior amud", () => {
    const analysis = buildShabbat3DemoAnalysis();

    expect(analysis.id).toBe(SHABBAT_3_DEMO_ANALYSIS_ID);
    expect(analysis.pages.map((page) => page.dafRef)).toEqual([
      "Shabbat 2b",
      "Shabbat 3a",
      "Shabbat 3b",
    ]);
    expect(analysis.pages[0].imageUrl).toBe("/fixtures/daf-yomi/shabbat-2b.png");
    expect(analysis.pages[2].imageUrl).toBe("/fixtures/daf-yomi/shabbat-3b.png");
  });

  it("anchors start on 2b after Daf 2 ended and end on 3b", () => {
    const analysis = buildShabbat3DemoAnalysis();

    expect(analysis.range.start?.id).toBe("Shabbat 2b:15");
    expect(analysis.range.start?.selectionReason).toBe("daf-continuation-anchor");
    expect(analysis.range.end?.id).toMatch(/^Shabbat 3b:/);
    expect(analysis.pages[0].markers[0]).toMatchObject({ kind: "start" });
    expect(analysis.pages[2].markers[0]).toMatchObject({ kind: "end" });
  });

  it("uses cached marker coordinates from the fixture file", () => {
    const analysis = buildShabbat3DemoAnalysis();
    const [page2b, , page3b] = analysis.pages;
    const start = markerFixture.markers.find((marker) => marker.kind === "start");
    const end = markerFixture.markers.find((marker) => marker.kind === "end");

    expect(page2b.markers[0]).toMatchObject({ x: start?.x, y: start?.y });
    expect(page3b.markers[0]).toMatchObject({ x: end?.x, y: end?.y });
  });
});