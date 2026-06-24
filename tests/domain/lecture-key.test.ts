import { describe, expect, it } from "vitest";

import {
  canonicalLectureKey,
  lectureKeyFromUrl,
} from "../../lib/domain/lecture-key";

describe("lecture key", () => {
  it.each([
    ["https://www.yutorah.org/lectures/lecture.cfm/948110", "yutorah:948110"],
    ["https://yutorah.org/lectures/lecture.cfm?lecture=948110", "yutorah:948110"],
    ["https://WWW.YUTORAH.ORG/lectures/lecture.cfm/948110", "yutorah:948110"],
    ["https://www.yutorah.org:443/lectures/lecture.cfm?lecture=948110", "yutorah:948110"],
    ["https://www.yutorah.org/lectures/lecture.cfm/000948110", "yutorah:948110"],
    ["https://www.yutorah.org/lectures/lecture.cfm?lecture=000948110", "yutorah:948110"],
  ])("normalizes supported YUTorah URL %s", (url, expected) => {
    expect(canonicalLectureKey(url)).toBe(expected);
    expect(lectureKeyFromUrl(url)).toBe(expected);
  });

  it.each([
    "http://www.yutorah.org/lectures/lecture.cfm/948110",
    "https://evil.example/lectures/lecture.cfm/948110",
    "https://media.yutorah.org/lectures/lecture.cfm/948110",
    "https://user:pass@www.yutorah.org/lectures/lecture.cfm/948110",
    "https://www.yutorah.org:444/lectures/lecture.cfm/948110",
    "https://www.yutorah.org/lectures/lecture.cfm",
    "https://www.yutorah.org/lectures/lecture.cfm?lecture=",
    "https://www.yutorah.org/lectures/lecture.cfm/0",
    "https://www.yutorah.org/lectures/lecture.cfm?lecture=000",
    "https://www.yutorah.org/lectures/lecture.cfm?lecture=948110&lecture=948111",
    "https://www.yutorah.org/lectures/lecture.cfm/948110/extra",
  ])("rejects unsupported or unsafe URL %s", (url) => {
    expect(() => canonicalLectureKey(url)).toThrow(/Unsupported YUTorah lecture URL/);
  });
});
