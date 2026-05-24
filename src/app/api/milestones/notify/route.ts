import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const resend   = new Resend(process.env.RESEND_API_KEY!);
  const admin    = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { project_id, milestone_name, milestone_index, milestone_total } = await req.json();
    if (!project_id || !milestone_name) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Fetch project + linked deal contact email
    const { data: project } = await admin
      .from("projects")
      .select("*, deals(title, company, contact_name, contact_email)")
      .eq("id", project_id)
      .maybeSingle();

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!project.email_client_updates) {
      return NextResponse.json({ ok: true, skipped: "email_client_updates disabled" });
    }

    const recipientEmail = project.deals?.contact_email;
    if (!recipientEmail) {
      return NextResponse.json({ ok: true, skipped: "no contact email on linked deal" });
    }

    const clientName  = project.deals?.contact_name || project.deals?.company || "there";
    const projectName = project.name;
    const woNumber    = project.wo_number ? `WO-${project.wo_number}` : projectName;
    const progress    = milestone_total > 0
      ? Math.round((milestone_index / milestone_total) * 100)
      : null;
    const isComplete  = milestone_index === milestone_total;

    const subject = isComplete
      ? `✅ ${woNumber} — All milestones complete!`
      : `📋 ${woNumber} — Milestone complete: ${milestone_name}`;

    // Build progress bar HTML
    const pct = progress ?? 0;
    const progressBar = `
      <div style="background:#1c1c1f;border-radius:4px;height:8px;margin:12px 0 6px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${isComplete?"#34d399":"#C9A84C"};border-radius:4px;"></div>
      </div>
      <p style="color:#71717a;font-size:12px;margin:0;">${milestone_index} of ${milestone_total} milestones complete (${pct}%)</p>
    `;

    const html = `
      <div style="background:#0a0a0b;color:#fafafa;font-family:Arial,sans-serif;padding:40px;max-width:560px;margin:0 auto;">
        <p style="color:#C9A84C;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 8px;">Signal Strike · Project Update</p>
        <h1 style="font-size:22px;font-weight:800;margin:0 0 6px;">${woNumber}</h1>
        <p style="color:#71717a;font-size:14px;margin:0 0 24px;">${project.service_type || project.deals?.company || ""}</p>

        <div style="background:#111113;border:1px solid #27272a;border-radius:10px;padding:20px;margin-bottom:24px;">
          <p style="color:#52525b;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 6px;">
            ${isComplete ? "PROJECT COMPLETE" : "MILESTONE COMPLETE"}
          </p>
          <p style="font-size:18px;font-weight:700;color:${isComplete?"#34d399":"#fafafa"};margin:0 0 12px;">
            ${isComplete ? "🎉 All milestones complete!" : `✅ ${milestone_name}`}
          </p>
          ${progressBar}
        </div>

        <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 24px;">
          Hi ${clientName},<br/><br/>
          ${isComplete
            ? `We're pleased to let you know that all milestones for <strong style="color:#fafafa;">${projectName}</strong> have been completed. Our team will be in touch shortly to wrap up.`
            : `A milestone has been completed on your project <strong style="color:#fafafa;">${projectName}</strong>. We'll keep you updated as work progresses.`
          }
        </p>

        <p style="color:#52525b;font-size:12px;margin:0;border-top:1px solid #1c1c1f;padding-top:20px;">
          This is an automated update from Signal Strike · HillTop Ave<br/>
          To stop receiving these emails, contact your project manager.
        </p>
      </div>`;

    await resend.emails.send({
      from:    "Signal Strike <updates@hilltopave.com>",
      to:      recipientEmail,
      subject,
      html,
    });

    return NextResponse.json({ ok: true, sent_to: recipientEmail });
  } catch (err: any) {
    console.error("[milestones/notify]", err);
    return NextResponse.json({ error: err?.message ?? "Send failed" }, { status: 500 });
  }
}
