import { NextResponse } from "next/server";

import { getOrCreateStripeCustomer } from "@/lib/billing/customer";
import { getVerifiedClaims } from "@/lib/auth/session";
import { createBillingPortalSession } from "@/lib/services/stripe";

export async function POST() {
  const claims = await getVerifiedClaims();
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  const email = typeof claims?.email === "string" ? claims.email : null;

  if (!userId) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  try {
    const customerId = await getOrCreateStripeCustomer({ userId, email });
    const url = await createBillingPortalSession(customerId);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("[POST /api/stripe/portal]", error);
    return NextResponse.json({ error: "Unable to open billing portal." }, { status: 500 });
  }
}