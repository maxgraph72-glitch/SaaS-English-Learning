import type { Metadata } from "next";
import { getRequestOrigin } from "@/lib/request-origin";
import { publicSiteDescription, publicSiteName, publicSiteTitle } from "@/lib/seo";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = new URL(await getRequestOrigin());

  return {
    metadataBase,
    title: {
      default: publicSiteTitle,
      template: `%s | ${publicSiteName}`,
    },
    description: publicSiteDescription,
    openGraph: {
      title: publicSiteTitle,
      description: publicSiteDescription,
      type: "website",
      siteName: publicSiteName,
      images: [{ url: "/og.png", width: 1792, height: 1024, alt: publicSiteTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: publicSiteTitle,
      description: publicSiteDescription,
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabaseConfig = isSupabaseConfigured() ? getSupabaseConfig() : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {supabaseConfig ? (
          <>
            <meta name="daily-english-supabase-url" content={supabaseConfig.url} />
            <meta
              name="daily-english-supabase-publishable-key"
              content={supabaseConfig.publishableKey}
            />
          </>
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
