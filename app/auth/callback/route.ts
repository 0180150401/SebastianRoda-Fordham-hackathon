import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

function safeNextPath(raw: string | null): string {
  if (!raw) return "/tool";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/tool";
  return raw;
}

export async function GET(request: NextRequest) {
  const requestOrigin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  const publicConfig = getSupabasePublicConfig();
  if (!publicConfig) {
    return NextResponse.redirect(new URL("/sign-in?error=config", requestOrigin));
  }

  const cookieStore = await cookies();

  if (code) {
    const redirectTarget = new URL(next, requestOrigin);
    const redirectResponse = NextResponse.redirect(redirectTarget);

    const supabase = createServerClient(publicConfig.url, publicConfig.anonKey, {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            redirectResponse.cookies.set(name, value, options);
          });
          if (headers) {
            Object.entries(headers).forEach(([key, value]) =>
              redirectResponse.headers.set(key, value),
            );
          }
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectResponse;
    }
  }

  return NextResponse.redirect(new URL("/sign-in?error=auth", requestOrigin));
}
