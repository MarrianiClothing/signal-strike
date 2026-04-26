/**
 * Signal Strike — Server-side Stripe client and helpers.
 *
 * This module is server-only. Do not import from any client component.
 * Uses STRIPE_SECRET_KEY which is never exposed to the browser.
 */

import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment");
}

/**
 * Singleton Stripe client. The Next.js dev server hot-reloads modules,
 * so we cache on globalThis to avoid creating dozens of clients.
 */
const globalForStripe = globalThis as unknown as {
  stripe: Stripe | undefined;
};

export const stripe =
  globalForStripe.stripe ??
  new Stripe(process.env.STRIPE_SECRET_KEY, {
    // Pinning the API version is a Stripe best practice — it freezes
    // the request/response shape against future Stripe API changes.
    apiVersion: "2025-09-30.clover",
    typescript: true,
    appInfo: {
      name: "Signal Strike",
      version: "0.1.0",
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForStripe.stripe = stripe;
}

/* ─────────────────── Pricing configuration ─────────────────── */

export type Tier = "scout" | "strike" | "command";

/**
 * The $1 charged immediately at Checkout. This is a one-time line item
 * that runs alongside the recurring subscription. Together with the
 * 14-day trial on the recurring price, the user pays $1 today and
 * $29/$79/$129 starting day 15.
 */
export const SETUP_FEE_CENTS = 100; // $1.00 USD
export const TRIAL_DAYS = 14;

/**
 * Tier → recurring price ID. Pulled from environment so test/live
 * deployments can swap prices without code changes.
 */
export function getPriceIdForTier(tier: Tier): string {
  const map: Record<Tier, string | undefined> = {
    scout: process.env.STRIPE_PRICE_SCOUT,
    strike: process.env.STRIPE_PRICE_STRIKE,
    command: process.env.STRIPE_PRICE_COMMAND,
  };
  const priceId = map[tier];
  if (!priceId) {
    throw new Error(
      `STRIPE_PRICE_${tier.toUpperCase()} is not set in environment`,
    );
  }
  return priceId;
}

/**
 * Human-readable tier names for the $1 setup-fee line item.
 * Stripe shows this on the Checkout page next to the $1.00 charge.
 */
export function getTierDisplayName(tier: Tier): string {
  return {
    scout: "Signal Strike — Scout (14-day trial activation)",
    strike: "Signal Strike — Strike (14-day trial activation)",
    command: "Signal Strike — Command (14-day trial activation)",
  }[tier];
}
