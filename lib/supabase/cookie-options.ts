import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Shared cookie options for browser, server, middleware, and auth callback.
 * Long maxAge keeps refresh/access tokens in cookies across browser restarts (same as @supabase/ssr defaults).
 */
export const supabaseCookieOptions: CookieOptionsWithName = {
  path: "/",
  sameSite: "lax",
  maxAge: 400 * 24 * 60 * 60,
  secure: process.env.NODE_ENV === "production",
};
