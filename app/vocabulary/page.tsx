import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { VocabularyWorkspace } from "@/components/vocabulary-workspace";
import { calendarDateInTimeZone } from "@/lib/learning/calendar";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireViewer } from "@/lib/supabase/viewer";
import {
  VOCABULARY_ITEM_SELECT,
  type VocabularyItem,
} from "@/lib/vocabulary/types";

export const dynamic = "force-dynamic";

export default async function VocabularyPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const { supabase, user } = await requireViewer();
  const requestTime = new Date();
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("display_name,current_cefr").maybeSingle(),
    supabase.from("user_settings").select("timezone").maybeSingle(),
  ]);
  const { error: overdueError } = await supabase.rpc("get_due_vocabulary");
  const { data: items, error } = await supabase
    .from("vocabulary_items")
    .select(VOCABULARY_ITEM_SELECT)
    .order("created_at", { ascending: false });
  const displayName = profile?.display_name?.trim() || user.email?.split("@")[0] || "Learner";
  const today = calendarDateInTimeZone(requestTime, settings?.timezone ?? "UTC");

  return (
    <AppShell email={user.email ?? "Signed in"} displayName={displayName} cefr={profile?.current_cefr ?? "A1"}>
      <VocabularyWorkspace
        initialItems={(items as VocabularyItem[] | null) ?? []}
        loadError={
          error || overdueError
            ? "Vocabulary could not be loaded completely."
            : ""
        }
        today={today}
      />
    </AppShell>
  );
}
