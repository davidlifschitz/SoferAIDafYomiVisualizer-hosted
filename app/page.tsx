import Link from "next/link";

import { AnalysisForm } from "@/components/analysis-form";
import { AppShell } from "@/components/app-shell";
import { CreditBalance } from "@/components/credit-balance";
import {
  formatDemoCardTitle,
  formatRangeSummary,
  listDemoAnalyses,
} from "@/lib/fixtures/demo-analyses";

export default function Home() {
  const demoAnalyses = listDemoAnalyses();

  return (
    <AppShell activePath="/">
      <section className="dashboard-top" aria-labelledby="dashboard-title">
        <div className="dashboard-heading">
          <p className="eyebrow">Analysis workspace</p>
          <h1 id="dashboard-title">Daf Shiur Visualizer</h1>
          <p>
            Explore fixture-backed shiur visualizations now. Live YUTorah submissions with credit
            charging arrive after protected submission and workflow tasks are wired up.
          </p>
        </div>
        <CreditBalance />
      </section>

      <div className="dashboard-grid">
        <AnalysisForm />

        <section className="recent-results" aria-labelledby="recent-results-title">
          <div className="panel-heading">
            <h2 id="recent-results-title">Fixture demos</h2>
            <p>
              Open precomputed Shabbat analyses while live submissions are still disabled. Each demo
              shows detected range, confidence, and calibrated start/end markers on daf-yomi pages.
            </p>
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

          <p className="form-note">
            Browse all demos without signing in from the{" "}
            <Link href="/library">public library</Link>.
          </p>
        </section>
      </div>
    </AppShell>
  );
}