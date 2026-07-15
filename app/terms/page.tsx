import type { Metadata } from "next";
import { PublicLegalPage } from "@/components/public-chrome";
import { getRequestOrigin } from "@/lib/request-origin";
import { siteUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();
  return {
    title: "Terms",
    description: "Technical launch terms for using Daily English.",
    alternates: { canonical: siteUrl(origin, "/terms") },
    robots: { index: true, follow: true },
  };
}

export default function TermsPage() {
  return (
    <PublicLegalPage
      eyebrow="Launch notice"
      title="Terms"
      intro="These plain-language terms describe the current educational service during its technical launch."
    >
      <section>
        <h2>Educational purpose</h2>
        <p>
          Daily English is a practice tool for vocabulary, repetition, writing, and
          learning progress. It does not provide an official language qualification or
          guarantee a particular learning outcome.
        </p>
      </section>
      <section>
        <h2>Your account</h2>
        <p>
          You are responsible for using accurate sign-in information, keeping account
          access secure, and telling the operator through the future contact channel if
          you believe someone else has accessed your account.
        </p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <p>
          Do not use the service to disrupt the application, attempt unauthorized access,
          upload unlawful material, or interfere with other users and systems.
        </p>
      </section>
      <section>
        <h2>Availability</h2>
        <p>
          The service may occasionally be unavailable for maintenance, updates, or
          technical reasons. No uptime or service-level commitment is offered during this
          launch.
        </p>
      </section>
      <section>
        <h2>Product changes</h2>
        <p>
          Features, limits, and these terms may evolve as Daily English develops. Material
          changes should be reflected on this page before a commercial launch.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Contact details will be published before commercial launch.</p>
      </section>
    </PublicLegalPage>
  );
}
