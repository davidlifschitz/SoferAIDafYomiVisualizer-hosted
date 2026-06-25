import "server-only";

import { createResultStore } from "@/lib/analysis/result-store";
import {
  formatDemoCardTitle,
  formatRangeSummary,
  listDemoAnalyses,
} from "@/lib/fixtures/demo-analyses";

export type LibraryEntry = {
  id: string;
  title: string;
  summary: string;
  href: string;
  source: "fixture" | "listed";
};

export async function listLibraryEntries(): Promise<LibraryEntry[]> {
  const fixtures = listDemoAnalyses().map((analysis) => ({
    id: analysis.id,
    title: formatDemoCardTitle(analysis),
    summary: formatRangeSummary(analysis),
    href: `/analyses/${analysis.id}`,
    source: "fixture" as const,
  }));

  const store = createResultStore();
  const listed = await store.listPublicResults();
  const listedEntries = listed.map((result) => ({
    id: result.publicId,
    title: result.title,
    summary: "Listed analysis result",
    href: `/r/${result.publicId}`,
    source: "listed" as const,
  }));

  return [...listedEntries, ...fixtures];
}