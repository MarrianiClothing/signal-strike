"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DailySignalCountdown from "@/components/DailySignalCountdown";
import DailyQuote from "@/components/DailyQuote";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}


function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}

const STAGE_COLORS: Record<string, string> = {
  prospecting: "#71717a", qualification: "#34d399", proposal: "#a78bfa",
  negotiation: "#fbbf24", closed_won: "#C9A84C", closed_lost: "#f87171",
};
const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecting", qualification: "Qualified", proposal: "Proposal",
  negotiation: "Negotiation", closed_won: "Won", closed_lost: "Lost",
};

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [deals, setDeals] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDealsGoal, setOpenDealsGoal] = useState<number | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserName(user.user_metadata?.full_name?.split(" ")[0] || "");
      setUserId(user.id);

      const [dealsRes, goalRes, tiersRes] = await Promise.all([
        supabase.from("deals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("goals").select("*").eq("user_id", user.id).order("period_start", { ascending: false }),
        supabase.from("commission_tiers").select("*").eq("user_id", user.id),
      ]);

      const tiersMap: Record<string,any> = {};
      for (const t of (tiersRes.data || [])) tiersMap[t.id] = t;
      const dealsWithTiers = (dealsRes.data || []).map((d:any) => ({
        ...d,
        commission_tiers: d.commission_tier_id ? tiersMap[d.commission_tier_id] || null : null
      }));
      setDeals(dealsWithTiers);
      setGoals(goalRes.data || []);

      const { data: profileData } = await supabase.from("profiles").select("open_deals_goal").eq("id", user.id).maybeSingle();
      if (profileData?.open_deals_goal) setOpenDealsGoal(profileData.open_deals_goal);
      setLoading(false);
    }
    load();
  }, []);

  const totalPipeline = deals.filter(d => !["closed_won","closed_lost"].includes(d.stage))
    .reduce((s, d) => s + (d.value || 0), 0);
  const wonRevenue = deals.filter(d => d.stage === "closed_won")
    .reduce((s, d) => s + (d.value || 0), 0);
  const openDeals = deals.filter(d => !["closed_won","closed_lost"].includes(d.stage)).length;

  const card: React.CSSProperties = {
    background: "#111113", border: "1px solid #27272a", borderRadius: 12, padding: 24,
  };

  if (loading) return <div style={{ padding: 32, color: "#71717a" }}>Loading...</div>;

  const tieredDeals = deals.filter((d: any) => d.commission_tiers);
  const totalCommission = tieredDeals.reduce((sum: number, d: any) => sum + (d.value || 0) * (d.commission_tiers.rate / 100), 0);

  return (
    <div style={{ padding: isMobile ? "16px 0" : 32, maxWidth: isMobile ? "100%" : 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 20 : 32, display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "center" : "flex-start", gap: isMobile ? 12 : 0, margin: isMobile ? "0 16px" : 0 }}>
        <div style={{ flexShrink: 0 }}>
          <h1 style={{ fontSize: isMobile ? "1.4rem" : "1.6rem", fontWeight: 800, color: "#fafafa", textAlign: isMobile ? "center" : "left", margin: 0 }}>
            {userName ? `Welcome back, ${userName} ` : "Dashboard"}
          </h1>
          <p style={{ color: "#71717a", fontSize: "0.85rem", marginTop: 4, textAlign: isMobile ? "center" : "left" }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <DailyQuote />
        {userId && <DailySignalCountdown userId={userId} />}
      </div>


      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: isMobile ? 10 : 16, marginBottom: 24, margin: isMobile ? "0 16px" : 0 }}>
        {[
          { label: "Pipeline Value", value: fmt(totalPipeline), sub: `${openDeals} open deals`, color: "#34d399" },
          { label: "Won Revenue", value: fmt(wonRevenue), sub: `${deals.filter(d => d.stage === "closed_won").length} deals closed`, color: "#C9A84C" },
          { label: "Open Deals", value: openDeals.toString(), sub: "active opportunities", color: (() => {
            if (!openDealsGoal) return "#a78bfa";
            if (openDeals >= openDealsGoal) return "#C9A84C";
            if (openDeals >= openDealsGoal * 0.5) return "#34d399";
            return "#f87171";
          })() },
          { label: "Win Rate", value: deals.length ? Math.round((deals.filter(d => d.stage === "closed_won").length / deals.length) * 100) + "%" : "0%", sub: `${deals.length} total deals`, color: "#34d399" },
        ].map(stat => (
          <div key={stat.label} style={card}>
            <p style={{ color: "#fafafa", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{stat.label}</p>
            <p style={{ fontSize: "1.75rem", fontWeight: 800, color: stat.color, fontFamily: "var(--font-cinzel, serif)" }}>{stat.value}</p>
            <p style={{ color: "#52525b", fontSize: "0.75rem", marginTop: 4 }}>{stat.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px", gap: 20, margin: isMobile ? "0 16px" : 0 }}>
        {/* Commission Tracker */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.95rem", margin: 0 }}>Commission Tracker</h2>
            <span style={{ color: "#52525b", fontSize: "0.75rem" }}>{tieredDeals.length} deals tracked</span>
          </div>

          {tieredDeals.length === 0 ? (
            <p style={{ color: "#52525b", fontSize: "0.85rem" }}>No deals with commission tiers yet. Assign a tier when creating or editing a deal.</p>
          ) : (
            <>
              {/* Total summary bar */}
              <div style={{ background: "#18181b", borderRadius: 10, padding: "12px 16px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#a1a1aa", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Commission</span>
                <span style={{ color: "#34d399", fontWeight: 800, fontSize: "1.25rem", fontFamily: "monospace" }}>{fmt(totalCommission)}</span>
              </div>
              {/* Deal rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tieredDeals.map((d: any) => {
                  const commission = (d.value || 0) * (d.commission_tiers.rate / 100);
                  const stageColor = STAGE_COLORS[d.stage] || "#71717a";
                  return (
                    <div key={d.id} onClick={() => router.push("/deals/" + d.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "#18181b", borderRadius: 8, borderLeft: `3px solid ${stageColor}`, cursor: "pointer" }} onMouseEnter={e => (e.currentTarget.style.background = "#222225")} onMouseLeave={e => (e.currentTarget.style.background = "#18181b")}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: "#fafafa", fontWeight: 600, fontSize: "0.88rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</p>
                        <p style={{ color: "#71717a", fontSize: "0.75rem", marginTop: 2 }}>{d.company || "—"}</p>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ color: "#34d399", fontWeight: 700, fontSize: "0.95rem", fontFamily: "monospace" }}>{fmt(commission)}</p>
                        <p style={{ color: "#52525b", fontSize: "0.7rem", marginTop: 1 }}>{d.commission_tiers.name} · {d.commission_tiers.rate}%</p>
                      </div>
                      <span style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: 5, background: stageColor + "22", color: stageColor, fontWeight: 600, flexShrink: 0 }}>
                        {STAGE_LABELS[d.stage] || d.stage}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Revenue Goals */}
          <div style={card}>
            <h2 style={{ color: "#fafafa", fontWeight: 700, marginBottom: 16, fontSize: "0.95rem" }}>Revenue Goals</h2>
            {goals.length === 0 ? (
              <p style={{ color: "#52525b", fontSize: "0.82rem" }}>No goals set. Add one in Settings.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {goals.map((g: any) => {
                  const pct = Math.min(100, Math.round((wonRevenue / g.target_revenue) * 100));
                  const barColor = pct >= 100 ? "#C9A84C" : pct >= 50 ? "#4ade80" : "#f87171";
                  const label = g.period_type === "monthly"
                    ? new Date(g.period_start + "T00:00:00").toLocaleString("en-US", { month: "long", year: "numeric" })
                    : g.period_type === "quarterly"
                    ? `Q${Math.ceil((new Date(g.period_start + "T00:00:00").getMonth() + 1) / 3)} ${new Date(g.period_start + "T00:00:00").getFullYear()}`
                    : (g.period_type === "multi_year" || g.period_type === "multi-year")
                    ? `${new Date(g.period_start + "T00:00:00").getFullYear()}–${new Date(g.period_end + "T00:00:00").getFullYear()} Multi-Year`
                    : `${new Date(g.period_start + "T00:00:00").getFullYear()} Annual`;
                  return (
                    <div key={g.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ color: "#a1a1aa", fontSize: "0.78rem" }}>{label}</span>
                        <span style={{ color: "#fafafa", fontSize: "0.78rem", fontWeight: 600 }}>{fmt(g.target_revenue)}</span>
                      </div>
                      <div style={{ background: "#1c1c1f", borderRadius: 6, height: 7, overflow: "hidden", marginBottom: 5 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 6, transition: "width 0.5s" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: barColor, fontSize: "0.75rem", fontWeight: 600 }}>{fmt(wonRevenue)} earned</span>
                        <span style={{ color: "#71717a", fontSize: "0.75rem" }}>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pipeline by Stage */}
          <div style={card}>
            <h2 style={{ color: "#fafafa", fontWeight: 700, marginBottom: 16, fontSize: "0.95rem" }}>Pipeline by Stage</h2>
            {Object.entries(STAGE_LABELS).map(([stage, label]) => {
              const stageDeals = deals.filter(d => d.stage === stage);
              const stageVal = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
              if (stageDeals.length === 0) return null;
              return (
                <div key={stage} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: STAGE_COLORS[stage] }} />
                    <span style={{ color: "#a1a1aa", fontSize: "0.82rem" }}>{label}</span>
                    <span style={{ color: "#52525b", fontSize: "0.72rem" }}>({stageDeals.length})</span>
                  </div>
                  <span style={{ color: "#fafafa", fontSize: "0.82rem", fontWeight: 600 }}>{fmt(stageVal)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
