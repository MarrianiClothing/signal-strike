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

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const dealRows = activeDeals.map(d => {
    const tier       = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
    const commission = tier ? (d.value || 0) * (tier.rate / 100) : null;
    const stageColor = STAGE_COLORS[d.stage] || "#71717a";
    const stageLabel = STAGE_LABELS[d.stage] || d.stage;

    return `
      <div style="background:#18181b;border:1px solid #27272a;border-radius:10px;padding:18px 20px;margin-bottom:12px;border-left:4px solid ${stageColor};">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <div>
            <p style="color:#fafafa;font-size:1rem;font-weight:700;margin:0 0 2px 0;">${d.title}</p>
            <p style="color:#71717a;font-size:0.82rem;margin:0;">${d.company || "—"}</p>
          </div>
          <div style="text-align:right;">
            <p style="color:#C9A84C;font-size:1.1rem;font-weight:800;font-family:monospace;margin:0;">${fmt(d.value || 0)}</p>
            <span style="font-size:0.72rem;padding:2px 8px;border-radius:4px;background:${stageColor}22;color:${stageColor};font-weight:600;">${stageLabel}</span>
          </div>
        </div>
        ${commission !== null ? `
        <div style="background:#111113;border-radius:6px;padding:8px 12px;margin-bottom:10px;display:inline-block;">
          <span style="color:#71717a;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;">Commission · </span>
          <span style="color:#34d399;font-weight:700;font-family:monospace;">${fmt(commission)}</span>
          <span style="color:#52525b;font-size:0.7rem;"> (${tier.name} ${tier.rate}%)</span>
        </div>` : ""}
        ${d.contact_name ? `<p style="color:#a1a1aa;font-size:0.8rem;margin:6px 0 0 0;">👤 ${d.contact_name}${d.contact_email ? ` · ${d.contact_email}` : ""}</p>` : ""}
        ${d.expected_close_date ? `<p style="color:#a1a1aa;font-size:0.8rem;margin:4px 0 0 0;">📅 Close: ${new Date(d.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>` : ""}
        ${d.next_task ? `
        <div style="background:#1c1c1f;border:1px solid #C9A84C44;border-radius:6px;padding:9px 12px;margin-top:10px;">
          <span style="color:#C9A84C;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">⚡ Next Task</span>
          <p style="color:#fafafa;font-size:0.88rem;margin:4px 0 0 0;">${d.next_task}</p>
        </div>` : `
        <div style="margin-top:10px;">
          <span style="color:#3f3f46;font-size:0.78rem;font-style:italic;">No next task assigned</span>
        </div>`}
        ${d.notes ? `<p style="color:#71717a;font-size:0.78rem;margin:8px 0 0 0;font-style:italic;">${d.notes}</p>` : ""}
      </div>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <p style="color:#C9A84C;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 6px 0;">SIGNAL STRIKE</p>
      <h1 style="color:#fafafa;font-size:1.8rem;font-weight:800;margin:0 0 4px 0;">Daily Signal</h1>
      <p style="color:#52525b;font-size:0.85rem;margin:0;">${today}</p>
    </div>

    <!-- Summary bar -->
    <div style="background:#111113;border:1px solid #27272a;border-radius:12px;padding:16px 20px;margin-bottom:28px;display:flex;justify-content:space-between;">
      <div style="text-align:center;flex:1;">
        <p style="color:#71717a;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 4px 0;">Active Deals</p>
        <p style="color:#fafafa;font-size:1.4rem;font-weight:800;margin:0;">${activeDeals.length}</p>
      </div>
      <div style="width:1px;background:#27272a;"></div>
      <div style="text-align:center;flex:1;">
        <p style="color:#71717a;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 4px 0;">Pipeline Value</p>
        <p style="color:#C9A84C;font-size:1.4rem;font-weight:800;font-family:monospace;margin:0;">${fmt(totalValue)}</p>
      </div>
      <div style="width:1px;background:#27272a;"></div>
      <div style="text-align:center;flex:1;">
        <p style="color:#71717a;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 4px 0;">Tasks Pending</p>
        <p style="color:#fafafa;font-size:1.4rem;font-weight:800;margin:0;">${activeDeals.filter(d => d.next_task).length}</p>
      </div>
    </div>

    <!-- Deal cards -->
    <h2 style="color:#fafafa;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 14px 0;">Your Deals</h2>
    ${activeDeals.length === 0
      ? `<p style="color:#52525b;font-size:0.9rem;">No active deals right now.</p>`
      : dealRows
    }

    <!-- Footer -->
    <div style="text-align:center;margin-top:36px;padding-top:20px;border-top:1px solid #18181b;">
      <p style="color:#3f3f46;font-size:0.75rem;margin:0;">Signal Strike · Revenue CRM · Powered by Hilltop Ave</p>
      <p style="color:#3f3f46;font-size:0.72rem;margin:6px 0 0 0;">Manage your Daily Signal settings in Signal Strike → Settings</p>
    </div>

  </div>
</body>
</html>
  `;
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
