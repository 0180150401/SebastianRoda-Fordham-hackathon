import Stripe from "stripe";

const apiVersion = "2026-03-25.dahlia" as const;

let stripeClient: Stripe | null = null;

/** Lazy init so `next build` does not require STRIPE_SECRET_KEY at module load. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, { apiVersion });
  }
  return stripeClient;
}

/** @deprecated Prefer getStripe() in route handlers */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return Reflect.get(getStripe(), prop);
  },
});

export const PRICE_IDS: Record<string, Record<string, string>> = {
  solo: {
    monthly: process.env.STRIPE_PRICE_SOLO_MONTHLY ?? process.env.STRIPE_PRICE_PLUS_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_SOLO_YEARLY ?? process.env.STRIPE_PRICE_PLUS_YEARLY!,
  },
  teams: {
    monthly: process.env.STRIPE_PRICE_TEAMS_MONTHLY ?? process.env.STRIPE_PRICE_ADVANCED_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_TEAMS_YEARLY ?? process.env.STRIPE_PRICE_ADVANCED_YEARLY!,
  },
};
