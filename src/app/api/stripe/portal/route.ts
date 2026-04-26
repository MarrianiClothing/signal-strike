/**
 * Signal Strike — Stripe Customer Portal session creator
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session for the logged-in user and
 * returns the portal URL. The frontend redirects to this URL; the user
 * manages their subscription, payment method, etc. on Stripe's hosted
 * portal page; then Stripe sends them back to /account when done.
 *
 * Auth check is critical here. Without it, anyone could pass any
 * customer_id and impersonate that customer's billing context.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {
            // Read-only context — Next.js Server Components/Route Handlers
            // can't always set cookies. Safe to no-op here since we only
            // need to verify the user, not refresh their session.
          },
        },
      },
    );

    // 1. Verify the user is logged in
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "You must be signed in to manage billing." },
        { status: 401 },
      );
    }

    // 2. Look up their stripe_customer_id from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: `Could not load profile: ${profileError.message}` },
        { status: 500 },
      );
    }

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        {
          error:
            "No billing account found. Start a trial first to set up billing.",
        },
        { status: 400 },
      );
    }

    // 3. Build the return URL — where Stripe sends them after they're done
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
      req.nextUrl.origin ||
      "http://localhost:3000";

    // 4. Create the portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${baseUrl}/account`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown server error";
    console.error("[stripe/portal] error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to create a portal session." },
    { status: 405 },
  );
}
