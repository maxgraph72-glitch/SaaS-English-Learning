import { AppShell } from "@/components/app-shell";
import { ReviewSession } from "@/components/review-session";
import { SetupNotice } from "@/components/setup-notice";
import { calendarDateInTimeZone } from "@/lib/learning/calendar";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireViewer } from "@/lib/supabase/viewer";
import {
  parseStudyItemIds,
  restoreSelectionOrder,
} from "@/lib/vocabulary/study-session";
import {
  VOCABULARY_ITEM_SELECT,
  type VocabularyItem,
} from "@/lib/vocabulary/types";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const requestedIds = parseStudyItemIds((await searchParams).id);
  const { supabase, user } = await requireViewer();
  const requestTime = new Date();
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("display_name,current_cefr").maybeSingle(),
    supabase.from("user_settings").select("timezone").maybeSingle(),
  ]);
  const displayName =
    profile?.display_name?.trim() || user.email?.split("@")[0] || "Learner";
  const timeZone = settings?.timezone ?? "UTC";
  const today = calendarDateInTimeZone(requestTime, timeZone);
  const { data: dueItems, error: dueError } =
    await supabase.rpc("get_due_vocabulary");
  const { data: practiceItems, error: practiceError } = await supabase
    .from("vocabulary_items")
    .select(VOCABULARY_ITEM_SELECT)
    .eq("user_id", user.id)
    .eq("last_stage_advanced_date", today)
    .eq("requires_relearning", false)
    .not("next_review_date", "is", null)
    .order("last_attempt_at", { ascending: true });
  const allScheduledItems = (dueItems as VocabularyItem[] | null) ?? [];
  const scheduledQueue =
    requestedIds.length > 0
      ? restoreSelectionOrder(requestedIds, allScheduledItems)
      : allScheduledItems;
  const dueIds = new Set(allScheduledItems.map((item) => item.id));
  const practiceQueue = ((practiceItems as VocabularyItem[] | null) ?? []).filter(
    (item) => !dueIds.has(item.id),
  );

  return (
    <AppShell
      email={user.email ?? "Signed in"}
      displayName={displayName}
      cefr={profile?.current_cefr ?? "A1"}
    >
      <ReviewSession
        initialQueue={scheduledQueue}
        practiceQueue={practiceQueue}
        loadError={dueError ? "Your review queue could not be loaded." : ""}
        practiceLoadError={
          practiceError ? "Words learned today could not be loaded." : ""
        }
      />
    </AppShell>
  );
}
