import { describe, expect, it } from "vitest";

import {
  SHABBAT_2_DEMO_ANALYSIS_ID,
  SHABBAT_3_DEMO_ANALYSIS_ID,
  formatRangeSummary,
  listDemoAnalyses,
} from "@/lib/fixtures/demo-analyses";

describe("listDemoAnalyses", () => {
  it("returns both Shabbat fixture demos with detected ranges", () => {
    const analyses = listDemoAnalyses();

    expect(analyses).toHaveLength(2);
    expect(analyses.map((analysis) => analysis.id)).toEqual([
      SHABBAT_2_DEMO_ANALYSIS_ID,
      SHABBAT_3_DEMO_ANALYSIS_ID,
    ]);
    expect(analyses[0].range.start?.id).toBe("Shabbat 2a:1");
    expect(analyses[0].range.end?.id).toBe("Shabbat 2b:14");
    expect(analyses[1].range.start?.id).toBe("Shabbat 2b:15");
    expect(analyses[1].range.end?.id).toMatch(/^Shabbat 3b:/);
  });

  it("formats a readable range summary for dashboard cards", () => {
    const [shabbat2] = listDemoAnalyses();

    expect(formatRangeSummary(shabbat2)).toMatch(
      /Start Shabbat 2a:1 · End Shabbat 2b:14 · Confidence ~\d+%/,
    );
  });
});