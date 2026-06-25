import Link from "next/link";
import { notFound } from "next/navigation";

import { AnalysisProgress } from "@/components/analysis-progress";
import { AppShell } from "@/components/app-shell";
import { DemoAppShell } from "@/components/demo-app-shell";
import { EvidenceInspector } from "@/components/evidence-inspector";
import { RangeVisualizer } from "@/components/range-visualizer";
import {
  SHABBAT_2_DEMO_ANALYSIS_ID,
  SHABBAT_3_DEMO_ANALYSIS_ID,
  formatRangeSummary,
  getDemoAnalysisById,
  isDemoFixtureId,
} from "@/lib/fixtures/demo-analyses";

type AnalysisPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    calibrate?: string;
  }>;
};

export default async function AnalysisPage({ params, searchParams }: AnalysisPageProps) {
  const { id } = await params;
  const { calibrate } = await searchParams;
  const analysis = getDemoAnalysisById(id);

  if (!analysis) {
    notFound();
  }

  const isDemoFixture = isDemoFixtureId(id);
  const calibrationMode = isDemoFixture && calibrate === "1";
  const backHref = isDemoFixture ? "/library" : "/";
  const backLabel = isDemoFixture ? "Back to library" : "Back to dashboard";

  const content = (
    <>
      <section className="analysis-header" aria-labelledby="analysis-title">
        <div className="dashboard-heading">
          <p className="eyebrow">{isDemoFixture ? "Fixture demo" : "Completed analysis"}</p>
          <h1 id="analysis-title">{analysis.title}</h1>
          <p>
            {analysis.speaker} ·{" "}
            <a href={analysis.lectureUrl} target="_blank" rel="noreferrer">
              View lecture
            </a>
          </p>
          <p className="form-note">{formatRangeSummary(analysis)}</p>
        </div>
        <Link className="button-ghost" href={backHref}>
          {backLabel}
        </Link>
      </section>

      <AnalysisProgress currentStage="complete" />

      {isDemoFixture ? (
        <p className="form-note" style={{ marginBottom: 16 }}>
          {calibrationMode ? (
            <>
              {id === SHABBAT_2_DEMO_ANALYSIS_ID ? (
                <>
                  Drag the green start marker onto the big word{" "}
                  <span dir="rtl" className="font-semibold">
                    יְצִיאוֹת
                  </span>{" "}
                  on 2a, and the red end marker onto Rava in the center gemara column on 2b (not
                  Tosafot or Rashi).
                </>
              ) : id === SHABBAT_3_DEMO_ANALYSIS_ID ? (
                <>
                  Drag the green start marker onto{" "}
                  <span dir="rtl" className="font-semibold">
                    רַב מַתְנָה
                  </span>{" "}
                  near the bottom of 2b, where Daf 3 continues after Daf 2 ended, and the red end
                  marker onto Abaye&apos;s{" "}
                  <span dir="rtl" className="font-semibold">
                    יָדוֹ שֶׁל אָדָם
                  </span>{" "}
                  question on 3b.
                </>
              ) : (
                <>Drag each marker onto the correct phrase in the center column.</>
              )}{" "}
              Copy the JSON from the calibration panel and paste it back into the fixture markers
              file.
            </>
          ) : (
            <>
              Fixture-backed visualization with calibrated start/end markers. Add{" "}
              <code>?calibrate=1</code> to the URL to fine-tune marker placement.
            </>
          )}
        </p>
      ) : null}

      <div className="analysis-layout">
        <RangeVisualizer
          pages={analysis.pages}
          draggableMarkers={calibrationMode}
        />
        <EvidenceInspector
          range={analysis.range}
          transcriptPreview={analysis.transcriptPreview}
        />
      </div>
    </>
  );

  if (isDemoFixture) {
    return (
      <DemoAppShell activePath={`/analyses/${id}`}>{content}</DemoAppShell>
    );
  }

  return <AppShell activePath="/">{content}</AppShell>;
}