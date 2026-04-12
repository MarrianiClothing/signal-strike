import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ── Internal user check — bypass credits entirely ─────────────────────────
    const { data: internalUser } = await supabaseAdmin
      .from("internal_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const isInternal = !!internalUser;

    // ── Credit check for commercial users ────────────────────────────────────
    if (!isInternal) {
      const { data: credits } = await supabaseAdmin
        .from("credits")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      const balance = credits?.balance ?? 0;
      if (balance <= 0) {
        return NextResponse.json(
          { error: "insufficient_credits", message: "You have no enrichment credits remaining. Purchase more to continue." },
          { status: 402 }
        );
      }
    }

    // ── Apollo API call ───────────────────────────────────────────────────────
    // Internal users use personal key, commercial users use commercial key
    const key = isInternal
      ? process.env.APOLLO_API_KEY
      : (process.env.APOLLO_COMMERCIAL_API_KEY || process.env.APOLLO_API_KEY);

    if (!key) return NextResponse.json({ error: "Apollo API key not configured" }, { status: 500 });

    const { person_id, first_name, last_name, organization_name, linkedin_url } = await req.json();

    const payload: any = {
      id:                person_id         || undefined,
      first_name:        first_name        || undefined,
      last_name:         last_name         || undefined,
      organization_name: organization_name || undefined,
      linkedin_url:      linkedin_url      || undefined,
      reveal_personal_emails: false,
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    const res = await fetch("https://api.apollo.io/v1/people/match", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key":     key,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data?.message ?? "Enrichment failed" }, { status: res.status });
    }

    // ── Deduct 1 credit for commercial users (only on success) ────────────────
    if (!isInternal) {
      await supabaseAdmin.rpc("deduct_credit", { p_user_id: user.id });

      await supabaseAdmin.from("credit_transactions").insert({
        user_id:     user.id,
        type:        "deduction",
        amount:      1,
        description: `Enriched: ${first_name ?? ""} ${last_name ?? ""} at ${organization_name ?? "unknown"}`.trim(),
      });
    }

    const person = data.person ?? {};
    return NextResponse.json({
      email:        person.email                                 ?? null,
      phone:        person.phone_numbers?.[0]?.sanitized_number ?? null,
      linkedin_url: person.linkedin_url                         ?? null,
      title:        person.title                                ?? null,
      company:      person.organization?.name                   ?? null,
      city:         person.city                                 ?? null,
      state:        person.state                                ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Enrich error" }, { status: 500 });
  }
}
