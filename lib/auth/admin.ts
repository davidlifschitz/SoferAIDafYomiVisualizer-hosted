import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getVerifiedClaims } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProfileRole = "user" | "admin";

export async function getProfileRole(
  userId: string,
  admin: SupabaseClient = createAdminClient(),
): Promise<ProfileRole | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.role) {
    return null;
  }

  return data.role as ProfileRole;
}

export async function isAdminUser(
  userId: string,
  admin: SupabaseClient = createAdminClient(),
): Promise<boolean> {
  return (await getProfileRole(userId, admin)) === "admin";
}

export async function requireAdminUserId(): Promise<string | null> {
  const claims = await getVerifiedClaims();
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (!userId) {
    return null;
  }

  return (await isAdminUser(userId)) ? userId : null;
}