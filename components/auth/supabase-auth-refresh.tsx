"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps server-rendered routes aligned with the browser session: when tokens refresh
 * or auth state changes, Next.js cache is updated so users stay signed in across visits.
 */
export function SupabaseAuthRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "TOKEN_REFRESHED" ||
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT"
      ) {
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
