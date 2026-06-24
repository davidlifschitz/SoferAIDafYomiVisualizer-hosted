import { AppShell } from "@/components/app-shell";

export default function SettingsPage() {
  return (
    <AppShell activePath="/settings">
      <section className="dashboard-heading" aria-labelledby="settings-title">
        <p className="eyebrow">Account</p>
        <h1 id="settings-title">Settings</h1>
        <p>Manage identity and publication defaults.</p>
      </section>

      <section className="empty-dashboard" aria-label="Account settings">
        <div>
          <h2>Settings are coming soon</h2>
          <p>Profile and publication defaults will be editable here.</p>
        </div>
      </section>
    </AppShell>
  );
}