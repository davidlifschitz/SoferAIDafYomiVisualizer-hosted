import "server-only";

import { createClient } from "@/lib/supabase/server";

const AUTH_CLAIMS_TIMEOUT_MS = 3_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("auth_claims_timeout"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function getVerifiedClaims() {
  try {
    const supabase = await createClient();
    const { data, error } = await withTimeout(
      supabase.auth.getClaims(),
      AUTH_CLAIMS_TIMEOUT_MS,
    );

    if (error || !data?.claims) {
      return null;
    }

    return data.claims;
  } catch {
    return null;
  }
}