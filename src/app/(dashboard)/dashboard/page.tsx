"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCache, setCache } from "@/lib/cache";
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

function fmt(n: number | null | undefined) {
  if (!n || isNaN(n)) return "$0";
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
  const { userId: authUserId, fullName: authFullName, ready: authReady } = useAuth();
  const [userName, setUserName] = useState(() => authFullName?.split(" ")[0] || "");
  const [userId, setUserId] = useState(authUserId);
  const [deals, setDeals] = useState<any[]>(() => getCache<any[]>("deals") ?? []);
  const [goals, setGoals] = useState<any[]>(() => getCache<any[]>("goals") ?? []);
  const [loading, setLoading] = useState(!getCache<any[]>("deals"));
  const [openDealsGoal, setOpenDealsGoal] = useState<number | null>(() => getCache<number>("open_deals_goal") ?? null);
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // Sync userId from auth context when ready
  useEffect(() => {
    if (authReady && authUserId) {
      setUserId(authUserId);
      setUserName(authFullName?.split(" ")[0] || "");
    }
  }, [authReady, authUserId, authFullName]);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const uid = session.user.id;
      setUserId(uid);

      const [dealsRes, goalRes, tiersRes, profileRes] = await Promise.all([
        supabase.from("deals").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("goals").select("*").eq("user_id", uid).order("period_start", { ascending: false }),
        supabase.from("commission_tiers").select("*").eq("user_id", uid),
        supabase.from("profiles").select("open_deals_goal").eq("id", uid).maybeSingle(),
      ]);

      const tiersMap: Record<string,any> = {};
      for (const t of (tiersRes.data || [])) tiersMap[t.id] = t;
      const dealsWithTiers = (dealsRes.data || []).map((d:any) => ({
        ...d,
        commission_tiers: d.commission_tier_id ? tiersMap[d.commission_tier_id] || null : null
      }));
      setDeals(dealsWithTiers);
      setCache("deals", dealsWithTiers);

      const freshGoals = goalRes.data || [];
      setGoals(freshGoals);
      setCache("goals", freshGoals);

      if (profileRes.data?.open_deals_goal) {
        setOpenDealsGoal(profileRes.data.open_deals_goal);
        setCache("open_deals_goal", profileRes.data.open_deals_goal);
      }
      setLoading(false);
    }
    load();
  }, []);

  const totalPipeline = deals.filter(d => !["closed_won","closed_lost"].includes(d.stage)).reduce((s, d) => s + (d.value || 0), 0);
  const wonRevenue = deals.filter(d => d.stage === "closed_won").reduce((s, d) => s + (d.value || 0), 0);
  const openDeals = deals.filter(d => !["closed_won","closed_lost"].includes(d.stage)).length;
  const tieredDeals = deals.filter((d: any) => d.commission_tiers);
  const totalCommission = tieredDeals.reduce((sum: number, d: any) => sum + (d.value || 0) * (d.commission_tiers.rate / 100), 0);

  const card: React.CSSProperties = {
    background: "#111113", border: "1px solid #27272a", borderRadius: 12, padding: 18,
  };

  if (loading) return <div style={{ padding: 32, color: "#71717a" }}>Loading...</div>;

  const openDealsColor = !openDealsGoal ? "#a78bfa" : openDeals >= openDealsGoal ? "#C9A84C" : openDeals >= openDealsGoal * 0.5 ? "#34d399" : "#f87171";

  const searchResults = search.trim().length < 1 ? [] : deals.filter(d => {
    const q = search.toLowerCase();
    return (
      d.title?.toLowerCase().includes(q) ||
      d.company?.toLowerCase().includes(q) ||
      d.contact_name?.toLowerCase().includes(q) ||
      d.contact_email?.toLowerCase().includes(q) ||
      d.contact_phone?.toLowerCase().includes(q) ||
      (STAGE_LABELS[d.stage] || "").toLowerCase().includes(q) ||
      String(d.value || "").includes(q) ||
      d.notes?.toLowerCase().includes(q)
    );
  }).slice(0, 8);

  const GoalsList = () => (
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
  );

  const StageList = () => (
    <>
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
    </>
  );

  return (
    <div style={{ padding: isMobile ? "0 16px 24px" : "20px 20px 32px", boxSizing: "border-box", width: "100%", minWidth: 0 }}>

      {/* Header */}
      <div style={{ marginBottom: isMobile ? 16 : 20, display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "center" : "stretch", gap: isMobile ? 12 : 0 }}>
        <div style={{ flexShrink: 0 }}>
          <h1 style={{ fontSize: isMobile ? "1.4rem" : "1.6rem", fontWeight: 800, color: "#fafafa", textAlign: isMobile ? "center" : "left", margin: 0 }}>
            {userName ? `Welcome back, ${userName}` : "Dashboard"}
          </h1>
          <p style={{ color: "#71717a", fontSize: "0.85rem", marginTop: 4, marginBottom: 10, textAlign: isMobile ? "center" : "left" }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
          {/* Signal Search */}
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C9A84C" }}>⚡ Signal Search</span>
          </div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#52525b", fontSize: "0.85rem", pointerEvents: "none" }}>🔍</span>
            <input
              type="text"
              placeholder="Signal Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#18181b", border: `1px solid ${searchFocused ? "#C9A84C" : "#27272a"}`,
                borderRadius: 8, padding: "8px 30px 8px 32px",
                color: "#fafafa", fontSize: "0.82rem", outline: "none",
                transition: "border-color 0.2s",
              }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#52525b", cursor: "pointer", fontSize: "1rem", padding: 0, lineHeight: 1 }}>×</button>
            )}
            {/* Results dropdown */}
            {searchFocused && search.trim().length >= 1 && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100, background: "#111113", border: "1px solid #27272a", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", minWidth: 340 }}>
                {searchResults.length === 0 ? (
                  <div style={{ padding: "14px 16px", color: "#52525b", fontSize: "0.82rem" }}>No deals match "{search}"</div>
                ) : (
                  <>
                    <div style={{ padding: "7px 14px 5px", borderBottom: "1px solid #1c1c1f" }}>
                      <span style={{ color: "#52525b", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{searchResults.length} result{searchResults.length !== 1 ? "s" : ""}</span>
                    </div>
                    {searchResults.map(d => {
                      const stageColor = STAGE_COLORS[d.stage] || "#71717a";
                      const commission = d.commission_tiers ? (d.value || 0) * (d.commission_tiers.rate / 100) : null;
                      return (
                        <div key={d.id}
                          onClick={() => { setSearch(""); router.push("/deals/" + d.id); }}
                          style={{ padding: "10px 14px", borderBottom: "1px solid #18181b", cursor: "pointer", borderLeft: `3px solid ${stageColor}`, transition: "background 0.1s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#1c1c1f")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.85rem", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</p>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                {d.company && <span style={{ color: "#71717a", fontSize: "0.72rem" }}>{d.company}</span>}
                                {d.contact_name && <span style={{ color: "#52525b", fontSize: "0.72rem" }}>· {d.contact_name}</span>}
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <p style={{ color: "#C9A84C", fontWeight: 800, fontSize: "0.88rem", margin: "0 0 3px", fontFamily: "var(--font-cinzel, serif)" }}>{fmt(d.value || 0)}</p>
                              <span style={{ fontSize: "0.65rem", padding: "2px 7px", borderRadius: 20, background: stageColor + "22", color: stageColor, fontWeight: 600 }}>{STAGE_LABELS[d.stage] || d.stage}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {deals.filter(d => { const q = search.toLowerCase(); return d.title?.toLowerCase().includes(q) || d.company?.toLowerCase().includes(q) || d.contact_name?.toLowerCase().includes(q) || d.contact_email?.toLowerCase().includes(q) || d.contact_phone?.toLowerCase().includes(q) || (STAGE_LABELS[d.stage]||"").toLowerCase().includes(q) || String(d.value||"").includes(q) || d.notes?.toLowerCase().includes(q); }).length > 8 && (
                      <div style={{ padding: "8px 14px", color: "#52525b", fontSize: "0.72rem", textAlign: "center", borderTop: "1px solid #1c1c1f" }}>Showing top 8 — refine to narrow results</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <DailyQuote />
        {userId && <DailySignalCountdown userId={userId} />}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 12, marginBottom: 20 }}>
        {[
          { label: "Pipeline Value", value: fmt(totalPipeline), sub: `${openDeals} open deals`, color: "#34d399" },
          { label: "Won Revenue", value: fmt(wonRevenue), sub: `${deals.filter(d => d.stage === "closed_won").length} deals closed`, color: "#C9A84C" },
          { label: "Open Deals", value: openDeals.toString(), sub: "active opportunities", color: openDealsColor },
          { label: "Win Rate", value: deals.length ? Math.round((deals.filter(d => d.stage === "closed_won").length / deals.length) * 100) + "%" : "0%", sub: `${deals.length} total deals`, color: "#34d399" },
        ].map(stat => (
          <div key={stat.label} style={card}>
            <p style={{ color: "#fafafa", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{stat.label}</p>
            <p style={{ fontSize: isMobile ? "1.3rem" : "1.5rem", fontWeight: 800, color: stat.color, fontFamily: "var(--font-cinzel, serif)" }}>{stat.value}</p>
            <p style={{ color: "#52525b", fontSize: "0.75rem", marginTop: 4 }}>{stat.sub}</p>
          </div>
        ))}
      </div>

      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Commission Tracker */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.95rem", margin: 0 }}>Commission Tracker</h2>
              <span style={{ color: "#52525b", fontSize: "0.75rem" }}>{tieredDeals.length} deals tracked</span>
            </div>
            {tieredDeals.length === 0 ? (
              <p style={{ color: "#52525b", fontSize: "0.85rem" }}>No deals with commission tiers yet.</p>
            ) : (
              <>
                <div style={{ background: "#18181b", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#a1a1aa", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Commission</span>
                  <span style={{ color: "#34d399", fontWeight: 800, fontSize: "1.1rem", fontFamily: "monospace" }}>{fmt(totalCommission)}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tieredDeals.map((d: any) => {
                    const commission = (d.value || 0) * (d.commission_tiers.rate / 100);
                    const stageColor = STAGE_COLORS[d.stage] || "#71717a";
                    return (
                      <div key={d.id} onClick={() => router.push("/deals/" + d.id)}
                        style={{ padding: "10px 12px", background: "#18181b", borderRadius: 8, borderLeft: `3px solid ${stageColor}`, cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <p style={{ color: "#fafafa", fontWeight: 600, fontSize: "0.85rem", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%" }}>{d.title}</p>
                          <p style={{ color: "#34d399", fontWeight: 700, fontSize: "0.85rem", fontFamily: "monospace", margin: 0 }}>{fmt(commission)}</p>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <p style={{ color: "#71717a", fontSize: "0.72rem", margin: 0 }}>{d.company || "—"}</p>
                          <span style={{ fontSize: "0.68rem", padding: "2px 7px", borderRadius: 5, background: stageColor + "22", color: stageColor, fontWeight: 600 }}>{STAGE_LABELS[d.stage] || d.stage}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Revenue Goals */}
          <div style={card}>
            <h2 style={{ color: "#fafafa", fontWeight: 700, marginBottom: 16, fontSize: "0.95rem" }}>Revenue Goals</h2>
            {goals.length === 0 ? <p style={{ color: "#52525b", fontSize: "0.82rem" }}>No goals set.</p> : <GoalsList />}
          </div>

          {/* Pipeline by Stage */}
          <div style={card}>
            <h2 style={{ color: "#fafafa", fontWeight: 700, marginBottom: 16, fontSize: "0.95rem" }}>Pipeline by Stage</h2>
            <StageList />
          </div>

        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Commission Tracker — full width */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.95rem", margin: 0 }}>Commission Tracker</h2>
              <span style={{ color: "#52525b", fontSize: "0.75rem" }}>{tieredDeals.length} deals tracked</span>
            </div>
            {tieredDeals.length === 0 ? (
              <p style={{ color: "#52525b", fontSize: "0.85rem" }}>No deals with commission tiers yet.</p>
            ) : (
              <>
                <div style={{ background: "#18181b", borderRadius: 10, padding: "10px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#a1a1aa", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Commission</span>
                  <span style={{ color: "#34d399", fontWeight: 800, fontSize: "1.15rem", fontFamily: "monospace" }}>{fmt(totalCommission)}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tieredDeals.map((d: any) => {
                    const commission = (d.value || 0) * (d.commission_tiers.rate / 100);
                    const stageColor = STAGE_COLORS[d.stage] || "#71717a";
                    return (
                      <div key={d.id} onClick={() => router.push("/deals/" + d.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#18181b", borderRadius: 8, borderLeft: `3px solid ${stageColor}`, cursor: "pointer" }} onMouseEnter={e => (e.currentTarget.style.background = "#222225")} onMouseLeave={e => (e.currentTarget.style.background = "#18181b")}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: "#fafafa", fontWeight: 600, fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</p>
                          <p style={{ color: "#71717a", fontSize: "0.73rem", marginTop: 2 }}>{d.company || "—"}</p>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ color: "#34d399", fontWeight: 700, fontSize: "0.9rem", fontFamily: "monospace" }}>{fmt(commission)}</p>
                          <p style={{ color: "#52525b", fontSize: "0.68rem", marginTop: 1 }}>{d.commission_tiers.name} · {d.commission_tiers.rate}%</p>
                        </div>
                        <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 5, background: stageColor + "22", color: stageColor, fontWeight: 600, flexShrink: 0 }}>{STAGE_LABELS[d.stage] || d.stage}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Bottom row — Revenue Goals + Pipeline by Stage side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={card}>
              <h2 style={{ color: "#fafafa", fontWeight: 700, marginBottom: 14, fontSize: "0.95rem" }}>Revenue Goals</h2>
              {goals.length === 0 ? <p style={{ color: "#52525b", fontSize: "0.82rem" }}>No goals set.</p> : <GoalsList />}
            </div>
            <div style={card}>
              <h2 style={{ color: "#fafafa", fontWeight: 700, marginBottom: 14, fontSize: "0.95rem" }}>Pipeline by Stage</h2>
              <StageList />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
