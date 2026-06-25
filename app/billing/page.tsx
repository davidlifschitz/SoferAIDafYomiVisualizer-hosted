import { AppShell } from "@/components/app-shell";
import { BillingActions } from "@/components/billing-actions";
import { getCurrentUserBalance } from "@/lib/billing/balance";

export default async function BillingPage() {
  const balance = await getCurrentUserBalance();

  return (
    <AppShell activePath="/billing">
      <section className="dashboard-heading" aria-labelledby="billing-title">
        <p className="eyebrow">Credits</p>
        <h1 id="billing-title">Billing</h1>
        <p>Purchase credit packs or manage your subscription. Credits roll over indefinitely.</p>
      </section>

      <BillingActions balance={balance} />
    </AppShell>
  );
}