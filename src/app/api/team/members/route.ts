import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const owner_id = searchParams.get("owner_id");
    if (!owner_id) return NextResponse.json({ error: "Missing owner_id" }, { status: 400 });

    // Get team
    const { data: team } = await admin.from("teams").select("*").eq("owner_id", owner_id).maybeSingle();
    if (!team) return NextResponse.json({ team: null, members: [] });

    // Get members
    const { data: members } = await admin.from("team_members")
      .select("*").eq("team_id", team.id);

    // Get profiles + deal stats for each member
    const enriched = await Promise.all((members || []).map(async (m: any) => {
      const { data: profile } = await admin.from("profiles").select("full_name,email").eq("id", m.user_id).maybeSingle();
      const { data: deals }   = await admin.from("deals").select("id,value,stage").eq("user_id", m.user_id);
      const { data: projects } = await admin.from("projects").select("id,name,status").eq("user_id", m.user_id);

      const dealList  = deals || [];
      const openDeals = dealList.filter((d: any) => !["closed_won","closed_lost"].includes(d.stage)).length;
      const pipeline  = dealList.filter((d: any) => !["closed_won","closed_lost"].includes(d.stage)).reduce((s: number, d: any) => s + (d.value||0), 0);
      const won       = dealList.filter((d: any) => d.stage === "closed_won").reduce((s: number, d: any) => s + (d.value||0), 0);

      return {
        user_id:   m.user_id,
        role:      m.role,
        joined_at: m.joined_at,
        full_name: profile?.full_name ?? "Unnamed",
        email:     profile?.email ?? "",
        open_deals:  openDeals,
        pipeline,
        won_revenue: won,
        total_deals: dealList.length,
        projects:    (projects || []).length,
      };
    }));

    // Get pending invites
    const { data: invites } = await admin.from("team_invites")
      .select("*").eq("team_id", team.id).eq("accepted", false)
      .gt("expires_at", new Date().toISOString());

    return NextResponse.json({ team, members: enriched, pending_invites: invites || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
