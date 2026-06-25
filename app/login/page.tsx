import Link from "next/link";

import { LoginForm } from "@/components/login-form";
import { sanitizeNextPath } from "@/lib/auth/redirect";
import {
  formatSupabaseOfflineHelp,
  getSupabaseHealth,
} from "@/lib/supabase/health";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next, "/");
  const errorMessage = params.error;

  const supabaseHealth = await getSupabaseHealth();

  return (
    <div className="login-page">
      {!supabaseHealth.reachable ? (
        <div className="login-offline-banner" role="status">
          <p>{formatSupabaseOfflineHelp(supabaseHealth)}</p>
          <p>
            <Link href="/library">Open fixture demos without signing in</Link>
          </p>
        </div>
      ) : null}
      <LoginForm
        nextPath={nextPath}
        errorMessage={errorMessage}
        supabaseOffline={!supabaseHealth.reachable}
      />
    </div>
  );
}