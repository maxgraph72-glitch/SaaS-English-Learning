import { AppShell } from "@/components/app-shell";
import { ReviewSession } from "@/components/review-session";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireViewer } from "@/lib/supabase/viewer";
import type { VocabularyItem } from "@/lib/vocabulary/types";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const { supabase, user } = await requireViewer();
  const [{ data: profile }, { data: dueItems, error }] = await Promise.all([
    supabase.from("profiles").select("display_name,current_cefr").maybeSingle(),
    supabase.rpc("get_due_vocabulary"),
  ]);
  const displayName = profile?.display_name?.trim() || user.email?.split("@")[0] || "Learner";

  return (
    <AppShell email={user.email ?? "Signed in"} displayName={displayName} cefr={profile?.current_cefr ?? "A1"}>
      <ReviewSession initialQueue={(dueItems as VocabularyItem[] | null) ?? []} loadError={error ? "Your review queue could not be loaded." : ""} />
    </AppShell>
  );
}
