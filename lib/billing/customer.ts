import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ensureStripeCustomer } from "@/lib/services/stripe";

export async function getOrCreateStripeCustomer(input: {
  userId: string;
  email?: string | null;
}): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (data?.stripe_customer_id) {
    return data.stripe_customer_id;
  }

  return ensureStripeCustomer({
    userId: input.userId,
    email: input.email,
    adminUpsert: async (customerId) => {
      const { error } = await admin.from("stripe_customers").insert({
        user_id: input.userId,
        stripe_customer_id: customerId,
      });

      if (error) {
        throw new Error(`Failed to save Stripe customer mapping: ${error.message}`);
      }
    },
  });
}