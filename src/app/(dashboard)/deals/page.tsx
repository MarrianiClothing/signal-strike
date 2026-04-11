"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  const [userId,        setUserId]        = useState("");
  const [dashModal,     setDashModal]     = useState(false);
  const [dashJobs,      setDashJobs]      = useState<any[]>([]);
  const [dashSelected,  setDashSelected]  = useState<Set<number>>(new Set());
  const [dashLoading,   setDashLoading]   = useState(false);
  const [dashImporting, setDashImporting] = useState(false);
  const [dashError,     setDashError]     = useState("");
  const [dashImported,  setDashImported]  = useState(0);
  const supabase = createClient();
  const router = useRouter();
  const isMobile = useIsMobile();

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

  useEffect(() => {
    createClient().auth.getUser().then(({ data:{ user }}) => { if (user) setUserId(user.id); });
  }, []);

  async function handleDashFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDashLoading(true); setDashError(""); setDashJobs([]); setDashSelected(new Set());
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res  = await fetch("/api/dash/import", { method:"POST", body:fd });
      const json = await res.json();
      if (!res.ok || json.error) { setDashError(json.error ?? "Parse failed"); }
      else {
        setDashJobs(json.jobs || []);
        setDashSelected(new Set((json.jobs||[]).map((_:any,i:number)=>i)));
      }
    } catch(err:any) { setDashError(err?.message ?? "Upload failed"); }
    setDashLoading(false);
    e.target.value = "";
  }

  async function handleDashImport() {
    if (!userId || dashSelected.size === 0) return;
    setDashImporting(true);
    let imported = 0;
    const STAGE_CLR: Record<string,string> = { prospecting:"#71717a", negotiation:"#fbbf24", closed_won:"#C9A84C" };
    for (const idx of Array.from(dashSelected)) {
      const job = dashJobs[idx];
      if (!job) continue;
      try {
        const res = await fetch("/api/apollo/pipeline", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            user_id:       userId,
            contact_name:  job.contact_name,
            contact_email: null,
            contact_phone: null,
            company:       job.company,
            title:         job.title,
            linkedin_url:  null,
            value:         job.value,
            stage:         job.stage,
            notes:         job.notes,
          }),
        });
        if (res.ok) imported++;
      } catch {}
    }
    setDashImported(imported);
    setDashImporting(false);
    setTimeout(() => {
      setDashModal(false); setDashJobs([]); setDashSelected(new Set()); setDashImported(0);
      load();
    }, 1800);
  }

  function toggleDashJob(idx: number) {
    setDashSelected(prev => { const n = new Set(prev); n.has(idx)?n.delete(idx):n.add(idx); return n; });
  }

  if (loading) return <div style={{ padding: 32, color: "#71717a" }}>Loading deals...</div>;

  return (
    <div style={{ padding: isMobile ? 16 : 32 }}>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: 24, gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fafafa" }}>Deals</h1>
          <p style={{ color: "#71717a", fontSize: "0.82rem", marginTop: 3 }}>{deals.length} total deals</p>
        </div>
        <div style={{ display: "flex", gap: 10, width: isMobile ? "100%" : "auto" }}>
          <input
            style={{ background: "#1c1c1f", border: "1px solid #27272a", borderRadius: 8, padding: "9px 14px", color: "#fafafa", fontSize: "0.85rem", width: isMobile ? "100%" : 220, flex: isMobile ? 1 : undefined }}
            placeholder="Search deals..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
                    <label style={{ background:"#1c1c1f", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:8, padding:"9px 16px", fontWeight:600, fontSize:"0.85rem", cursor:"pointer", display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap" }}>
            📂 Import DASH Deals
            <input type="file" accept=".xls,.xlsx,.html,.htm" style={{ display:"none" }}
              onChange={e => { setDashModal(true); setDashError(""); setDashJobs([]); handleDashFile(e); }} />
          </label>
          <button onClick={() => router.push("/pipeline")} style={{
            background: "#C9A84C", color: "#000", border: "none", borderRadius: 8,
            padding: "9px 20px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
          }}>+ Add Deal</button>
        </div>
      </div>

      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 ? (
            <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 12, padding: 32, textAlign: "center", color: "#52525b" }}>
              {search ? "No deals match your search." : "No deals yet."}
            </div>
          ) : filtered.map(deal => {
            const stageColor = STAGE_COLORS[deal.stage] || "#71717a";
            return (
              <div key={deal.id} onClick={() => router.push("/deals/" + deal.id)}
                style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 12, borderLeft: `3px solid ${stageColor}`, padding: "14px 16px", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <p style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.95rem", margin: "0 0 3px" }}>{deal.title}</p>
                    <p style={{ color: "#71717a", fontSize: "0.78rem", margin: 0 }}>{deal.company || "—"}</p>
                  </div>
                  <span style={{ color: "#C9A84C", fontWeight: 800, fontSize: "1rem", fontFamily: "var(--font-cinzel, serif)" }}>{fmt(deal.value)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#71717a", fontSize: "0.78rem" }}>{deal.contact_name || "—"}</span>
                  <span style={{ fontSize: "0.72rem", padding: "3px 10px", borderRadius: 20, background: stageColor + "22", color: stageColor, fontWeight: 600 }}>
                    {STAGE_LABELS[deal.stage] || deal.stage}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
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



                <td style={{ padding:"13px 16px" }}><span style={{ color:"#3f3f46" }}>—</span></td>
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
      )}
      {/* ── DASH Import Modal ────────────────────────────────────────────────── */}
      {dashModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:14, padding:28, width:"100%", maxWidth:700, maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div>
                <h2 style={{ color:"#fafafa", fontWeight:700, fontSize:"1.05rem", margin:"0 0 3px" }}>📂 Import DASH Deals</h2>
                <p style={{ color:"#52525b", fontSize:"0.78rem", margin:0 }}>Select which jobs to add to your Signal Strike pipeline</p>
              </div>
              <button onClick={() => { setDashModal(false); setDashJobs([]); setDashSelected(new Set()); setDashError(""); }}
                style={{ background:"none", border:"none", color:"#52525b", fontSize:"1.2rem", cursor:"pointer" }}>✕</button>
            </div>
            {dashLoading && <div style={{ textAlign:"center", padding:"40px 0", color:"#71717a" }}><p>Parsing DASH export...</p></div>}
            {dashError && !dashLoading && (
              <div style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:8, padding:"12px 16px", marginBottom:16 }}>
                <p style={{ color:"#f87171", fontSize:"0.85rem", margin:0 }}>{dashError}</p>
              </div>
            )}
            {!dashLoading && !dashError && dashJobs.length === 0 && (
              <div style={{ textAlign:"center", padding:"32px 0", color:"#52525b" }}>
                <div style={{ fontSize:"2.5rem", marginBottom:12 }}>📊</div>
                <p style={{ margin:"0 0 8px", fontSize:"0.9rem", color:"#a1a1aa" }}>Upload your DASH Open Jobs export</p>
                <p style={{ margin:"0 0 16px", fontSize:"0.8rem", lineHeight:1.6 }}>In DASH: <strong style={{ color:"#71717a" }}>Reports → Open Jobs → Export to Excel</strong></p>
                <label style={{ background:"#C9A84C", color:"#000", borderRadius:8, padding:"9px 20px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", display:"inline-block" }}>
                  Choose File
                  <input type="file" accept=".xls,.xlsx,.html,.htm" style={{ display:"none" }} onChange={handleDashFile} />
                </label>
              </div>
            )}
            {dashJobs.length > 0 && !dashLoading && (
              <>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <span style={{ color:"#52525b", fontSize:"0.82rem" }}>{dashJobs.length} deals found · {dashSelected.size} selected</span>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => setDashSelected(new Set(dashJobs.map((_,i)=>i)))}
                      style={{ background:"none", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:6, padding:"4px 10px", fontSize:"0.75rem", cursor:"pointer" }}>Select All</button>
                    <button onClick={() => setDashSelected(new Set())}
                      style={{ background:"none", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:6, padding:"4px 10px", fontSize:"0.75rem", cursor:"pointer" }}>Clear</button>
                  </div>
                </div>
                <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
                  {dashJobs.map((job:any, idx:number) => {
                    const selected = dashSelected.has(idx);
                    const SC: Record<string,string> = { prospecting:"#71717a", qualification:"#60a5fa", proposal:"#a78bfa", negotiation:"#fbbf24", closed_won:"#C9A84C", closed_lost:"#f87171" };
                    const stageClr = SC[job.stage] ?? "#71717a";
                    return (
                      <div key={idx} onClick={() => toggleDashJob(idx)}
                        style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:selected?"#18181b":"#0f0f10", border:`1px solid ${selected?"#27272a":"#1c1c1f"}`, borderLeft:`3px solid ${selected?stageClr:"#27272a"}`, borderRadius:8, cursor:"pointer" }}>
                        <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${selected?"#C9A84C":"#27272a"}`, background:selected?"#C9A84C":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"0.7rem", color:"#000", fontWeight:700 }}>
                          {selected?"✓":""}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                            <span style={{ color:selected?"#fafafa":"#71717a", fontWeight:700, fontSize:"0.85rem" }}>{job.title}</span>
                            <span style={{ fontSize:"0.68rem", fontWeight:600, color:stageClr, background:stageClr+"22", padding:"2px 7px", borderRadius:4 }}>{job.dash_status}</span>
                          </div>
                          {job.company && <p style={{ color:"#52525b", fontSize:"0.75rem", margin:"2px 0 0" }}>{job.company}</p>}
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <p style={{ color:job.value>0?"#C9A84C":"#3f3f46", fontWeight:700, fontSize:"0.88rem", margin:0, fontFamily:"monospace" }}>
                            {job.value>=1000000?"$"+(job.value/1000000).toFixed(2)+"M":job.value>=1000?"$"+(job.value/1000).toFixed(1)+"K":job.value>0?"$"+job.value:"—"}
                          </p>
                          {job.received_date && <p style={{ color:"#3f3f46", fontSize:"0.7rem", margin:"2px 0 0" }}>{job.received_date}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {dashImported > 0 && (
                  <div style={{ background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:8, padding:"10px 14px", marginBottom:12 }}>
                    <p style={{ color:"#34d399", fontSize:"0.85rem", margin:0, fontWeight:600 }}>✓ {dashImported} deal{dashImported!==1?"s":""} added to pipeline</p>
                  </div>
                )}
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end", borderTop:"1px solid #1c1c1f", paddingTop:16 }}>
                  <button onClick={() => { setDashModal(false); setDashJobs([]); setDashSelected(new Set()); setDashError(""); }}
                    style={{ background:"none", border:"1px solid #27272a", color:"#71717a", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontSize:"0.85rem" }}>Cancel</button>
                  <button onClick={handleDashImport} disabled={dashImporting||dashSelected.size===0}
                    style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"8px 20px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", opacity:dashSelected.size>0&&!dashImporting?1:0.5 }}>
                    {dashImporting?"Adding...": `Add ${dashSelected.size} Deal${dashSelected.size!==1?"s":""} to Pipeline`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}