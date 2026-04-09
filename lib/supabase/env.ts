/**
 * Public Supabase config (NEXT_PUBLIC_*). Used so we never call createClient with empty strings.
 *
 * Accepts the legacy anon JWT (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) or the newer publishable key names
 * shown in the Supabase dashboard (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_*`).
 */

/** Trailing slashes break `/auth/v1/authorize` joins; host-only paste still works. */
export function normalizeSupabaseProjectUrl(raw: string): string {
  let u = raw.trim();
  if (!u) return u;
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  return u.replace(/\/+$/, "");
}

function getSupabaseBrowserKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  );
}

export function getSupabasePublicConfig(): { url: string; anonKey: string } | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = getSupabaseBrowserKey();
  if (!rawUrl || !anonKey) return null;
  return { url: normalizeSupabaseProjectUrl(rawUrl), anonKey };
}

export function assertSupabasePublicConfig(): { url: string; anonKey: string } {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY from the dashboard). See .env.example.",
    );
  }
  return config;
}
