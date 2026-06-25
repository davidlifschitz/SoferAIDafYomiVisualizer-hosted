import { redirect } from "next/navigation";

import { AdminControls } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { getOperationalSnapshot } from "@/lib/admin/operations";
import { createDefaultAdminStore } from "@/lib/admin/store";
import { requireAdminUserId } from "@/lib/auth/admin";

export default async function AdminPage() {
  const adminId = await requireAdminUserId();
  if (!adminId) {
    redirect("/");
  }

  const snapshot = await getOperationalSnapshot(createDefaultAdminStore());

  return (
    <AppShell activePath="/admin">
      <section className="dashboard-heading" aria-labelledby="admin-title">
        <p className="eyebrow">Operations</p>
        <h1 id="admin-title">Administration</h1>
        <p>Pause submissions, inspect failures, and adjust credits.</p>
      </section>

      <AdminControls
        initialSettings={snapshot.settings}
        monthlySpendCents={snapshot.monthlySpendCents}
        costPerAnalysisCents={snapshot.costPerAnalysisCents}
        problemAnalyses={snapshot.problemAnalyses}
      />
    </AppShell>
  );
}