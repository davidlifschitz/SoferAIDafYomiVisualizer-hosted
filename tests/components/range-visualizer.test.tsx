import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  RangeVisualizer,
  coordinatesFromPointer,
  markerPosition,
} from "@/components/range-visualizer";
import markerFixture from "@/lib/fixtures/shabbat-2-markers.json";
import { buildShabbat2DemoAnalysis } from "@/lib/fixtures/shabbat-2-analysis";
import { buildShabbat3DemoAnalysis } from "@/lib/fixtures/shabbat-3-analysis";

describe("coordinatesFromPointer", () => {
  it("converts pointer position into image pixel coordinates", () => {
    const analysis = buildShabbat2DemoAnalysis();
    const page = analysis.pages[0];

    expect(
      coordinatesFromPointer(100, 200, { left: 0, top: 0, width: 600, height: 1000 }, page),
    ).toEqual({
      x: Math.round((100 / 600) * page.width),
      y: Math.round((200 / 1000) * page.height),
    });
  });
});

describe("markerPosition", () => {
  it("uses percentage-based placement", () => {
    const analysis = buildShabbat2DemoAnalysis();
    const page = analysis.pages[0];
    const marker = page.markers[0];

    expect(markerPosition(marker, page)).toEqual({
      left: `${(marker.x / page.width) * 100}%`,
      top: `${(marker.y / page.height) * 100}%`,
    });
  });
});

describe("buildShabbat2DemoAnalysis", () => {
  it("uses static daf-yomi fixture page images", () => {
    const analysis = buildShabbat2DemoAnalysis();

    expect(analysis.pages[0].imageUrl).toBe("/fixtures/daf-yomi/shabbat-2a.png");
    expect(analysis.pages[1].imageUrl).toBe("/fixtures/daf-yomi/shabbat-2b.png");
    expect(analysis.pages.every((page) => page.width > 0 && page.height > 0)).toBe(true);
  });

  it("keeps start and end markers on the Shabbat 2 regression pages", () => {
    const analysis = buildShabbat2DemoAnalysis();

    expect(analysis.pages[0].markers).toEqual([
      expect.objectContaining({ kind: "start", label: "Start Shabbat 2a:1" }),
    ]);
    expect(analysis.pages[1].markers).toEqual([
      expect.objectContaining({ kind: "end", label: "End Shabbat 2b:14" }),
    ]);
  });

  it("uses vision-located marker coordinates from the fixture cache", () => {
    const analysis = buildShabbat2DemoAnalysis();
    const [page2a, page2b] = analysis.pages;
    const start = markerFixture.markers.find((marker) => marker.kind === "start");
    const end = markerFixture.markers.find((marker) => marker.kind === "end");

    expect(page2a.markers[0]).toMatchObject({ x: start?.x, y: start?.y });
    expect(page2b.markers[0]).toMatchObject({ x: end?.x, y: end?.y });
  });
});

describe("RangeVisualizer", () => {
  it("renders stacked pages with start on 2a and end on 2b", () => {
    const analysis = buildShabbat2DemoAnalysis();

    render(<RangeVisualizer pages={analysis.pages} />);

    expect(screen.getByRole("heading", { name: /range visualizer/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/daf page shabbat 2a/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/daf page shabbat 2b/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start shabbat 2a:1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end shabbat 2b:14/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/start shabbat 2b/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/end shabbat 2a/i)).not.toBeInTheDocument();
  });

  it("shows marker calibration controls when dragging is enabled", () => {
    const analysis = buildShabbat2DemoAnalysis();

    render(<RangeVisualizer pages={analysis.pages} draggableMarkers />);

    expect(screen.getByRole("heading", { name: /marker calibration/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy json/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /start shabbat 2a:1/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /end shabbat 2b:14/i })).toHaveLength(1);
  });

  it("exposes accessible zoom controls", () => {
    const analysis = buildShabbat2DemoAnalysis();

    render(<RangeVisualizer pages={analysis.pages} />);

    expect(screen.getByRole("button", { name: /zoom in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zoom out/i })).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders Shabbat 3 continuation pages with start on 2b and end on 3b", () => {
    const analysis = buildShabbat3DemoAnalysis();

    render(<RangeVisualizer pages={analysis.pages} />);

    expect(screen.getByLabelText(/daf page shabbat 2b/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/daf page shabbat 3a/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/daf page shabbat 3b/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start shabbat 2b:15/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end shabbat 3b:3/i)).toBeInTheDocument();
  });

});