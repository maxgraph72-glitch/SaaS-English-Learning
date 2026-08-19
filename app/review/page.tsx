import { AppShell } from "@/components/app-shell";
import { ReviewSession } from "@/components/review-session";
import { SetupNotice } from "@/components/setup-notice";
import { calendarDateInTimeZone } from "@/lib/learning/calendar";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireViewer } from "@/lib/supabase/viewer";
import { selectLearnedTodayPracticeItems } from "@/lib/vocabulary/review-practice";
import { parseStudyItemIds, restoreSelectionOrder } from "@/lib/vocabulary/study-session";
import type { VocabularyItem } from "@/lib/vocabulary/types";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ practice?: string | string[] }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const practiceIds = parseStudyItemIds((await searchParams).practice);
  const selectedPractice = practiceIds.length > 0;
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
  const scheduledQueue = (dueItems as VocabularyItem[] | null) ?? [];
  const learnedTodayQueue = selectLearnedTodayPracticeItems(
    (recentlyLearnedItems as VocabularyItem[] | null) ?? [],
    today,
    timeZone,
    scheduledQueue.map((item) => item.id),
  );
  let selectedPracticeQueue: VocabularyItem[] = [];
  let selectedPracticeError = "";

  if (selectedPractice) {
    const { data, error } = await supabase
      .from("vocabulary_items")
      .select(
        "id,user_id,english_word,translation,source,current_group,repetition_stage,learned_at,last_reviewed_at,next_review_date,created_at,updated_at",
      )
      .eq("user_id", user.id)
      .in("id", practiceIds)
      .gt("repetition_stage", 0)
      .not("next_review_date", "is", null);

    if (error) {
      selectedPracticeError = "Your selected words could not be loaded.";
    } else {
      selectedPracticeQueue = restoreSelectionOrder(
        practiceIds,
        (data as VocabularyItem[] | null) ?? [],
      );
      if (selectedPracticeQueue.length === 0) {
        selectedPracticeError = "No selected learned words are available to practice.";
      }
    }
  }

  return (
    <AppShell
      email={user.email ?? "Signed in"}
      displayName={displayName}
      cefr={profile?.current_cefr ?? "A1"}
    >
      <ReviewSession
        initialQueue={selectedPractice ? [] : scheduledQueue}
        learnedTodayQueue={selectedPractice ? selectedPracticeQueue : learnedTodayQueue}
        loadError={
          selectedPractice
            ? selectedPracticeError
            : dueError
              ? "Your review queue could not be loaded."
              : ""
        }
        practiceLoadError={
          !selectedPractice && practiceError
            ? "Words learned today could not be loaded."
            : ""
        }
        initialMode={selectedPractice ? "practice" : undefined}
        practiceScope={selectedPractice ? "selected" : "today"}
      />
    </AppShell>
  );
}
