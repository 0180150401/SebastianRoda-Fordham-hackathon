import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { assertSupabasePublicConfig } from "@/lib/supabase/env";

export async function createClient() {
  const { url, anonKey } = assertSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(
    url,
    anonKey,
    {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component without mutable cookies — middleware refreshes session.
          }
        },
      },
    },
  );
}
