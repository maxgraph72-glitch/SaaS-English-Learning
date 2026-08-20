import { AppShell } from "@/components/app-shell";
import { PracticeSession } from "@/components/practice-session";
import { SetupNotice } from "@/components/setup-notice";
import type { PracticeExercise } from "@/lib/practice/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireViewer } from "@/lib/supabase/viewer";

export const dynamic = "force-dynamic";

export default async function PracticePage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const { supabase, user } = await requireViewer();
  const [{ data: profile }, { data: exerciseData, error }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name,current_cefr")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.rpc("get_practice_session", { p_limit: 10 }),
  ]);
  const displayName = profile?.display_name?.trim() || user.email?.split("@")[0] || "Learner";
  const exercises = error ? [] : ((exerciseData as PracticeExercise[] | null) ?? []);

  return (
    <AppShell
      email={user.email ?? "Signed in"}
      displayName={displayName}
      cefr={profile?.current_cefr ?? "A1"}
    >
      <PracticeSession
        exercises={exercises}
        loadError={error ? "Your practice session could not be loaded." : ""}
      />
    </AppShell>
  );
}
