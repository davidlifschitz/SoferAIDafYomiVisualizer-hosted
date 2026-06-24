import { describe, expect, it } from "vitest";

import {
  normalizeToken,
  stripHtml,
  tokenSet,
  tokenize,
  wordCount,
} from "../../lib/domain/text-normalizer";

describe("text normalizer", () => {
  it("removes tags, script and style content, and decodes common entities", () => {
    expect(
      stripHtml(
        '<style>.hidden { display: none; }</style><b>Shabbos</b>&nbsp;&amp; <script>alert("x")</script>carrying',
      ),
    ).toBe("Shabbos & carrying");
  });

  it("normalizes common daf shiur variants and removes stop words", () => {
    expect(tokenize("Yetzios haShabbos in the Mishna, reshus ha-rabim")).toEqual([
      "yetziot",
      "shabbat",
      "mishnah",
      "reshut",
      "ha",
      "rabim",
    ]);
  });

  it("strips Hebrew diacritics", () => {
    expect(tokenize("רְשׁוּיוֹת שבת")).toEqual(["רשויות", "שבת"]);
  });

  it("treats Hebrew maqaf as a token separator", () => {
    expect(tokenize("רשות־הרבים")).toEqual(tokenize("רשות הרבים"));
  });

  it("exposes normalized token, set, and count helpers", () => {
    expect(normalizeToken("Shabbes")).toBe("shabbat");
    expect(tokenSet("Shabbos Shabbat Mishna")).toEqual(new Set(["shabbat", "mishnah"]));
    expect(wordCount("the Shabbos Mishna")).toBe(2);
  });
});
