import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

function safeNextPath(raw: string | null): string {
  if (!raw) return "/tool";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/tool";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.AUTH_URL ??
    new URL(request.url).origin;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const publicConfig = getSupabasePublicConfig();
  if (!publicConfig) {
    return NextResponse.redirect(`${origin}/sign-in?error=config`);
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      publicConfig.url,
      publicConfig.anonKey,
      {
        cookieOptions: supabaseCookieOptions,
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth`);
}
