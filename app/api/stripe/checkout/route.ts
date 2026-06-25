import { NextResponse } from "next/server";
import { z } from "zod";

import { getOrCreateStripeCustomer } from "@/lib/billing/customer";
import { parseStripeProductCode } from "@/lib/billing/stripe-config";
import { getVerifiedClaims } from "@/lib/auth/session";
import { createCheckoutSession } from "@/lib/services/stripe";

const bodySchema = z.object({
  product: z.string().min(1),
});

export async function POST(request: Request) {
  const claims = await getVerifiedClaims();
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  const email = typeof claims?.email === "string" ? claims.email : null;

  if (!userId) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const product = parseStripeProductCode(parsed.data.product);
  if (!product) {
    return NextResponse.json({ error: "Unsupported product." }, { status: 400 });
  }

  try {
    const customerId = await getOrCreateStripeCustomer({ userId, email });
    const url = await createCheckoutSession({ customerId, product, userId });
    return NextResponse.json({ url });
  } catch (error) {
    console.error("[POST /api/stripe/checkout]", error);
    return NextResponse.json({ error: "Unable to start checkout." }, { status: 500 });
  }
}