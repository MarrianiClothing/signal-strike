import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}

const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecting", qualification: "Qualified",
  proposal: "Proposal", negotiation: "Negotiation",
  closed_won: "Won", closed_lost: "Lost",
};

const STAGE_COLORS: Record<string, string> = {
  prospecting: "#71717a", qualification: "#60a5fa", proposal: "#a78bfa",
  negotiation: "#fbbf24", closed_won: "#C9A84C", closed_lost: "#f87171",
};


function buildPDF(deals: any[], tiers: any[], today: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const buffers: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const tiersMap: Record<string, any> = {};
    for (const t of tiers) tiersMap[t.id] = t;
    const activeDeals = deals.filter(d => d.stage !== "closed_lost");
    const totalValue  = activeDeals.reduce((s, d) => s + (d.value || 0), 0);
    const totalComm   = activeDeals.reduce((s, d) => {
      const tier = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
      return s + (tier ? (d.value || 0) * (tier.rate / 100) : 0);
    }, 0);

    const GOLD   = "#C9A84C";
    const GREEN  = "#34d399";
    const WHITE  = "#FFFFFF";
    const MUTED  = "#71717a";
    const BG     = "#111113";
    const BORDER = "#27272a";

    const STAGE_LABELS: Record<string, string> = {
      prospecting: "Prospecting", qualification: "Qualified",
      proposal: "Proposal", negotiation: "Negotiation",
      closed_won: "Won", closed_lost: "Lost",
    };
    const STAGE_COLORS: Record<string, string> = {
      prospecting: "#71717a", qualification: "#60a5fa", proposal: "#a78bfa",
      negotiation: "#fbbf24", closed_won: "#C9A84C", closed_lost: "#f87171",
    };

    // ── Header ────────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 90).fill("#09090b");
    doc.fillColor(GOLD).fontSize(9).font("Helvetica-Bold")
       .text("SIGNAL STRIKE  ·  REVENUE CRM", 50, 24, { align: "center", characterSpacing: 2 });
    doc.fillColor(WHITE).fontSize(26).font("Helvetica-Bold")
       .text("Daily Signal", 50, 36, { align: "center" });
    doc.fillColor(MUTED).fontSize(10).font("Helvetica")
       .text(today, 50, 66, { align: "center" });

    // ── Summary bar ───────────────────────────────────────────────────────────
    const bY = 100, bH = 60, bW = (doc.page.width - 100) / 3;
    const stats = [
      { label: "Active Deals",      value: String(activeDeals.length),  color: WHITE },
      { label: "Pipeline Value",    value: fmt(totalValue),              color: GOLD  },
      { label: "Total Commission",  value: fmt(totalComm),               color: GREEN },
    ];
    stats.forEach((st, i) => {
      const x = 50 + i * bW;
      doc.rect(x, bY, bW, bH).fillAndStroke("#111113", BORDER);
      doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold")
         .text(st.label.toUpperCase(), x + 8, bY + 10, { width: bW - 16, align: "center", characterSpacing: 1 });
      doc.fillColor(st.color).fontSize(20).font("Helvetica-Bold")
         .text(st.value, x + 8, bY + 26, { width: bW - 16, align: "center" });
    });

    // ── Section label ─────────────────────────────────────────────────────────
    doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold")
       .text("YOUR DEALS", 50, 176, { characterSpacing: 2 });
    doc.moveTo(50, 187).lineTo(doc.page.width - 50, 187).strokeColor(BORDER).lineWidth(0.5).stroke();

    // ── Deal cards ────────────────────────────────────────────────────────────
    let y = 196;

    activeDeals.forEach((d, i) => {
      const tier       = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
      const commission = tier ? (d.value || 0) * (tier.rate / 100) : null;
      const stageColor = STAGE_COLORS[d.stage] || MUTED;
      const stageLabel = STAGE_LABELS[d.stage] || d.stage;
      const closeDate  = d.expected_close_date
        ? new Date(d.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : null;

      const cardH = 80 + (d.next_task ? 36 : 0) + (d.notes ? 20 : 0);

      // Page break if needed
      if (y + cardH > doc.page.height - 60) {
        doc.addPage();
        y = 50;
      }

      const cW = doc.page.width - 100;

      // Card background + border
      doc.rect(50, y, cW, cardH).fillAndStroke("#1a1a1d", BORDER);

      // Stage color bar (left edge)
      doc.rect(50, y, 5, cardH).fill(stageColor);

      // Deal title
      doc.fillColor(WHITE).fontSize(13).font("Helvetica-Bold")
         .text(d.title, 64, y + 12, { width: 280 });

      // Company
      doc.fillColor(MUTED).fontSize(9).font("Helvetica")
         .text(d.company || "", 64, y + 28, { width: 280 });

      // Value (right aligned)
      doc.fillColor(GOLD).fontSize(16).font("Helvetica-Bold")
         .text(fmt(d.value || 0), cW - 90, y + 10, { width: 132, align: "right" });

      // Stage badge
      doc.fillColor(stageColor).fontSize(8).font("Helvetica-Bold")
         .text(stageLabel.toUpperCase(), cW - 90, y + 30, { width: 132, align: "right", characterSpacing: 0.8 });

      // Divider
      doc.moveTo(64, y + 46).lineTo(50 + cW - 8, y + 46).strokeColor(BORDER).lineWidth(0.5).stroke();

      // Contact + Close date
      let detailY = y + 52;
      if (d.contact_name) {
        doc.fillColor("#a1a1aa").fontSize(9).font("Helvetica")
           .text(`${d.contact_name}${d.contact_email ? "  ·  " + d.contact_email : ""}`, 64, detailY, { width: 300 });
        detailY += 13;
      }
      if (closeDate) {
        doc.fillColor(MUTED).fontSize(9).font("Helvetica")
           .text(`Close: ${closeDate}`, 64, detailY);
        detailY += 13;
      }

      // Commission (right column)
      if (commission !== null) {
        doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold")
           .text("COMMISSION", cW - 88, y + 52, { width: 130, align: "right", characterSpacing: 0.8 });
        doc.fillColor(GREEN).fontSize(14).font("Helvetica-Bold")
           .text(fmt(commission), cW - 88, y + 62, { width: 130, align: "right" });
        doc.fillColor(MUTED).fontSize(8).font("Helvetica")
           .text(`${tier.name}  ·  ${tier.rate}%`, cW - 88, y + 78, { width: 130, align: "right" });
      }

      // Next task
      if (d.next_task) {
        const taskY = y + cardH - 32;
        doc.rect(55, taskY - 4, cW - 10, 30).fill("#17150e");
        doc.fillColor(GOLD).fontSize(8).font("Helvetica-Bold")
           .text("⚡ NEXT TASK", 64, taskY, { characterSpacing: 0.8 });
        doc.fillColor(WHITE).fontSize(10).font("Helvetica")
           .text(d.next_task, 64, taskY + 12, { width: cW - 80 });
      }

      y += cardH + 12;
    });

    // ── Footer ────────────────────────────────────────────────────────────────
    if (y + 30 > doc.page.height - 50) { doc.addPage(); y = 50; }
    doc.moveTo(50, y + 8).lineTo(doc.page.width - 50, y + 8).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.fillColor(MUTED).fontSize(8).font("Helvetica")
       .text("Signal Strike  ·  Revenue CRM  ·  Powered by Hilltop Ave", 50, y + 14, { align: "center" });

    doc.end();
  });
}

function buildEmailHtml(userName: string, deals: any[], tiers: any[]) {
  const tiersMap: Record<string, any> = {};
  for (const t of tiers) tiersMap[t.id] = t;

  const activeDeals = deals.filter(d => d.stage !== "closed_lost");
  const totalValue  = activeDeals.reduce((s, d) => s + (d.value || 0), 0);
  const totalCommission = activeDeals.reduce((s, d) => {
    const tier = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
    return s + (tier ? (d.value || 0) * (tier.rate / 100) : 0);
  }, 0);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const dealRows = activeDeals.map((d, i) => {
    const tier       = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
    const commission = tier ? (d.value || 0) * (tier.rate / 100) : null;
    const stageColor = STAGE_COLORS[d.stage] || "#71717a";
    const stageLabel = STAGE_LABELS[d.stage] || d.stage;
    const closeDate  = d.expected_close_date
      ? new Date(d.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null;

    return `
      <!-- Deal Card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border-radius:12px;overflow:hidden;border:1px solid #27272a;">
        <!-- Stage color bar + title row -->
        <tr>
          <td width="4" style="background:${stageColor};border-radius:12px 0 0 0;"></td>
          <td style="background:#1a1a1d;padding:16px 18px 12px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0 0 3px 0;font-size:17px;font-weight:700;color:#ffffff;line-height:1.3;">${d.title}</p>
                  <p style="margin:0;font-size:13px;color:#71717a;">${d.company || "&nbsp;"}</p>
                </td>
                <td align="right" valign="top" style="padding-left:12px;white-space:nowrap;">
                  <p style="margin:0 0 5px 0;font-size:20px;font-weight:800;color:#C9A84C;font-family:Georgia,serif;">${fmt(d.value || 0)}</p>
                  <span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${stageColor}30;color:${stageColor};letter-spacing:0.04em;">${stageLabel.toUpperCase()}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td colspan="2" style="height:1px;background:#27272a;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Details row -->
        <tr>
          <td width="4" style="background:${stageColor}40;"></td>
          <td style="background:#141416;padding:12px 18px 12px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <!-- Left: contact + close date -->
                <td valign="top" style="padding-right:12px;">
                  ${d.contact_name ? `
                  <p style="margin:0 0 5px 0;font-size:13px;color:#a1a1aa;">
                    <span style="color:#52525b;">&#128100;</span>&nbsp;
                    <strong style="color:#d4d4d8;">${d.contact_name}</strong>
                    ${d.contact_email ? `<br><span style="color:#52525b;font-size:12px;">${d.contact_email}</span>` : ""}
                  </p>` : ""}
                  ${closeDate ? `
                  <p style="margin:0;font-size:12px;color:#71717a;">
                    <span>&#128197;</span>&nbsp;Close: <strong style="color:#a1a1aa;">${closeDate}</strong>
                  </p>` : ""}
                </td>
                <!-- Right: commission -->
                ${commission !== null ? `
                <td align="right" valign="top" style="white-space:nowrap;">
                  <p style="margin:0 0 2px 0;font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:0.06em;">Commission</p>
                  <p style="margin:0 0 2px 0;font-size:18px;font-weight:800;color:#34d399;font-family:Georgia,serif;">${fmt(commission)}</p>
                  <p style="margin:0;font-size:11px;color:#52525b;">${tier.name} &middot; ${tier.rate}%</p>
                </td>` : "<td></td>"}
              </tr>
            </table>
          </td>
        </tr>

        ${d.next_task ? `
        <!-- Divider -->
        <tr><td colspan="2" style="height:1px;background:#27272a;font-size:0;line-height:0;">&nbsp;</td></tr>
        <!-- Next Task -->
        <tr>
          <td width="4" style="background:#C9A84C;border-radius:0 0 0 12px;"></td>
          <td style="background:#17150e;padding:11px 18px 11px 16px;border-radius:0 0 12px 0;">
            <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#C9A84C;text-transform:uppercase;letter-spacing:0.08em;">&#9889; Next Task</p>
            <p style="margin:0;font-size:14px;color:#fafafa;line-height:1.5;">${d.next_task}</p>
          </td>
        </tr>` : `
        <!-- No task -->
        <tr>
          <td width="4" style="background:#27272a;border-radius:0 0 0 12px;"></td>
          <td style="background:#111113;padding:9px 18px 9px 16px;border-radius:0 0 12px 0;">
            <p style="margin:0;font-size:12px;color:#3f3f46;font-style:italic;">No next task assigned</p>
          </td>
        </tr>`}
      </table>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Daily Signal</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;min-height:100vh;">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- ── HEADER ── -->
  <tr>
    <td align="center" style="padding-bottom:28px;">
      <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#C9A84C;text-transform:uppercase;letter-spacing:0.2em;">SIGNAL STRIKE</p>
      <h1 style="margin:0 0 6px 0;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Daily Signal</h1>
      <p style="margin:0;font-size:14px;color:#52525b;">${today}</p>
    </td>
  </tr>

  <!-- ── SUMMARY STATS ── -->
  <tr>
    <td style="padding-bottom:28px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid #27272a;">
        <tr>
          <td align="center" style="background:#111113;padding:20px 12px;border-right:1px solid #27272a;">
            <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:0.1em;">Active Deals</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;">${activeDeals.length}</p>
          </td>
          <td align="center" style="background:#111113;padding:20px 12px;border-right:1px solid #27272a;">
            <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:0.1em;">Pipeline Value</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#C9A84C;font-family:Georgia,serif;">${fmt(totalValue)}</p>
          </td>
          <td align="center" style="background:#111113;padding:20px 12px;border-right:1px solid #27272a;">
            <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:0.1em;">Total Commission</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#34d399;font-family:Georgia,serif;">${fmt(totalCommission)}</p>
          </td>
          <td align="center" style="background:#111113;padding:20px 12px;">
            <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:0.1em;">Tasks Pending</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;">${activeDeals.filter((d: any) => d.next_task).length}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── SECTION HEADER ── -->
  <tr>
    <td style="padding-bottom:12px;">
      <p style="margin:0;font-size:11px;font-weight:700;color:#52525b;text-transform:uppercase;letter-spacing:0.12em;">Your Deals</p>
    </td>
  </tr>

  <!-- ── DEAL CARDS ── -->
  <tr>
    <td>
      ${activeDeals.length === 0
        ? `<p style="color:#52525b;font-size:15px;padding:24px 0;">No active deals right now.</p>`
        : dealRows
      }
    </td>
  </tr>

  <!-- ── FOOTER ── -->
  <tr>
    <td align="center" style="padding-top:32px;border-top:1px solid #18181b;margin-top:8px;">
      <p style="margin:0 0 4px 0;font-size:12px;color:#3f3f46;">Signal Strike &middot; Revenue CRM &middot; Powered by Hilltop Ave</p>
      <p style="margin:0;font-size:11px;color:#27272a;">Manage Daily Signal settings: Signal Strike &rarr; Settings</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const secret  = req.nextUrl.searchParams.get("secret");
  const preview = req.nextUrl.searchParams.get("preview") === "true";

  // Auth: cron uses secret, preview uses logged-in session
  if (!preview && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get current UTC time in HH:MM
    const now     = new Date();
    const hh      = now.getUTCHours().toString().padStart(2, "0");
    const mm      = now.getUTCMinutes().toString().padStart(2, "0");
    const nowTime = `${hh}:${mm}`;

    // Find users to send to
    let query = supabase
      .from("profiles")
      .select("id, full_name, email, daily_signal_time, daily_signal_enabled, timezone")
      .eq("daily_signal_enabled", true);

    if (!preview) {
      // For cron: match users whose send time falls within this 15-min window
      query = query.gte("daily_signal_time", nowTime)
                   .lt("daily_signal_time", `${hh}:${(parseInt(mm) + 15).toString().padStart(2, "0")}`);
    } else {
      // For preview: just get the current user (first profile returned, no filter)
      query = query.limit(1);
    }

    // For preview mode, get any enabled user
    if (preview) {
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .limit(1);
      const profile = allProfiles?.[0];
      if (!profile?.id) {
        return NextResponse.json({ ok: false, error: "No user profile found." });
      }
      // Get email from auth.users via admin API
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(profile.id);
      const email = authUser?.email;
      if (!email) {
        return NextResponse.json({ ok: false, error: "No email found for user." });
      }
      // fetch their deals and tiers
      const { data: deals } = await supabase
        .from("deals").select("*").eq("user_id", profile.id);
      const { data: tiers } = await supabase
        .from("commission_tiers").select("*").eq("user_id", profile.id);

      const today2 = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const html = buildEmailHtml(profile.full_name || "there", deals || [], tiers || []);
      const pdfBuffer = await buildPDF(deals || [], tiers || [], today2);
      const dateStr = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      await resend.emails.send({
        from:    "Signal Strike <onboarding@resend.dev>",
        to:      email,
        subject: `Daily Signal · ${dateStr}`,
        html,
        attachments: [{
          filename: `Daily-Signal-${new Date().toISOString().slice(0,10)}.pdf`,
          content: pdfBuffer.toString("base64"),
        }],
      });
      return NextResponse.json({ ok: true, sent_to: email });
    }

    const { data: profiles } = await query;
    if (!profiles?.length) {
      return NextResponse.json({ ok: true, sent: 0, message: "No users scheduled for this window." });
    }

    let sent = 0;
    for (const profile of profiles) {
      // Get email from auth.users
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(profile.id);
      const userEmail = authUser?.email;
      if (!userEmail) continue;
      const { data: deals } = await supabase
        .from("deals").select("*").eq("user_id", profile.id);
      const { data: tiers } = await supabase
        .from("commission_tiers").select("*").eq("user_id", profile.id);

      const todayCron = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const html = buildEmailHtml(profile.full_name || "there", deals || [], tiers || []);
      const pdfBuf = await buildPDF(deals || [], tiers || [], todayCron);
      const dateStrCron = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      await resend.emails.send({
        from:    "Signal Strike <onboarding@resend.dev>",
        to:      userEmail,
        subject: `Daily Signal · ${dateStrCron}`,
        html,
        attachments: [{
          filename: `Daily-Signal-${new Date().toISOString().slice(0,10)}.pdf`,
          content: pdfBuf.toString("base64"),
        }],
      });
      sent++;
    }

    return NextResponse.json({ ok: true, sent });
  } catch (err: any) {
    console.error("Daily Signal error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
