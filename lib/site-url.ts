/**
 * Ensures site base URLs used for OAuth redirectTo and server redirects are absolute.
 * If NEXT_PUBLIC_SITE_URL is "example.com" (no scheme), Supabase resolves it as a path on
 * the project host (e.g. https://xxx.supabase.co/example.com?code=...).
 */
export function normalizeSiteOrigin(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  const noTrailing = s.replace(/\/+$/, "");
  if (/^https:\/\//i.test(noTrailing)) return noTrailing;
  if (/^http:\/\//i.test(noTrailing)) return noTrailing;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(noTrailing)) {
    return `http://${noTrailing}`;
  }
  return `https://${noTrailing}`;
}
