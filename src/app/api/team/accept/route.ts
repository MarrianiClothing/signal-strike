import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { token, user_id } = await req.json();
    if (!token || !user_id) return NextResponse.json({ error: "Missing token or user_id" }, { status: 400 });

    // Validate invite
    const { data: invite } = await admin.from("team_invites")
      .select("*").eq("token", token).eq("accepted", false).maybeSingle();

    if (!invite) return NextResponse.json({ error: "Invite not found or already used" }, { status: 404 });
    if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: "Invite has expired" }, { status: 410 });

    // Add user to team
    const { error: memberErr } = await admin.from("team_members")
      .upsert({ team_id: invite.team_id, user_id, role: "member" }, { onConflict: "team_id,user_id" });
    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });

    // Mark invite accepted
    await admin.from("team_invites").update({ accepted: true }).eq("id", invite.id);

    return NextResponse.json({ ok: true, team_id: invite.team_id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
