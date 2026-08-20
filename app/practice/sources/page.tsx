import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { practiceSourceAcknowledgements } from "@/lib/practice/sources";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireViewer } from "@/lib/supabase/viewer";

export const dynamic = "force-dynamic";

export default async function PracticeSourcesPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const { supabase, user } = await requireViewer();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,current_cefr")
    .eq("user_id", user.id)
    .maybeSingle();
  const displayName = profile?.display_name?.trim() || user.email?.split("@")[0] || "Learner";

  return (
    <AppShell email={user.email ?? "Signed in"} displayName={displayName} cefr={profile?.current_cefr ?? "A1"}>
      <div className="page-container">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Practice provenance</p>
            <h1>Sources and licenses</h1>
            <p>Every published exercise retains its source item, release, checksum, license, and transformation history.</p>
          </div>
        </section>
        <section className="input-grid" aria-label="Eligible practice sources">
          {practiceSourceAcknowledgements.map((source) => (
            <article className="panel-card" key={source.name}>
              <div className="panel-heading">
                <div><p className="eyebrow">{source.license}</p><h2>{source.name}</h2></div>
                <span className="panel-step" aria-hidden="true">CC0</span>
              </div>
              <p className="panel-description">{source.description}</p>
              <div className="saved-writing-actions">
                <a className="secondary-button" href={source.homepageUrl} target="_blank" rel="noreferrer">Source</a>
                <a className="secondary-button" href={source.licenseUrl} target="_blank" rel="noreferrer">License</a>
                <a className="secondary-button" href={source.termsUrl} target="_blank" rel="noreferrer">Terms</a>
              </div>
            </article>
          ))}
        </section>
        <div className="completion-actions"><Link className="primary-button compact" href="/practice">Back to practice</Link></div>
      </div>
    </AppShell>
  );
}
