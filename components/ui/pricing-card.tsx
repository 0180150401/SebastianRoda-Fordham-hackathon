"use client";

import {
  Add01Icon,
  MinusSignIcon,
  Tick02Icon,
  UserStoryIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const plans = [
  {
    id: "solo",
    name: "Solo",
    description: "1 user",
    monthlyPrice: 25.0,
    yearlyPrice: 15.0,
    features: [],
  },
  {
    id: "teams",
    name: "Teams",
    description: "up to 3 users",
    monthlyPrice: 50.0,
    yearlyPrice: 40.0,
    features: [],
  },
];

const TRANSITION = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

export default function PricingCard() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [selectedPlan, setSelectedPlan] = useState("solo");
  const [userCount, setUserCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const router = useRouter();
  const isTeamsPlan = selectedPlan === "teams";
  const checkoutQuantity = isTeamsPlan ? Math.max(1, Math.min(3, userCount)) : 1;

  async function handleCheckout() {
    setLoading(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan, billingCycle, quantity: checkoutQuantity }),
      });
      if (res.status === 401) {
        router.push(`/sign-in?redirect=${encodeURIComponent("/#trusted-by")}`);
        return;
      }
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setCheckoutError(data.error ?? "Unable to start checkout. Please try again.");
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Unable to start checkout. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedPlanData = plans.find((p) => p.id === selectedPlan) ?? plans[0];

  return (
    <div className="flex w-full max-w-5xl flex-col gap-3 rounded-2xl border border-border bg-background p-3 shadow-sm transition-colors duration-300 sm:gap-3.5 sm:p-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
          Select a Plan
        </h3>

        <div className="flex h-9 w-full rounded-lg bg-muted p-0.5 ring-1 ring-border">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`relative h-full flex-1 rounded-md text-sm font-medium transition-colors duration-300 ${
              billingCycle === "monthly"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {billingCycle === "monthly" && (
              <motion.div
                layoutId="tab-bg"
                className="absolute inset-0 rounded-md bg-background shadow-sm ring-1 ring-border"
                transition={TRANSITION}
              />
            )}
            <span className="relative z-10">Monthly</span>
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={`relative flex h-full flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors duration-300 ${
              billingCycle === "yearly"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {billingCycle === "yearly" && (
              <motion.div
                layoutId="tab-bg"
                className="absolute inset-0 rounded-md bg-background shadow-sm ring-1 ring-border"
                transition={TRANSITION}
              />
            )}
            <span className="relative z-10">Yearly</span>
            <span className="relative z-10 whitespace-nowrap rounded-full bg-primary px-1 py-0.5 text-[0.65rem] font-semibold uppercase tracking-tight text-primary-foreground">
              20% OFF
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2">
        {plans.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          const price =
            billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;

          return (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className="relative cursor-pointer"
            >
              <div
                className={`relative flex h-full min-h-0 flex-col rounded-lg border border-foreground/10 bg-card p-2.5 transition-colors duration-300 sm:min-h-[108px] sm:p-3 ${
                  isSelected ? "z-10 border-2 border-primary" : ""
                }`}
              >
                <div className="mb-2 flex shrink-0 items-start gap-2">
                  <div className="mt-px shrink-0">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                        isSelected
                          ? "border-primary"
                          : "border-muted-foreground/15"
                      }`}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="h-3 w-3 rounded-full bg-primary"
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 25,
                              duration: 0.2,
                            }}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium leading-tight text-foreground">
                      {plan.name}
                    </h3>
                    <p className="text-[0.65rem] lowercase leading-tight text-muted-foreground">
                      {plan.description}
                    </p>
                  </div>
                </div>
                <div className="mt-auto text-left">
                  <div className="text-base font-medium tabular-nums text-foreground sm:text-lg">
                    <NumberFlow
                      value={price}
                      format={{ style: "currency", currency: "USD" }}
                    />
                  </div>
                  <div className="text-[0.65rem] text-muted-foreground/60">/mo</div>
                  {billingCycle === "yearly" ? (
                    <div className="text-[0.65rem] text-muted-foreground/60">
                      billed annually
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <motion.div
        key={selectedPlan + billingCycle}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
        className="rounded-lg border border-foreground/10 bg-card p-3"
      >
        <div className="flex flex-col gap-2.5">
          {selectedPlanData.features.length > 0 ? (
            <>
              <ul className="grid gap-1 sm:grid-cols-3 sm:gap-x-3 sm:gap-y-1">
                {selectedPlanData.features.map((feature, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-1.5 text-[0.7rem] leading-snug text-foreground/80"
                  >
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={12}
                      className="mt-0.5 shrink-0 text-primary"
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="h-px bg-muted" />
            </>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <HugeiconsIcon
                  icon={UserStoryIcon}
                  size={20}
                  className="text-muted-foreground"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium leading-none text-foreground">
                  Users
                </span>
                <span className="mt-0.5 text-[0.7rem] text-muted-foreground">
                  {isTeamsPlan ? `Up to 3 seats (${checkoutQuantity} selected)` : "Single seat"}
                </span>
              </div>
            </div>
            {isTeamsPlan ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-1 sm:shrink-0">
                <button
                  type="button"
                  onClick={() => setUserCount(Math.max(1, checkoutQuantity - 1))}
                  className="rounded-md p-1 text-muted-foreground/60 transition-all hover:bg-background hover:text-foreground hover:shadow-sm active:scale-95"
                >
                  <HugeiconsIcon icon={MinusSignIcon} size={12} />
                </button>
                <span className="min-w-[1.25rem] text-center text-xs tabular-nums text-foreground/80">
                  <NumberFlow value={checkoutQuantity} />
                </span>
                <button
                  type="button"
                  onClick={() => setUserCount(Math.min(3, checkoutQuantity + 1))}
                  className="rounded-md p-1 text-muted-foreground/60 transition-all hover:bg-background hover:text-foreground hover:shadow-sm active:scale-95"
                >
                  <HugeiconsIcon icon={Add01Icon} size={14} />
                </button>
              </div>
            ) : (
              <span className="rounded-lg border border-border bg-muted px-3 py-1 text-xs text-muted-foreground sm:shrink-0">
                1 seat
              </span>
            )}
          </div>
        </div>
      </motion.div>

      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading}
        className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? "Redirecting…" : "Get Started"}
      </button>
      {checkoutError ? (
        <p className="text-xs text-rose-500">{checkoutError}</p>
      ) : null}
    </div>
  );
}
