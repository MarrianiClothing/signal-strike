import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
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


async function buildPDF(deals: any[], tiers: any[], today: string): Promise<Buffer> {
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  const tiersMap: Record<string, any> = {};
  for (const t of tiers) tiersMap[t.id] = t;
  const activeDeals = deals.filter(d => d.stage !== "closed_lost");
  const totalValue  = activeDeals.reduce((s, d) => s + (d.value || 0), 0);
  const totalComm   = activeDeals.reduce((s, d) => {
    const tier = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
    return s + (tier ? (d.value || 0) * (tier.rate / 100) : 0);
  }, 0);

  const STAGE_LABELS: Record<string, string> = {
    prospecting: "Prospecting", qualification: "Qualified",
    proposal: "Proposal", negotiation: "Negotiation",
    closed_won: "Won", closed_lost: "Lost",
  };
  // rgb values 0-1
  const STAGE_RGB: Record<string, [number,number,number]> = {
    prospecting:   [0.44, 0.44, 0.48],
    qualification: [0.38, 0.64, 0.98],
    proposal:      [0.65, 0.54, 0.98],
    negotiation:   [0.98, 0.75, 0.14],
    closed_won:    [0.79, 0.66, 0.30],
    closed_lost:   [0.97, 0.53, 0.44],
  };

  const doc = await PDFDocument.create();

  // Embed standard fonts
  const fontBold   = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg    = await doc.embedFont(StandardFonts.Helvetica);

  // Color helpers
  const GOLD  = rgb(0.79, 0.66, 0.30);
  const GREEN = rgb(0.20, 0.83, 0.60);
  const WHITE = rgb(0.98, 0.98, 0.98);
  const MUTED = rgb(0.44, 0.44, 0.48);
  const DARK  = rgb(0.07, 0.07, 0.08);
  const CARD  = rgb(0.10, 0.10, 0.11);
  const BORDER = rgb(0.15, 0.15, 0.16);
  const BG    = rgb(0.035, 0.035, 0.04);

  const PW = 612; // Letter width
  const PH = 792; // Letter height
  const M  = 50;  // Margin

  // ── helpers ────────────────────────────────────────────────────────────────
  const clampText = (text: string, font: any, size: number, maxW: number): string => {
    let t = text;
    while (t.length > 0 && font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -1);
    return t.length < text.length ? t.slice(0, -1) + "…" : t;
  };

  let page = doc.addPage([PW, PH]);
  let y = PH; // top of page, we draw downward (pdf-lib Y is from bottom)

  const newPage = () => {
    page = doc.addPage([PW, PH]);
    y = PH;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < 40) newPage();
  };

  // Draw filled rect (coords: top-left x,y, w, h — converted to pdf-lib bottom-left)
  const fillRect = (x: number, ty: number, w: number, h: number, color: any) => {
    page.drawRectangle({ x, y: PH - ty - h, width: w, height: h, color });
  };

  const strokeRect = (x: number, ty: number, w: number, h: number, color: any) => {
    page.drawRectangle({ x, y: PH - ty - h, width: w, height: h, borderColor: color, borderWidth: 0.5, opacity: 0 });
  };

  const drawText = (text: string, x: number, ty: number, opts: any = {}) => {
    page.drawText(text, {
      x, y: PH - ty - (opts.size || 10),
      font: opts.bold ? fontBold : fontReg,
      size: opts.size || 10,
      color: opts.color || WHITE,
      ...opts,
    });
  };

  const hline = (ty: number, x1 = M, x2 = PW - M) => {
    page.drawLine({ start: { x: x1, y: PH - ty }, end: { x: x2, y: PH - ty }, thickness: 0.5, color: BORDER });
  };

  // ── HEADER ─────────────────────────────────────────────────────────────────
  fillRect(0, 0, PW, 82, DARK);
  drawText("SIGNAL STRIKE  -  REVENUE CRM", M, 16, { font: fontBold, size: 9, color: GOLD, bold: true });
  drawText("Daily Signal", M, 30, { font: fontBold, size: 26, color: WHITE, bold: true });
  drawText(today, M, 62, { font: fontReg, size: 11, color: MUTED });
  y = 90;

  // ── SUMMARY STATS ──────────────────────────────────────────────────────────
  const statW = (PW - M * 2) / 3;
  const statData = [
    { label: "ACTIVE DEALS",    value: String(activeDeals.length), color: WHITE },
    { label: "PIPELINE VALUE",  value: fmt(totalValue),             color: GOLD  },
    { label: "TOTAL COMMISSION",value: fmt(totalComm),              color: GREEN },
  ];
  const statH = 58;
  statData.forEach((st, i) => {
    const sx = M + i * statW;
    fillRect(sx, y, statW, statH, CARD);
    strokeRect(sx, y, statW, statH, BORDER);
    // label
    const lx = sx + statW / 2 - fontBold.widthOfTextAtSize(st.label, 7.5) / 2;
    drawText(st.label, lx, y + 12, { font: fontBold, size: 7.5, color: MUTED, bold: true });
    // value
    const valSize = 20;
    const vx = sx + statW / 2 - (st.color === WHITE ? fontBold : fontBold).widthOfTextAtSize(st.value, valSize) / 2;
    drawText(st.value, vx, y + 26, { font: fontBold, size: valSize, color: st.color, bold: true });
  });
  y += statH + 18;

  // ── SECTION LABEL ──────────────────────────────────────────────────────────
  drawText("YOUR DEALS", M, y, { font: fontBold, size: 8, color: MUTED, bold: true });
  y += 12;
  hline(y);
  y += 10;

  // ── DEAL CARDS ─────────────────────────────────────────────────────────────
  for (const d of activeDeals) {
    const tier       = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
    const commission = tier ? (d.value || 0) * (tier.rate / 100) : null;
    const stageRgb   = STAGE_RGB[d.stage] || [0.44, 0.44, 0.48];
    const stageColor = rgb(stageRgb[0], stageRgb[1], stageRgb[2]);
    const stageLabel = (STAGE_LABELS[d.stage] || d.stage).toUpperCase();
    const closeDate  = d.expected_close_date
      ? new Date(d.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null;

    const cardH = 104 + (d.next_task ? 38 : 0);
    ensureSpace(cardH + 14);

    const cW = PW - M * 2;

    // Card bg + border
    fillRect(M, y, cW, cardH, CARD);
    strokeRect(M, y, cW, cardH, BORDER);
    // Stage bar
    fillRect(M, y, 5, cardH, stageColor);

    // Title
    const titleText = clampText(d.title || "", fontBold, 13, 280);
    drawText(titleText, M + 12, y + 12, { font: fontBold, size: 13, color: WHITE, bold: true });

    // Company
    const compText = clampText(d.company || "", fontReg, 9, 280);
    drawText(compText, M + 12, y + 28, { font: fontReg, size: 9, color: MUTED });

    // Value (right)
    const valStr = fmt(d.value || 0);
    const valW = fontBold.widthOfTextAtSize(valStr, 15);
    drawText(valStr, M + cW - valW - 10, y + 12, { font: fontBold, size: 15, color: GOLD, bold: true });

    // Stage badge
    const badgeW = fontBold.widthOfTextAtSize(stageLabel, 8);
    drawText(stageLabel, M + cW - badgeW - 10, y + 32, { font: fontBold, size: 8, color: stageColor, bold: true });

    // Divider
    hline(y + 50, M + 5, M + cW - 5);

    // Details
    let detY = y + 57;
    if (d.contact_name) {
      const ct = clampText(d.contact_name + (d.contact_email ? "  " + d.contact_email : ""), fontReg, 9, cW - 160);
      drawText(ct, M + 12, detY, { font: fontReg, size: 9, color: rgb(0.63, 0.63, 0.67) });
      detY += 13;
    }
    if (closeDate) {
      drawText("Close: " + closeDate, M + 12, detY, { font: fontReg, size: 9, color: MUTED });
    }

    // Commission (right)
    if (commission !== null) {
      const commStr = fmt(commission);
      const commW = fontBold.widthOfTextAtSize(commStr, 14);
      drawText("COMMISSION", M + cW - 120, y + 52, { font: fontBold, size: 7.5, color: MUTED, bold: true });
      drawText(commStr, M + cW - commW - 10, y + 63, { font: fontBold, size: 14, color: GREEN, bold: true });
      const tierLabel = tier.name + "  " + tier.rate + "%";
      const tierW = fontReg.widthOfTextAtSize(tierLabel, 8);
      drawText(tierLabel, M + cW - tierW - 10, y + 80, { font: fontReg, size: 8, color: MUTED });
    }

    // Next task
    if (d.next_task) {
      const taskY = y + cardH - 36;
      fillRect(M + 5, taskY - 6, cW - 10, 34, rgb(0.09, 0.08, 0.055));
      drawText(">> NEXT TASK", M + 12, taskY, { font: fontBold, size: 8, color: GOLD, bold: true });
      const taskText = clampText(d.next_task, fontReg, 10, cW - 30);
      drawText(taskText, M + 12, taskY + 14, { font: fontReg, size: 10, color: WHITE });
    }

    y += cardH + 12;
  }

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  ensureSpace(30);
  hline(y + 8);
  const footerText = "Signal Strike  ·  Revenue CRM  ·  Powered by Hilltop Ave";
  const footerW = fontReg.widthOfTextAtSize(footerText, 8);
  drawText(footerText, PW / 2 - footerW / 2, y + 16, { font: fontReg, size: 8, color: MUTED });

  const bytes = await doc.save();
  return Buffer.from(bytes);
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
