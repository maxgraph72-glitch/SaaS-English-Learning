import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { safeLocalPath } from "../lib/auth/redirect";
import { isPublicPath } from "../lib/routes";
import { createRobotsText, createSitemapXml } from "../lib/seo";

const projectRoot = resolve(import.meta.dirname, "..");

function source(pathname: string): string {
  return readFileSync(resolve(projectRoot, pathname), "utf8");
}

describe("public launch routing", () => {
  it("keeps public routes open and private application routes protected", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/terms")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/vocabulary/study")).toBe(false);
  });

  it("uses dashboard as the safe authentication destination", () => {
    expect(safeLocalPath(null)).toBe("/dashboard");
    expect(safeLocalPath("/review?mode=due")).toBe("/review?mode=due");
    expect(safeLocalPath("https://example.com")).toBe("/dashboard");
    expect(safeLocalPath("//example.com/path")).toBe("/dashboard");
    expect(safeLocalPath("/\\example.com/path")).toBe("/dashboard");
  });

  it("moves the authenticated Today page without coupling the landing to Supabase", () => {
    const landing = source("app/page.tsx");
    const dashboard = source("app/dashboard/page.tsx");

    expect(landing).not.toContain("requireViewer");
    expect(landing).not.toContain("isSupabaseConfigured");
    expect(dashboard).toContain("requireViewer()");
    expect(dashboard).toContain("<Dashboard");
  });

  it("migrates authenticated Today navigation to dashboard", () => {
    const paths = [
      "components/app-shell.tsx",
      "components/review-session.tsx",
      "components/vocabulary-study-session.tsx",
      "components/writing-workspace.tsx",
    ];
    const combined = paths.map(source).join("\n");

    expect(combined).not.toMatch(/href="\/">Back to today/u);
    expect(source("components/app-shell.tsx")).toContain(
      'label: "Today", href: "/dashboard"',
    );
  });
});

describe("public launch search controls", () => {
  const origin = "https://daily-english.example";

  it("allows indexable pages and disallows authenticated paths", () => {
    const robots = createRobotsText(origin);
    expect(robots).toContain("Allow: /privacy");
    expect(robots).toContain("Disallow: /dashboard");
    expect(robots).toContain("Disallow: /auth/");
    expect(robots).toContain(`Sitemap: ${origin}/sitemap.xml`);
  });

  it("publishes exactly the three canonical public URLs", () => {
    const sitemap = createSitemapXml(origin);
    const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/gu)].map(
      (match) => match[1],
    );
    expect(locations).toEqual([
      `${origin}/`,
      `${origin}/privacy`,
      `${origin}/terms`,
    ]);
  });

  it("applies private metadata to login and every authenticated route group", () => {
    for (const segment of [
      "login",
      "dashboard",
      "vocabulary",
      "review",
      "writing",
      "settings",
    ]) {
      expect(source(`app/${segment}/layout.tsx`)).toContain("privatePageMetadata");
    }
  });
});
