import { NextResponse } from "next/server";

import { createStripeBillingStore } from "@/lib/billing/stripe-store";
import { handleStripeWebhookEvent } from "@/lib/billing/stripe-webhook";
import { constructStripeEvent } from "@/lib/services/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await request.text();

  try {
    const event = constructStripeEvent(payload, signature);
    await handleStripeWebhookEvent(
      {
        id: event.id,
        type: event.type,
        data: { object: event.data.object as never },
      },
      createStripeBillingStore(),
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[POST /api/stripe/webhook]", error);
    return NextResponse.json({ error: "Webhook verification failed." }, { status: 400 });
  }
}