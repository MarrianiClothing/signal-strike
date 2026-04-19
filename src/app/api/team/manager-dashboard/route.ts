import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const manager_id = searchParams.get("manager_id");
    if (!manager_id) return NextResponse.json({ error: "Missing manager_id" }, { status: 400 });

    // Get all direct reports
    const { data: reports } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("manager_id", manager_id);

    if (!reports || reports.length === 0) {
      return NextResponse.json({ reports: [], totals: { pipeline: 0, won: 0, open_deals: 0, total_deals: 0 } });
    }

    // For each report, load their deals + projects in parallel
    const enriched = await Promise.all(reports.map(async (r: any) => {
      const [{ data: deals }, { data: projects }] = await Promise.all([
        admin.from("deals").select("id,title,value,stage,company,updated_at").eq("user_id", r.id),
        admin.from("projects").select("id,name,status").eq("user_id", r.id),
      ]);

      const dealList  = deals || [];
      const open      = dealList.filter((d: any) => !["closed_won","closed_lost"].includes(d.stage));
      const won       = dealList.filter((d: any) => d.stage === "closed_won");
      const pipeline  = open.reduce((s: number, d: any) => s + (d.value || 0), 0);
      const wonRev    = won.reduce((s: number, d: any) => s + (d.value || 0), 0);

      return {
        user_id:     r.id,
        full_name:   r.full_name ?? "Unnamed",
        email:       r.email ?? "",
        open_deals:  open.length,
        total_deals: dealList.length,
        pipeline,
        won_revenue: wonRev,
        projects:    (projects || []).length,
        recent_deals: dealList
          .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 3),
      };
    }));

    // Team totals
    const totals = enriched.reduce((acc, r) => ({
      pipeline:    acc.pipeline + r.pipeline,
      won:         acc.won + r.won_revenue,
      open_deals:  acc.open_deals + r.open_deals,
      total_deals: acc.total_deals + r.total_deals,
    }), { pipeline: 0, won: 0, open_deals: 0, total_deals: 0 });

    return NextResponse.json({ reports: enriched, totals });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
