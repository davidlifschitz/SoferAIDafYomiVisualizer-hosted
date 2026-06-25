import { describe, expect, it } from "vitest";

import {
  CorrectionError,
  applyManualCorrection,
  validateCorrectionRange,
} from "@/lib/analysis/correction";
import sefariaFixture from "@/fixtures/sefaria-shabbat-2.json";
import type { RangeDetectionResult } from "@/lib/domain/report";

const generatedRange: RangeDetectionResult = {
  start: {
    id: "Shabbat 2a:1",
    ref: "Shabbat 2a",
    chunkIndex: 0,
    ordinal: 0,
    startWord: 0,
    endWord: 10,
    text: "start",
    he: "",
    tokens: [],
    score: 0.5,
  },
  end: {
    id: "Shabbat 2b:14",
    ref: "Shabbat 2b",
    chunkIndex: 1,
    ordinal: 0,
    startWord: 0,
    endWord: 10,
    text: "end",
    he: "",
    tokens: [],
    score: 0.5,
  },
  confidence: 0.53,
  startCandidates: [],
  endCandidates: [],
  windows: { first: "", last: "" },
};

describe("validateCorrectionRange", () => {
  it("rejects a corrected start that follows the corrected end", () => {
    expect(() =>
      validateCorrectionRange("Shabbat 2b:14", "Shabbat 2a:1"),
    ).toThrow(CorrectionError);

    try {
      validateCorrectionRange("Shabbat 2b:14", "Shabbat 2a:1");
    } catch (error) {
      expect(error).toMatchObject({ code: "invalid_range" });
    }
  });

  it("accepts in-order manual refs", () => {
    expect(() =>
      validateCorrectionRange("Shabbat 2a:1", "Shabbat 2b:14"),
    ).not.toThrow();
  });
});

describe("applyManualCorrection", () => {
  it("preserves the generated range separately and recomputes candidate refs", () => {
    const corrected = applyManualCorrection({
      generatedRange,
      manualStartRef: "Shabbat 2a:2",
      manualEndRef: "Shabbat 2b:10",
      pages: sefariaFixture,
    });

    expect(corrected.generatedRange).toBe(generatedRange);
    expect(corrected.manualStartRef).toBe("Shabbat 2a:2");
    expect(corrected.manualEndRef).toBe("Shabbat 2b:10");
    expect(corrected.candidateRefs).toEqual(["Shabbat 2a", "Shabbat 2b"]);
    expect(corrected.effectiveRange.start?.id).toBe("Shabbat 2a:2");
    expect(corrected.effectiveRange.end?.id).toBe("Shabbat 2b:10");
  });
});