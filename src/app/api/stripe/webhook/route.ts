/**
 * Signal Strike — Stripe webhook handler
 * POST /api/stripe/webhook
 *
 * Every event from Stripe (checkout completed, subscription updated,
 * payment succeeded/failed, etc.) lands here. We verify the request
 * is genuinely from Stripe by validating the Stripe-Signature header
 * against STRIPE_WEBHOOK_SECRET.
 *
 * The handler is idempotent — Stripe retries failed webhooks for up
 * to 3 days, and we may receive duplicate events. Every database
 * operation uses upserts or status checks so retries are safe.
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, type Tier } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Webhook payload signature verification needs the raw body bytes,
// not Next.js's automatic JSON parsing. Disable body parsing here.
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // crypto + raw body need Node runtime

const VALID_TIERS: Tier[] = ["scout", "strike", "command"];

function isValidTier(value: unknown): value is Tier {
  return typeof value === "string" && VALID_TIERS.includes(value as Tier);
}

function getBaseUrl(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return req.nextUrl.origin || "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  let rawBody: string;

  try {
    rawBody = await req.text();
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      secret,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[stripe/webhook] signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  console.log(`[stripe/webhook] received: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          getBaseUrl(req),
        );
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.trial_will_end":
        await handleSubscriptionUpsert(
          event.data.object as Stripe.Subscription,
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        // Stripe sends us many events we don't care about. Acknowledge
        // them all with 200 so Stripe stops retrying.
        console.log(`[stripe/webhook] ignoring event: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      `[stripe/webhook] handler error for ${event.type}:`,
      err,
    );
    // Returning 500 tells Stripe to retry. Only do this on transient
    // failures we expect to clear up — not on bad data.
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ───────────────────────── Event Handlers ───────────────────────── */

/**
 * checkout.session.completed
 *
 * Stripe just charged the user $1 + set up their subscription.
 *  1. Read tier from the session's metadata (we set it in /api/stripe/checkout)
 *  2. Find or create a Supabase auth user with the email Stripe captured
 *  3. Send a password-set email so they can log into Signal Strike
 *  4. Save stripe_customer_id onto their profile
 *  5. Upsert their subscriptions row
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  baseUrl: string,
): Promise<void> {
  const tier = session.metadata?.tier;
  if (!isValidTier(tier)) {
    throw new Error(
      `checkout.session.completed missing valid tier metadata: ${tier}`,
    );
  }

  const email = session.customer_details?.email ?? session.customer_email;
  if (!email) {
    throw new Error("checkout.session.completed missing customer email");
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  if (!customerId) {
    throw new Error("checkout.session.completed missing customer id");
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  if (!subscriptionId) {
    throw new Error("checkout.session.completed missing subscription id");
  }

  // Fetch the full subscription so we can read trial dates, status, etc.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Step 1: find or create the Supabase auth user
  const userId = await findOrCreateUserByEmail(email, baseUrl);

  // Step 2: write the stripe_customer_id onto the profile
  // The profile row is created by the auth.users trigger you already
  // have set up. We just patch the customer ID onto it.
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("id", userId);

  if (profileError) {
    console.error(
      "[stripe/webhook] failed to update profile with stripe_customer_id:",
      profileError,
    );
    // Non-fatal — we can reconcile later. Continue.
  }

  // Step 3: upsert the subscription row
  await upsertSubscription(userId, customerId, subscription, tier);
}

/**
 * customer.subscription.{created,updated,trial_will_end}
 *
 * Stripe is telling us the subscription state changed. Find the
 * matching subscription row by stripe_subscription_id and update.
 */
async function handleSubscriptionUpsert(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  // Find the user by stripe_customer_id on profiles
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      `Could not look up profile by stripe_customer_id: ${profileError.message}`,
    );
  }

  if (!profile) {
    // We may receive subscription events before the checkout.completed
    // handler finishes provisioning. That's fine — the next event will
    // catch up, or we'll backfill manually.
    console.warn(
      `[stripe/webhook] no profile yet for customer ${customerId} — skipping subscription upsert`,
    );
    return;
  }

  // Try to read tier from subscription metadata (we set it at checkout
  // creation). Fall back to 'scout' if missing — unusual but not fatal.
  const metaTier = subscription.metadata?.tier;
  const tier = isValidTier(metaTier) ? metaTier : "scout";

  await upsertSubscription(profile.id, customerId, subscription, tier);
}

/**
 * customer.subscription.deleted
 *
 * User canceled and the cancellation is now effective. Mark the row
 * as canceled. We keep the row for historical reporting (manager
 * dashboards still want to know "this rep used to be on Strike").
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    throw new Error(`Failed to mark subscription canceled: ${error.message}`);
  }
}

/**
 * invoice.payment_succeeded
 *
 * Day 15 (or any subsequent month) charge succeeded. Make sure we're
 * reflecting an active status. Stripe is the source of truth.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  // Some invoices aren't subscription invoices (e.g. one-off charges).
  // Stripe types this loosely; access via any-cast keeps us flexible.
  const subId = (invoice as unknown as { subscription?: string | Stripe.Subscription | null })
    .subscription;
  const subscriptionId =
    typeof subId === "string" ? subId : subId?.id;
  if (!subscriptionId) return;

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({ status: "active" })
    .eq("stripe_subscription_id", subscriptionId)
    .neq("status", "canceled"); // never resurrect a canceled row

  if (error) {
    console.error(
      "[stripe/webhook] invoice.payment_succeeded update failed:",
      error,
    );
  }
}

/**
 * invoice.payment_failed
 *
 * Charge failed. Mark past_due and let Stripe's smart retries do their
 * thing. We'll get follow-up events when Stripe retries succeed or
 * the subscription is finally canceled.
 */
async function handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
  const subId = (invoice as unknown as { subscription?: string | Stripe.Subscription | null })
    .subscription;
  const subscriptionId =
    typeof subId === "string" ? subId : subId?.id;
  if (!subscriptionId) return;

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error(
      "[stripe/webhook] invoice.payment_failed update failed:",
      error,
    );
  }
}

/* ─────────────────────────── Helpers ─────────────────────────── */

/**
 * Find an existing Supabase user by email or create one.
 *
 * For new users we trigger a password-set magic link so they can
 * complete account setup on their own time. They'll arrive at /login
 * with a fresh password and the trial already running.
 */
async function findOrCreateUserByEmail(
  email: string,
  baseUrl: string,
): Promise<string> {
  // Try to find an existing user by email
  const { data: existing, error: listErr } =
    await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

  if (listErr) {
    throw new Error(`Failed to list auth users: ${listErr.message}`);
  }

  const found = existing?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (found) {
    return found.id;
  }

  // Create the user. They start without a password — we'll send them a
  // magic link / password-set link in the next step.
  const { data: created, error: createErr } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true, // skip email-confirmation gate; they paid $1
    });

  if (createErr || !created?.user?.id) {
    throw new Error(
      `Failed to create Supabase user: ${createErr?.message ?? "unknown"}`,
    );
  }

  // Trigger a password-set email. Supabase calls this "recover" because
  // the same flow is used for forgotten passwords.
  const { error: linkErr } = await supabaseAdmin.auth.resetPasswordForEmail(
    email,
    {
      redirectTo: `${baseUrl}/login?welcome=1`,
    },
  );

  if (linkErr) {
    console.error(
      "[stripe/webhook] failed to send password-set email:",
      linkErr,
    );
    // Non-fatal — they can use 'forgot password' on /login.
  }

  return created.user.id;
}

/**
 * Upsert a subscriptions row for a user.
 *
 * The user_id has a UNIQUE constraint, so onConflict='user_id' is safe.
 * Status, dates, and identifiers are all kept current with whatever
 * Stripe just told us.
 */
async function upsertSubscription(
  userId: string,
  customerId: string,
  subscription: Stripe.Subscription,
  tier: Tier,
): Promise<void> {
  // Cast to access fields the SDK types weakly. These are documented
  // on the Subscription object but TS sometimes underdescribes them.
  type SubExtras = {
    trial_end?: number | null;
    current_period_start?: number | null;
    current_period_end?: number | null;
    cancel_at?: number | null;
    canceled_at?: number | null;
    items?: { data?: Array<{ price?: { id?: string } }> };
  };
  const sub = subscription as Stripe.Subscription & SubExtras;

  const toIso = (epochSeconds: number | null | undefined) =>
    epochSeconds ? new Date(epochSeconds * 1000).toISOString() : null;

  const priceId = sub.items?.data?.[0]?.price?.id ?? null;

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        tier,
        status: subscription.status,
        trial_end: toIso(sub.trial_end),
        current_period_start: toIso(sub.current_period_start),
        current_period_end: toIso(sub.current_period_end),
        cancel_at: toIso(sub.cancel_at),
        canceled_at: toIso(sub.canceled_at),
      },
      { onConflict: "user_id" },
    );

  if (error) {
    throw new Error(`Failed to upsert subscription: ${error.message}`);
  }
}

/* GET is rejected so casual visits to the URL don't 500. */
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Stripe POSTs to this endpoint." },
    { status: 405 },
  );
}
