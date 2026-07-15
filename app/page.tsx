import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { getRequestOrigin } from "@/lib/request-origin";
import {
  publicSiteDescription,
  publicSiteName,
  publicSiteTitle,
  siteUrl,
} from "@/lib/seo";

const learningLoop = [
  {
    number: "01",
    title: "Choose useful words",
    detail: "Add them one by one or import a CSV list.",
    tone: "mint",
  },
  {
    number: "02",
    title: "Learn with flashcards",
    detail: "Reveal translations and keep difficult words in the session.",
    tone: "peach",
  },
  {
    number: "03",
    title: "Review at the right time",
    detail: "A spaced schedule brings due words back automatically.",
    tone: "sky",
  },
] as const;

const features = [
  {
    label: "Your vocabulary",
    title: "Build a list that belongs to you.",
    copy: "Add words manually, bring in a CSV file, search your collection, and manage each item from one calm workspace.",
  },
  {
    label: "Focused flashcards",
    title: "Recall first. Reveal second.",
    copy: "Study selected words one card at a time, repeat the ones that need another look, and schedule the words you have learned.",
  },
  {
    label: "Spaced repetition",
    title: "Review what is due, not everything.",
    copy: "Review timing adapts to your answer and response time so today’s queue stays useful and manageable.",
  },
  {
    label: "Visible progress",
    title: "See the work you completed today.",
    copy: "Daily session states, vocabulary totals, review queues, and a CEFR estimate keep your routine measurable.",
  },
  {
    label: "Private account",
    title: "Keep learning data tied to your sign-in.",
    copy: "Email/password and optional Google sign-in protect your vocabulary, review history, settings, and learning records.",
  },
  {
    label: "Comfortable themes",
    title: "Choose a palette that suits your focus.",
    copy: "Theme settings apply across the learning workspace and stay on your device for the next visit.",
  },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();
  const canonical = siteUrl(origin);

  return {
    title: { absolute: publicSiteTitle },
    description: publicSiteDescription,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: publicSiteTitle,
      description: publicSiteDescription,
      type: "website",
      url: canonical,
      siteName: publicSiteName,
      images: [{ url: siteUrl(origin, "/og.png"), width: 1792, height: 1024, alt: publicSiteTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: publicSiteTitle,
      description: publicSiteDescription,
      images: [siteUrl(origin, "/og.png")],
    },
  };
}

export default async function PublicHomePage() {
  const origin = await getRequestOrigin();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: publicSiteName,
    url: siteUrl(origin),
    description: publicSiteDescription,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web browser",
    browserRequirements: "Requires a modern web browser",
  };

  return (
    <main className="public-site">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</gu, "\\u003c"),
        }}
      />
      <div className="public-frame">
        <PublicHeader />

        <section className="public-hero" aria-labelledby="public-hero-heading">
          <div className="public-hero-copy">
            <p className="public-eyebrow">A steady English habit</p>
            <h1 id="public-hero-heading">
              Practice a little.
              <span>Remember much more.</span>
            </h1>
            <p className="public-hero-intro">
              Daily English turns your own vocabulary into short flashcard sessions,
              well-timed reviews, and progress you can see — without making practice
              feel like another full-time task.
            </p>
            <div className="public-hero-actions">
              <Link className="public-primary-link public-large-link" href="/login">
                Start learning
              </Link>
              <a className="public-secondary-link" href="#how-it-works">
                See how it works
              </a>
            </div>
            <ul className="public-proof-list" aria-label="Product highlights">
              <li>Personal vocabulary</li>
              <li>Spaced review</li>
              <li>Daily progress</li>
            </ul>
          </div>

          <div className="public-loop-card" aria-label="The Daily English learning loop">
            <div className="public-loop-heading">
              <div>
                <p className="public-eyebrow">Today’s loop</p>
                <h2>Small steps, in order.</h2>
              </div>
              <span className="public-time-chip">25 min</span>
            </div>
            <ol className="public-loop-list">
              {learningLoop.map((step) => (
                <li key={step.number} className={`public-loop-step ${step.tone}`}>
                  <span>{step.number}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <small>{step.detail}</small>
                  </div>
                </li>
              ))}
            </ol>
            <div className="public-loop-progress" aria-hidden="true">
              <span />
            </div>
            <p className="public-loop-note">Return tomorrow. Your next review is already waiting.</p>
          </div>
        </section>

        <section className="public-how" id="how-it-works" aria-labelledby="how-heading">
          <div className="public-section-heading">
            <p className="public-eyebrow">How it works</p>
            <h2 id="how-heading">A routine clear enough to repeat.</h2>
            <p>There is always one useful next action, and no pressure to do everything at once.</p>
          </div>
          <ol className="public-how-grid">
            <li>
              <span>1</span>
              <h3>Bring your words</h3>
              <p>Add the English vocabulary you actually meet in work, reading, or conversation.</p>
            </li>
            <li>
              <span>2</span>
              <h3>Study in a short session</h3>
              <p>Use focused flashcards to learn a manageable selection without clutter.</p>
            </li>
            <li>
              <span>3</span>
              <h3>Follow the review queue</h3>
              <p>Come back to due words and let the schedule shape the next repetition.</p>
            </li>
          </ol>
        </section>

        <section className="public-features" aria-labelledby="features-heading">
          <div className="public-section-heading public-section-heading-wide">
            <div>
              <p className="public-eyebrow">Built for everyday practice</p>
              <h2 id="features-heading">Everything you need for a useful vocabulary loop.</h2>
            </div>
            <p>
              Simple tools stay close to the learning task: collect, study, review,
              and understand what you completed.
            </p>
          </div>
          <div className="public-feature-grid">
            {features.map((feature, index) => (
              <article key={feature.title}>
                <div className="public-feature-topline">
                  <span>{feature.label}</span>
                  <small>{String(index + 1).padStart(2, "0")}</small>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="public-final-cta" aria-labelledby="cta-heading">
          <div>
            <p className="public-eyebrow">Your next word can start here</p>
            <h2 id="cta-heading">Make today’s English practice count.</h2>
            <p>Start with a few useful words. Daily English will help you keep them moving.</p>
          </div>
          <Link className="public-primary-link public-large-link" href="/login">
            Start learning
          </Link>
        </section>

        <PublicFooter />
      </div>
    </main>
  );
}
