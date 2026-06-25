import { describe, expect, it } from "vitest";

import sefariaFixture from "../../fixtures/sefaria-shabbat-2.json";
import transcriptFixture from "../../fixtures/transcript-948110.json";
import {
  buildCandidateChunks,
  detectRange,
  scoreTokens,
  transcriptWindows,
} from "../../lib/domain/range-aligner";
import type { TextPage } from "../../lib/domain/report";

function segmentPagesFromFixture(): TextPage[] {
  return sefariaFixture;
}

describe("range aligner", () => {
  it("preserves the legacy token scoring constants", () => {
    expect(scoreTokens(["one", "two"], ["one", "two", "three"])).toBe(0.9167);
    expect(scoreTokens([], ["one"])).toBe(0);
  });

  it("builds segment-level and fallback word chunks", () => {
    const chunks = buildCandidateChunks([
      {
        ref: "Shabbat 2a",
        segments: [{ ref: "Shabbat 2a:1", en: "<b>One two</b>", he: "אחד" }],
      },
      { ref: "Shabbat 2b", en: "one two three four five" },
    ], { size: 3, step: 2 });

    expect(chunks.map(({ id, startWord, endWord }) => ({ id, startWord, endWord }))).toEqual([
      { id: "Shabbat 2a:1", startWord: 0, endWord: 2 },
      { id: "Shabbat 2b#chunk-1", startWord: 0, endWord: 3 },
      { id: "Shabbat 2b#chunk-2", startWord: 2, endWord: 5 },
    ]);
  });

  it.each([
    { size: 0 },
    { size: -1 },
    { size: 1.5 },
    { step: 0 },
    { step: -1 },
    { step: 1.5 },
  ])("rejects invalid chunk options without entering the chunk loop: %o", (options) => {
    expect(() => buildCandidateChunks([], options)).toThrow(RangeError);
  });

  it("creates first, middle, and last transcript windows", () => {
    const windows = transcriptWindows("one two three four five six", 2);

    expect(windows.first.text).toBe("one two");
    expect(windows.middle.text).toBe("three four");
    expect(windows.last.text).toBe("five six");
  });

  it("fails explicitly when every ranked end candidate precedes an anchored start", () => {
    const earlySegments = Array.from({ length: 6 }, (_, index) => ({
      ref: `Shabbat 2a:${index + 1}`,
      en: "target ending",
    }));
    const pages: TextPage[] = [
      { ref: "Shabbat 2a", segments: earlySegments },
      {
        ref: "Shabbat 2b",
        segments: [
          { ref: "Shabbat 2b:1", en: "anchored start" },
          { ref: "Shabbat 2b:2", en: "unrelated conclusion" },
        ],
      },
    ];

    expect(() =>
      detectRange(
        "today daf shabbos intro filler filler filler target ending",
        pages,
        {
          preferredStartRef: "Shabbat 2b",
          windowWords: 5,
        },
      ),
    ).toThrow(/end candidate.*start/i);
  });

  it("prefers the requested end ref among candidates inside the close-score margin", () => {
    const range = detectRange(
      "start filler target",
      [
        { ref: "Shabbat 2a", segments: [{ ref: "Shabbat 2a:1", en: "start" }] },
        { ref: "Shabbat 2b", segments: [{ ref: "Shabbat 2b:1", en: "target" }] },
        { ref: "Shabbat 3a", segments: [{ ref: "Shabbat 3a:1", en: "target" }] },
      ],
      {
        preferredEndRef: "Shabbat 2b",
        windowWords: 1,
      },
    );

    expect(range.end?.id).toBe("Shabbat 2b:1");
  });

  it("keeps latest-close behavior when the preferred end ref is outside the margin", () => {
    const range = detectRange(
      "start filler strong target",
      [
        { ref: "Shabbat 2a", segments: [{ ref: "Shabbat 2a:1", en: "start" }] },
        { ref: "Shabbat 2b", segments: [{ ref: "Shabbat 2b:1", en: "weak" }] },
        {
          ref: "Shabbat 3a",
          segments: [
            { ref: "Shabbat 3a:1", en: "strong target" },
            { ref: "Shabbat 3a:2", en: "strong target" },
          ],
        },
      ],
      {
        preferredEndRef: "Shabbat 2b",
        windowWords: 2,
      },
    );

    expect(range.end?.id).toBe("Shabbat 3a:2");
  });

  it("starts a continuation shiur on the prior amud after the previous endpoint", () => {
    const range = detectRange(
      "Today's daf is Shabbos Daf Gimmel. We continue where we ended yesterday with Rav Mattana and twelve cases.",
      [
        {
          ref: "Shabbat 2b",
          segments: [
            { ref: "Shabbat 2b:14", en: "Rava domains", he: "רָבָא אָמַר" },
            {
              ref: "Shabbat 2b:15",
              en: "Rav Mattana said to Abaye they are twelve",
              he: "רַב מַתְנָה לְאַבָּיֵי תרתי סרי",
            },
            { ref: "Shabbat 2b:16", en: "Abaye sixteen", he: "שיתסרי" },
          ],
        },
        {
          ref: "Shabbat 3a",
          segments: [{ ref: "Shabbat 3a:1", en: "first section exempt", he: "בבא דרישא" }],
        },
      ],
      {
        preferredStartRef: "Shabbat 3a",
        priorShiurEndSegmentRef: "Shabbat 2b:14",
        windowWords: 20,
      },
    );

    expect(range.start?.id).toBe("Shabbat 2b:15");
    expect(range.start?.selectionReason).toBe("daf-continuation-anchor");
  });

  it("keeps the actual Shabbos Daf 2 fixture range stable", () => {
    const pages = segmentPagesFromFixture();

    expect(transcriptFixture.title).toContain("Shabbos Daf 02");
    expect(pages.map((page) => page.segments?.length)).toEqual([7, 17]);
    expect(sefariaFixture[0].versionTitle).toBe("William Davidson Edition - English");
    expect(sefariaFixture[0].heVersionTitle).toBe(
      "William Davidson Edition - Vocalized Aramaic",
    );

    const range = detectRange(transcriptFixture.text, pages, {
      preferredStartRef: "Shabbat 2a",
      preferredEndRef: "Shabbat 2b",
    });

    expect({
      start: range.start?.id,
      end: range.end?.id,
      confidence: range.confidence,
    }).toEqual({
      start: "Shabbat 2a:1",
      end: "Shabbat 2b:14",
      confidence: expect.closeTo(0.5301, 2),
    });
  });
});
