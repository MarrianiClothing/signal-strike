"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecting", qualification: "Qualified", proposal: "Proposal",
  negotiation: "Negotiation", closed_won: "Won", closed_lost: "Lost",
};
const STAGE_COLORS: Record<string, string> = {
  prospecting: "#71717a", qualification: "#60a5fa", proposal: "#a78bfa",
  negotiation: "#fbbf24", closed_won: "#C9A84C", closed_lost: "#f87171",
};

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}

export default function DealsPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("deals").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setDeals(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = deals.filter(d =>
    !search || d.title?.toLowerCase().includes(search.toLowerCase()) ||
    d.company?.toLowerCase().includes(search.toLowerCase()) ||
    d.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={{ padding: 32, color: "#71717a" }}>Loading deals...</div>;

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fafafa" }}>Deals</h1>
          <p style={{ color: "#71717a", fontSize: "0.82rem", marginTop: 3 }}>{deals.length} total deals</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            style={{ background: "#1c1c1f", border: "1px solid #27272a", borderRadius: 8, padding: "9px 14px", color: "#fafafa", fontSize: "0.85rem", width: 220 }}
            placeholder="Search deals..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button onClick={() => router.push("/pipeline")} style={{
            background: "#C9A84C", color: "#000", border: "none", borderRadius: 8,
            padding: "9px 20px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
          }}>+ Add Deal</button>
        </div>
      </div>

      <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #27272a" }}>
              {["Deal", "Company", "Contact", "Value", "Stage", "Close Date"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "#71717a", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#52525b" }}>
                {search ? "No deals match your search." : "No deals yet. Add one from the Pipeline view."}
              </td></tr>
            ) : filtered.map(deal => (
              <tr key={deal.id}
                onClick={() => router.push("/deals/" + deal.id)}
                style={{ borderBottom: "1px solid #18181b", color: "#fafafa", fontSize: "0.9rem", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#1c1c1f")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "13px 16px", fontWeight: 600 }}>{deal.title}</td>
                <td style={{ padding: "13px 16px", color: "#a1a1aa" }}>{deal.company || "—"}</td>
                <td style={{ padding: "13px 16px", color: "#a1a1aa" }}>{deal.contact_name || "—"}</td>
                <td style={{ padding: "13px 16px", color: "#C9A84C", fontWeight: 700 }}>{fmt(deal.value)}</td>
                <td style={{ padding: "13px 16px" }}>
                  <span style={{ fontSize: "0.75rem", padding: "3px 8px", borderRadius: 5, background: (STAGE_COLORS[deal.stage] || "#71717a") + "22", color: STAGE_COLORS[deal.stage] || "#71717a", fontWeight: 600 }}>
                    {STAGE_LABELS[deal.stage] || deal.stage}
                  </span>
                </td>
                <td style={{ padding: "13px 16px", color: "#71717a", fontSize: "0.82rem" }}>
                  {deal.expected_close_date ? new Date(deal.expected_close_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
