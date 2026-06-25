import Link from "next/link";

import { DemoAppShell } from "@/components/demo-app-shell";
import { listLibraryEntries } from "@/lib/analysis/library";

export default async function LibraryPage() {
  const entries = await listLibraryEntries();
  const listed = entries.filter((entry) => entry.source === "listed");
  const fixtures = entries.filter((entry) => entry.source === "fixture");

  return (
    <DemoAppShell activePath="/library">
      <section className="dashboard-heading" aria-labelledby="library-title">
        <p className="eyebrow">Public library</p>
        <h1 id="library-title">Listed results</h1>
        <p>
          Browse published shiur visualizations without signing in. Unlisted results are only
          available through their share URLs at <code>/r/&lt;public-id&gt;</code>.
        </p>
      </section>

      {listed.length > 0 ? (
        <section className="recent-results" aria-labelledby="listed-results-title">
          <div className="panel-heading">
            <h2 id="listed-results-title">Published analyses</h2>
          </div>
          {listed.map((entry) => (
            <article key={entry.id} className="result-card">
              <div>
                <h3>{entry.title}</h3>
                <p>{entry.summary}</p>
              </div>
              <Link className="button-secondary result-card-link" href={entry.href}>
                Open result
              </Link>
            </article>
          ))}
        </section>
      ) : null}

      <section className="recent-results" aria-labelledby="library-results-title">
        <div className="panel-heading">
          <h2 id="library-results-title">Fixture demos</h2>
          <p>Precomputed Shabbat 2 and Shabbat 3 analyses with calibrated marker placement.</p>
        </div>

        {fixtures.map((entry) => (
          <article key={entry.id} className="result-card">
            <div>
              <h3>{entry.title}</h3>
              <p>{entry.summary}</p>
            </div>
            <Link className="button-secondary result-card-link" href={entry.href}>
              Open visualizer
            </Link>
          </article>
        ))}
      </section>
    </DemoAppShell>
  );
}