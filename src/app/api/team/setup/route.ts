import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { user_id, name } = await req.json();
    if (!user_id) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

    // Check if team already exists
    const { data: existing } = await admin.from("teams").select("*").eq("owner_id", user_id).maybeSingle();
    if (existing) return NextResponse.json({ team: existing });

    // Create team + add owner as member
    const { data: team, error } = await admin.from("teams")
      .insert({ owner_id: user_id, name: name || "My Team" })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin.from("team_members").insert({ team_id: team.id, user_id, role: "owner" });
    return NextResponse.json({ team });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
