import type { Metadata } from "next";
import { PublicLegalPage } from "@/components/public-chrome";
import { getRequestOrigin } from "@/lib/request-origin";
import { siteUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();
  return {
    title: "Privacy",
    description: "How Daily English handles account and learning data.",
    alternates: { canonical: siteUrl(origin, "/privacy") },
    robots: { index: true, follow: true },
  };
}

export default function PrivacyPage() {
  return (
    <PublicLegalPage
      eyebrow="Launch notice"
      title="Privacy"
      intro="This notice explains the data flows currently used by Daily English. It is written for this technical launch and will evolve with the product."
    >
      <section>
        <h2>Account and authentication</h2>
        <p>
          Supabase handles account authentication and stores the email address connected
          to an account. If you choose Google sign-in, Google and Supabase process the
          information needed to complete that sign-in.
        </p>
      </section>
      <section>
        <h2>Learning data</h2>
        <p>
          Daily English stores account-owned vocabulary, review attempts and timing,
          learning-session status, settings, progress information, writing entries, and
          generated writing feedback so the application can provide its learning features.
        </p>
      </section>
      <section>
        <h2>Writing feedback</h2>
        <p>
          When you actively request a writing check, the submitted entry is sent to the
          configured Yandex AI Studio model for correction. The application saves the
          original entry before requesting feedback and stores the returned feedback with
          your account.
        </p>
      </section>
      <section>
        <h2>Advertising and data sales</h2>
        <p>
          This launch does not add advertising, analytics, tracking pixels, or telemetry.
          Daily English does not sell personal data.
        </p>
      </section>
      <section>
        <h2>Contact and deletion requests</h2>
        <p>
          Contact details will be published before commercial launch. Once a contact
          channel is available, users may use it to request account and data deletion.
        </p>
      </section>
    </PublicLegalPage>
  );
}
