import {
  STRIPE_PRODUCT_CREDITS,
  parseStripeProductCode,
} from "@/lib/billing/stripe-config";

type CheckoutSessionLike = {
  id?: string;
  mode?: string;
  payment_status?: string;
  customer?: string | { id?: string } | null;
  metadata?: Record<string, string | undefined> | null;
};

type InvoiceLike = {
  id?: string;
  billing_reason?: string | null;
  paid?: boolean;
  customer?: string | { id?: string } | null;
};

type ChargeLike = {
  id?: string;
  customer?: string | { id?: string } | null;
  metadata?: Record<string, string | undefined> | null;
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: CheckoutSessionLike | InvoiceLike | ChargeLike;
  };
};

export type StripeBillingStore = {
  hasProcessedEvent(eventId: string): Promise<boolean>;
  recordProcessedEvent(eventId: string, eventType: string): Promise<void>;
  getUserIdForStripeCustomer(customerId: string): Promise<string | null>;
  grantCredits(
    userId: string,
    amount: number,
    idempotencyKey: string,
    reason: "purchase" | "refund",
  ): Promise<void>;
};

function customerId(
  value: string | { id?: string } | null | undefined,
): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id ?? null;
}

export function creditsForCheckoutSession(
  session: CheckoutSessionLike,
): number | null {
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return null;
  }

  const product = parseStripeProductCode(session.metadata?.product);
  return product ? STRIPE_PRODUCT_CREDITS[product] : null;
}

export function creditsForInvoicePayment(invoice: InvoiceLike): number | null {
  if (!invoice.paid || invoice.billing_reason !== "subscription_cycle") {
    return null;
  }

  return STRIPE_PRODUCT_CREDITS.subscription;
}

export async function handleStripeWebhookEvent(
  event: StripeWebhookEvent,
  store: StripeBillingStore,
): Promise<void> {
  if (await store.hasProcessedEvent(event.id)) {
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as CheckoutSessionLike;
    const credits = creditsForCheckoutSession(session);
    const stripeCustomerId = customerId(session.customer);
    if (!credits || !stripeCustomerId || !session.id) {
      await store.recordProcessedEvent(event.id, event.type);
      return;
    }

    const userId = await store.getUserIdForStripeCustomer(stripeCustomerId);
    if (!userId) {
      await store.recordProcessedEvent(event.id, event.type);
      return;
    }

    await store.grantCredits(
      userId,
      credits,
      `stripe:checkout:${session.id}`,
      "purchase",
    );
    await store.recordProcessedEvent(event.id, event.type);
    return;
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as InvoiceLike;
    const credits = creditsForInvoicePayment(invoice);
    const stripeCustomerId = customerId(invoice.customer);
    if (!credits || !stripeCustomerId || !invoice.id) {
      await store.recordProcessedEvent(event.id, event.type);
      return;
    }

    const userId = await store.getUserIdForStripeCustomer(stripeCustomerId);
    if (!userId) {
      await store.recordProcessedEvent(event.id, event.type);
      return;
    }

    await store.grantCredits(
      userId,
      credits,
      `stripe:invoice:${invoice.id}`,
      "purchase",
    );
    await store.recordProcessedEvent(event.id, event.type);
    return;
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as ChargeLike;
    const stripeCustomerId = customerId(charge.customer);
    const credits = Number(charge.metadata?.credits ?? 0);
    if (!stripeCustomerId || !charge.id || !Number.isFinite(credits) || credits <= 0) {
      await store.recordProcessedEvent(event.id, event.type);
      return;
    }

    const userId = await store.getUserIdForStripeCustomer(stripeCustomerId);
    if (!userId) {
      await store.recordProcessedEvent(event.id, event.type);
      return;
    }

    await store.grantCredits(
      userId,
      -credits,
      `stripe:refund:${charge.id}`,
      "refund",
    );
    await store.recordProcessedEvent(event.id, event.type);
    return;
  }

  await store.recordProcessedEvent(event.id, event.type);
}