import { createBrowserClient } from "@supabase/ssr";

function readMetaContent(name: string): string | null {
  return document
    .querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
    ?.content.trim() || null;
}

export function createClient() {
  if (typeof document === "undefined") {
    throw new Error("The browser Supabase client is unavailable during server rendering.");
  }

  const url = readMetaContent("daily-english-supabase-url");
  const publishableKey = readMetaContent(
    "daily-english-supabase-publishable-key",
  );

  if (!url || !publishableKey) {
    throw new Error("Supabase browser configuration is unavailable.");
  }

  return createBrowserClient(url, publishableKey);
}
