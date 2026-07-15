import { redirect } from "next/navigation";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { error } = await searchParams;
  return (
    <main className="login-page">
      <div className="login-aside" aria-hidden="true">
        <p>10 min</p>
        <strong>Learn a few words.</strong>
        <p>Review them exactly when they are due.</p>
      </div>
      <LoginForm initialError={error} />
    </main>
  );
}
