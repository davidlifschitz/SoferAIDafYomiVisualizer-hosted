import { AppShell } from "@/components/app-shell";

export default function BillingPage() {
  return (
    <AppShell activePath="/billing">
      <section className="dashboard-heading" aria-labelledby="billing-title">
        <p className="eyebrow">Credits</p>
        <h1 id="billing-title">Billing</h1>
        <p>Purchase credit packs or manage your subscription.</p>
      </section>

      <section className="empty-dashboard" aria-label="Billing options">
        <div>
          <h2>Billing arrives in a later task</h2>
          <p>Stripe checkout and subscription management will be wired here.</p>
        </div>
      </section>
    </AppShell>
  );
}