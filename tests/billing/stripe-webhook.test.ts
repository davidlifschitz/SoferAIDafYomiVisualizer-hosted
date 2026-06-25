import { describe, expect, it } from "vitest";

import {
  creditsForCheckoutSession,
  creditsForInvoicePayment,
  handleStripeWebhookEvent,
  type StripeBillingStore,
} from "@/lib/billing/stripe-webhook";

const USER_ID = "11111111-1111-1111-1111-111111111111";

function createMemoryBillingStore() {
  const events = new Set<string>();
  const grants: Array<{ userId: string; amount: number; idempotencyKey: string }> = [];

  const store: StripeBillingStore = {
    async hasProcessedEvent(eventId) {
      return events.has(eventId);
    },
    async recordProcessedEvent(eventId) {
      events.add(eventId);
    },
    async getUserIdForStripeCustomer(customerId) {
      return customerId === "cus_test" ? USER_ID : null;
    },
    async grantCredits(userId, amount, idempotencyKey) {
      grants.push({ userId, amount, idempotencyKey });
    },
  };

  return { store, grants, events };
}

describe("creditsForCheckoutSession", () => {
  it("grants pack credits only for paid checkout sessions", () => {
    expect(
      creditsForCheckoutSession({
        mode: "payment",
        payment_status: "paid",
        metadata: { product: "pack_5" },
      }),
    ).toBe(5);
    expect(
      creditsForCheckoutSession({
        mode: "payment",
        payment_status: "paid",
        metadata: { product: "pack_20" },
      }),
    ).toBe(20);
    expect(
      creditsForCheckoutSession({
        mode: "payment",
        payment_status: "unpaid",
        metadata: { product: "pack_5" },
      }),
    ).toBeNull();
  });
});

describe("creditsForInvoicePayment", () => {
  it("grants ten credits for paid subscription invoices", () => {
    expect(
      creditsForInvoicePayment({
        billing_reason: "subscription_cycle",
        paid: true,
      }),
    ).toBe(10);
    expect(
      creditsForInvoicePayment({
        billing_reason: "subscription_cycle",
        paid: false,
      }),
    ).toBeNull();
  });
});

describe("handleStripeWebhookEvent", () => {
  it("grants pack credits from checkout.session.completed once per event", async () => {
    const { store, grants } = createMemoryBillingStore();

    const event = {
      id: "evt_checkout_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          mode: "payment",
          payment_status: "paid",
          customer: "cus_test",
          metadata: { product: "pack_5" },
        },
      },
    };

    await handleStripeWebhookEvent(event, store);
    await handleStripeWebhookEvent(event, store);

    expect(grants).toEqual([
      {
        userId: USER_ID,
        amount: 5,
        idempotencyKey: "stripe:checkout:cs_test",
      },
    ]);
  });

  it("creates compensating entries for charge.refunded events", async () => {
    const { store, grants } = createMemoryBillingStore();

    await handleStripeWebhookEvent(
      {
        id: "evt_refund_1",
        type: "charge.refunded",
        data: {
          object: {
            id: "ch_test",
            customer: "cus_test",
            metadata: { credits: "5" },
          },
        },
      },
      store,
    );

    expect(grants).toEqual([
      {
        userId: USER_ID,
        amount: -5,
        idempotencyKey: "stripe:refund:ch_test",
      },
    ]);
  });

  it("grants subscription invoice credits idempotently", async () => {
    const { store, grants } = createMemoryBillingStore();

    const event = {
      id: "evt_invoice_1",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          id: "in_test",
          customer: "cus_test",
          billing_reason: "subscription_cycle",
          paid: true,
        },
      },
    };

    await handleStripeWebhookEvent(event, store);
    await handleStripeWebhookEvent(event, store);

    expect(grants).toEqual([
      {
        userId: USER_ID,
        amount: 10,
        idempotencyKey: "stripe:invoice:in_test",
      },
    ]);
  });
});