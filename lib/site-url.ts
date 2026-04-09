/**
 * Ensures site base URLs used for OAuth redirectTo and server redirects are absolute.
 * If NEXT_PUBLIC_SITE_URL is "example.com" (no scheme), Supabase resolves it as a path on
 * the project host (e.g. https://xxx.supabase.co/example.com?code=...).
 */
export function normalizeSiteOrigin(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  let noTrailing = s.replace(/\/+$/, "");
  if (noTrailing.startsWith("//")) {
    noTrailing = `https:${noTrailing}`;
  }
  if (/^https:\/\//i.test(noTrailing)) return noTrailing;
  if (/^http:\/\//i.test(noTrailing)) return noTrailing;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(noTrailing)) {
    return `http://${noTrailing}`;
  }
  return `https://${noTrailing}`;
}

/**
 * OAuth/email auth redirects must use an absolute https URL on your app host.
 * Prefer the browser's current origin so a wrong NEXT_PUBLIC_SITE_URL on Vercel cannot
 * send users to the Supabase project URL with your hostname as a path segment (?code=...).
 */
export function getOAuthSiteOrigin(): string {
  if (typeof window !== "undefined") {
    const o = window.location?.origin;
    if (o && /^https?:\/\//i.test(o)) return o;
  }
  return (
    normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    "https://6degree.noemtech.com"
  );
}

/** Absolute /auth/callback URL with ?next= for Supabase redirectTo / emailRedirectTo. */
export function buildAuthCallbackUrl(nextPath: string): string {
  const url = new URL("/auth/callback", getOAuthSiteOrigin());
  url.searchParams.set("next", nextPath);
  return url.href;
}
