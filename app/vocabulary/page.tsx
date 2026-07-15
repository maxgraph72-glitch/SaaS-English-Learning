import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { VocabularyWorkspace } from "@/components/vocabulary-workspace";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireViewer } from "@/lib/supabase/viewer";
import type { VocabularyItem } from "@/lib/vocabulary/types";

export const dynamic = "force-dynamic";

export default async function VocabularyPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const { supabase, user } = await requireViewer();
  const [{ data: profile }, { data: items, error }] = await Promise.all([
    supabase.from("profiles").select("display_name,current_cefr").maybeSingle(),
    supabase
      .from("vocabulary_items")
      .select("id,user_id,english_word,translation,source,current_group,repetition_stage,learned_at,last_reviewed_at,next_review_date,created_at,updated_at")
      .order("created_at", { ascending: false }),
  ]);
  const displayName = profile?.display_name?.trim() || user.email?.split("@")[0] || "Learner";

  return (
    <AppShell email={user.email ?? "Signed in"} displayName={displayName} cefr={profile?.current_cefr ?? "A1"}>
      <VocabularyWorkspace initialItems={(items as VocabularyItem[] | null) ?? []} loadError={error ? "Vocabulary could not be loaded." : ""} />
    </AppShell>
  );
}
