import { getSupabaseUrl } from "@/lib/supabase/env";

export type SupabaseHealth = {
  reachable: boolean;
  local: boolean;
  message?: string;
};

export function isLocalSupabaseUrl(url: string): boolean {
  return (
    url.includes("127.0.0.1") ||
    url.includes("localhost") ||
    url.includes("0.0.0.0")
  );
}

export async function getSupabaseHealth(
  timeoutMs = 800,
): Promise<SupabaseHealth> {
  let supabaseUrl: string;

  try {
    supabaseUrl = getSupabaseUrl();
  } catch {
    return {
      reachable: false,
      local: false,
      message: "Supabase environment variables are not configured.",
    };
  }

  const local = isLocalSupabaseUrl(supabaseUrl);
  const healthUrl = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/health`;

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return {
        reachable: false,
        local,
        message: local
          ? "Local Supabase responded but is unhealthy."
          : "Supabase auth health check failed.",
      };
    }

    return { reachable: true, local };
  } catch {
    return {
      reachable: false,
      local,
      message: local
        ? "Local Supabase is not running on port 54321."
        : "Could not reach Supabase.",
    };
  }
}

export function formatSupabaseOfflineHelp(health: SupabaseHealth): string {
  if (!health.local) {
    return health.message ?? "Supabase is unavailable.";
  }

  return [
    health.message ?? "Local Supabase is offline.",
    "Start it with: supabase start -x vector",
    "Fixture demos work without sign-in at /library",
  ].join(" ");
}