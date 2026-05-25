import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// TODO(security): This route uses the service-role key with a userId taken
// from the request body. A signed-in user could pass any userId. Before public
// launch, swap to the SSR Supabase client and read userId from the session,
// OR add an explicit auth.getUser() check using the user's access token.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  prospecting: "Lead",
  qualified: "Qualified",
  qualification: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Won",
  won: "Won",
  closed_lost: "Lost",
  lost: "Lost",
};

const OPEN_STAGES   = new Set(["lead", "prospecting", "qualified", "qualification", "proposal", "negotiation"]);
const WON_STAGES    = new Set(["closed_won", "won"]);
const LOST_STAGES   = new Set(["closed_lost", "lost"]);

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return d; }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch live context in parallel
    const [
      dealsRes, expRes, goalsRes, tiersRes, profileRes,
      projectsRes, milestonesRes, activitiesRes, correspondenceRes,
      notificationsRes, teamMembersRes,
    ] = await Promise.all([
      supabase.from("deals").select("*").eq("user_id", userId),
      supabase.from("expenses").select("*").eq("user_id", userId),
      supabase.from("goals").select("*").eq("user_id", userId),
      supabase.from("commission_tiers").select("*").eq("user_id", userId),
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("projects").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
      supabase.from("work_order_milestones").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("activities").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
      supabase.from("correspondence").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
      supabase.from("notifications").select("*").eq("user_id", userId).eq("read", false).order("created_at", { ascending: false }).limit(10),
      supabase.from("team_members").select("*, teams(*)").eq("user_id", userId),
    ]);

    const deals          = dealsRes.data          || [];
    const expenses       = expRes.data            || [];
    const goals          = goalsRes.data          || [];
    const tiers          = tiersRes.data          || [];
    const profile        = profileRes.data;
    const projects       = projectsRes.data       || [];
    const allMilestones  = milestonesRes.data     || [];
    const activities     = activitiesRes.data     || [];
    const correspondence = correspondenceRes.data || [];
    const notifications  = notificationsRes.data  || [];
    const teamMemberships = teamMembersRes.data   || [];

    // Filter milestones to only those belonging to this user's projects
    const projectIds = new Set(projects.map(p => p.id));
    const milestones = allMilestones.filter(m => projectIds.has(m.project_id));

    const tiersMap: Record<string, any> = {};
    for (const t of tiers) tiersMap[t.id] = t;

    // Deal aggregations
    const openDeals   = deals.filter(d => OPEN_STAGES.has(d.stage));
    const wonDeals    = deals.filter(d => WON_STAGES.has(d.stage));
    const lostDeals   = deals.filter(d => LOST_STAGES.has(d.stage));
    const pipelineValue = openDeals.reduce((s, d) => s + (d.value || 0), 0);
    const wonRevenue   = wonDeals.reduce((s, d) => s + (d.value || 0), 0);
    const winRate = (wonDeals.length + lostDeals.length) > 0
      ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100)
      : 0;
    const totalComm = deals.reduce((s, d) => {
      const tier = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
      return s + (tier ? (d.value || 0) * (tier.rate / 100) : 0);
    }, 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    // Bucket deals by stage for the prompt
    const byStage: Record<string, any[]> = {};
    for (const d of deals) {
      const label = STAGE_LABELS[d.stage] || d.stage;
      (byStage[label] ||= []).push(d);
    }
    const stageBreakdown = Object.entries(byStage)
      .map(([label, list]) => {
        const sum = list.reduce((s, d) => s + (d.value || 0), 0);
        return `- ${label}: ${list.length} deal${list.length === 1 ? "" : "s"} (${fmt(sum)})`;
      })
      .join("\n");

    // Deal summary — cap at 30 most-recent to control token usage
    const recentDeals = [...deals]
      .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())
      .slice(0, 30);
    const dealSummary = recentDeals.map(d => {
      const tier = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
      const comm = tier ? (d.value || 0) * (tier.rate / 100) : null;
      return [
        `Deal: ${d.title}`,
        `  Company: ${d.company || "N/A"}`,
        `  Contact: ${d.contact_name || "N/A"}${d.contact_email ? " (" + d.contact_email + ")" : ""}`,
        `  Value: ${fmt(d.value || 0)}`,
        `  Stage: ${STAGE_LABELS[d.stage] || d.stage}`,
        `  Probability: ${d.probability || 0}%`,
        comm !== null ? `  Commission: ${fmt(comm)} (${tier.name} ${tier.rate}%)` : "",
        d.expected_close_date ? `  Expected Close: ${fmtDate(d.expected_close_date)}` : "",
        d.next_task ? `  Next Task: ${d.next_task}` : "",
        d.notes ? `  Notes: ${d.notes}` : "",
      ].filter(Boolean).join("\n");
    }).join("\n\n");
    const dealsTruncatedNote = deals.length > recentDeals.length
      ? `\n\n(Showing ${recentDeals.length} most-recently-updated of ${deals.length} total deals.)`
      : "";

    // Project / Jobs summary with milestone progress
    const milestonesByProject: Record<string, any[]> = {};
    for (const m of milestones) (milestonesByProject[m.project_id] ||= []).push(m);

    const projectSummary = projects.slice(0, 20).map(p => {
      const pm = milestonesByProject[p.id] || [];
      const done = pm.filter(m => m.completed || m.status === "completed").length;
      const total = pm.length;
      const pct = total ? Math.round((done / total) * 100) : null;
      return [
        `Job: ${p.name}${p.wo_number ? " (WO #" + p.wo_number + ")" : ""}`,
        `  Status: ${p.status || "—"}`,
        p.service_type ? `  Service: ${p.service_type}` : "",
        p.value ? `  Value: ${fmt(Number(p.value))}` : "",
        p.due_date ? `  Due: ${fmtDate(p.due_date)}` : "",
        total ? `  Milestones: ${done}/${total}${pct !== null ? " (" + pct + "%)" : ""}` : "",
      ].filter(Boolean).join("\n");
    }).join("\n\n");

    // Expense summary — last 30
    const expSummary = expenses.slice(0, 30).map(e =>
      `- ${e.expense_date || e.created_at?.slice(0,10) || "—"} | ${e.merchant || e.vendor || "—"} | ${e.category || "—"} | ${fmt(e.amount || 0)} | ${e.status || "—"}${e.notes ? " | " + e.notes : ""}`
    ).join("\n");

    // Goals + tiers
    const goalSummary = goals.map(g =>
      `- ${g.period_type} goal: ${fmt(g.target_revenue)} (${g.period_start}${g.period_end ? " to " + g.period_end : ""})`
    ).join("\n");
    const tierSummary = tiers.map(t =>
      `- ${t.name}: ${t.rate}% ${t.description ? "(" + t.description + ")" : ""}`
    ).join("\n");

    // Recent activities
    const activitySummary = activities.slice(0, 20).map(a =>
      `- ${fmtDate(a.created_at)} | ${a.type || "activity"} | ${a.description || a.title || "—"}`
    ).join("\n");

    // Recent correspondence
    const corrSummary = correspondence.slice(0, 20).map(c =>
      `- ${fmtDate(c.created_at)} | ${c.direction || "—"} | ${c.subject || c.snippet || "—"}`
    ).join("\n");

    // Unread notifications
    const notifSummary = notifications.map(n =>
      `- ${fmtDate(n.created_at)} | ${n.type} | ${n.title}${n.body ? " — " + n.body : ""}`
    ).join("\n");

    // Team context
    const teamSummary = teamMemberships.length > 0
      ? teamMemberships.map((tm: any) =>
          `- Team: ${tm.teams?.name || tm.team_id} | Role: ${tm.role || "member"}`
        ).join("\n")
      : "Not on any team";

    const systemPrompt = `You are Ask Signal, the AI assistant built into Signal Strike — a revenue CRM for sales professionals, sales managers, and small-business owners running their own pipeline. You have full access to the user's live CRM data and help them understand their pipeline, find deals, analyze performance, manage jobs and milestones, and take action.

Be helpful, concise, and direct. Speak like a sharp sales analyst — data-driven, never hedgy. Use $ formatting for money values. When citing numbers, pull them straight from the live data below.

SIGNAL STRIKE FEATURE MAP (so you can guide the user when they ask "how do I…"):
- Dashboard — overview of pipeline value, won revenue, open deals, win rate, commission tracker, revenue goals, and a daily countdown to the Daily Signal email.
- Leads & Pipeline (at /deals in the URL but called "Leads & Pipeline" in the app) — manage every deal across stages: Lead, Qualified, Proposal, Negotiation, Won, Lost. Supports Import DASH, Import Spreadsheet, Add Lead, and retire/reactivate leads.
- Scout (at /prospects) — AI prospecting. User describes ideal prospect in plain English, Claude sets Apollo filters, results enrich with email/phone and can be added to the pipeline.
- Jobs (at /projects) — work orders with WO numbers, milestone tracking, service type, value, due date, and cash-flow visibility. Status flow: Pending → In Progress → Completed (or On Hold).
- Expenses — track spending by category (Travel, Meals & Entertainment, Marketing, Client Expenses) and status (Pending, Submitted, Approved, Reimbursed). Receipts attached per line.
- Team — if user is a manager, they see team members' rollups. Team Management is an add-on tier.
- Manager dashboard — visibility into reports' pipelines (RLS-controlled).
- Ask Signal — this chat, with live access to all the above data.
- Daily Signal — the morning email briefing with pipeline updates, sent at the user's scheduled time. PDF + Excel attached.
- Notifications — in-app alerts for deals won/advanced, milestones completed, team activity, etc.

USER PROFILE:
Name: ${profile?.full_name || "User"}
Open Deals Goal: ${profile?.open_deals_goal || "Not set"}
Daily Signal: ${profile?.daily_signal_enabled ? "Enabled at " + (profile?.daily_signal_time || "—") : "Disabled"}

TEAM CONTEXT:
${teamSummary}

LIVE PIPELINE METRICS:
Total Deals: ${deals.length}
Open Deals: ${openDeals.length}
Won Deals: ${wonDeals.length}
Lost Deals: ${lostDeals.length}
Pipeline Value (open only): ${fmt(pipelineValue)}
Won Revenue: ${fmt(wonRevenue)}
Win Rate: ${winRate}% (of decided deals)
Total Commission Tracked: ${fmt(totalComm)}

STAGE BREAKDOWN:
${stageBreakdown || "No deals yet"}

JOBS / WORK ORDERS:
Total: ${projects.length} | Open milestones across all jobs: ${milestones.filter(m => !m.completed && m.status !== "completed").length}
${projectSummary || "No jobs yet"}

EXPENSES:
Total Expenses: ${fmt(totalExpenses)} (${expenses.length} entries)

COMMISSION TIERS:
${tierSummary || "None set"}

REVENUE GOALS:
${goalSummary || "None set"}

UNREAD NOTIFICATIONS:
${notifSummary || "None"}

RECENT ACTIVITIES (last 20):
${activitySummary || "None"}

RECENT CORRESPONDENCE (last 20):
${corrSummary || "None"}

DEALS (most-recently-updated, full detail):
${dealSummary || "No deals yet"}${dealsTruncatedNote}

RECENT EXPENSES (up to 30):
${expSummary || "No expenses yet"}

When asked to find or filter data, search the lists above. When asked for analysis, be specific with numbers. When the user asks how to do something in Signal Strike, refer to the feature map above and point them to the right page.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
    });

    const text = response.content.find(b => b.type === "text")?.text || "";
    return NextResponse.json({ reply: text });
  } catch (err: any) {
    console.error("Ask Signal error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
