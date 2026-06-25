import {
  SHABBAT_2_DEMO_ANALYSIS_ID,
  buildShabbat2DemoAnalysis,
} from "@/lib/fixtures/shabbat-2-analysis";
import {
  SHABBAT_3_DEMO_ANALYSIS_ID,
  buildShabbat3DemoAnalysis,
} from "@/lib/fixtures/shabbat-3-analysis";
import type { DemoAnalysisView } from "@/lib/fixtures/demo-analysis-types";

export { SHABBAT_2_DEMO_ANALYSIS_ID, SHABBAT_3_DEMO_ANALYSIS_ID };

const DEMO_FIXTURE_IDS = new Set([
  SHABBAT_2_DEMO_ANALYSIS_ID,
  SHABBAT_3_DEMO_ANALYSIS_ID,
]);

export function isDemoFixtureId(id: string): boolean {
  return DEMO_FIXTURE_IDS.has(id);
}

export function listDemoAnalyses(): DemoAnalysisView[] {
  return [buildShabbat2DemoAnalysis(), buildShabbat3DemoAnalysis()];
}

export function formatDemoCardTitle(analysis: DemoAnalysisView): string {
  const shortTitle = analysis.title.replace(/^Rabbi Aryeh Lebowitz Daf Yomi /, "");
  return `${analysis.speaker} — ${shortTitle}`;
}

export function formatRangeSummary(analysis: DemoAnalysisView): string {
  const confidence = Math.round((analysis.range.confidence ?? 0) * 100);
  return `Start ${analysis.range.start?.id ?? "unknown"} · End ${
    analysis.range.end?.id ?? "unknown"
  } · Confidence ~${confidence}%`;
}

export function getDemoAnalysisById(id: string): DemoAnalysisView | null {
  if (id === SHABBAT_2_DEMO_ANALYSIS_ID) {
    return buildShabbat2DemoAnalysis();
  }

  if (id === SHABBAT_3_DEMO_ANALYSIS_ID) {
    return buildShabbat3DemoAnalysis();
  }

  return null;
}