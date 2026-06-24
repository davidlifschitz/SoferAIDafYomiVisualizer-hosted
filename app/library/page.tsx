export default function LibraryPage() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-start">
          <div className="brand-mark" aria-hidden="true">
            DS
          </div>
          <span className="brand-name">Daf Shiur Visualizer</span>
        </div>
      </header>

      <main className="dashboard">
        <section className="dashboard-heading" aria-labelledby="library-title">
          <p className="eyebrow">Public library</p>
          <h1 id="library-title">Listed results</h1>
          <p>Browse publicly listed shiur visualizations.</p>
        </section>

        <section className="empty-dashboard" aria-label="Public results">
          <div>
            <h2>No listed results yet</h2>
            <p>Published visualizations will appear here without requiring sign-in.</p>
          </div>
        </section>
      </main>
    </div>
  );
}