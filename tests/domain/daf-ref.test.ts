import { describe, expect, it } from "vitest";

import {
  MAX_ENUMERATED_HALF_PAGES,
  dafYomiAmud,
  dafYomiMassechetId,
  dafYomiPageId,
  dafYomiPageUrl,
  dafYomiPdfUrl,
  enumerateHalfPages,
  previousHalfPageRef,
  formatDafRef,
  parseDafRef,
} from "../../lib/domain/daf-ref";

describe("daf references", () => {
  it("parses Shabbat and Shabbos refs with an optional segment", () => {
    expect(parseDafRef("Shabbat 2b:14")).toEqual({
      tractate: "Shabbat",
      daf: 2,
      side: "b",
      segment: 14,
    });
    expect(parseDafRef("shabbos.3A")).toEqual({
      tractate: "Shabbat",
      daf: 3,
      side: "a",
    });
    expect(parseDafRef("Shabbat 157b")).toEqual({
      tractate: "Shabbat",
      daf: 157,
      side: "b",
    });
  });

  it("formats refs canonically at half-page or segment precision", () => {
    expect(formatDafRef(parseDafRef("Shabbos.2B:14"))).toBe("Shabbat 2b:14");
    expect(formatDafRef(parseDafRef("Shabbat 2a"), false)).toBe("Shabbat 2a");
  });

  it("maps each Shabbat half-page to daf-yomi massechet, amud, and page IDs", () => {
    expect(dafYomiMassechetId("Shabbat 2a")).toBe(284);
    expect(dafYomiAmud("Shabbat 2a")).toBe(3);
    expect(dafYomiAmud("Shabbat 2b:14")).toBe(4);
    expect(dafYomiAmud("Shabbos 3a")).toBe(5);
    expect(dafYomiPageId("Shabbat 2a")).toBe(126);
    expect(dafYomiPageId("Shabbat 2b")).toBe(127);
    expect(dafYomiPageId("Shabbos 3a")).toBe(128);
  });

  it("builds daf-yomi page and PDF URLs", () => {
    expect(dafYomiPageUrl("Shabbat 2a")).toBe(
      "https://daf-yomi.com/Dafyomi_Page.aspx?massechet=284&amud=3&fs=1",
    );
    expect(dafYomiPageUrl("Shabbat 2b")).toBe(
      "https://daf-yomi.com/Dafyomi_Page.aspx?massechet=284&amud=4&fs=1",
    );
    expect(dafYomiPdfUrl("Shabbat 2a")).toBe(
      "https://daf-yomi.com/Data/UploadedFiles/DY_Page/126.pdf",
    );
    expect(dafYomiPdfUrl("Shabbat 2b")).toBe(
      "https://daf-yomi.com/Data/UploadedFiles/DY_Page/127.pdf",
    );
  });

  it("resolves the prior half-page for continuation shiurim", () => {
    expect(previousHalfPageRef("Shabbat 3a")).toBe("Shabbat 2b");
    expect(previousHalfPageRef("Shabbat 2a")).toBeNull();
  });

  it("enumerates an inclusive range of canonical half-pages", () => {
    expect(enumerateHalfPages("Shabbos 2a:1", "Shabbat 3a:4")).toEqual([
      "Shabbat 2a",
      "Shabbat 2b",
      "Shabbat 3a",
    ]);
  });

  it("rejects malformed, reversed, and cross-tractate ranges", () => {
    expect(() => parseDafRef("Berakhot 2a")).toThrow(/Unsupported daf ref/);
    expect(() => parseDafRef("Shabbat 1b")).toThrow(RangeError);
    expect(() => parseDafRef("Shabbat 158a")).toThrow(RangeError);
    expect(() => parseDafRef("Shabbat 9007199254740992a")).toThrow(RangeError);
    expect(() => parseDafRef(`Shabbat ${"9".repeat(400)}a`)).toThrow(RangeError);
    expect(() => enumerateHalfPages("Shabbat 3a", "Shabbat 2b")).toThrow(/reversed/i);
    expect(() =>
      enumerateHalfPages(
        { tractate: "Shabbat", daf: 2, side: "a" },
        { tractate: "Berakhot", daf: 2, side: "b" },
      ),
    ).toThrow(/cross-tractate/i);
  });

  it("enumerates the complete bounded Shabbat span", () => {
    const fullRange = enumerateHalfPages("Shabbat 2a", "Shabbat 157b");

    expect(MAX_ENUMERATED_HALF_PAGES).toBe(312);
    expect(fullRange).toHaveLength(312);
    expect(fullRange[0]).toBe("Shabbat 2a");
    expect(fullRange.at(-1)).toBe("Shabbat 157b");
  });
});
