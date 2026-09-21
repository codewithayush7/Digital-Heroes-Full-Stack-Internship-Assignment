import Stripe from "stripe";

/**
 * Server-only Stripe client.
 * NEVER import into client components or expose STRIPE_SECRET_KEY.
 */
if (typeof window !== "undefined") {
  throw new Error("CRITICAL SECURITY VIOLATION: Stripe server client cannot be loaded in the browser.");
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  // In build/test environments, fallback to a dummy key if not yet set
  console.warn("Missing STRIPE_SECRET_KEY in environment; Stripe operations will fail if invoked.");
}

export const stripe = new Stripe(stripeSecretKey || "sk_test_placeholder", {
  typescript: true,
});

export type PlanType = "monthly" | "yearly";

export function getStripePriceId(planType: PlanType): string {
  const priceId =
    planType === "monthly"
      ? process.env.STRIPE_MONTHLY_PRICE_ID
      : process.env.STRIPE_YEARLY_PRICE_ID;

  if (!priceId) {
    throw new Error(`Missing Stripe Price ID for plan type: ${planType}`);
  }

  return priceId;
}

export function getPlanTypeFromPriceId(priceId?: string | null): PlanType {
  if (!priceId) return "monthly";
  if (priceId === process.env.STRIPE_YEARLY_PRICE_ID) {
    return "yearly";
  }
  return "monthly";
}
