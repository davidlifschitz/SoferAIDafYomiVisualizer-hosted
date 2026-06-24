import { AppShell } from "@/components/app-shell";

export default function AdminPage() {
  return (
    <AppShell activePath="/admin">
      <section className="dashboard-heading" aria-labelledby="admin-title">
        <p className="eyebrow">Operations</p>
        <h1 id="admin-title">Administration</h1>
        <p>Pause submissions, inspect failures, and adjust credits.</p>
      </section>

      <section className="empty-dashboard" aria-label="Admin controls">
        <div>
          <h2>Admin controls arrive in a later task</h2>
          <p>Trusted role checks and cost controls will be enforced here.</p>
        </div>
      </section>
    </AppShell>
  );
}