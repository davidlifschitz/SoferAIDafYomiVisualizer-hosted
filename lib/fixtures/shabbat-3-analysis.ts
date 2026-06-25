import sefariaShabbat2Fixture from "@/fixtures/sefaria-shabbat-2.json";
import sefariaShabbat3Fixture from "@/fixtures/sefaria-shabbat-3a-3b.json";
import transcriptFixture from "@/fixtures/transcript-948127.json";
import markerFixture from "@/lib/fixtures/shabbat-3-markers.json";
import {
  enumerateHalfPages,
  formatHalfPageRef,
  parseDafRef,
} from "@/lib/domain/daf-ref";
import { detectRange } from "@/lib/domain/range-aligner";
import type { RangeDetectionResult, TextPage } from "@/lib/domain/report";
import type {
  CachedMarkerRecord,
  DemoAnalysisView,
  DemoFixturePageAsset,
  MarkerKind,
  VisualizerMarker,
  VisualizerPage,
} from "@/lib/fixtures/demo-analysis-types";

export const SHABBAT_3_DEMO_ANALYSIS_ID = "fixture-shabbat-3";
export const SHABBAT_2_DAF3_PRIOR_END_SEGMENT = "Shabbat 2b:14";

const FIXTURE_PAGE_ASSETS: Record<string, DemoFixturePageAsset> = {
  "Shabbat 2b": {
    imageUrl: "/fixtures/daf-yomi/shabbat-2b.png",
    width: 1296,
    height: 2000,
  },
  "Shabbat 3a": {
    imageUrl: "/fixtures/daf-yomi/shabbat-3a.png",
    width: 1296,
    height: 2000,
  },
  "Shabbat 3b": {
    imageUrl: "/fixtures/daf-yomi/shabbat-3b.png",
    width: 1296,
    height: 2000,
  },
};

function buildAlignmentPages(): TextPage[] {
  const shabbat2b = (sefariaShabbat2Fixture as TextPage[]).find(
    (page) => page.ref === "Shabbat 2b",
  );
  if (!shabbat2b) {
    throw new Error("Missing Shabbat 2b page in sefaria-shabbat-2 fixture");
  }

  return [shabbat2b, ...(sefariaShabbat3Fixture as TextPage[])];
}

function cachedMarker(kind: MarkerKind): CachedMarkerRecord {
  const marker = markerFixture.markers.find((entry) => entry.kind === kind);
  if (!marker) {
    throw new Error(`Missing cached marker for ${kind}`);
  }

  return marker as CachedMarkerRecord;
}

function halfPageForSegment(segmentRef: string | undefined, fallback: string): string {
  if (!segmentRef) return fallback;
  return formatHalfPageRef(parseDafRef(segmentRef));
}

export function buildVisualizerPages(range: RangeDetectionResult): VisualizerPage[] {
  const startMarker = cachedMarker("start");
  const endMarker = cachedMarker("end");
  const startRef = range.start?.id ?? startMarker.segmentRef;
  const endRef = range.end?.id ?? endMarker.segmentRef;
  const startHalfPage = halfPageForSegment(startRef, "Shabbat 2b");
  const endHalfPage = halfPageForSegment(endRef, "Shabbat 3b");
  const halfPages = enumerateHalfPages(startHalfPage, endHalfPage);

  return halfPages.map((dafRef) => {
    const asset = FIXTURE_PAGE_ASSETS[dafRef];
    if (!asset) {
      throw new Error(`Missing fixture page asset for ${dafRef}`);
    }

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

export function buildShabbat3DemoAnalysis(): DemoAnalysisView {
  const pages = buildAlignmentPages();
  const range = detectRange(transcriptFixture.text, pages, {
    preferredStartRef: "Shabbat 3a",
    preferredEndRef: "Shabbat 3b",
    priorShiurEndSegmentRef: SHABBAT_2_DAF3_PRIOR_END_SEGMENT,
  });

  return {
    id: SHABBAT_3_DEMO_ANALYSIS_ID,
    title: transcriptFixture.title,
    lectureUrl: transcriptFixture.lectureUrl,
    speaker: "Rabbi Aryeh Lebowitz",
    status: "complete",
    range,
    pages: buildVisualizerPages(range),
    transcriptPreview: transcriptFixture.text.slice(0, 420),
  };
}