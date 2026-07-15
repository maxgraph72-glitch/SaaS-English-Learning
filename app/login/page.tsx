import { redirect } from "next/navigation";
import { SetupNotice } from "@/components/setup-notice";
import { safeLocalPath } from "@/lib/auth/redirect";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const params = await searchParams;
  const nextPath = safeLocalPath(params.next);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(nextPath);

  return (
    <main className="login-page">
      <div className="login-aside" aria-hidden="true">
        <p>10 min</p>
        <strong>Learn a few words.</strong>
        <p>Review them exactly when they are due.</p>
      </div>
      <LoginForm initialError={params.error} nextPath={nextPath} />
    </main>
  );
}
