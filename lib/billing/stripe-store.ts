import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { StripeBillingStore } from "@/lib/billing/stripe-webhook";
import { createAdminClient } from "@/lib/supabase/admin";

export function createStripeBillingStore(
  admin: SupabaseClient = createAdminClient(),
): StripeBillingStore {
  return {
    async hasProcessedEvent(eventId) {
      const { data } = await admin
        .from("stripe_events")
        .select("id")
        .eq("stripe_event_id", eventId)
        .maybeSingle();

      return Boolean(data);
    },

    async recordProcessedEvent(eventId, eventType) {
      await admin.from("stripe_events").insert({
        stripe_event_id: eventId,
        event_type: eventType,
      });
    },

    async getUserIdForStripeCustomer(customerId) {
      const { data } = await admin
        .from("stripe_customers")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

      return data?.user_id ?? null;
    },

    async grantCredits(userId, amount, idempotencyKey, reason) {
      const { error } = await admin.from("credit_ledger").insert({
        user_id: userId,
        amount,
        reason,
        idempotency_key: idempotencyKey,
      });

      if (error && !error.message.includes("duplicate key")) {
        throw new Error(`Failed to grant credits: ${error.message}`);
      }
    },
  };
}