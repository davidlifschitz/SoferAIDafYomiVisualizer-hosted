import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { hasSupabaseConfig } from "./env";

function requireSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !secret || !publishable) {
    throw new Error("Supabase environment variables are required for this test.");
  }

  return { url, secret, publishable };
}

export function createE2EAdminClient(): SupabaseClient {
  const { url, secret } = requireSupabaseEnv();
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createE2EAnonClient(): SupabaseClient {
  const { url, publishable } = requireSupabaseEnv();
  return createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createTestEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export async function getCreditBalanceForUser(userId: string): Promise<number> {
  const admin = createE2EAdminClient();
  const { data, error } = await admin
    .from("credit_ledger")
    .select("amount")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? []).reduce((total, entry) => total + entry.amount, 0);
}

export async function getUserIdByEmail(email: string): Promise<string | null> {
  const admin = createE2EAdminClient();
  const { data } = await admin.auth.admin.listUsers();
  return data.users.find((user) => user.email === email)?.id ?? null;
}

export function supabaseConfigured(): boolean {
  return hasSupabaseConfig();
}