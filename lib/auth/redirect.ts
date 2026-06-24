const PUBLIC_PATHS = new Set(["/login", "/library"]);
const PUBLIC_PREFIXES = ["/auth/", "/r/"];

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

export function buildAuthCallbackUrl(nextPath: string): string {
  const next = sanitizeNextPath(nextPath);
  const origin = getAppUrl();

  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}