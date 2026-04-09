"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import PricingCard from "@/components/ui/pricing-card";
import { cn } from "@/lib/utils";

export type ToolPaywallProps = {
  /** Full page (legacy) vs floating above content */
  variant?: "page" | "overlay";
  onDismiss?: () => void;
};

export function ToolPaywall({ variant = "page", onDismiss }: ToolPaywallProps) {
  useEffect(() => {
    if (variant !== "overlay") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [variant]);

  const body = (
    <>
      <div className="grid w-full gap-4 md:grid-cols-[minmax(0,240px)_1fr] md:items-start md:gap-6 lg:gap-8">
        <div className="max-w-lg justify-self-center text-center md:justify-self-start md:pt-1 md:text-left">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary">
            6 degree&apos;s
          </p>
          <h1
            id="paywall-title"
            className="mt-2 text-lg font-semibold leading-snug tracking-tight text-foreground sm:text-xl"
          >
            Your free demo is complete
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Subscribe for unlimited analyses, competitor tracking, and an up-to-date GEO graph.
          </p>
        </div>
        <div className="min-w-0">
          <PricingCard />
        </div>
      </div>
      <Link
        href="/"
        className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        ← Back to landing
      </Link>
    </>
  );

  if (variant === "overlay") {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
      >
        <button
          type="button"
          className="absolute inset-0 bg-foreground/60 backdrop-blur-[2px]"
          aria-label="Close paywall"
          onClick={onDismiss}
        />
        <div
          className={cn(
            "relative z-10 flex w-full max-w-lg flex-col items-stretch gap-4 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-2xl",
            "sm:max-w-5xl sm:p-5",
          )}
        >
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="absolute right-3 top-3 rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
          <div className="flex w-full min-w-0 flex-col items-stretch gap-3 pt-7 sm:pt-8">
            {body}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 py-12">
      {body}
    </div>
  );
}
