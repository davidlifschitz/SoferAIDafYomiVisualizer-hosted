import { createServerClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";
import type { BrowserContext, Page } from "playwright/test";

import { appBaseUrl } from "./env";
import { createE2EAdminClient, createE2EAnonClient, createTestEmail } from "./supabase";

type StoredCookie = {
  name: string;
  value: string;
};

function authCookiePrefix(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }

  const hostname = new URL(supabaseUrl).hostname;
  const projectRef = hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

async function createSessionForEmail(email: string): Promise<Session> {
  const admin = createE2EAdminClient();
  const anon = createE2EAnonClient();

  const existing = await admin.auth.admin.listUsers();
  const found = existing.data.users.find((user) => user.email === email);
  if (!found) {
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createError) {
      throw createError;
    }
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${appBaseUrl()}/auth/callback?next=/`,
    },
  });

  if (linkError || !linkData.properties?.hashed_token) {
    throw linkError ?? new Error("Failed to generate auth link.");
  }

  const { data: verifyData, error: verifyError } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties.hashed_token,
  });

  if (verifyError || !verifyData.session) {
    throw verifyError ?? new Error("Failed to verify auth token.");
  }

  return verifyData.session;
}

async function materializeAuthCookies(session: Session): Promise<StoredCookie[]> {
  const jar = new Map<string, string>();

  const { url, publishable } = (() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!supabaseUrl || !publishableKey) {
      throw new Error("Supabase environment variables are required.");
    }
    return { url: supabaseUrl, publishable: publishableKey };
  })();

  const client = createServerClient(url, publishable, {
    cookies: {
      getAll() {
        return [...jar.entries()].map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          jar.set(cookie.name, cookie.value);
        }
      },
    },
  });

  const { error } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  if (error) {
    throw error;
  }

  const prefix = authCookiePrefix();
  return [...jar.entries()]
    .filter(([name]) => name === prefix || name.startsWith(`${prefix}.`))
    .map(([name, value]) => ({ name, value }));
}

export async function establishAuthenticatedSession(
  context: BrowserContext,
  email = createTestEmail("session"),
): Promise<string> {
  const session = await createSessionForEmail(email);
  const cookies = await materializeAuthCookies(session);
  const base = new URL(appBaseUrl());

  await context.addCookies(
    cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: base.hostname,
      path: "/",
      httpOnly: false,
      sameSite: "Lax" as const,
    })),
  );

  return email;
}

export async function signInTestUser(page: Page, email?: string): Promise<string> {
  const resolvedEmail = email ?? createTestEmail("session");
  await establishAuthenticatedSession(page.context(), resolvedEmail);
  await page.goto("/");
  return resolvedEmail;
}