import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
