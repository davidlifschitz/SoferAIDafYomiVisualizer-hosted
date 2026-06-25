import type { RangeDetectionResult } from "@/lib/domain/report";

export type MarkerKind = "start" | "end";

export interface VisualizerMarker {
  kind: MarkerKind;
  x: number;
  y: number;
  label: string;
}

export interface VisualizerPage {
  dafRef: string;
  imageUrl: string;
  width: number;
  height: number;
  markers: VisualizerMarker[];
}

export interface DemoAnalysisView {
  id: string;
  title: string;
  lectureUrl: string;
  speaker: string;
  status: "complete";
  range: RangeDetectionResult;
  pages: VisualizerPage[];
  transcriptPreview: string;
}

export interface DemoFixturePageAsset {
  imageUrl: string;
  width: number;
  height: number;
}

export interface CachedMarkerRecord {
  kind: MarkerKind;
  dafRef: string;
  segmentRef: string;
  x: number;
  y: number;
}