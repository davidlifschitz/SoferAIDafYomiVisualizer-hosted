"use client";

import { useState, useTransition } from "react";

type BillingActionsProps = {
  balance: number;
};

async function startCheckout(product: string) {
  const response = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product }),
  });
  const payload = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? "Checkout failed.");
  }
  window.location.assign(payload.url);
}

async function openPortal() {
  const response = await fetch("/api/stripe/portal", { method: "POST" });
  const payload = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? "Portal failed.");
  }
  window.location.assign(payload.url);
}

export function BillingActions({ balance }: BillingActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="billing-panel" aria-labelledby="billing-options-title">
      <div className="panel-heading">
        <h2 id="billing-options-title">Purchase credits</h2>
        <p>Current balance: {balance}</p>
      </div>

      <div className="billing-actions">
        <button
          type="button"
          className="button-primary"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              try {
                await startCheckout("pack_5");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Checkout failed.");
              }
            })
          }
        >
          Buy 5 credits
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              try {
                await startCheckout("pack_20");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Checkout failed.");
              }
            })
          }
        >
          Buy 20 credits
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              try {
                await startCheckout("subscription");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Checkout failed.");
              }
            })
          }
        >
          Subscribe (+10 / month)
        </button>
        <button
          type="button"
          className="button-ghost"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              try {
                await openPortal();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Portal failed.");
              }
            })
          }
        >
          Manage billing
        </button>
      </div>

      {message ? <p className="form-note">{message}</p> : null}
    </section>
  );
}