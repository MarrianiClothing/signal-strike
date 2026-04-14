import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Admin client only needed for DB queries, not JWT validation
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Validate JWT using user's own token — no service role key needed
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check if internal user
    const { data: internalUser } = await supabaseAdmin
      .from("internal_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (internalUser) {
      return NextResponse.json({ balance: null, is_internal: true });
    }

    // Get credit balance
    const { data: credits } = await supabaseAdmin
      .from("credits")
      .select("balance, total_purchased, total_used")
      .eq("user_id", user.id)
      .maybeSingle();

    // Get recent transactions
    const { data: transactions } = await supabaseAdmin
      .from("credit_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      balance: credits?.balance ?? 0,
      total_purchased: credits?.total_purchased ?? 0,
      total_used: credits?.total_used ?? 0,
      is_internal: false,
      transactions: transactions ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Balance error" }, { status: 500 });
  }
}
