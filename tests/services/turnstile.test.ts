import { describe, expect, it, vi } from "vitest";

import {
  createTurnstileClient,
  verifyTurnstile,
} from "@/lib/services/turnstile";

describe("verifyTurnstile", () => {
  it("returns true when Cloudflare reports success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await expect(
      verifyTurnstile("valid-token", "secret-key", "203.0.113.10", fetchImpl),
    ).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        body: expect.any(URLSearchParams),
      }),
    );

    const body = fetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get("secret")).toBe("secret-key");
    expect(body.get("response")).toBe("valid-token");
    expect(body.get("remoteip")).toBe("203.0.113.10");
  });

  it("returns false for invalid tokens", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        "error-codes": ["invalid-input-response"],
      }),
    });

    await expect(
      verifyTurnstile("bad-token", "secret-key", undefined, fetchImpl),
    ).resolves.toBe(false);
  });

  it("returns false when verification HTTP fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false }),
    });

    await expect(
      verifyTurnstile("token", "secret-key", undefined, fetchImpl),
    ).resolves.toBe(false);
  });

  it("returns false for empty token or secret", async () => {
    const fetchImpl = vi.fn();

    await expect(
      verifyTurnstile("", "secret-key", undefined, fetchImpl),
    ).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("createTurnstileClient", () => {
  it("delegates verification to verifyTurnstile", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    const client = createTurnstileClient("secret-key", fetchImpl);

    await expect(client.verify("token")).resolves.toBe(true);
  });
});