import sefariaFixture from "@/fixtures/sefaria-shabbat-2.json";
import transcriptFixture from "@/fixtures/transcript-948110.json";
import markerFixture from "@/lib/fixtures/shabbat-2-markers.json";
import type {
  CachedMarkerRecord,
  DemoAnalysisView,
  DemoFixturePageAsset,
  MarkerKind,
  VisualizerMarker,
  VisualizerPage,
} from "@/lib/fixtures/demo-analysis-types";
import {
  enumerateHalfPages,
  formatHalfPageRef,
  parseDafRef,
} from "@/lib/domain/daf-ref";
import { detectRange } from "@/lib/domain/range-aligner";
import type { RangeDetectionResult, TextPage } from "@/lib/domain/report";

export const SHABBAT_2_DEMO_ANALYSIS_ID = "fixture-shabbat-2";

const FIXTURE_PAGE_ASSETS: Record<string, DemoFixturePageAsset> = {
  "Shabbat 2a": {
    imageUrl: "/fixtures/daf-yomi/shabbat-2a.png",
    width: 1296,
    height: 2000,
  },
  "Shabbat 2b": {
    imageUrl: "/fixtures/daf-yomi/shabbat-2b.png",
    width: 1296,
    height: 2000,
  },
};

function cachedMarker(kind: MarkerKind): CachedMarkerRecord {
  const marker = markerFixture.markers.find((entry) => entry.kind === kind);
  if (!marker) {
    throw new Error(`Missing cached marker for ${kind}`);
  }

  return marker as CachedMarkerRecord;
}

export function buildVisualizerPages(range: RangeDetectionResult): VisualizerPage[] {
  const startMarker = cachedMarker("start");
  const endMarker = cachedMarker("end");
  const startRef = range.start?.id ?? startMarker.segmentRef;
  const endRef = range.end?.id ?? endMarker.segmentRef;
  const startHalfPage = startRef
    ? formatHalfPageRef(parseDafRef(startRef))
    : "Shabbat 2a";
  const endHalfPage = endRef ? formatHalfPageRef(parseDafRef(endRef)) : "Shabbat 2b";
  const halfPages = enumerateHalfPages(startHalfPage, endHalfPage);

  return halfPages.map((dafRef) => {
    const asset = FIXTURE_PAGE_ASSETS[dafRef];
    const markers: VisualizerMarker[] = [];

    if (dafRef === startMarker.dafRef && range.start) {
      markers.push({
        kind: "start",
        x: startMarker.x,
        y: startMarker.y,
        label: `Start ${startRef}`,
      });
    }

    if (dafRef === endMarker.dafRef && range.end) {
      markers.push({
        kind: "end",
        x: endMarker.x,
        y: endMarker.y,
        label: `End ${endRef}`,
      });
    }

    return {
      dafRef,
      imageUrl: asset.imageUrl,
      width: asset.width,
      height: asset.height,
      markers,
    };
  });
}

export function buildShabbat2DemoAnalysis(): DemoAnalysisView {
  const pages = sefariaFixture as TextPage[];
  const range = detectRange(transcriptFixture.text, pages, {
    preferredStartRef: "Shabbat 2a",
    preferredEndRef: "Shabbat 2b",
  });

  return {
    id: SHABBAT_2_DEMO_ANALYSIS_ID,
    title: transcriptFixture.title,
    lectureUrl: transcriptFixture.lectureUrl,
    speaker: "Rabbi Aryeh Lebowitz",
    status: "complete",
    range,
    pages: buildVisualizerPages(range),
    transcriptPreview: transcriptFixture.text.slice(0, 420),
  };
}

export type { MarkerKind, VisualizerMarker, VisualizerPage } from "@/lib/fixtures/demo-analysis-types";