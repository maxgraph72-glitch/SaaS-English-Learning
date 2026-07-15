import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { ThemeSettings } from "@/components/theme-settings";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireViewer } from "@/lib/supabase/viewer";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const { supabase, user } = await requireViewer();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,current_cefr")
    .maybeSingle();
  const displayName = profile?.display_name?.trim() || user.email?.split("@")[0] || "Learner";

  return (
    <AppShell
      email={user.email ?? "Signed in"}
      displayName={displayName}
      cefr={profile?.current_cefr ?? "A1"}
    >
      <ThemeSettings />
    </AppShell>
  );
}
