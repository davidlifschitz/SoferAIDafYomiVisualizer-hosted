import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatSupabaseOfflineHelp,
  getSupabaseHealth,
  isLocalSupabaseUrl,
} from "@/lib/supabase/health";

describe("supabase health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("detects local supabase URLs", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseUrl("https://example.supabase.co")).toBe(false);
  });

  it("reports unreachable local supabase when health fetch fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      }),
    );

    const health = await getSupabaseHealth();

    expect(health).toEqual({
      reachable: false,
      local: true,
      message: "Local Supabase is not running on port 54321.",
    });
    expect(formatSupabaseOfflineHelp(health)).toContain("/library");
  });

  it("sends the publishable key when checking hosted supabase health", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://example.supabase.co",
    );
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "hosted-anon-key");
    const fetchMock = vi.fn(async () => ({
      ok: true,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const health = await getSupabaseHealth();

    expect(health).toEqual({
      reachable: true,
      local: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/health",
      expect.objectContaining({
        headers: {
          apikey: "hosted-anon-key",
        },
      }),
    );
  });
});