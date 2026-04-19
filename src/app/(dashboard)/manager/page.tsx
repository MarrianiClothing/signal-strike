"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCache, setCache } from "@/lib/cache";

function fmt(n: number | null | undefined) {
  if (!n || isNaN(n)) return "$0";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}

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

const STAGE_COLORS: Record<string, string> = {
  prospecting: "#71717a", qualification: "#60a5fa", proposal: "#a78bfa",
  negotiation: "#fbbf24", closed_won: "#C9A84C", closed_lost: "#f87171",
};
const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecting", qualification: "Qualified", proposal: "Proposal",
  negotiation: "Negotiation", closed_won: "Won", closed_lost: "Lost",
};

export default function ManagerDashboard() {
  const router   = useRouter();
  const supabase = createClient();
  const isMobile = useIsMobile();
  const { userId: authUserId, ready: authReady } = useAuth();

  const [reports,  setReports]  = useState<any[]>(() => getCache<any[]>("manager_reports") ?? []);
  const [totals,   setTotals]   = useState<any>(() => getCache<any>("manager_totals") ?? {});
  const [loading,  setLoading]  = useState(!getCache<any[]>("manager_reports"));
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) return;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/login"); return; }

      const res  = await fetch(`/api/team/manager-dashboard?manager_id=${session.user.id}`);
      const json = await res.json();
      if (json.reports) {
        setReports(json.reports);
        setTotals(json.totals);
        setCache("manager_reports", json.reports);
        setCache("manager_totals", json.totals);
      }
      setLoading(false);
    }
    load();
  }, [authReady]);

  const card: React.CSSProperties = {
    background: "#111113", border: "1px solid #27272a", borderRadius: 12, padding: 20,
  };

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fafafa", margin: "0 0 4px", fontFamily: "var(--font-cinzel,serif)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Manager Dashboard
        </h1>
        <p style={{ color: "#52525b", fontSize: "0.82rem", margin: 0 }}>
          {loading ? "Loading..." : `${reports.length} direct report${reports.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Team Totals */}
      {!loading && reports.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Team Pipeline", value: fmt(totals.pipeline), color: "#a78bfa" },
            { label: "Team Won Revenue", value: fmt(totals.won), color: "#C9A84C" },
            { label: "Open Deals", value: totals.open_deals ?? 0, color: "#60a5fa" },
            { label: "Total Deals", value: totals.total_deals ?? 0, color: "#34d399" },
          ].map(({ label, value, color }) => (
            <div key={label} style={card}>
              <p style={{ color: "#52525b", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>{label}</p>
              <p style={{ color, fontSize: "1.5rem", fontWeight: 800, margin: 0, fontFamily: "monospace" }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* No reports state */}
      {!loading && reports.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#3f3f46" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>👥</div>
          <p style={{ fontSize: "0.95rem", color: "#52525b", margin: "0 0 6px" }}>No direct reports yet</p>
          <p style={{ fontSize: "0.82rem", margin: "0 0 20px" }}>Assign teammates to your management in the Team page</p>
          <button onClick={() => router.push("/team")}
            style={{ background: "#C9A84C", color: "#000", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
            Go to Team
          </button>
        </div>
      )}

      {/* Direct Reports */}
      {reports.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reports.map(r => (
            <div key={r.user_id} style={{ ...card, padding: 0, overflow: "hidden" }}>

              {/* Rep header row */}
              <div
                onClick={() => setExpanded(expanded === r.user_id ? null : r.user_id)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", cursor: "pointer" }}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(201,168,76,0.12)", border: "1px solid #C9A84C",
                  color: "#C9A84C", fontWeight: 700, fontSize: "0.85rem",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {r.full_name?.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase() || "?"}
                </div>

                {/* Name + email */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.9rem", margin: 0 }}>{r.full_name}</p>
                  <p style={{ color: "#52525b", fontSize: "0.75rem", margin: "2px 0 0" }}>{r.email}</p>
                </div>

                {/* Stats */}
                <div style={{ display: "flex", gap: isMobile ? 12 : 24, alignItems: "center" }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ color: "#52525b", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Pipeline</p>
                    <p style={{ color: "#a78bfa", fontWeight: 700, fontSize: "0.95rem", margin: 0, fontFamily: "monospace" }}>{fmt(r.pipeline)}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ color: "#52525b", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Won</p>
                    <p style={{ color: "#C9A84C", fontWeight: 700, fontSize: "0.95rem", margin: 0, fontFamily: "monospace" }}>{fmt(r.won_revenue)}</p>
                  </div>
                  {!isMobile && (
                    <div style={{ textAlign: "right" }}>
                      <p style={{ color: "#52525b", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Open</p>
                      <p style={{ color: "#60a5fa", fontWeight: 700, fontSize: "0.95rem", margin: 0 }}>{r.open_deals}</p>
                    </div>
                  )}
                  <span style={{ color: "#52525b", fontSize: "0.75rem", marginLeft: 4 }}>
                    {expanded === r.user_id ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {/* Expanded: recent deals */}
              {expanded === r.user_id && (
                <div style={{ borderTop: "1px solid #1c1c1f", padding: "12px 20px 16px" }}>
                  <p style={{ color: "#52525b", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
                    Recent Deals
                  </p>
                  {r.recent_deals?.length === 0 ? (
                    <p style={{ color: "#3f3f46", fontSize: "0.82rem", margin: 0 }}>No deals yet</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {r.recent_deals?.map((d: any) => {
                        const sc = STAGE_COLORS[d.stage] ?? "#71717a";
                        return (
                          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#0f0f10", borderRadius: 8, border: "1px solid #1c1c1f" }}>
                            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: sc, background: sc + "22", padding: "2px 8px", borderRadius: 4, flexShrink: 0 }}>
                              {STAGE_LABELS[d.stage] ?? d.stage}
                            </span>
                            <span style={{ color: "#fafafa", fontSize: "0.82rem", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {d.title}
                            </span>
                            <span style={{ color: "#C9A84C", fontSize: "0.82rem", fontWeight: 700, fontFamily: "monospace", flexShrink: 0 }}>
                              {fmt(d.value)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <button
                      onClick={() => router.push(`/team/${r.user_id}`)}
                      style={{ background: "none", border: "1px solid #27272a", color: "#a1a1aa", borderRadius: 7, padding: "6px 14px", fontSize: "0.78rem", cursor: "pointer", fontWeight: 600 }}>
                      View Full Profile →
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
