import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { team_id, email, inviter_name } = await req.json();
    if (!team_id || !email) return NextResponse.json({ error: "Missing team_id or email" }, { status: 400 });

    // Create invite token
    const { data: invite, error } = await admin.from("team_invites")
      .insert({ team_id, email: email.toLowerCase().trim() })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://signal-strike.vercel.app"}/invite/${invite.token}`;

    // Send invite email
    await resend.emails.send({
      from:    "Signal Strike <hello@hilltopave.com>",
      to:      email,
      subject: `${inviter_name || "Someone"} invited you to Signal Strike`,
      html: `
        <div style="background:#0a0a0b;color:#fafafa;font-family:Arial,sans-serif;padding:40px;max-width:560px;margin:0 auto;">
          <p style="color:#C9A84C;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Signal Strike · Team Invite</p>
          <h1 style="font-size:22px;font-weight:800;margin:0 0 16px;">You've been invited</h1>
          <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin-bottom:24px;">
            <strong style="color:#fafafa;">${inviter_name || "A teammate"}</strong> has invited you to join their Signal Strike team.
            Signal Strike is a revenue CRM for tracking deals, commissions, and projects.
          </p>
          <a href="${inviteUrl}" style="display:inline-block;background:#C9A84C;color:#000;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;margin-bottom:24px;">
            Accept Invitation →
          </a>
          <p style="color:#52525b;font-size:12px;margin:0;">This invite expires in 7 days. If you didn't expect this, you can safely ignore it.</p>
          <p style="color:#3f3f46;font-size:11px;margin-top:24px;border-top:1px solid #1c1c1f;padding-top:16px;">
            Powered by Signal Strike · HillTop Ave
          </p>
        </div>`,
    });

    return NextResponse.json({ ok: true, token: invite.token });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
