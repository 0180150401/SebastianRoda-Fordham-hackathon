/** Stripe subscription statuses that grant full product access. */
export function isSubscriptionActive(stripeStatus: string | null | undefined): boolean {
  return stripeStatus === "active" || stripeStatus === "trialing";
}

export function canUseSemanticTool(
  subscriptionActive: boolean,
  freeDemoUsedAt: string | null | undefined,
): boolean {
  if (subscriptionActive) return true;
  return !freeDemoUsedAt;
}
