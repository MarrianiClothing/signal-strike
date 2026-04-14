import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const BUNDLES: Record<string, { credits: number; price_cents: number; label: string }> = {
  starter:  { credits: 25,  price_cents: 499,  label: "25 Enrichment Credits" },
  standard: { credits: 100, price_cents: 1499, label: "100 Enrichment Credits" },
  pro:      { credits: 500, price_cents: 4999, label: "500 Enrichment Credits" },
};

export async function POST(req: NextRequest) {
  const debug: Record<string, any> = {};
  try {
    debug.step = "loading stripe";
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });
    debug.stripe_key_prefix = process.env.STRIPE_SECRET_KEY?.slice(0, 7) ?? "MISSING";

    debug.step = "auth header";
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized - no auth header", debug }, { status: 401 });
    debug.has_auth_header = true;

    debug.step = "supabase getUser";
    debug.supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL ? "present" : "MISSING";
    debug.anon_key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "present" : "MISSING";

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized - getUser failed", auth_error: authError?.message, debug }, { status: 401 });
    }
    debug.user_id = user.id;

    debug.step = "parse body";
    const body = await req.json();
    const bundle_id = body?.bundle_id;
    debug.bundle_id = bundle_id;
    const bundle = BUNDLES[bundle_id];
    if (!bundle) return NextResponse.json({ error: "Invalid bundle", debug }, { status: 400 });

    debug.step = "create stripe session";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://strike.hilltopave.com";
    debug.app_url = appUrl;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: bundle.price_cents,
          product_data: {
            name: bundle.label,
            description: "Signal Strike enrichment credits — reveal direct email & phone for any prospect",
          },
        },
        quantity: 1,
      }],
      metadata: {
        user_id: user.id,
        bundle_id,
        credits: bundle.credits.toString(),
      },
      success_url: `${appUrl}/prospects?credits=success&bundle=${bundle_id}`,
      cancel_url:  `${appUrl}/prospects?credits=cancelled`,
      customer_email: user.email,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Checkout error", debug, stack: err?.stack?.slice(0,500) }, { status: 500 });
  }
}
