import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseProjectUrl } from "@/lib/supabase/env";

/**
 * Server-only client with the service role key. Bypasses RLS — use only in Route Handlers / Server Actions.
 */
export function createAdminClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const url = normalizeSupabaseProjectUrl(rawUrl);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
