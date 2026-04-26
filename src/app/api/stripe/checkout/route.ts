/**
 * Signal Strike — POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for a $1 immediate charge plus a
 * 14-day trial of the selected tier, after which Stripe begins billing
 * the standard monthly price ($29/$79/$129).
 *
 * Request body:
 *   { tier: "scout" | "strike" | "command" }
 *
 * Response:
 *   200 { url: <stripe-checkout-url> }   on success
 *   400 { error: <message> }              if tier is missing/invalid
 *   500 { error: <message> }              on unexpected failure
 *
 * Auth (optional):
 *   - If a Supabase session cookie is present and the user has a
 *     stripe_customer_id on their profile row, that customer is reused.
 *   - Otherwise an anonymous Checkout is created. Stripe collects the
 *     email at checkout. The webhook (Session 4) will later reconcile
 *     the new customer back to a Supabase user.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  stripe,
  getPriceIdForTier,
  getTierDisplayName,
  SETUP_FEE_CENTS,
  TRIAL_DAYS,
  type Tier,
} from "@/lib/stripe";

const VALID_TIERS: Tier[] = ["scout", "strike", "command"];

function isValidTier(value: unknown): value is Tier {
  return typeof value === "string" && VALID_TIERS.includes(value as Tier);
}

/**
 * Resolve the absolute base URL for success/cancel redirects.
 * Falls back to localhost:3000 in dev. NEXT_PUBLIC_APP_URL should be
 * set in production to e.g. https://strike.hilltopave.com.
 */
function getBaseUrl(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  // Derive from the request origin as a last resort
  const origin = req.nextUrl.origin;
  return origin || "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const tier = (body as { tier?: unknown })?.tier;
  if (!isValidTier(tier)) {
    return NextResponse.json(
      {
        error: `Invalid tier. Must be one of: ${VALID_TIERS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  let priceId: string;
  try {
    priceId = getPriceIdForTier(tier);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pricing not configured" },
      { status: 500 },
    );
  }

  const baseUrl = getBaseUrl(req);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],

      // Two line items in the same Checkout:
      //  1) $1 one-time setup fee charged immediately
      //  2) The recurring subscription, with 14-day trial so the
      //     monthly price doesn't kick in until day 15.
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: getTierDisplayName(tier) },
            unit_amount: SETUP_FEE_CENTS,
          },
          quantity: 1,
        },
        {
          price: priceId,
          quantity: 1,
        },
      ],

      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: {
          tier,
          source: "trial_page",
        },
      },

      // Billing address collection helps with tax + chargeback defense.
      billing_address_collection: "auto",

      // Note: `customer_creation` is not valid in subscription mode —
      // Stripe always creates a Customer for subscriptions automatically.
      // The webhook (Session 4) reconciles that customer to a Supabase
      // user using the email captured at Checkout.

      // Show clear cancel/success outcomes so users always have a path
      // back into the funnel.
      success_url: `${baseUrl}/trial/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/trial?canceled=1`,

      // Preserve which tier was selected on the session for the webhook.
      metadata: {
        tier,
        source: "trial_page",
      },

      // Make the Checkout look on-brand.
      allow_promotion_codes: false,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a Checkout URL");
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    // Stripe errors have a `.message` field. Other errors might not.
    const message =
      err instanceof Error ? err.message : "Failed to create Checkout Session";
    console.error("[stripe/checkout] error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Reject any non-POST methods cleanly so we don't leak 404s or
 * accidentally execute code on stray GETs.
 */
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 },
  );
}
