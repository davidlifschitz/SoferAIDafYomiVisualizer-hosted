import { describe, expect, it, vi } from "vitest";

import {
  buildWorkflowReport,
  captureRequiredPages,
  ensureSoferSubmission,
  pollSoferBatchStatus,
} from "@/lib/analysis/workflow-actions";
import { createMemoryWorkflowStore } from "@/lib/analysis/workflow-store";
import sefariaFixture from "@/fixtures/sefaria-shabbat-2.json";
import transcriptFixture from "@/fixtures/transcript-948110.json";
import type { SoferClient } from "@/lib/services/sofer";

const ANALYSIS_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function createMockSofer() {
  const createExpressBatch = vi.fn(async () => ({ batch_id: "batch-123" }));
  const getBatchStatus = vi.fn(async () => ({ status: "completed" }));

  const client = {
    createExpressBatch,
    getBatchStatus,
    getByClientItemId: vi.fn(),
    getTranscription: vi.fn(),
    requireKey: vi.fn(),
  };

  return {
    client: client as unknown as SoferClient,
    createExpressBatch,
    getBatchStatus,
  };
}

describe("ensureSoferSubmission", () => {
  it("persists and reuses an existing Sofer batch id on replay", async () => {
    const store = createMemoryWorkflowStore();
    const { client, createExpressBatch } = createMockSofer();

    const first = await ensureSoferSubmission(
      ANALYSIS_ID,
      { store, sofer: client },
      {
        audioUrl: "https://example.com/audio.mp3",
        title: "Shabbos Daf 02",
      },
    );
    const second = await ensureSoferSubmission(
      ANALYSIS_ID,
      { store, sofer: client },
      {
        audioUrl: "https://example.com/audio.mp3",
        title: "Shabbos Daf 02",
      },
    );

    expect(first.batchId).toBe("batch-123");
    expect(second.batchId).toBe("batch-123");
    expect(createExpressBatch).toHaveBeenCalledTimes(1);
    expect(store.state.sofer).toEqual({
      batchId: "batch-123",
      clientItemId: "yutorah-lecture",
    });
  });
});

describe("pollSoferBatchStatus", () => {
  it("returns a terminal status before the poll deadline", async () => {
    const { client, getBatchStatus } = createMockSofer();
    vi.mocked(getBatchStatus)
      .mockResolvedValueOnce({ status: "processing" })
      .mockResolvedValueOnce({ status: "completed" });

    const status = await pollSoferBatchStatus("batch-123", client, {
      maxPolls: 5,
      pollIntervalMs: 0,
      sleep: async () => {},
    });

    expect(status).toBe("completed");
    expect(getBatchStatus).toHaveBeenCalledTimes(2);
  });

  it("throws when the poll deadline is exceeded", async () => {
    const { client, getBatchStatus } = createMockSofer();
    vi.mocked(getBatchStatus).mockResolvedValue({ status: "processing" });

    await expect(
      pollSoferBatchStatus("batch-123", client, {
        maxPolls: 2,
        pollIntervalMs: 0,
        sleep: async () => {},
      }),
    ).rejects.toThrow(/did not finish before deadline/);
  });
});

describe("buildWorkflowReport", () => {
  it("preserves the Shabbos Daf 2 regression range", () => {
    const report = buildWorkflowReport({
      resolved: {
        lectureUrl: "https://www.yutorah.org/lectures/lecture.cfm/948110",
        sourceKey: "yutorah:948110",
        title: "Rabbi Aryeh Lebowitz Daf Yomi Shabbos Daf 02",
        audioUrl: "https://example.com/audio.mp3",
      },
      transcriptText: transcriptFixture.text,
      transcriptionId: "transcription-123",
      pages: sefariaFixture,
      candidateRefs: ["Shabbat 2a", "Shabbat 2b"],
    });

    expect(report.range.start?.id).toBe("Shabbat 2a:1");
    expect(report.range.end?.id).toBe("Shabbat 2b:14");
    expect(report.range.confidence).toBeGreaterThan(0.5);
  });
});

describe("captureRequiredPages", () => {
  it("returns partial capture until Browserless is wired", async () => {
    await expect(captureRequiredPages(["Shabbat 2a", "Shabbat 2b"])).resolves.toEqual({
      captured: 0,
      total: 2,
    });
  });
});