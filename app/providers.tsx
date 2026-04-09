"use client";

import { SupabaseAuthRefresh } from "@/components/auth/supabase-auth-refresh";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      <SupabaseAuthRefresh />
      {children}
    </>
  );
}
