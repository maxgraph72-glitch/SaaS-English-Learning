import Link from "next/link";
import type { ReactNode } from "react";

export function PublicHeader() {
  return (
    <header className="public-header">
      <Link className="public-brand" href="/" aria-label="Daily English home">
        <span className="public-brand-mark" aria-hidden="true">D</span>
        <span>
          <strong>Daily</strong>
          <small>English practice</small>
        </span>
      </Link>
      <nav className="public-header-actions" aria-label="Account navigation">
        <Link className="public-text-link" href="/login">Sign in</Link>
        <Link className="public-primary-link" href="/login">Start learning</Link>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <p>Short practice. Steady progress.</p>
      <nav aria-label="Legal and account links">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/login">Sign in</Link>
      </nav>
    </footer>
  );
}

export function PublicLegalPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="public-site public-legal-site">
      <div className="public-frame">
        <PublicHeader />
        <article className="public-legal-card">
          <p className="public-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="public-legal-intro">{intro}</p>
          <div className="public-legal-content">{children}</div>
        </article>
        <PublicFooter />
      </div>
    </main>
  );
}
