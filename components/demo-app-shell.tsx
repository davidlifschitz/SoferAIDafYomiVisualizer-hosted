import type { ReactNode } from "react";
import Link from "next/link";

import {
  SHABBAT_2_DEMO_ANALYSIS_ID,
  SHABBAT_3_DEMO_ANALYSIS_ID,
} from "@/lib/fixtures/demo-analyses";

type DemoAppShellProps = {
  children: ReactNode;
  activePath?: string;
};

const NAV_ITEMS = [
  { href: "/library", label: "Library" },
  { href: `/analyses/${SHABBAT_2_DEMO_ANALYSIS_ID}`, label: "Shabbat 2 demo" },
  { href: `/analyses/${SHABBAT_3_DEMO_ANALYSIS_ID}`, label: "Shabbat 3 demo" },
];

export function DemoAppShell({ children, activePath = "/library" }: DemoAppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-start">
          <div className="brand-mark" aria-hidden="true">
            DS
          </div>
          <Link className="brand-name" href="/library">
            Daf Shiur Visualizer
          </Link>
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
          <span className="user-label">Fixture demo mode</span>
          <Link className="button-ghost" href="/login">
            Sign in
          </Link>
        </div>
      </header>

      <main className="dashboard">{children}</main>
    </div>
  );
}