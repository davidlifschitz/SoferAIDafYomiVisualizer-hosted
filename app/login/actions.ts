"use server";

import { redirect } from "next/navigation";

import { resolveRequestOrigin } from "@/lib/auth/origin";
import { buildAuthCallbackUrl, sanitizeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export type LoginActionState = {
  error?: string;
  success?: boolean;
};

export async function signInWithEmail(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const next = sanitizeNextPath(formData.get("next")?.toString());

  if (!email) {
    return { error: "Email is required." };
  }

  try {
    const origin = await resolveRequestOrigin();
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: buildAuthCallbackUrl(next, origin),
      },
    });

    if (error) {
      return { error: error.message };
    }

    return { success: true };
  } catch {
    return {
      error:
        "Could not reach Supabase. If you are developing locally, run `supabase start -x vector`. Fixture demos are available without sign-in at /library.",
    };
  }
}

export async function signInWithGoogle(formData: FormData) {
  const next = sanitizeNextPath(formData.get("next")?.toString());
  const supabase = await createClient();
  const origin = await resolveRequestOrigin();

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