"use client";

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function RequireToolAuth({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const router = useRouter();

  useEffect(() => {
    setSupabase(createClient());
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session) {
        router.replace(`/sign-in?redirect=${encodeURIComponent("/tool")}`);
      } else {
        setReady(true);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace(`/sign-in?redirect=${encodeURIComponent("/tool")}`);
      } else {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <p className="text-sm">Loading session…</p>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground">
        <p className="max-w-md text-sm">
          Supabase is not configured. Add{" "}
          <code className="rounded bg-muted px-1 font-mono text-xs">
            NEXT_PUBLIC_SUPABASE_URL
          </code>{" "}
          and a browser key:{" "}
          <code className="rounded bg-muted px-1 font-mono text-xs">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>{" "}
          or{" "}
          <code className="rounded bg-muted px-1 font-mono text-xs">
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
          </code>{" "}
          (see <code className="font-mono text-xs">.env.example</code>), then restart the dev server.
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <p className="text-sm">Loading session…</p>
      </div>
    );
  }

  return <>{children}</>;
}
