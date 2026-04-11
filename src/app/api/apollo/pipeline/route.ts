import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const {
      user_id, contact_name, contact_email, contact_phone,
      company, title, linkedin_url, value, stage, notes,
    } = await req.json();

    if (!user_id) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

    const dealTitle = [company, contact_name].filter(Boolean).join(" — ") || "New Prospect";

    const { data, error } = await supabaseAdmin.from("deals").insert({
      user_id,
      title:         dealTitle,
      company:       company       || null,
      contact_name:  contact_name  || null,
      contact_email: contact_email || null,
      contact_phone: contact_phone || null,
      notes:         notes || (linkedin_url ? `LinkedIn: ${linkedin_url}` : null),
      stage:         stage || "prospecting",
      value:         value || 0,
      probability:   10,
      created_at:    new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    }).select("id").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deal_id: data.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Pipeline error" }, { status: 500 });
  }
}
