"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { buildAuthCallbackUrl, sanitizeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export type LoginActionState = {
  error?: string;
  success?: boolean;
};

async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();
  const headerOrigin = headerList.get("origin");
  if (headerOrigin) {
    return headerOrigin;
  }

  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export async function signInWithEmail(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const next = sanitizeNextPath(formData.get("next")?.toString());

  if (!email) {
    return { error: "Email is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: buildAuthCallbackUrl(next),
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function signInWithGoogle(formData: FormData) {
  const next = sanitizeNextPath(formData.get("next")?.toString());
  const supabase = await createClient();
  const origin = await getRequestOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.url) {
    redirect(data.url);
  }

  redirect("/login?error=oauth_start_failed");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}