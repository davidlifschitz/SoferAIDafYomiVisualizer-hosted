import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";

import { signOut } from "@/app/login/actions";
import { getVerifiedClaims } from "@/lib/auth/session";

type AppShellProps = {
  children: ReactNode;
  activePath?: string;
};

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/library", label: "Library" },
  { href: "/billing", label: "Billing" },
  { href: "/settings", label: "Settings" },
];

export async function AppShell({ children, activePath = "/" }: AppShellProps) {
  const claims = await getVerifiedClaims();
  const email =
    typeof claims?.email === "string" ? claims.email : "Signed in";

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-start">
          <div className="brand-mark" aria-hidden="true">
            DS
          </div>
          <span className="brand-name">Daf Shiur Visualizer</span>
        </div>

        <nav className="app-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                activePath === item.href ? "nav-link nav-link-active" : "nav-link"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="app-header-end">
          <span className="user-label">{email}</span>
          <form action={signOut}>
            <button type="submit" className="button-ghost" aria-label="Sign out">
              <LogOut size={16} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </header>

      <main className="dashboard">{children}</main>
    </div>
  );
}