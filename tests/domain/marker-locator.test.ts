import { describe, expect, it } from "vitest";

import {
  buildMarkerLocatePrompt,
  parseMarkerLocateResponse,
} from "../../lib/domain/marker-locator";

describe("marker locator", () => {
  it("builds a center-column-focused vision prompt", () => {
    const prompt = buildMarkerLocatePrompt({
      imageWidth: 1296,
      imageHeight: 2000,
      dafRef: "Shabbat 2a",
      segmentRef: "Shabbat 2a:1",
      hebrewSnippet: "יְצִיאוֹת הַשַּׁבָּת",
    });

    expect(prompt).toContain("CENTER gemara/mishna column");
    expect(prompt).toContain("Shabbat 2a:1");
    expect(prompt).toContain("יְצִיאוֹת הַשַּׁבָּת");
  });

  it("parses absolute pixel coordinates inside the gemara column", () => {
    expect(
      parseMarkerLocateResponse(
        '{"x": 812, "y": 456, "confidence": 0.91}',
        1296,
        2000,
      ),
    ).toEqual({ x: 812, y: 456, confidence: 0.91 });
  });

  it("parses column-relative coordinates into gemara pixels", () => {
    expect(
      parseMarkerLocateResponse(
        '{"columnX": 0.614, "columnY": 0.023, "confidence": 0.88}',
        1296,
        2000,
      ),
    ).toEqual({ x: 683, y: 297, confidence: 0.88 });
  });

  it("maps the calibrated Shabbat 2b end marker from column-relative coords", () => {
    expect(
      parseMarkerLocateResponse(
        '{"columnX": 0.764, "columnY": 0.3086, "confidence": 0.9}',
        1296,
        2000,
      ),
    ).toEqual({ x: 779, y: 760, confidence: 0.9 });
  });

  it("rejects out-of-bounds coordinates", () => {
    expect(() =>
      parseMarkerLocateResponse('{"x": 2000, "y": 100}', 1296, 2000),
    ).toThrow(/out of bounds/i);
  });
});