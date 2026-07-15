const publicPaths = new Set([
  "/",
  "/login",
  "/privacy",
  "/terms",
  "/robots.txt",
  "/sitemap.xml",
]);

export function isPublicPath(pathname: string): boolean {
  return publicPaths.has(pathname) || pathname.startsWith("/auth/");
}
