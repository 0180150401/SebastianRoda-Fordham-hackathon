import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

/** Returns null when public env vars are missing (avoids Supabase SDK throwing at runtime). */
export function createClient(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.anonKey, {
    cookieOptions: supabaseCookieOptions,
    isSingleton: true,
  });
}
