"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n/1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return "$" + (n/1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}

const STAGE_LABELS: Record<string,string> = { prospecting:"Prospecting", qualification:"Qualified", proposal:"Proposal", negotiation:"Negotiation", closed_won:"Won", closed_lost:"Lost" };
const STAGE_COLORS: Record<string,string> = { prospecting:"#71717a", qualification:"#60a5fa", proposal:"#a78bfa", negotiation:"#fbbf24", closed_won:"#C9A84C", closed_lost:"#f87171" };

export default function MemberDetailPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const router   = useRouter();
  const supabase = createClient();

  const [userId,  setUserId]  = useState("");
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<"deals"|"projects"|"expenses">("deals");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const res  = await fetch(`/api/team/member?member_id=${memberId}&owner_id=${user.id}`);
      const json = await res.json();
      if (res.ok) setData(json);
      setLoading(false);
    });
  }, [memberId]);

  if (loading) return <div style={{ padding:32, color:"#71717a" }}>Loading...</div>;
  if (!data)   return <div style={{ padding:32, color:"#f87171" }}>Member not found or not in your team.</div>;

  const { profile, deals, projects, expenses } = data;
  const pipeline   = deals.filter((d:any) => !["closed_won","closed_lost"].includes(d.stage)).reduce((s:number,d:any)=>s+(d.value||0),0);
  const won        = deals.filter((d:any) => d.stage==="closed_won").reduce((s:number,d:any)=>s+(d.value||0),0);
  const openDeals  = deals.filter((d:any) => !["closed_won","closed_lost"].includes(d.stage)).length;

  const tabBtn = (t: typeof tab, label: string, count: number) => (
    <button onClick={() => setTab(t)} style={{
      background:tab===t?"#27272a":"transparent", border:"none",
      color:tab===t?"#fafafa":"#71717a", borderRadius:6, padding:"6px 14px",
      fontWeight:tab===t?700:400, fontSize:"0.82rem", cursor:"pointer",
    }}>
      {label} <span style={{ color:"#52525b", fontSize:"0.72rem" }}>({count})</span>
    </button>
  );

  return (
    <div style={{ padding:32, maxWidth:1000 }}>
      <button onClick={() => router.push("/team")}
        style={{ background:"none", border:"none", color:"#71717a", cursor:"pointer", fontSize:"0.85rem", marginBottom:20, padding:0, display:"flex", alignItems:"center", gap:6 }}>
        ← Team
      </button>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:28, flexWrap:"wrap" }}>
        <div style={{ width:56, height:56, borderRadius:"50%", background:"rgba(201,168,76,0.12)", border:"2px solid rgba(201,168,76,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"#C9A84C", fontSize:"1.3rem", flexShrink:0 }}>
          {(profile?.full_name?.[0] ?? "?").toUpperCase()}
        </div>
        <div>
          <h1 style={{ fontSize:"1.5rem", fontWeight:800, color:"#fafafa", margin:"0 0 4px" }}>{profile?.full_name ?? "Unnamed"}</h1>
          <p style={{ color:"#52525b", fontSize:"0.82rem", margin:0 }}>{profile?.email ?? ""}</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
        {[
          { label:"Pipeline",   value:fmt(pipeline),    color:"#C9A84C" },
          { label:"Won Revenue",value:fmt(won),         color:"#34d399" },
          { label:"Open Deals", value:String(openDeals),color:"#60a5fa" },
          { label:"Projects",   value:String(projects.length), color:"#a78bfa" },
        ].map(s => (
          <div key={s.label} style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"16px 18px" }}>
            <p style={{ color:"#71717a", fontSize:"0.7rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", margin:"0 0 6px" }}>{s.label}</p>
            <p style={{ fontSize:"1.4rem", fontWeight:800, color:s.color, fontFamily:"var(--font-cinzel,serif)", margin:0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, background:"#111113", border:"1px solid #27272a", borderRadius:8, padding:4, marginBottom:16, width:"fit-content" }}>
        {tabBtn("deals",    "Deals",    deals.length)}
        {tabBtn("projects", "Projects", projects.length)}
        {tabBtn("expenses", "Expenses", expenses.length)}
      </div>

      {/* Deals tab */}
      {tab === "deals" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {deals.length === 0 ? <p style={{ color:"#52525b" }}>No deals yet.</p> : deals.map((d:any) => {
            const sc = STAGE_COLORS[d.stage] ?? "#71717a";
            return (
              <div key={d.id} style={{ background:"#111113", border:"1px solid #27272a", borderLeft:`3px solid ${sc}`, borderRadius:10, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
                <div>
                  <p style={{ color:"#fafafa", fontWeight:600, fontSize:"0.9rem", margin:"0 0 3px" }}>{d.title}</p>
                  <p style={{ color:"#71717a", fontSize:"0.78rem", margin:0 }}>{d.company || "—"} · {d.contact_name || "—"}</p>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:"0.72rem", fontWeight:600, color:sc, background:sc+"22", padding:"3px 9px", borderRadius:5 }}>{STAGE_LABELS[d.stage]??d.stage}</span>
                  <span style={{ color:"#C9A84C", fontWeight:700, fontFamily:"monospace" }}>{fmt(d.value||0)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Projects tab */}
      {tab === "projects" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {projects.length === 0 ? <p style={{ color:"#52525b" }}>No projects yet.</p> : projects.map((p:any) => (
            <div key={p.id} style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <p style={{ color:"#fafafa", fontWeight:600, fontSize:"0.9rem", margin:0 }}>{p.name}</p>
              <span style={{ fontSize:"0.72rem", fontWeight:600, color:"#C9A84C", background:"rgba(201,168,76,0.1)", padding:"3px 9px", borderRadius:5 }}>{p.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expenses tab */}
      {tab === "expenses" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {expenses.length === 0 ? <p style={{ color:"#52525b" }}>No expenses yet.</p> : expenses.map((e:any) => (
            <div key={e.id} style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <p style={{ color:"#fafafa", fontWeight:600, fontSize:"0.9rem", margin:"0 0 2px" }}>{e.description}</p>
                <p style={{ color:"#71717a", fontSize:"0.75rem", margin:0 }}>{e.category} · {e.date}</p>
              </div>
              <span style={{ color:"#f87171", fontWeight:700, fontFamily:"monospace" }}>{fmt(e.amount||0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
