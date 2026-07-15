import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { VocabularyStudySession } from "@/components/vocabulary-study-session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireViewer } from "@/lib/supabase/viewer";
import {
  parseStudyItemIds,
  restoreSelectionOrder,
} from "@/lib/vocabulary/study-session";
import type { VocabularyItem } from "@/lib/vocabulary/types";

export const dynamic = "force-dynamic";

export default async function VocabularyStudyPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const requestedIds = parseStudyItemIds((await searchParams).id);
  const { supabase, user } = await requireViewer();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,current_cefr")
    .maybeSingle();

  let items: VocabularyItem[] = [];
  let loadError = "";
  if (requestedIds.length > 0) {
    const { data, error } = await supabase
      .from("vocabulary_items")
      .select(
        "id,user_id,english_word,translation,source,current_group,repetition_stage,learned_at,last_reviewed_at,next_review_date,created_at,updated_at",
      )
      .eq("user_id", user.id)
      .in("id", requestedIds)
      .in("current_group", ["unknown", "learning"])
      .eq("repetition_stage", 0)
      .is("next_review_date", null);

    if (error) {
      loadError = "Your selected words could not be loaded.";
    } else {
      items = restoreSelectionOrder(requestedIds, (data as VocabularyItem[] | null) ?? []);
    }
  }

  const displayName =
    profile?.display_name?.trim() || user.email?.split("@")[0] || "Learner";

  return (
    <AppShell
      email={user.email ?? "Signed in"}
      displayName={displayName}
      cefr={profile?.current_cefr ?? "A1"}
    >
      <VocabularyStudySession initialQueue={items} loadError={loadError} />
    </AppShell>
  );
}
