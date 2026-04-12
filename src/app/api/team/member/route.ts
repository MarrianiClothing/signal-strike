import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const member_id = searchParams.get("member_id");
    const owner_id  = searchParams.get("owner_id");
    if (!member_id || !owner_id) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    // Verify requester is owner of a team that contains this member
    const { data: team } = await admin.from("teams").select("id").eq("owner_id", owner_id).maybeSingle();
    if (!team) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    const { data: membership } = await admin.from("team_members").select("id")
      .eq("team_id", team.id).eq("user_id", member_id).maybeSingle();
    if (!membership) return NextResponse.json({ error: "Member not in your team" }, { status: 403 });

    const [profileRes, dealsRes, projectsRes, expensesRes] = await Promise.all([
      admin.from("profiles").select("*").eq("id", member_id).maybeSingle(),
      admin.from("deals").select("*").eq("user_id", member_id).order("created_at", { ascending: false }),
      admin.from("projects").select("*").eq("user_id", member_id).order("created_at", { ascending: false }),
      admin.from("expenses").select("*").eq("user_id", member_id).order("date", { ascending: false }).limit(20),
    ]);

    return NextResponse.json({
      profile:  profileRes.data,
      deals:    dealsRes.data    || [],
      projects: projectsRes.data || [],
      expenses: expensesRes.data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
