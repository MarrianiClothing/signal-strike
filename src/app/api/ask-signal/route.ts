import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecting", qualification: "Qualified",
  proposal: "Proposal", negotiation: "Negotiation",
  closed_won: "Won", closed_lost: "Lost",
};

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}

export async function POST(req: NextRequest) {
  try {
    const { messages, userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch live context
    const [dealsRes, expRes, goalsRes, tiersRes, profileRes] = await Promise.all([
      supabase.from("deals").select("*").eq("user_id", userId),
      supabase.from("expenses").select("*").eq("user_id", userId),
      supabase.from("goals").select("*").eq("user_id", userId),
      supabase.from("commission_tiers").select("*").eq("user_id", userId),
      supabase.from("profiles").select("*").eq("id", userId).single(),
    ]);

    const deals    = dealsRes.data || [];
    const expenses = expRes.data || [];
    const goals    = goalsRes.data || [];
    const tiers    = tiersRes.data || [];
    const profile  = profileRes.data;

    const tiersMap: Record<string, any> = {};
    for (const t of tiers) tiersMap[t.id] = t;

    const activeDeals  = deals.filter(d => d.stage !== "closed_lost");
    const wonDeals     = deals.filter(d => d.stage === "closed_won");
    const totalPipeline = activeDeals.reduce((s, d) => s + (d.value || 0), 0);
    const wonRevenue   = wonDeals.reduce((s, d) => s + (d.value || 0), 0);
    const totalComm    = deals.reduce((s, d) => {
      const tier = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
      return s + (tier ? (d.value || 0) * (tier.rate / 100) : 0);
    }, 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    const dealSummary = deals.map(d => {
      const tier = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
      const comm = tier ? (d.value || 0) * (tier.rate / 100) : null;
      return [
        `Deal: ${d.title}`,
        `  Company: ${d.company || "N/A"}`,
        `  Contact: ${d.contact_name || "N/A"} ${d.contact_email ? "(" + d.contact_email + ")" : ""}`,
        `  Value: ${fmt(d.value || 0)}`,
        `  Stage: ${STAGE_LABELS[d.stage] || d.stage}`,
        `  Probability: ${d.probability || 0}%`,
        comm !== null ? `  Commission: ${fmt(comm)} (${tier.name} ${tier.rate}%)` : "",
        d.expected_close_date ? `  Expected Close: ${d.expected_close_date}` : "",
        d.next_task ? `  Next Task: ${d.next_task}` : "",
        d.notes ? `  Notes: ${d.notes}` : "",
      ].filter(Boolean).join("\n");
    }).join("\n\n");

    const expSummary = expenses.slice(0, 30).map(e =>
      `- ${e.expense_date} | ${e.merchant} | ${e.category} | $${e.amount} | ${e.status}${e.notes ? " | " + e.notes : ""}`
    ).join("\n");

    const goalSummary = goals.map(g =>
      `- ${g.period_type} goal: ${fmt(g.target_revenue)} (${g.period_start}${g.period_end ? " to " + g.period_end : ""})`
    ).join("\n");

    const tierSummary = tiers.map(t =>
      `- ${t.name}: ${t.rate}% ${t.description ? "(" + t.description + ")" : ""}`
    ).join("\n");

    const systemPrompt = `You are Ask Signal, an intelligent AI assistant built into Signal Strike — a personal revenue CRM for sales professionals. You have full access to the user's live CRM data and help them understand their pipeline, find deals, analyze performance, and take action.

You are helpful, concise, and professional. You speak like a sharp sales analyst — direct, insightful, and data-driven. Use $ formatting for money values.

USER PROFILE:
Name: ${profile?.full_name || "User"}
Open Deals Goal: ${profile?.open_deals_goal || "Not set"}

LIVE CRM DATA (as of right now):
Total Deals: ${deals.length}
Active Deals: ${activeDeals.length}
Won Deals: ${wonDeals.length}
Pipeline Value: ${fmt(totalPipeline)}
Won Revenue: ${fmt(wonRevenue)}
Win Rate: ${deals.length ? Math.round((wonDeals.length / deals.length) * 100) : 0}%
Total Commission Tracked: ${fmt(totalComm)}
Total Expenses: ${fmt(totalExpenses)}

COMMISSION TIERS:
${tierSummary || "None set"}

REVENUE GOALS:
${goalSummary || "None set"}

DEALS:
${dealSummary || "No deals yet"}

RECENT EXPENSES (up to 30):
${expSummary || "No expenses yet"}

Answer questions about this data naturally and helpfully. If asked to find a deal, search through the data above. If asked for analysis, be specific with numbers. If asked how to use Signal Strike, explain the features: Dashboard, Pipeline (add/manage deals), Deals (view all), Expenses (track spending), Settings (goals, commission tiers, Daily Signal email), and Ask Signal (this chat).`;

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
