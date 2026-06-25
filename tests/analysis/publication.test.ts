import { describe, expect, it } from "vitest";

import {
  canViewInLibrary,
  canViewWithShareLink,
  sanitizePublicAnalysisPayload,
  type PublicationMode,
} from "@/lib/analysis/publication";
import type { DafYomiReport } from "@/lib/domain/report";

const sampleReport: DafYomiReport = {
  generatedAt: "2026-06-25T00:00:00.000Z",
  status: "complete",
  source: {
    lectureUrl: "https://www.yutorah.org/lectures/lecture.cfm/948110",
    title: "Shabbos Daf 02",
    speaker: "Rabbi Aryeh Lebowitz",
    soferBatchId: "secret-batch",
    workflowId: "secret-workflow",
    accountEmail: "owner@example.com",
  },
  transcript: {
    source: "sofer",
    transcriptionId: "secret-transcription",
    textPreview: "Today's daf is Shabbos Daf Beis",
  },
  sefaria: {
    refs: ["Shabbat 2a", "Shabbat 2b"],
    pages: [],
  },
  range: {
    start: null,
    end: null,
    confidence: 0.5,
    startCandidates: [],
    endCandidates: [],
    windows: { first: "", last: "" },
  },
};

describe("publication access matrix", () => {
  const modes: PublicationMode[] = ["private", "unlisted", "public"];

  it("allows library visibility only for public results", () => {
    for (const mode of modes) {
      expect(canViewInLibrary(mode)).toBe(mode === "public");
    }
  });

  it("allows share-link visibility for public and unlisted results", () => {
    for (const mode of modes) {
      expect(canViewWithShareLink(mode)).toBe(mode === "public" || mode === "unlisted");
    }
  });
});

describe("sanitizePublicAnalysisPayload", () => {
  it("removes account, workflow, and billing internals from public views", () => {
    const sanitized = sanitizePublicAnalysisPayload(sampleReport);

    expect(sanitized).toEqual({
      title: "Shabbos Daf 02",
      speaker: "Rabbi Aryeh Lebowitz",
      lectureUrl: "https://www.yutorah.org/lectures/lecture.cfm/948110",
      candidateRefs: ["Shabbat 2a", "Shabbat 2b"],
      range: sampleReport.range,
      transcriptPreview: "Today's daf is Shabbos Daf Beis",
    });
    expect(sanitized).not.toHaveProperty("transcriptionId");
    expect(JSON.stringify(sanitized)).not.toContain("secret-batch");
    expect(JSON.stringify(sanitized)).not.toContain("owner@example.com");
  });
});