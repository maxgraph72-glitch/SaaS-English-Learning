import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { SpeakingWorkspace } from "@/components/speaking-workspace";
import { calendarDateInTimeZone } from "@/lib/learning/calendar";
import { selectDailySpeakingPrompt } from "@/lib/speaking/prompts";
import type { SpeakingAttempt, SpeakingPrompt } from "@/lib/speaking/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireViewer } from "@/lib/supabase/viewer";

export const dynamic = "force-dynamic";

const attemptSelect = "id,submission_id,user_id,prompt_id,attempt_date,audio_path,audio_format,audio_bytes,duration_seconds,analysis_status,transcript,score,strengths,improvements,metrics,failure_code,provider,model,created_at,updated_at";

export default async function SpeakingPage() {
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
  const selected = selectDailySpeakingPrompt(today, user.id);
  const { data: promptData, error: promptError } = await supabase.rpc(
    "get_or_create_daily_speaking_prompt",
    { p_reference_text: selected.text, p_cefr: selected.cefr },
  );
  const prompt = (promptData as SpeakingPrompt | null) ?? null;

  const { data: attemptData, error: attemptError } = prompt
    ? await supabase
      .from("speaking_attempts")
      .select(attemptSelect)
      .eq("user_id", user.id)
      .eq("prompt_id", prompt.id)
      .order("created_at", { ascending: false })
      .limit(1)
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
      <SpeakingWorkspace
        prompt={prompt}
        initialAttempt={(attemptData as SpeakingAttempt | null) ?? null}
        loadError={promptError || attemptError ? "Today’s Speaking practice could not be loaded." : ""}
      />
    </AppShell>
  );
}
