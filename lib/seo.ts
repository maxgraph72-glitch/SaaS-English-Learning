import type { Metadata } from "next";

export const publicSiteName = "Daily English";
export const publicSiteTitle =
  "Daily English — daily practice, vocabulary and spaced repetition";
export const publicSiteDescription =
  "Build a steady English habit with short daily practice, personal vocabulary, flashcards, spaced repetition, and measurable progress.";

export const privatePageMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export function siteUrl(origin: string, pathname = "/"): string {
  return new URL(pathname, `${origin}/`).toString();
}

export function createRobotsText(origin: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Allow: /privacy",
    "Allow: /terms",
    "Disallow: /dashboard",
    "Disallow: /vocabulary",
    "Disallow: /review",
    "Disallow: /writing",
    "Disallow: /settings",
    "Disallow: /login",
    "Disallow: /auth/",
    "",
    `Sitemap: ${siteUrl(origin, "/sitemap.xml")}`,
    `Host: ${new URL(origin).host}`,
    "",
  ].join("\n");
}

export function createSitemapXml(origin: string): string {
  const urls = ["/", "/privacy", "/terms"]
    .map((pathname) => `  <url><loc>${siteUrl(origin, pathname)}</loc></url>`)
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");
}
