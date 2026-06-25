"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

import { DEFAULT_GEMARA_COLUMN_BOUNDS } from "@/lib/domain/marker-locator";
import type { MarkerKind, VisualizerPage } from "@/lib/fixtures/shabbat-2-analysis";

type RangeVisualizerProps = {
  pages: VisualizerPage[];
  draggableMarkers?: boolean;
};

type MarkerCoordinate = {
  dafRef: string;
  kind: MarkerKind;
  label: string;
  x: number;
  y: number;
};

export function markerPosition(
  marker: Pick<MarkerCoordinate, "x" | "y">,
  page: Pick<VisualizerPage, "width" | "height">,
) {
  return {
    left: `${(marker.x / page.width) * 100}%`,
    top: `${(marker.y / page.height) * 100}%`,
  };
}

export function coordinatesFromPointer(
  clientX: number,
  clientY: number,
  frameRect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  page: Pick<VisualizerPage, "width" | "height">,
): Pick<MarkerCoordinate, "x" | "y"> {
  const x = Math.round(((clientX - frameRect.left) / frameRect.width) * page.width);
  const y = Math.round(((clientY - frameRect.top) / frameRect.height) * page.height);

  return {
    x: Math.max(0, Math.min(page.width, x)),
    y: Math.max(0, Math.min(page.height, y)),
  };
}

function toGemaraColumnCoords(x: number, y: number) {
  const { left, right, top, bottom } = DEFAULT_GEMARA_COLUMN_BOUNDS;
  const columnWidth = right - left;
  const columnHeight = bottom - top;

  return {
    columnX: Number(((x - left) / columnWidth).toFixed(3)),
    columnY: Number(((y - top) / columnHeight).toFixed(3)),
  };
}

function buildMarkerState(pages: VisualizerPage[]): MarkerCoordinate[] {
  return pages.flatMap((page) =>
    page.markers.map((marker) => ({
      dafRef: page.dafRef,
      kind: marker.kind,
      label: marker.label,
      x: marker.x,
      y: marker.y,
    })),
  );
}

export function RangeVisualizer({
  pages,
  draggableMarkers = false,
}: RangeVisualizerProps) {
  const [zoom, setZoom] = useState(100);
  const pagesIdentity = useMemo(
    () =>
      pages
        .map((page) =>
          `${page.dafRef}:${page.markers
            .map((marker) => `${marker.kind}:${marker.x},${marker.y}`)
            .join("|")}`,
        )
        .join(";"),
    [pages],
  );
  const [markerCoords, setMarkerCoords] = useState<MarkerCoordinate[]>(() =>
    buildMarkerState(pages),
  );
  const [syncedPagesIdentity, setSyncedPagesIdentity] = useState(pagesIdentity);
  const [activeDrag, setActiveDrag] = useState<{
    dafRef: string;
    kind: MarkerKind;
    pointerId: number;
  } | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const frameRefs = useRef(new Map<string, HTMLDivElement | null>());
  const zoomScale = useMemo(() => zoom / 100, [zoom]);

  if (pagesIdentity !== syncedPagesIdentity) {
    setSyncedPagesIdentity(pagesIdentity);
    setMarkerCoords(buildMarkerState(pages));
  }

  const markerMap = useMemo(
    () => new Map(markerCoords.map((marker) => [`${marker.dafRef}:${marker.kind}`, marker])),
    [markerCoords],
  );

  const exportPayload = useMemo(
    () => ({
      imageWidth: pages[0]?.width ?? 1296,
      imageHeight: pages[0]?.height ?? 2000,
      markers: markerCoords.map((marker) => ({
        kind: marker.kind,
        dafRef: marker.dafRef,
        label: marker.label,
        ...toGemaraColumnCoords(marker.x, marker.y),
        x: marker.x,
        y: marker.y,
      })),
    }),
    [markerCoords, pages],
  );

  const updateMarkerPosition = useCallback(
    (
      dafRef: string,
      kind: MarkerKind,
      position: Pick<MarkerCoordinate, "x" | "y">,
    ) => {
      setMarkerCoords((current) =>
        current.map((marker) =>
          marker.dafRef === dafRef && marker.kind === kind
            ? { ...marker, ...position }
            : marker,
        ),
      );
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
        return;
      }

      const page = pages.find((entry) => entry.dafRef === activeDrag.dafRef);
      const frame = frameRefs.current.get(activeDrag.dafRef);
      if (!page || !frame) {
        return;
      }

      const position = coordinatesFromPointer(
        event.clientX,
        event.clientY,
        frame.getBoundingClientRect(),
        page,
      );

      updateMarkerPosition(activeDrag.dafRef, activeDrag.kind, position);
    },
    [activeDrag, pages, updateMarkerPosition],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
        return;
      }

      setActiveDrag(null);
    },
    [activeDrag],
  );

  useEffect(() => {
    if (!activeDrag) {
      return undefined;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [activeDrag, handlePointerMove, handlePointerUp]);

  async function copyMarkerPayload() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportPayload, null, 2));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  return (
    <section className="range-visualizer" aria-labelledby="visualizer-title">
      <div className="visualizer-toolbar">
        <div className="panel-heading">
          <h2 id="visualizer-title">Range visualizer</h2>
          <p>
            {draggableMarkers
              ? "Drag the markers into place, then copy the coordinates below."
              : "Stacked daf-yomi tzuras hadaf pages from detected start through end."}
          </p>
        </div>

        <div className="zoom-controls" aria-label="Zoom controls">
          <button
            type="button"
            className="button-ghost"
            onClick={() => setZoom((value) => Math.max(50, value - 10))}
            aria-label="Zoom out"
          >
            <ZoomOut size={16} aria-hidden="true" />
          </button>
          <span className="zoom-label">{zoom}%</span>
          <button
            type="button"
            className="button-ghost"
            onClick={() => setZoom((value) => Math.min(150, value + 10))}
            aria-label="Zoom in"
          >
            <ZoomIn size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {draggableMarkers ? (
        <section className="marker-calibration-panel" aria-label="Marker coordinates">
          <div className="marker-calibration-header">
            <h3>Marker calibration</h3>
            <button type="button" className="button-secondary" onClick={copyMarkerPayload}>
              {copyState === "copied"
                ? "Copied"
                : copyState === "error"
                  ? "Copy failed"
                  : "Copy JSON"}
            </button>
          </div>
          <p className="form-note">
            Drag each marker onto the correct text. Paste the copied JSON back here when done.
          </p>
          <pre className="marker-calibration-output">
            {JSON.stringify(exportPayload, null, 2)}
          </pre>
        </section>
      ) : null}

      <div
        className="visualizer-stack"
        style={{ transform: `scale(${zoomScale})`, transformOrigin: "top center" }}
      >
        {pages.map((page) => (
          <article
            key={page.dafRef}
            className="visualizer-page"
            aria-label={`Daf page ${page.dafRef}`}
          >
            <header className="visualizer-page-header">
              <h3>{page.dafRef}</h3>
              {draggableMarkers
                ? page.markers.map((marker) => {
                    const current = markerMap.get(`${page.dafRef}:${marker.kind}`);
                    if (!current) {
                      return null;
                    }

                    return (
                      <p key={marker.kind} className="marker-coordinate-label">
                        {marker.kind}: ({current.x}, {current.y})
                      </p>
                    );
                  })
                : null}
            </header>

            <div
              ref={(node) => {
                frameRefs.current.set(page.dafRef, node);
              }}
              className="visualizer-page-frame"
              style={{ aspectRatio: `${page.width} / ${page.height}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.imageUrl}
                alt={`Daf-yomi screenshot for ${page.dafRef}`}
                width={page.width}
                height={page.height}
                className="visualizer-page-image"
              />

              <div className="visualizer-page-overlay">
                {page.markers.map((marker) => {
                  const current =
                    markerMap.get(`${page.dafRef}:${marker.kind}`) ?? marker;
                  const isDragging =
                    activeDrag?.dafRef === page.dafRef &&
                    activeDrag.kind === marker.kind;

                  return (
                    <button
                      key={`${page.dafRef}-${marker.kind}`}
                      type="button"
                      className={[
                        "range-marker",
                        `range-marker-${marker.kind}`,
                        draggableMarkers ? "range-marker-draggable" : "",
                        isDragging ? "range-marker-dragging" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={markerPosition(current, page)}
                      aria-label={marker.label}
                      disabled={!draggableMarkers}
                      onPointerDown={(event) => {
                        if (!draggableMarkers) {
                          return;
                        }

                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setActiveDrag({
                          dafRef: page.dafRef,
                          kind: marker.kind,
                          pointerId: event.pointerId,
                        });
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}