import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveRequestOriginFromHeaders } from "@/lib/auth/origin";

describe("resolveRequestOriginFromHeaders", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers the origin header when present", () => {
    const origin = resolveRequestOriginFromHeaders(
      {
        get: (name) =>
          name === "origin"
            ? "https://preview.example.vercel.app"
            : null,
      },
      "http://localhost:3000",
    );

    expect(origin).toBe("https://preview.example.vercel.app");
  });

  it("falls back to forwarded host headers on server actions", () => {
    const origin = resolveRequestOriginFromHeaders(
      {
        get: (name) => {
          if (name === "x-forwarded-host") {
            return "sofer-aid-af-yomi-visualizer-hosted-13j4hm3be.vercel.app";
          }
          if (name === "x-forwarded-proto") {
            return "https";
          }
          return null;
        },
      },
      "http://localhost:3000",
    );

    expect(origin).toBe(
      "https://sofer-aid-af-yomi-visualizer-hosted-13j4hm3be.vercel.app",
    );
  });

  it("uses the configured app URL when no request host is available", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");

    const origin = resolveRequestOriginFromHeaders(
      {
        get: () => null,
      },
      "https://app.example.com",
    );

    expect(origin).toBe("https://app.example.com");
  });
});