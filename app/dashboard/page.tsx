import { AppShell } from "@/components/app-shell";
import { Dashboard } from "@/components/dashboard";
import { SetupNotice } from "@/components/setup-notice";
import { calendarDateInTimeZone } from "@/lib/learning/calendar";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireViewer } from "@/lib/supabase/viewer";
import type { DailySession } from "@/lib/vocabulary/types";

export const dynamic = "force-dynamic";

const emptySession: DailySession = {
  vocabulary_status: "not_started",
  speaking_status: "not_started",
  writing_status: "not_started",
  review_status: "not_started",
};

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const { supabase, user } = await requireViewer();
  const [{ data: profile }, { data: settings }, { count: vocabularyCount }, dueResult] =
    await Promise.all([
      supabase.from("profiles").select("display_name,current_cefr").maybeSingle(),
      supabase.from("user_settings").select("timezone").maybeSingle(),
      supabase.from("vocabulary_items").select("id", { count: "exact", head: true }),
      supabase.rpc("get_due_vocabulary"),
    ]);

  const timeZone = settings?.timezone ?? "UTC";
  const today = calendarDateInTimeZone(new Date(), timeZone);
  const { data: session } = await supabase
    .from("daily_sessions")
    .select("vocabulary_status,speaking_status,writing_status,review_status")
    .eq("session_date", today)
    .maybeSingle();

  const displayName =
    profile?.display_name?.trim() || user.email?.split("@")[0] || "Learner";

  return (
    <AppShell email={user.email ?? "Signed in"} displayName={displayName} cefr={profile?.current_cefr ?? "A1"}>
      <Dashboard
        displayName={displayName}
        cefr={profile?.current_cefr ?? "A1"}
        dueCount={dueResult.data?.length ?? 0}
        vocabularyCount={vocabularyCount ?? 0}
        initialSession={(session as DailySession | null) ?? emptySession}
        today={today}
      />
    </AppShell>
  );
}
