"use client";

import { useState, useTransition } from "react";

type ProblemAnalysis = {
  id: string;
  status: "failed" | "partial";
  workflow_error: string | null;
  created_at: string;
  canonical_lectures: {
    title: string;
    source_key: string;
  } | null;
};

type AdminControlsProps = {
  initialSettings: {
    submissions_paused: boolean;
    monthly_spend_cap_cents: number | null;
  };
  monthlySpendCents: number;
  costPerAnalysisCents: number;
  problemAnalyses: ProblemAnalysis[];
};

async function patchSettings(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    settings?: AdminControlsProps["initialSettings"];
    error?: string;
  };

  if (!response.ok || !payload.settings) {
    throw new Error(payload.error ?? "Unable to update settings.");
  }

  return payload.settings;
}

async function adjustCredits(body: {
  userId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
}) {
  const response = await fetch("/api/admin/credits", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { balance?: number; error?: string };

  if (!response.ok || payload.balance === undefined) {
    throw new Error(payload.error ?? "Unable to adjust credits.");
  }

  return payload.balance;
}

export function AdminControls({
  initialSettings,
  monthlySpendCents,
  costPerAnalysisCents,
  problemAnalyses,
}: AdminControlsProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [spendCapInput, setSpendCapInput] = useState(
    initialSettings.monthly_spend_cap_cents?.toString() ?? "",
  );
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="dashboard-grid">
      <section className="billing-panel" aria-labelledby="admin-settings-title">
        <div className="panel-heading">
          <h2 id="admin-settings-title">Submission controls</h2>
          <p>
            Estimated monthly Sofer spend: {monthlySpendCents}¢ at {costPerAnalysisCents}¢
            per new analysis.
          </p>
        </div>

        <div className="billing-actions">
          <button
            type="button"
            className="button-secondary"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setMessage(null);
                try {
                  const next = await patchSettings({
                    submissionsPaused: !settings.submissions_paused,
                  });
                  setSettings(next);
                  setMessage(
                    next.submissions_paused
                      ? "Submissions paused."
                      : "Submissions resumed.",
                  );
                } catch (error) {
                  setMessage(
                    error instanceof Error ? error.message : "Settings update failed.",
                  );
                }
              })
            }
          >
            {settings.submissions_paused ? "Resume submissions" : "Pause submissions"}
          </button>
        </div>

        <form
          className="analysis-form"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              setMessage(null);
              try {
                const trimmed = spendCapInput.trim();
                const monthlySpendCapCents = trimmed === "" ? null : Number(trimmed);
                if (monthlySpendCapCents !== null && !Number.isInteger(monthlySpendCapCents)) {
                  throw new Error("Spending cap must be a whole number of cents.");
                }

                const next = await patchSettings({ monthlySpendCapCents });
                setSettings(next);
                setMessage("Spending cap updated.");
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : "Spending cap update failed.",
                );
              }
            });
          }}
        >
          <label className="form-field">
            <span>Monthly spending cap (cents)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={spendCapInput}
              onChange={(event) => setSpendCapInput(event.target.value)}
              placeholder="Leave blank for no cap"
            />
          </label>
          <button type="submit" className="button-secondary" disabled={isPending}>
            Save spending cap
          </button>
        </form>
      </section>

      <section className="billing-panel" aria-labelledby="admin-credits-title">
        <div className="panel-heading">
          <h2 id="admin-credits-title">Credit adjustments</h2>
          <p>Add or remove credits with a reason and idempotency key.</p>
        </div>

        <form
          className="analysis-form"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              setMessage(null);
              try {
                const balance = await adjustCredits({
                  userId: userId.trim(),
                  amount: Number(amount),
                  reason: reason.trim(),
                  idempotencyKey: idempotencyKey.trim(),
                });
                setMessage(`Updated balance: ${balance}`);
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : "Credit adjustment failed.",
                );
              }
            });
          }}
        >
          <label className="form-field">
            <span>User ID</span>
            <input
              required
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="UUID"
            />
          </label>
          <label className="form-field">
            <span>Amount</span>
            <input
              required
              type="number"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Reason</span>
            <input
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Idempotency key</span>
            <input
              required
              value={idempotencyKey}
              onChange={(event) => setIdempotencyKey(event.target.value)}
            />
          </label>
          <button type="submit" className="button-primary" disabled={isPending}>
            Apply adjustment
          </button>
        </form>
      </section>

      <section className="recent-results" aria-labelledby="admin-failures-title">
        <div className="panel-heading">
          <h2 id="admin-failures-title">Failed and partial analyses</h2>
          <p>Inspect workflow errors before retrying or refunding manually.</p>
        </div>

        {problemAnalyses.length === 0 ? (
          <p className="form-note">No failed or partial analyses right now.</p>
        ) : (
          problemAnalyses.map((analysis) => (
            <article key={analysis.id} className="result-card">
              <div>
                <h3>{analysis.canonical_lectures?.title ?? analysis.id}</h3>
                <p>
                  {analysis.status} · {new Date(analysis.created_at).toLocaleString()}
                </p>
                <p>{analysis.workflow_error ?? "No workflow error recorded."}</p>
              </div>
            </article>
          ))
        )}
      </section>

      {message ? <p className="form-note">{message}</p> : null}
    </div>
  );
}