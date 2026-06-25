import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoAppShell } from "@/components/demo-app-shell";
import { EvidenceInspector } from "@/components/evidence-inspector";
import { RangeVisualizer } from "@/components/range-visualizer";
import { loadSharedResultView } from "@/lib/analysis/analysis-view";

type SharedResultPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function SharedResultPage({ params }: SharedResultPageProps) {
  const { slug } = await params;
  const shared = await loadSharedResultView(slug);

  if (!shared) {
    notFound();
  }

  return (
    <DemoAppShell activePath="/library">
      <section className="analysis-header" aria-labelledby="shared-title">
        <div className="dashboard-heading">
          <p className="eyebrow">
            {shared.publicationMode === "public" ? "Listed result" : "Shared result"}
          </p>
          <h1 id="shared-title">{shared.publicView.title}</h1>
          {shared.publicView.speaker ? <p>{shared.publicView.speaker}</p> : null}
          {shared.publicView.lectureUrl ? (
            <p>
              <a href={shared.publicView.lectureUrl} target="_blank" rel="noreferrer">
                View lecture
              </a>
            </p>
          ) : null}
        </div>
        <Link className="button-ghost" href="/library">
          Back to library
        </Link>
      </section>

      <div className="analysis-layout">
        <RangeVisualizer pages={shared.pages} />
        <EvidenceInspector
          range={shared.publicView.range}
          transcriptPreview={shared.publicView.transcriptPreview ?? ""}
        />
      </div>
    </DemoAppShell>
  );
}