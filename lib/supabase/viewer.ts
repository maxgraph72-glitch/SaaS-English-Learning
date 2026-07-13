import { redirect } from "next/navigation";
import { createClient } from "./server";

export async function requireViewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return { supabase, user };
}
