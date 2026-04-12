import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

    const body = await req.text();
    const sig  = req.headers.get("stripe-signature")!;

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
      return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session  = event.data.object as any;
      const userId   = session.metadata?.user_id;
      const credits  = parseInt(session.metadata?.credits ?? "0");
      const bundleId = session.metadata?.bundle_id;

      if (!userId || !credits) return NextResponse.json({ error: "Missing metadata" }, { status: 400 });

      const { data: existing } = await supabaseAdmin
        .from("credits").select("balance, total_purchased").eq("user_id", userId).maybeSingle();

      await supabaseAdmin.from("credits").upsert({
        user_id:         userId,
        balance:         (existing?.balance ?? 0) + credits,
        total_purchased: (existing?.total_purchased ?? 0) + credits,
        updated_at:      new Date().toISOString(),
      }, { onConflict: "user_id" });

      await supabaseAdmin.from("credit_transactions").insert({
        user_id:           userId,
        type:              "purchase",
        amount:            credits,
        description:       `Purchased ${credits} enrichment credits (${bundleId})`,
        stripe_session_id: session.id,
      });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Webhook error" }, { status: 500 });
  }
}
