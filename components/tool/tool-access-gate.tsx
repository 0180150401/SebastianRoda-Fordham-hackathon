"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type AccessPayload = {
  hasFreeDemoRemaining: boolean;
  subscriptionActive: boolean;
};

type ToolAccessContextValue = AccessPayload & {
  refetchAccess: () => Promise<void>;
};

const ToolAccessContext = createContext<ToolAccessContextValue | null>(null);

export function useToolAccess(): ToolAccessContextValue {
  const ctx = useContext(ToolAccessContext);
  if (!ctx) {
    throw new Error("useToolAccess must be used within ToolAccessGate");
  }
  return ctx;
}

export function ToolAccessGate({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<AccessPayload | null>(null);

  const refetchAccess = useCallback(async () => {
    const res = await fetch("/api/tool/access", { credentials: "include" });
    if (!res.ok) {
      setPayload({
        hasFreeDemoRemaining: false,
        subscriptionActive: false,
      });
      setLoading(false);
      return;
    }
    const data = (await res.json()) as AccessPayload;
    setPayload(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetchAccess();
  }, [refetchAccess]);

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      void refetchAccess();
    }
  }, [searchParams, refetchAccess]);

  const value = useMemo<ToolAccessContextValue | null>(() => {
    if (!payload) return null;
    return {
      ...payload,
      refetchAccess,
    };
  }, [payload, refetchAccess]);

  if (loading || !value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <p className="text-sm">Checking access…</p>
      </div>
    );
  }

  return <ToolAccessContext.Provider value={value}>{children}</ToolAccessContext.Provider>;
}
