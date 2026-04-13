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

function cleanTitle(title: string, company?: string | null): string {
  if (!title) return title;
  const parts = title.split(" \u2014 ");
  if (parts.length === 2) {
    const a = parts[0].trim(), b = parts[1].trim();
    if (a === b) return a;
    if (company && (a === company.trim() || b === company.trim())) return a;
  }
  return title;
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
  const [importModal,    setImportModal]    = useState(false);
  const [importDeals,    setImportDeals]    = useState<any[]>([]);
  const [importSelected, setImportSelected] = useState<Set<number>>(new Set());
  const [importLoading,  setImportLoading]  = useState(false);
  const [importSaving,   setImportSaving]   = useState(false);
  const [importError,    setImportError]    = useState("");
  const [importDone,     setImportDone]     = useState(0);
  const [importDetected, setImportDetected] = useState<string[]>([]);
  const supabase = createClient();
  const router = useRouter();
  const isMobile = useIsMobile();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("deals").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setDeals(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

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
    for (const idx of Array.from(dashSelected)) {
      const job = dashJobs[idx];
      if (!job) continue;
      try {
        const res = await fetch("/api/apollo/pipeline", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            user_id: userId, contact_name: job.contact_name, contact_email: null,
            contact_phone: null, company: job.company, title: job.title,
            linkedin_url: null, value: job.value, stage: job.stage, notes: job.notes,
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

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true); setImportError(""); setImportDeals([]); setImportSelected(new Set());
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res  = await fetch("/api/deals/import", { method:"POST", body:fd });
      const json = await res.json();
      if (!res.ok || json.error) { setImportError(json.error ?? "Parse failed"); }
      else {
        setImportDeals(json.deals || []);
        setImportDetected(json.detected || []);
        setImportSelected(new Set((json.deals||[]).map((_:any,i:number)=>i)));
      }
    } catch(err:any) { setImportError(err?.message ?? "Upload failed"); }
    setImportLoading(false);
    e.target.value = "";
  }

  async function handleImportSave() {
    if (!userId || importSelected.size === 0) return;
    setImportSaving(true);
    let done = 0;
    for (const idx of Array.from(importSelected)) {
      const d = importDeals[idx];
      if (!d) continue;
      try {
        const res = await fetch("/api/apollo/pipeline", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            user_id: userId, title: d.title, company: d.company,
            contact_name: d.contact_name, contact_email: d.contact_email,
            contact_phone: d.contact_phone, value: d.value,
            stage: d.stage, notes: d.notes,
          }),
        });
        if (res.ok) done++;
      } catch {}
    }
    setImportDone(done);
    setImportSaving(false);
    setTimeout(async () => {
      setImportModal(false); setImportDeals([]); setImportSelected(new Set()); setImportDone(0);
      const { data: { user } } = await createClient().auth.getUser();
      if (user) {
        const { data } = await createClient().from("deals").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        setDeals(data || []);
      }
    }, 1800);
  }

  if (loading) return <div style={{ padding: 32, color: "#71717a" }}>Loading deals...</div>;

  return (
    <div style={{ padding: isMobile ? 16 : 32 }}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: 24, gap: 12, width: "100%", boxSizing: "border-box" as const }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fafafa" }}>Deals</h1>
          <p style={{ color: "#71717a", fontSize: "0.82rem", marginTop: 3 }}>{deals.length} total deals</p>
        </div>

        {/* Toolbar — mobile: search full-width + scrollable action row */}
        {isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            <input
              style={{ background: "#1c1c1f", border: "1px solid #27272a", borderRadius: 8, padding: "9px 14px", color: "#fafafa", fontSize: "0.85rem", width: "100%", boxSizing: "border-box" }}
              placeholder="Search deals..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ flex: 1, background: "#1c1c1f", border: "1px solid #27272a", color: "#a1a1aa", borderRadius: 8, padding: "8px 10px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, whiteSpace: "nowrap" }}>
                &#128194; DASH Import
                <input type="file" accept=".xls,.xlsx,.html,.htm" style={{ display: "none" }}
                  onChange={e => { setDashModal(true); setDashError(""); setDashJobs([]); handleDashFile(e); }} />
              </label>
              <label style={{ flex: 1, background: "#1c1c1f", border: "1px solid #27272a", color: "#a1a1aa", borderRadius: 8, padding: "8px 10px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, whiteSpace: "nowrap" }}>
                &#128229; Spreadsheet
                <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
                  onChange={e => { setImportModal(true); setImportError(""); setImportDeals([]); handleImportFile(e); }} />
              </label>
            </div>
            <button onClick={() => router.push("/pipeline")} style={{ background: "#C9A84C", color: "#000", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", width: "100%" }}>+ Add Deal</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <input
              style={{ background: "#1c1c1f", border: "1px solid #27272a", borderRadius: 8, padding: "9px 14px", color: "#fafafa", fontSize: "0.85rem", flex: "1 1 180px", minWidth: 120, maxWidth: 220 }}
              placeholder="Search deals..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <label style={{ background:"#1c1c1f", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:8, padding:"9px 16px", fontWeight:600, fontSize:"0.85rem", cursor:"pointer", display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap" }}>
              &#128194; Import DASH Deals
              <input type="file" accept=".xls,.xlsx,.html,.htm" style={{ display:"none" }}
                onChange={e => { setDashModal(true); setDashError(""); setDashJobs([]); handleDashFile(e); }} />
            </label>
            <label style={{ background:"#1c1c1f", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:8, padding:"9px 16px", fontWeight:600, fontSize:"0.85rem", cursor:"pointer", display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap" }}>
              &#128229; Import Spreadsheet
              <input type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }}
                onChange={e => { setImportModal(true); setImportError(""); setImportDeals([]); handleImportFile(e); }} />
            </label>
            <button onClick={() => router.push("/pipeline")} style={{ background: "#C9A84C", color: "#000", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>+ Add Deal</button>
          </div>
        )}
      </div>

      {/* Mobile card list */}
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 ? (
            <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 12, padding: 32, textAlign: "center", color: "#52525b" }}>
              {search ? "No deals match your search." : "No deals yet."}
            </div>
          ) : filtered.map(deal => {
            const stageColor = STAGE_COLORS[deal.stage] || "#71717a";
            const title = cleanTitle(deal.title, deal.company);
            const showCompany = deal.company && deal.company !== title;
            const showContact = deal.contact_name && deal.contact_name !== deal.company;
            return (
              <div key={deal.id} onClick={() => router.push("/deals/" + deal.id)}
                style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 12, borderLeft: `3px solid ${stageColor}`, padding: "14px 16px", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                    <p style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.95rem", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</p>
                    {showCompany && <p style={{ color: "#71717a", fontSize: "0.78rem", margin: 0 }}>{deal.company}</p>}
                  </div>
                  <span style={{ color: "#C9A84C", fontWeight: 800, fontSize: "1rem", fontFamily: "var(--font-cinzel, serif)", flexShrink: 0 }}>{fmt(deal.value)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#71717a", fontSize: "0.78rem" }}>{showContact ? deal.contact_name : (showCompany ? deal.company : "\u2014")}</span>
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
                  <td style={{ padding: "13px 16px", color: "#a1a1aa" }}>{deal.company || "\u2014"}</td>
                  <td style={{ padding: "13px 16px", color: "#a1a1aa" }}>{deal.contact_name || "\u2014"}</td>
                  <td style={{ padding: "13px 16px", color: "#C9A84C", fontWeight: 700 }}>{fmt(deal.value)}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ fontSize: "0.75rem", padding: "3px 8px", borderRadius: 5, background: (STAGE_COLORS[deal.stage] || "#71717a") + "22", color: STAGE_COLORS[deal.stage] || "#71717a", fontWeight: 600 }}>
                      {STAGE_LABELS[deal.stage] || deal.stage}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px", color: "#71717a", fontSize: "0.82rem" }}>
                    {deal.expected_close_date ? new Date(deal.expected_close_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "\u2014"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DASH Import Modal */}
      {dashModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:14, padding:28, width:"100%", maxWidth:700, maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div>
                <h2 style={{ color:"#fafafa", fontWeight:700, fontSize:"1.05rem", margin:"0 0 3px" }}>&#128194; Import DASH Deals</h2>
                <p style={{ color:"#52525b", fontSize:"0.78rem", margin:0 }}>Select which jobs to add to your Signal Strike pipeline</p>
              </div>
              <button onClick={() => { setDashModal(false); setDashJobs([]); setDashSelected(new Set()); setDashError(""); }}
                style={{ background:"none", border:"none", color:"#52525b", fontSize:"1.2rem", cursor:"pointer" }}>&times;</button>
            </div>
            {dashLoading && <div style={{ textAlign:"center", padding:"40px 0", color:"#71717a" }}><p>Parsing DASH export...</p></div>}
            {dashError && !dashLoading && (
              <div style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:8, padding:"12px 16px", marginBottom:16 }}>
                <p style={{ color:"#f87171", fontSize:"0.85rem", margin:0 }}>{dashError}</p>
              </div>
            )}
            {!dashLoading && !dashError && dashJobs.length === 0 && (
              <div style={{ textAlign:"center", padding:"32px 0", color:"#52525b" }}>
                <div style={{ fontSize:"2.5rem", marginBottom:12 }}>&#128202;</div>
                <p style={{ margin:"0 0 8px", fontSize:"0.9rem", color:"#a1a1aa" }}>Upload your DASH Open Jobs export</p>
                <p style={{ margin:"0 0 16px", fontSize:"0.8rem", lineHeight:1.6 }}>In DASH: <strong style={{ color:"#71717a" }}>Reports &rarr; Open Jobs &rarr; Export to Excel</strong></p>
                <label style={{ background:"#C9A84C", color:"#000", borderRadius:8, padding:"9px 20px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", display:"inline-block" }}>
                  Choose File
                  <input type="file" accept=".xls,.xlsx,.html,.htm" style={{ display:"none" }} onChange={handleDashFile} />
                </label>
              </div>
            )}
            {dashJobs.length > 0 && !dashLoading && (
              <>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <span style={{ color:"#52525b", fontSize:"0.82rem" }}>{dashJobs.length} deals found &middot; {dashSelected.size} selected</span>
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
                          {selected?"\u2713":""}
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
                            {job.value>=1000000?"$"+(job.value/1000000).toFixed(2)+"M":job.value>=1000?"$"+(job.value/1000).toFixed(1)+"K":job.value>0?"$"+job.value:"\u2014"}
                          </p>
                          {job.received_date && <p style={{ color:"#3f3f46", fontSize:"0.7rem", margin:"2px 0 0" }}>{job.received_date}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {dashImported > 0 && (
                  <div style={{ background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:8, padding:"10px 14px", marginBottom:12 }}>
                    <p style={{ color:"#34d399", fontSize:"0.85rem", margin:0, fontWeight:600 }}>\u2713 {dashImported} deal{dashImported!==1?"s":""} added to pipeline</p>
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

      {/* Generic Import Modal */}
      {importModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:700, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:14, padding:28, width:"100%", maxWidth:720, maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div>
                <h2 style={{ color:"#fafafa", fontWeight:700, fontSize:"1.05rem", margin:"0 0 3px" }}>&#128229; Import Deals from Spreadsheet</h2>
                <p style={{ color:"#52525b", fontSize:"0.78rem", margin:0 }}>Excel or CSV &mdash; columns are detected automatically</p>
              </div>
              <button onClick={() => { setImportModal(false); setImportDeals([]); setImportSelected(new Set()); setImportError(""); }}
                style={{ background:"none", border:"none", color:"#52525b", fontSize:"1.2rem", cursor:"pointer" }}>&times;</button>
            </div>
            {importLoading && <div style={{ textAlign:"center", padding:"40px 0", color:"#71717a" }}><p>Parsing file...</p></div>}
            {importError && !importLoading && (
              <div style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:8, padding:"12px 16px", marginBottom:16 }}>
                <p style={{ color:"#f87171", fontSize:"0.85rem", margin:"0 0 8px", fontWeight:600 }}>Could not parse file</p>
                <p style={{ color:"#a1a1aa", fontSize:"0.82rem", margin:0 }}>{importError}</p>
              </div>
            )}
            {!importLoading && !importError && importDeals.length === 0 && (
              <div style={{ textAlign:"center", padding:"32px 0", color:"#52525b" }}>
                <div style={{ fontSize:"2.5rem", marginBottom:12 }}>&#128202;</div>
                <p style={{ margin:"0 0 8px", fontSize:"0.9rem", color:"#a1a1aa" }}>Upload an Excel or CSV file</p>
                <p style={{ margin:"0 0 6px", fontSize:"0.8rem", lineHeight:1.6 }}>
                  Recognized columns: <strong style={{ color:"#71717a" }}>Title, Company, Contact Name, Email, Phone, Value, Stage, Probability, Close Date, Notes</strong>
                </p>
                <p style={{ margin:"0 0 20px", fontSize:"0.78rem", color:"#3f3f46" }}>Column names are flexible &mdash; "Deal Name", "Opportunity", "Job" all map to Title automatically</p>
                <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
                  <label style={{ background:"#C9A84C", color:"#000", borderRadius:8, padding:"9px 20px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", display:"inline-block" }}>
                    Choose File
                    <input type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={handleImportFile} />
                  </label>
                  <a href="/api/deals/template" download style={{ background:"#1c1c1f", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:8, padding:"9px 20px", fontWeight:600, fontSize:"0.85rem", textDecoration:"none", display:"inline-flex", alignItems:"center", gap:6 }}>
                    &darr; Download Template
                  </a>
                </div>
              </div>
            )}
            {importDeals.length > 0 && !importLoading && (
              <>
                <div style={{ background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.15)", borderRadius:8, padding:"10px 14px", marginBottom:12, display:"flex", gap:16, flexWrap:"wrap", alignItems:"center" }}>
                  <span style={{ color:"#34d399", fontSize:"0.82rem", fontWeight:600 }}>\u2713 {importDeals.length} rows detected</span>
                  <span style={{ color:"#52525b", fontSize:"0.78rem" }}>Columns mapped: {importDetected.join(", ")}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ color:"#52525b", fontSize:"0.82rem" }}>{importSelected.size} of {importDeals.length} selected</span>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => setImportSelected(new Set(importDeals.map((_,i)=>i)))}
                      style={{ background:"none", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:6, padding:"4px 10px", fontSize:"0.75rem", cursor:"pointer" }}>Select All</button>
                    <button onClick={() => setImportSelected(new Set())}
                      style={{ background:"none", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:6, padding:"4px 10px", fontSize:"0.75rem", cursor:"pointer" }}>Clear</button>
                  </div>
                </div>
                <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:5, marginBottom:16 }}>
                  {importDeals.map((d:any, idx:number) => {
                    const sel = importSelected.has(idx);
                    const SC: Record<string,string> = { prospecting:"#71717a", qualification:"#60a5fa", proposal:"#a78bfa", negotiation:"#fbbf24", closed_won:"#C9A84C", closed_lost:"#f87171" };
                    const SL: Record<string,string> = { prospecting:"Prospecting", qualification:"Qualified", proposal:"Proposal", negotiation:"Negotiation", closed_won:"Won", closed_lost:"Lost" };
                    const sc = SC[d.stage] ?? "#71717a";
                    return (
                      <div key={idx} onClick={() => setImportSelected(prev => { const n=new Set(prev); n.has(idx)?n.delete(idx):n.add(idx); return n; })}
                        style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:sel?"#18181b":"#0f0f10", border:`1px solid ${sel?"#27272a":"#1c1c1f"}`, borderLeft:`3px solid ${sel?sc:"#27272a"}`, borderRadius:8, cursor:"pointer" }}>
                        <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${sel?"#C9A84C":"#27272a"}`, background:sel?"#C9A84C":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"0.7rem", color:"#000", fontWeight:700 }}>
                          {sel?"\u2713":""}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                            <span style={{ color:sel?"#fafafa":"#71717a", fontWeight:700, fontSize:"0.85rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:280 }}>{d.title}</span>
                            <span style={{ fontSize:"0.68rem", fontWeight:600, color:sc, background:sc+"22", padding:"2px 7px", borderRadius:4, flexShrink:0 }}>{SL[d.stage]??d.stage}</span>
                          </div>
                          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop:2 }}>
                            {d.company     && <span style={{ color:"#52525b", fontSize:"0.73rem" }}>{d.company}</span>}
                            {d.contact_name && <span style={{ color:"#52525b", fontSize:"0.73rem" }}>&middot; {d.contact_name}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <p style={{ color:d.value>0?"#C9A84C":"#3f3f46", fontWeight:700, fontSize:"0.88rem", margin:0, fontFamily:"monospace" }}>
                            {d.value>=1000000?"$"+(d.value/1000000).toFixed(2)+"M":d.value>=1000?"$"+(d.value/1000).toFixed(1)+"K":d.value>0?"$"+d.value.toFixed(0):"\u2014"}
                          </p>
                          {d.expected_close_date && <p style={{ color:"#3f3f46", fontSize:"0.7rem", margin:"2px 0 0" }}>{d.expected_close_date}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {importDone > 0 && (
                  <div style={{ background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:8, padding:"10px 14px", marginBottom:12 }}>
                    <p style={{ color:"#34d399", fontSize:"0.85rem", margin:0, fontWeight:600 }}>\u2713 {importDone} deal{importDone!==1?"s":""} imported successfully</p>
                  </div>
                )}
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end", borderTop:"1px solid #1c1c1f", paddingTop:16 }}>
                  <a href="/api/deals/template" download style={{ background:"none", border:"1px solid #27272a", color:"#71717a", borderRadius:8, padding:"8px 14px", fontSize:"0.82rem", textDecoration:"none", display:"flex", alignItems:"center", gap:5 }}>
                    &darr; Template
                  </a>
                  <button onClick={() => { setImportModal(false); setImportDeals([]); setImportSelected(new Set()); setImportError(""); }}
                    style={{ background:"none", border:"1px solid #27272a", color:"#71717a", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontSize:"0.85rem" }}>Cancel</button>
                  <button onClick={handleImportSave} disabled={importSaving||importSelected.size===0}
                    style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"8px 20px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", opacity:importSelected.size>0&&!importSaving?1:0.5 }}>
                    {importSaving?"Importing...": `Import ${importSelected.size} Deal${importSelected.size!==1?"s":""}`}
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
