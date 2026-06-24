export default function Home() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">
          DS
        </div>
        <span className="brand-name">Daf Shiur Visualizer</span>
      </header>

      <main className="dashboard">
        <section className="dashboard-heading" aria-labelledby="dashboard-title">
          <p className="eyebrow">Analysis workspace</p>
          <h1 id="dashboard-title">Daf Shiur Visualizer</h1>
          <p>Analyze where a Daf Yomi shiur begins and ends.</p>
        </section>

        <section className="empty-dashboard" aria-label="Shiur analyses">
          <div>
            <h2>No analyses yet</h2>
            <p>Your completed shiur range analyses will appear here.</p>
          </div>
          <span className="status-label">Workspace ready</span>
        </section>
      </main>
    </div>
  );
}
