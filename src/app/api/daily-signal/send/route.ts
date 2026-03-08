import { NextRequest, NextResponse } from "next/server";
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

      const html = buildEmailHtml(profile.full_name || "there", deals || [], tiers || []);
      await resend.emails.send({
        from:    "Signal Strike <onboarding@resend.dev>",
        to:      email,
        subject: `Daily Signal · ${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`,
        html,
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

      const html = buildEmailHtml(profile.full_name || "there", deals || [], tiers || []);
      await resend.emails.send({
        from:    "Signal Strike <onboarding@resend.dev>",
        to:      userEmail,
        subject: `Daily Signal · ${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`,
        html,
      });
      sent++;
    }

    return NextResponse.json({ ok: true, sent });
  } catch (err: any) {
    console.error("Daily Signal error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
