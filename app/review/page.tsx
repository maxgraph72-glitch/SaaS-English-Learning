import { AppShell } from "@/components/app-shell";
import { ReviewSession } from "@/components/review-session";
import { SetupNotice } from "@/components/setup-notice";
import { calendarDateInTimeZone } from "@/lib/learning/calendar";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireViewer } from "@/lib/supabase/viewer";
import { selectLearnedTodayPracticeItems } from "@/lib/vocabulary/review-practice";
import {
  parseStudyItemIds,
  restoreSelectionOrder,
} from "@/lib/vocabulary/study-session";
import type { VocabularyItem } from "@/lib/vocabulary/types";

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
  const recentLearningCutoff = new Date(
    requestTime.getTime() - 48 * 60 * 60 * 1000,
  ).toISOString();
  const [
    { data: profile },
    { data: settings },
    { data: dueItems, error: dueError },
    { data: recentlyLearnedItems, error: practiceError },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name,current_cefr").maybeSingle(),
    supabase.from("user_settings").select("timezone").maybeSingle(),
    supabase.rpc("get_due_vocabulary"),
    supabase
      .from("vocabulary_items")
      .select(
        "id,user_id,english_word,translation,source,current_group,repetition_stage,learned_at,last_reviewed_at,next_review_date,created_at,updated_at",
      )
      .eq("user_id", user.id)
      .gte("learned_at", recentLearningCutoff)
      .order("learned_at", { ascending: true }),
  ]);
  const displayName =
    profile?.display_name?.trim() || user.email?.split("@")[0] || "Learner";
  const timeZone = settings?.timezone ?? "UTC";
  const today = calendarDateInTimeZone(requestTime, timeZone);
  const allScheduledItems = (dueItems as VocabularyItem[] | null) ?? [];
  const scheduledQueue =
    requestedIds.length > 0
      ? restoreSelectionOrder(requestedIds, allScheduledItems)
      : allScheduledItems;
  const learnedTodayQueue = selectLearnedTodayPracticeItems(
    (recentlyLearnedItems as VocabularyItem[] | null) ?? [],
    today,
    timeZone,
    allScheduledItems.map((item) => item.id),
  );

  return (
    <AppShell
      email={user.email ?? "Signed in"}
      displayName={displayName}
      cefr={profile?.current_cefr ?? "A1"}
    >
      <ReviewSession
        initialQueue={scheduledQueue}
        learnedTodayQueue={learnedTodayQueue}
        loadError={dueError ? "Your review queue could not be loaded." : ""}
        practiceLoadError={
          practiceError ? "Words learned today could not be loaded." : ""
        }
      />
    </AppShell>
  );
}
