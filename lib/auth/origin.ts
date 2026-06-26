import { headers } from "next/headers";

import { getAppUrl } from "@/lib/supabase/env";

type HeaderReader = {
  get(name: string): string | null;
};

export function resolveRequestOriginFromHeaders(
  headerList: HeaderReader,
  fallback = getAppUrl(),
): string {
  const originHeader = headerList.get("origin");
  if (originHeader) {
    return originHeader.replace(/\/$/, "");
  }

  const forwardedHost = headerList.get("x-forwarded-host");
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    if (host) {
      const protocol =
        headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
      return `${protocol}://${host}`.replace(/\/$/, "");
    }
  }

  const host = headerList.get("host");
  if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    return `https://${host}`.replace(/\/$/, "");
  }

  return fallback.replace(/\/$/, "");
}

export async function resolveRequestOrigin(): Promise<string> {
  const headerList = await headers();
  return resolveRequestOriginFromHeaders(headerList);
}