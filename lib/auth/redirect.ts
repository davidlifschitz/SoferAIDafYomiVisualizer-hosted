const PUBLIC_PATHS = new Set(["/login", "/library"]);
const PUBLIC_PREFIXES = ["/auth/", "/r/", "/analyses/fixture-"];

const PROTECTED_PREFIXES = [
  "/billing",
  "/settings",
  "/admin",
  "/analyses",
];

export function sanitizeNextPath(
  next: string | null | undefined,
  fallback = "/",
): string {
  if (!next) {
    return fallback;
  }

  if (!next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  if (next.includes("://") || next.includes("\\")) {
    return fallback;
  }

  return next;
}

export function needsSessionRefresh(pathname: string): boolean {
  if (pathname === "/login") {
    return true;
  }

  return isProtectedPath(pathname);
}

export function isProtectedPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) {
    return false;
  }

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  if (pathname === "/") {
    return true;
  }

  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function buildAuthCallbackUrl(
  nextPath: string,
  origin: string,
): string {
  const next = sanitizeNextPath(nextPath);

  return `${origin.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent(next)}`;
}