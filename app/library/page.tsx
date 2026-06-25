import Link from "next/link";

import { DemoAppShell } from "@/components/demo-app-shell";
import {
  formatDemoCardTitle,
  formatRangeSummary,
  listDemoAnalyses,
} from "@/lib/fixtures/demo-analyses";

export default function LibraryPage() {
  const demoAnalyses = listDemoAnalyses();

  return (
    <DemoAppShell activePath="/library">
      <section className="dashboard-heading" aria-labelledby="library-title">
        <p className="eyebrow">Public library</p>
        <h1 id="library-title">Listed results</h1>
        <p>
          Browse fixture-backed shiur visualizations without signing in. Live listed results will
          appear here after submission, workflow, and publication tasks are complete.
        </p>
      </section>

      <section className="recent-results" aria-labelledby="library-results-title">
        <div className="panel-heading">
          <h2 id="library-results-title">Available demos</h2>
          <p>Precomputed Shabbat 2 and Shabbat 3 analyses with calibrated marker placement.</p>
        </div>

        {demoAnalyses.map((analysis) => (
          <article key={analysis.id} className="result-card">
            <div>
              <h3>{formatDemoCardTitle(analysis)}</h3>
              <p>{formatRangeSummary(analysis)}</p>
            </div>
            <Link
              className="button-secondary result-card-link"
              href={`/analyses/${analysis.id}`}
            >
              Open visualizer
            </Link>
          </article>
        ))}
      </section>
    </DemoAppShell>
  );
}