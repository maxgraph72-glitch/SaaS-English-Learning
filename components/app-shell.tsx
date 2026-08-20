"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { updateTimezoneAction } from "@/app/actions/vocabulary";
import { createClient } from "@/lib/supabase/client";

const navigation = [
  { symbol: "⌂", label: "Today", href: "/dashboard" },
  { symbol: "◇", label: "Vocabulary", href: "/vocabulary" },
  { symbol: "◌", label: "Review", href: "/review" },
  { symbol: "✦", label: "Practice", href: "/practice" },
  { symbol: "↗", label: "Progress", href: null },
  { symbol: "⚙", label: "Settings", href: "/settings" },
] as const;

const availableThemes = new Set([
  "sunset",
  "twilight",
  "autumn",
  "peach-horizon",
  "amaranth-noir",
  "crimson-black",
  "signal-orange",
  "branding-orange",
  "web-slinger",
]);
const defaultTheme = "twilight";

const levelNames: Record<string, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper intermediate",
  C1: "Advanced",
  C2: "Proficient",
};

function isNavigationActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  email,
  displayName,
  cefr = "A1",
}: {
  children: ReactNode;
  email: string;
  displayName: string;
  cefr?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedTheme = window.localStorage.getItem("daily-english-theme");
      const theme = storedTheme && availableThemes.has(storedTheme)
        ? storedTheme
        : defaultTheme;
      document.documentElement.dataset.theme = theme;
      window.localStorage.setItem("daily-english-theme", theme);
    });

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone) void updateTimezoneAction(timeZone);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <Link className="brand" href="/dashboard" aria-label="Daily English today dashboard">
          <span className="brand-mark">D</span>
          <span>
            <strong>Daily</strong>
            <small>English practice</small>
          </span>
        </Link>

        <nav className="sidebar-nav">
          {navigation.map((item) =>
            item.href ? (
              <Link
                className={isNavigationActive(pathname, item.href) ? "nav-item active" : "nav-item"}
                href={item.href}
                key={item.label}
              >
                <span className="nav-symbol" aria-hidden="true">{item.symbol}</span>
                {item.label}
              </Link>
            ) : (
              <span className="nav-item nav-disabled" key={item.label} aria-disabled="true">
                <span className="nav-symbol" aria-hidden="true">{item.symbol}</span>
                {item.label}
              </span>
            ),
          )}
        </nav>

        <div className="sidebar-foot">
          <div className="level-chip">
            <span>{cefr}</span>
            <div>
              <strong>{levelNames[cefr] ?? "Learner"}</strong>
              <small>Your current estimate</small>
            </div>
          </div>
          <div className="level-track" aria-hidden="true"><span /></div>
          <p>Small steps become fluent habits.</p>
        </div>
      </aside>

      <section className="workspace" id="top">
        <header className="topbar">
          <Link className="mobile-brand" href="/dashboard" aria-label="Daily English today dashboard">
            <span className="brand-mark">D</span>
            <strong>Daily</strong>
          </Link>
          <div className="topbar-actions">
            <Link
              className="theme-toggle"
              href="/settings"
              aria-label="Choose color theme"
              title="Color theme"
            >
              <span aria-hidden="true">◐</span>
            </Link>
            <button className="profile-button" type="button" onClick={signOut} aria-label="Sign out" title={email}>
              <span className="avatar">{initials || "DE"}</span>
              <span className="profile-copy">
                <strong>{displayName}</strong>
                <small>Sign out</small>
              </span>
              <span aria-hidden="true">⌄</span>
            </button>
          </div>
        </header>
        {children}
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.slice(0, 4).map((item) =>
          item.href ? (
            <Link className={isNavigationActive(pathname, item.href) ? "active" : ""} href={item.href} key={item.label}>
              <span aria-hidden="true">{item.symbol}</span>
              <small>{item.label}</small>
            </Link>
          ) : (
            <span className="mobile-nav-disabled" key={item.label} aria-disabled="true">
              <span aria-hidden="true">{item.symbol}</span>
              <small>{item.label}</small>
            </span>
          ),
        )}
      </nav>
    </main>
  );
}
