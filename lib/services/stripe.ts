import "server-only";

import Stripe from "stripe";

import {
  getStripePriceId,
  type StripeProductCode,
} from "@/lib/billing/stripe-config";
import { getAppUrl } from "@/lib/supabase/env";

let stripeClient: Stripe | null = null;

export function getStripeSecretKey(): string | undefined {
  return process.env.STRIPE_RESTRICTED_KEY;
}

export function createStripeClient(): Stripe {
  const apiKey = getStripeSecretKey();
  if (!apiKey) {
    throw new Error("STRIPE_RESTRICTED_KEY is required for Stripe billing");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(apiKey);
  }

  return stripeClient;
}

export async function ensureStripeCustomer(input: {
  userId: string;
  email?: string | null;
  adminUpsert: (customerId: string) => Promise<void>;
}): Promise<string> {
  const stripe = createStripeClient();
  const customer = await stripe.customers.create({
    email: input.email ?? undefined,
    metadata: { userId: input.userId },
  });

  await input.adminUpsert(customer.id);
  return customer.id;
}

export async function createCheckoutSession(input: {
  customerId: string;
  product: StripeProductCode;
  userId: string;
}): Promise<string> {
  const stripe = createStripeClient();
  const priceId = getStripePriceId(input.product);
  if (!priceId) {
    throw new Error(`Stripe price is not configured for ${input.product}`);
  }

  const appUrl = getAppUrl();
  const mode = input.product === "subscription" ? "subscription" : "payment";
  const session = await stripe.checkout.sessions.create({
    mode,
    customer: input.customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/billing?checkout=success`,
    cancel_url: `${appUrl}/billing?checkout=cancelled`,
    metadata: {
      userId: input.userId,
      product: input.product,
    },
    subscription_data:
      mode === "subscription"
        ? { metadata: { userId: input.userId, product: input.product } }
        : undefined,
  });

  if (!session.url) {
    throw new Error("Stripe checkout session did not return a URL");
  }

  return session.url;
}

export async function createBillingPortalSession(customerId: string): Promise<string> {
  const stripe = createStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getAppUrl()}/billing`,
  });

  return session.url;
}

export function constructStripeEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  const stripe = createStripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required for webhook verification");
  }

  return stripe.webhooks.constructEvent(payload, signature, secret);
}