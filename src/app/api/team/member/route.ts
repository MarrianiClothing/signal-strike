import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const member_id = searchParams.get("member_id");
    const owner_id  = searchParams.get("owner_id");
    if (!member_id || !owner_id) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Verify this member belongs to the owner's team
    const { data: team } = await admin.from("teams").select("id").eq("owner_id", owner_id).maybeSingle();
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const { data: membership } = await admin.from("team_members")
      .select("role").eq("team_id", team.id).eq("user_id", member_id).maybeSingle();
    if (!membership) return NextResponse.json({ error: "Member not in team" }, { status: 404 });

    // Get profile
    const { data: profile } = await admin.from("profiles")
      .select("id, full_name").eq("id", member_id).maybeSingle();

    // Get auth email
    const { data: { user: authUser } } = await admin.auth.admin.getUserById(member_id);

    // Get deals, projects, expenses in parallel
    const [{ data: deals }, { data: projects }, { data: expenses }] = await Promise.all([
      admin.from("deals").select("*").eq("user_id", member_id).order("created_at", { ascending: false }),
      admin.from("projects").select("*").eq("user_id", member_id).order("created_at", { ascending: false }),
      admin.from("expenses").select("*").eq("user_id", member_id).order("expense_date", { ascending: false }),
    ]);

    return NextResponse.json({
      profile: { ...profile, email: authUser?.email ?? "" },
      deals:    deals    ?? [],
      projects: projects ?? [],
      expenses: expenses ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user_id, team_id, role, manager_id } = await req.json();
    if (!user_id) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

    // Update role in team_members
    if (role && team_id) {
      await admin.from("team_members")
        .update({ role })
        .eq("team_id", team_id)
        .eq("user_id", user_id);
    }

    // Update manager_id in profiles
    if (manager_id !== undefined) {
      await admin.from("profiles")
        .update({ manager_id: manager_id || null })
        .eq("id", user_id);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
