import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { WritingWorkspace } from "@/components/writing-workspace";
import { calendarDateInTimeZone } from "@/lib/learning/calendar";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireViewer } from "@/lib/supabase/viewer";
import type { WritingEntry, WritingFeedback } from "@/lib/writing/types";

export const dynamic = "force-dynamic";

export default async function WritingPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const { supabase, user } = await requireViewer();
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name,current_cefr")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_settings")
      .select("timezone")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  const today = calendarDateInTimeZone(new Date(), settings?.timezone ?? "UTC");
  const { data: entry, error: entryError } = await supabase
    .from("writing_entries")
    .select("id,user_id,submission_id,entry_date,original_text,word_count,feedback_status,active_seconds,failure_code,created_at,updated_at")
    .eq("user_id", user.id)
    .eq("entry_date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: feedback, error: feedbackError } = entry
    ? await supabase
      .from("writing_feedback")
      .select("id,user_id,writing_entry_id,corrected_text,mistakes,estimated_cefr,cefr_rationale,schema_version,prompt_version,provider,model,created_at")
      .eq("user_id", user.id)
      .eq("writing_entry_id", entry.id)
      .maybeSingle()
    : { data: null, error: null };
  const displayName =
    profile?.display_name?.trim() || user.email?.split("@")[0] || "Learner";

  return (
    <AppShell
      email={user.email ?? "Signed in"}
      displayName={displayName}
      cefr={profile?.current_cefr ?? "A1"}
    >
      <WritingWorkspace
        initialState={{
          entry: (entry as WritingEntry | null) ?? null,
          feedback: (feedback as WritingFeedback | null) ?? null,
        }}
        loadError={entryError || feedbackError ? "Your Writing entry could not be loaded." : ""}
      />
    </AppShell>
  );
}
