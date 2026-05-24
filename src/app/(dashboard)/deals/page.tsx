"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCache, setCache } from "@/lib/cache";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

const STAGES = ["prospecting","qualification","proposal","negotiation","closed_won","closed_lost"];
const STAGE_LABELS: Record<string,string> = {
  prospecting:"Lead", qualification:"Qualified", proposal:"Proposal",
  negotiation:"Negotiation", closed_won:"Won", closed_lost:"Lost",
};
const STAGE_COLORS: Record<string,string> = {
  prospecting:"#71717a", qualification:"#60a5fa", proposal:"#a78bfa",
  negotiation:"#fbbf24", closed_won:"#C9A84C", closed_lost:"#f87171",
};

function fmt(n: number | null | undefined) {
  if (!n || isNaN(n)) return "$0";
  if (n >= 1_000_000) return "$" + (n/1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return "$" + (n/1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}

function initials(name?: string | null, company?: string | null) {
  const src = name || company || "??";
  return src.split(" ").map((w:string) => w[0]).join("").slice(0,2).toUpperCase();
}

function timeAgo(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts), now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60)   return "just now";
  if (diff < 3600) return Math.floor(diff/60) + "m ago";
  if (diff < 86400)return Math.floor(diff/3600) + "h ago";
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
}

function canDelete(deal: any, userId: string) {
  if (!deal) return false;
  return deal.user_id === userId;
}

const inp: React.CSSProperties = {
  width:"100%", background:"#1c1c1f", border:"1px solid #27272a",
  borderRadius:8, padding:"9px 12px", color:"#fafafa", fontSize:"0.875rem",
  boxSizing:"border-box",
};
const lbl: React.CSSProperties = {
  color:"#71717a", fontSize:"0.72rem", textTransform:"uppercase",
  letterSpacing:"0.05em", marginBottom:5, display:"block",
};

export default function DealsPage() {
  const supabase = createClient();
  const isMobile = useIsMobile();

  // List state
  const [deals,           setDeals]           = useState<any[]>(() => getCache<any[]>("deals") ?? []);
  const [loading,         setLoading]         = useState(!getCache<any[]>("deals"));
  const [search,          setSearch]          = useState("");
  const [stageFilter,     setStageFilter]     = useState("all");
  const [userId,          setUserId]          = useState("");
  const [userName,        setUserName]        = useState("");
  const [commissionTiers, setCommissionTiers] = useState<any[]>(() => getCache<any[]>("commission_tiers") ?? []);

  // Add deal modal
  const [showAdd, setShowAdd] = useState(false);
  const [newDeal, setNewDeal] = useState({ title:"", company:"", contact_name:"", contact_email:"", contact_phone:"", value:"", stage:"prospecting", probability:"20", expected_close_date:"", notes:"" });
  const [saving,  setSaving]  = useState(false);
  const [addMsg,  setAddMsg]  = useState("");

  // Detail modal
  const [selected,         setSelected]         = useState<any>(null);
  const [detailEdit,       setDetailEdit]       = useState<any>(null);
  const [activities,       setActivities]       = useState<any[]>([]);
  const [detailSaving,     setDetailSaving]     = useState(false);
  const [detailMsg,        setDetailMsg]        = useState<{ok:boolean;text:string}|null>(null);
  const [rollbackConfirm,  setRollbackConfirm]  = useState(false);
  const [advanceConfirm,   setAdvanceConfirm]   = useState(false);
  const [notesWarning,     setNotesWarning]     = useState(false);
  const [deleteConfirm,    setDeleteConfirm]    = useState(false);
  const [actLoading,       setActLoading]       = useState(false);

  // DASH import state
  const [dashModal,     setDashModal]     = useState(false);
  const [dashJobs,      setDashJobs]      = useState<any[]>([]);
  const [dashSelected,  setDashSelected]  = useState<Set<number>>(new Set());
  const [dashLoading,   setDashLoading]   = useState(false);
  const [dashImporting, setDashImporting] = useState(false);
  const [dashError,     setDashError]     = useState("");
  const [dashImported,  setDashImported]  = useState(0);

  // Spreadsheet import state
  const [importModal,    setImportModal]    = useState(false);
  const [importDeals,    setImportDeals]    = useState<any[]>([]);
  const [importSelected, setImportSelected] = useState<Set<number>>(new Set());
  const [importLoading,  setImportLoading]  = useState(false);
  const [importSaving,   setImportSaving]   = useState(false);
  const [importError,    setImportError]    = useState("");
  const [importDone,     setImportDone]     = useState(0);
  const [importDetected, setImportDetected] = useState<string[]>([]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const [{ data }, { data: tiersData }, { data: profile }] = await Promise.all([
      supabase.from("deals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("commission_tiers").select("*").eq("user_id", user.id),
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    ]);
    const fresh = data || [];
    setDeals(fresh); setCache("deals", fresh);
    setCommissionTiers(tiersData || []); setCache("commission_tiers", tiersData || []);
    setUserName(profile?.full_name ?? "");
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function loadActivities(dealId: string) {
    setActLoading(true);
    const { data } = await supabase.from("activities").select("*").eq("deal_id", dealId).order("occurred_at", { ascending: false });
    setActivities(data || []);
    setActLoading(false);
  }

  function openDetail(deal: any) {
    setSelected(deal);
    setDetailEdit({ ...deal });
    setDetailMsg(null);
    setRollbackConfirm(false);
    setAdvanceConfirm(false);
    setDeleteConfirm(false);
    loadActivities(deal.id);
  }

  function closeDetail() {
    setSelected(null);
    setDetailEdit(null);
    setActivities([]);
    setDetailMsg(null);
    setNotesWarning(false);
  }

  async function handleDetailSave() {
    if (!selected) return;
    setDetailSaving(true);
    const { error } = await supabase.from("deals").update({
      title:               detailEdit.title,
      company:             detailEdit.company,
      contact_name:        detailEdit.contact_name,
      contact_email:       detailEdit.contact_email,
      contact_phone:       detailEdit.contact_phone || null,
      value:               parseFloat(detailEdit.value) || 0,
      notes:               detailEdit.notes || null,
      updated_at:          new Date().toISOString(),
    }).eq("id", selected.id);
    if (!error) {
      setDetailMsg({ ok:true, text:"Saved!" });
      await load();
      const updated = deals.find(d => d.id === selected.id);
      if (updated) setSelected({ ...updated, ...detailEdit });
      setTimeout(() => setDetailMsg(null), 2000);
    } else {
      setDetailMsg({ ok:false, text: error.message });
    }
    setDetailSaving(false);
  }

  async function handleAdvanceStage() {
    if (!selected) return;
    const currentIdx = STAGES.indexOf(detailEdit.stage);
    if (currentIdx >= STAGES.length - 1) return;
    const nextStage = STAGES[currentIdx + 1];
    const { error } = await supabase.from("deals").update({ stage: nextStage, updated_at: new Date().toISOString() }).eq("id", selected.id);
    if (!error) {
      await supabase.from("activities").insert({ user_id: userId, deal_id: selected.id, type:"stage_change", title:`${STAGE_LABELS[detailEdit.stage]} → ${STAGE_LABELS[nextStage]}`, occurred_at: new Date().toISOString() });
      setDetailEdit((p:any) => ({ ...p, stage: nextStage }));
      setSelected((p:any) => ({ ...p, stage: nextStage }));
      await load();
      await loadActivities(selected.id);
    }
    setAdvanceConfirm(false);
  }

  async function handleRollback() {
    if (!selected) return;
    const currentIdx = STAGES.indexOf(detailEdit.stage);
    if (currentIdx <= 0) return;
    const prevStage = STAGES[currentIdx - 1];
    const { error } = await supabase.from("deals").update({ stage: prevStage, updated_at: new Date().toISOString() }).eq("id", selected.id);
    if (!error) {
      await supabase.from("activities").insert({ user_id: userId, deal_id: selected.id, type:"stage_change", title:`Rolled back: ${STAGE_LABELS[detailEdit.stage]} → ${STAGE_LABELS[prevStage]}`, occurred_at: new Date().toISOString() });
      setDetailEdit((p:any) => ({ ...p, stage: prevStage }));
      setSelected((p:any) => ({ ...p, stage: prevStage }));
      await load();
      await loadActivities(selected.id);
    }
    setRollbackConfirm(false);
  }

  async function handleDelete() {
    if (!selected) return;
    await supabase.from("activities").insert({ user_id: userId, deal_id: selected.id, type:"note", title:"Deal deleted", occurred_at: new Date().toISOString() });
    await supabase.from("deals").delete().eq("id", selected.id);
    closeDetail();
    await load();
    setDeleteConfirm(false);
  }

  async function handleAddDeal(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setAddMsg("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { error } = await supabase.from("deals").insert({
      user_id: session.user.id, title: newDeal.title, company: newDeal.company,
      contact_name: newDeal.contact_name, contact_email: newDeal.contact_email,
      contact_phone: newDeal.contact_phone || null, value: parseFloat(newDeal.value) || 0,
      stage: newDeal.stage, probability: parseInt(newDeal.probability) || 20,
      expected_close_date: newDeal.expected_close_date || null, notes: newDeal.notes || null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    if (!error) {
      setNewDeal({ title:"", company:"", contact_name:"", contact_email:"", contact_phone:"", value:"", stage:"prospecting", probability:"20", expected_close_date:"", notes:"" });
      setShowAdd(false); await load();
    } else setAddMsg(error.message);
    setSaving(false);
  }

  // DASH handlers
  async function handleDashFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setDashLoading(true); setDashError(""); setDashJobs([]); setDashSelected(new Set());
    const fd = new FormData(); fd.append("file", file);
    try {
      const res = await fetch("/api/dash/import",{method:"POST",body:fd});
      const json = await res.json();
      if (!res.ok || json.error) setDashError(json.error ?? "Parse failed");
      else { setDashJobs(json.jobs||[]); setDashSelected(new Set((json.jobs||[]).map((_:any,i:number)=>i))); }
    } catch(err:any) { setDashError(err?.message ?? "Upload failed"); }
    setDashLoading(false); e.target.value="";
  }
  async function handleDashImport() {
    if (!userId||dashSelected.size===0) return;
    setDashImporting(true); let imported=0;
    for (const idx of Array.from(dashSelected)) {
      const job=dashJobs[idx]; if (!job) continue;
      try {
        const res=await fetch("/api/apollo/pipeline",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:userId,contact_name:job.contact_name,contact_email:null,contact_phone:null,company:job.company,title:job.title,linkedin_url:null,value:job.value,stage:job.stage,notes:job.notes})});
        if (res.ok) imported++;
      } catch {}
    }
    setDashImported(imported); setDashImporting(false);
    setTimeout(async()=>{ setDashModal(false); setDashJobs([]); setDashSelected(new Set()); setDashImported(0); await load(); }, 1800);
  }

  // Spreadsheet import handlers
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImportLoading(true); setImportError(""); setImportDeals([]); setImportSelected(new Set());
    const fd = new FormData(); fd.append("file", file);
    try {
      const res=await fetch("/api/deals/import",{method:"POST",body:fd});
      const json=await res.json();
      if (!res.ok||json.error) setImportError(json.error??"Parse failed");
      else { setImportDeals(json.deals||[]); setImportDetected(json.detected||[]); setImportSelected(new Set((json.deals||[]).map((_:any,i:number)=>i))); }
    } catch(err:any) { setImportError(err?.message??"Upload failed"); }
    setImportLoading(false); e.target.value="";
  }
  async function handleImportSave() {
    if (!userId||importSelected.size===0) return;
    setImportSaving(true); let done=0;
    for (const idx of Array.from(importSelected)) {
      const d=importDeals[idx]; if (!d) continue;
      try {
        const res=await fetch("/api/apollo/pipeline",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:userId,title:d.title,company:d.company,contact_name:d.contact_name,contact_email:d.contact_email,contact_phone:d.contact_phone,value:d.value,stage:d.stage,notes:d.notes})});
        if (res.ok) done++;
      } catch {}
    }
    setImportDone(done); setImportSaving(false);
    setTimeout(async()=>{ setImportModal(false); setImportDeals([]); setImportSelected(new Set()); setImportDone(0); await load(); }, 1800);
  }

  const filtered = deals.filter(d => {
    const matchSearch = !search || [d.title,d.company,d.contact_name,d.contact_email].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchStage  = stageFilter==="all" || d.stage===stageFilter;
    return matchSearch && matchStage;
  });

  const stageIdx    = (s: string) => STAGES.indexOf(s);
  const currentIdx  = selected ? stageIdx(detailEdit?.stage) : -1;
  const canAdvance  = selected && currentIdx < STAGES.length - 1;
  const canRollback = selected && currentIdx > 0;

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: isMobile ? 16 : 28, maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ display:"flex", flexDirection:isMobile?"column":"row", justifyContent:"space-between", alignItems:isMobile?"flex-start":"center", marginBottom:24, gap:12 }}>
        <div>
          <h1 style={{ fontSize:"1.5rem", fontWeight:800, color:"#fafafa", margin:"0 0 3px", fontFamily:"var(--font-cinzel,serif)", letterSpacing:"0.06em", textTransform:"uppercase" }}>Leads & Pipeline</h1>
          <p style={{ color:"#52525b", fontSize:"0.82rem", margin:0 }}>{deals.length} total deals</p>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", width:isMobile?"100%":"auto" }}>
          <label style={{ background:"#1c1c1f", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:8, padding:"8px 14px", fontWeight:600, fontSize:"0.82rem", cursor:"pointer", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>
            📂 Import DASH
            <input type="file" accept=".xls,.xlsx,.html,.htm" style={{ display:"none" }} onChange={e=>{ setDashModal(true); setDashError(""); setDashJobs([]); handleDashFile(e); }} />
          </label>
          <label style={{ background:"#1c1c1f", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:8, padding:"8px 14px", fontWeight:600, fontSize:"0.82rem", cursor:"pointer", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>
            📥 Import Spreadsheet
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={e=>{ setImportModal(true); setImportError(""); setImportDeals([]); handleImportFile(e); }} />
          </label>
          <button onClick={()=>setShowAdd(true)} style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"8px 18px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", whiteSpace:"nowrap" }}>
            + Add Lead
          </button>
        </div>
      </div>

      {/* Search + stage filter */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        <input style={{ ...inp, flex:1, minWidth:200, maxWidth:320 }} placeholder="Search leads, companies, contacts..."
          value={search} onChange={e=>setSearch(e.target.value)} />
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {[{id:"all",label:"All"},...STAGES.map(s=>({id:s,label:STAGE_LABELS[s]}))].map(s=>(
            <button key={s.id} onClick={()=>setStageFilter(s.id)}
              style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${stageFilter===s.id?(STAGE_COLORS[s.id]||"#C9A84C"):"#27272a"}`,
                background: stageFilter===s.id?(STAGE_COLORS[s.id]||"#C9A84C")+"22":"transparent",
                color: stageFilter===s.id?(STAGE_COLORS[s.id]||"#C9A84C"):"#71717a",
                fontSize:"0.75rem", fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TABLE ────────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#52525b" }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:"60px 0", textAlign:"center" }}>
          <div style={{ fontSize:"2.5rem", marginBottom:12 }}>📋</div>
          <p style={{ color:"#52525b", fontSize:"0.95rem", margin:"0 0 6px" }}>{search || stageFilter!=="all" ? "No deals match your filters." : "No deals yet."}</p>
          {!search && stageFilter==="all" && <p style={{ color:"#3f3f46", fontSize:"0.82rem", margin:0 }}>Click <strong style={{ color:"#C9A84C" }}>+ Add Lead</strong> to get started</p>}
        </div>
      ) : isMobile ? (
        /* Mobile card list */
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map(deal => {
            const sc = STAGE_COLORS[deal.stage] ?? "#71717a";
            return (
              <div key={deal.id} onClick={()=>openDetail(deal)}
                style={{ background:"#111113", border:"1px solid #27272a", borderLeft:`3px solid ${sc}`, borderRadius:10, padding:"14px 16px", cursor:"pointer" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                    <div style={{ width:36, height:36, borderRadius:"50%", background:"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.75rem", fontWeight:700, color:"#C9A84C", flexShrink:0 }}>
                      {initials(deal.contact_name, deal.company)}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <p style={{ color:"#fafafa", fontWeight:700, fontSize:"0.9rem", margin:"0 0 2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{deal.title || deal.company}</p>
                      <p style={{ color:"#52525b", fontSize:"0.75rem", margin:0 }}>{deal.company || deal.contact_name || "—"}</p>
                    </div>
                  </div>
                  <span style={{ color:"#C9A84C", fontWeight:800, fontSize:"0.95rem", fontFamily:"monospace", flexShrink:0, marginLeft:8 }}>{fmt(deal.value)}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:"0.72rem", fontWeight:600, color:sc, background:sc+"22", padding:"2px 8px", borderRadius:4 }}>{STAGE_LABELS[deal.stage]}</span>
                  <span style={{ color:"#52525b", fontSize:"0.72rem" }}>{timeAgo(deal.updated_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop table */
        <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #1c1c1f" }}>
                {["CLIENT","COMPANY / SERVICE","VALUE","STAGE","REP","ACTIVITY",""].map(h=>(
                  <th key={h} style={{ padding:"11px 16px", textAlign:"left", color:"#52525b", fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(deal => {
                const sc = STAGE_COLORS[deal.stage] ?? "#71717a";
                return (
                  <tr key={deal.id} onClick={()=>openDetail(deal)}
                    style={{ borderBottom:"1px solid #18181b", cursor:"pointer", transition:"background 0.1s" }}
                    onMouseEnter={e=>(e.currentTarget.style.background="#18181b")}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                    {/* CLIENT */}
                    <td style={{ padding:"12px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:34, height:34, borderRadius:"50%", background:"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.7rem", fontWeight:700, color:"#C9A84C", flexShrink:0 }}>
                          {initials(deal.contact_name, deal.company)}
                        </div>
                        <div style={{ minWidth:0 }}>
                          <p style={{ color:"#fafafa", fontWeight:600, fontSize:"0.85rem", margin:"0 0 1px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:220 }}>{deal.title || deal.company}</p>
                          {deal.contact_email && <p style={{ color:"#52525b", fontSize:"0.72rem", margin:0 }}>{deal.contact_email}</p>}
                        </div>
                      </div>
                    </td>
                    {/* COMPANY / SERVICE */}
                    <td style={{ padding:"12px 16px", color:"#a1a1aa", fontSize:"0.82rem", whiteSpace:"nowrap" }}>{deal.company || "—"}</td>
                    {/* VALUE */}
                    <td style={{ padding:"12px 16px", color:"#C9A84C", fontWeight:700, fontFamily:"monospace", fontSize:"0.88rem", whiteSpace:"nowrap" }}>{fmt(deal.value)}</td>
                    {/* STAGE */}
                    <td style={{ padding:"12px 16px" }}>
                      <span style={{ fontSize:"0.72rem", fontWeight:700, color:sc, background:sc+"22", padding:"3px 10px", borderRadius:20, whiteSpace:"nowrap" }}>{STAGE_LABELS[deal.stage]}</span>
                    </td>
                    {/* REP */}
                    <td style={{ padding:"12px 16px", color:"#71717a", fontSize:"0.82rem", whiteSpace:"nowrap" }}>{deal.contact_name || userName || "—"}</td>
                    {/* ACTIVITY */}
                    <td style={{ padding:"12px 16px", color:"#52525b", fontSize:"0.78rem", whiteSpace:"nowrap" }}>{timeAgo(deal.updated_at)}</td>
                    {/* ACTION */}
                    <td style={{ padding:"12px 16px" }}>
                      <button onClick={e=>{e.stopPropagation();openDetail(deal);}}
                        style={{ background:"none", border:"1px solid #27272a", color:"#71717a", borderRadius:6, padding:"4px 8px", cursor:"pointer", fontSize:"0.75rem" }}>
                        👁
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DEAL DETAIL MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:500, display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center", padding:isMobile?0:16 }}>
          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:isMobile?"16px 16px 0 0":"14px", width:"100%", maxWidth:680, maxHeight:isMobile?"92dvh":"88vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Modal header */}
            <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid #1c1c1f", flexShrink:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                <h2 style={{ color:"#fafafa", fontWeight:800, fontSize:"1.1rem", margin:0, lineHeight:1.3, paddingRight:16 }}>{selected.title || selected.company}</h2>
                <button onClick={closeDetail} style={{ background:"none", border:"none", color:"#52525b", fontSize:"1.3rem", cursor:"pointer", flexShrink:0, lineHeight:1, padding:"0 0 0 8px" }}>✕</button>
              </div>

              {/* Stage progress bar */}
              <div style={{ position:"relative", marginBottom:10 }}>
                {/* Track */}
                <div style={{ height:4, background:"#27272a", borderRadius:2, position:"relative" }}>
                  <div style={{ height:"100%", borderRadius:2, background:"#C9A84C", width:`${Math.max(0,(currentIdx/(STAGES.length-3))*100)}%`, maxWidth:"100%", transition:"width 0.3s" }} />
                </div>
                {/* Stage dots */}
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                  {STAGES.filter(s=>s!=="closed_lost").map((s,i)=>{
                    const active = STAGES.indexOf(detailEdit?.stage) >= STAGES.indexOf(s);
                    const current = detailEdit?.stage === s;
                    const sc = STAGE_COLORS[s];
                    return (
                      <div key={s} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:current?sc:active?"#C9A84C":"#27272a", border:`2px solid ${current?sc:active?"#C9A84C":"#27272a"}`, transition:"all 0.2s" }} />
                        <span style={{ fontSize:"0.6rem", color:current?sc:active?"#a1a1aa":"#3f3f46", fontWeight:current?700:400, whiteSpace:"nowrap" }}>{STAGE_LABELS[s]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Roll back button */}
              {canRollback && (
                <button onClick={()=>setRollbackConfirm(true)}
                  style={{ background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.25)", color:"#C9A84C", borderRadius:6, padding:"4px 12px", fontSize:"0.75rem", fontWeight:600, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4 }}>
                  ↶ Roll back to {STAGE_LABELS[STAGES[currentIdx-1]]}
                </button>
              )}
            </div>

            {/* Modal body — scrollable */}
            <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>

              {/* CLIENT INFO / DEAL INFO */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16, marginBottom:20 }}>
                <div>
                  <p style={{ color:"#C9A84C", fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 10px" }}>Client Info</p>
                  <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                    {selected.contact_phone && (
                      <a href={`tel:${selected.contact_phone.replace(/\D/g,"").replace(/^(\d{10})$/,"+1$1")}`}
                        style={{ display:"flex", alignItems:"center", gap:8, color:"#34d399", fontSize:"0.82rem", textDecoration:"none" }}>
                        <span style={{ color:"#52525b" }}>📞</span>{selected.contact_phone}
                      </a>
                    )}
                    {selected.contact_email && (
                      <a href={`mailto:${selected.contact_email}?subject=${encodeURIComponent("Following up — "+(selected.company||selected.title||""))}`}
                        style={{ display:"flex", alignItems:"center", gap:8, color:"#60a5fa", fontSize:"0.82rem", textDecoration:"none" }}>
                        <span style={{ color:"#52525b" }}>✉</span>{selected.contact_email}
                      </a>
                    )}
                    {selected.contact_name && (
                      <div style={{ display:"flex", alignItems:"center", gap:8, color:"#a1a1aa", fontSize:"0.82rem" }}>
                        <span style={{ color:"#52525b" }}>👤</span>{selected.contact_name}
                      </div>
                    )}
                    {!selected.contact_phone && !selected.contact_email && !selected.contact_name && (
                      <p style={{ color:"#3f3f46", fontSize:"0.82rem" }}>No contact info</p>
                    )}
                  </div>
                </div>
                <div>
                  <p style={{ color:"#C9A84C", fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 10px" }}>Deal Info</p>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ color:"#52525b", fontSize:"0.78rem" }}>Value</span>
                      <span style={{ color:"#C9A84C", fontWeight:700, fontFamily:"monospace", fontSize:"0.88rem" }}>{fmt(selected.value)}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ color:"#52525b", fontSize:"0.78rem" }}>Stage</span>
                      <span style={{ fontSize:"0.72rem", fontWeight:700, color:STAGE_COLORS[detailEdit?.stage], background:(STAGE_COLORS[detailEdit?.stage]||"#71717a")+"22", padding:"2px 8px", borderRadius:4 }}>{STAGE_LABELS[detailEdit?.stage]}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ color:"#52525b", fontSize:"0.78rem" }}>Rep</span>
                      <span style={{ color:"#a1a1aa", fontSize:"0.78rem" }}>{userName || "—"}</span>
                    </div>
                    {selected.expected_close_date && (
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <span style={{ color:"#52525b", fontSize:"0.78rem" }}>Close Date</span>
                        <span style={{ color:"#a1a1aa", fontSize:"0.78rem" }}>{new Date(selected.expected_close_date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Inline edit — title, company, value, phone, email */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={lbl}>Deal Title</label>
                  <input style={inp} value={detailEdit?.title??""} onChange={e=>setDetailEdit((p:any)=>({...p,title:e.target.value}))} />
                </div>
                <div>
                  <label style={lbl}>Company</label>
                  <input style={inp} value={detailEdit?.company??""} onChange={e=>setDetailEdit((p:any)=>({...p,company:e.target.value}))} />
                </div>
                <div>
                  <label style={lbl}>Value ($)</label>
                  <input style={inp} type="number" value={detailEdit?.value??""} onChange={e=>setDetailEdit((p:any)=>({...p,value:e.target.value}))} />
                </div>
                <div>
                  <label style={lbl}>Contact Name</label>
                  <input style={inp} value={detailEdit?.contact_name??""} onChange={e=>setDetailEdit((p:any)=>({...p,contact_name:e.target.value}))} />
                </div>
                <div>
                  <label style={lbl}>Contact Email</label>
                  <input style={inp} type="email" value={detailEdit?.contact_email??""} onChange={e=>setDetailEdit((p:any)=>({...p,contact_email:e.target.value}))} />
                </div>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={lbl}>Contact Phone</label>
                  <input style={inp} type="tel" value={detailEdit?.contact_phone??""} onChange={e=>setDetailEdit((p:any)=>({...p,contact_phone:e.target.value}))} />
                </div>
              </div>

              {/* Scope notes */}
              <div style={{ marginBottom:20 }}>
                <label style={lbl}>Scope Notes</label>
                <textarea style={{ ...inp, resize:"vertical", minHeight:80 }}
                  placeholder="Describe the project scope, materials, timeline considerations..."
                  value={detailEdit?.notes??""} onChange={e=>{ setDetailEdit((p:any)=>({...p,notes:e.target.value})); if (e.target.value.trim()) setNotesWarning(false); }} />
              </div>

              {/* Save button */}
              <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:24, gap:8 }}>
                {detailMsg && <p style={{ color:detailMsg.ok?"#34d399":"#f87171", fontSize:"0.82rem", margin:"auto 0" }}>{detailMsg.text}</p>}
                <button onClick={handleDetailSave} disabled={detailSaving}
                  style={{ background:"#27272a", border:"1px solid #3f3f46", color:"#a1a1aa", borderRadius:8, padding:"7px 16px", fontWeight:600, fontSize:"0.82rem", cursor:"pointer" }}>
                  {detailSaving?"Saving...":"Save Changes"}
                </button>
              </div>

              {/* Activity log */}
              <div>
                <p style={{ color:"#52525b", fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 12px" }}>Activity Log</p>
                {actLoading ? (
                  <p style={{ color:"#52525b", fontSize:"0.82rem" }}>Loading...</p>
                ) : activities.length === 0 ? (
                  <p style={{ color:"#3f3f46", fontSize:"0.82rem" }}>No activity yet.</p>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                    {activities.map((act, i) => {
                      const isRollback = act.title?.includes("Rolled back");
                      const isStage    = act.type === "stage_change";
                      return (
                        <div key={act.id} style={{ display:"flex", alignItems:"flex-start", gap:10, paddingBottom:i<activities.length-1?12:0, position:"relative" }}>
                          {/* Timeline line */}
                          {i < activities.length-1 && (
                            <div style={{ position:"absolute", left:14, top:28, bottom:0, width:1, background:"#1c1c1f" }} />
                          )}
                          {/* Icon */}
                          <div style={{ width:28, height:28, borderRadius:"50%", background:isRollback?"rgba(113,113,122,0.15)":isStage?"rgba(201,168,76,0.12)":"#18181b", border:`1px solid ${isRollback?"#27272a":isStage?"rgba(201,168,76,0.2)":"#1c1c1f"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"0.65rem" }}>
                            {isRollback?"↩":isStage?"↑":"·"}
                          </div>
                          <div style={{ flex:1, paddingTop:4 }}>
                            <p style={{ color:isRollback?"#71717a":"#a1a1aa", fontSize:"0.82rem", margin:"0 0 1px" }}>{act.title}</p>
                            <p style={{ color:"#3f3f46", fontSize:"0.7rem", margin:0 }}>
                              {new Date(act.occurred_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})} · {new Date(act.occurred_at).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 24-hour delete link */}
                {canDelete(selected, userId) && (
                  <div style={{ marginTop:20, paddingTop:16, borderTop:"1px solid #1c1c1f", textAlign:"center" }}>
                    <button onClick={()=>setDeleteConfirm(true)}
                      style={{ background:"none", border:"none", color:"#f87171", fontSize:"0.78rem", cursor:"pointer", textDecoration:"underline" }}>
                      Delete this lead
                    </button>
                    <p style={{ color:"#3f3f46", fontSize:"0.68rem", margin:"4px 0 0" }}>Permanently deletes this lead and all its data</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ padding:"14px 24px", borderTop:"1px solid #1c1c1f", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0, gap:10 }}>
              {notesWarning && STAGES[currentIdx+1]==="closed_won" && (
                <div style={{ flex:1, display:"flex", alignItems:"center", gap:8, background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.25)", borderRadius:8, padding:"8px 12px" }}>
                  <span style={{ fontSize:"0.85rem" }}>⚠️</span>
                  <span style={{ color:"#fbbf24", fontSize:"0.78rem", fontWeight:600 }}>Scope notes required before marking Won</span>
                </div>
              )}
              <button onClick={closeDetail}
                style={{ background:"none", border:"1px solid #27272a", color:"#71717a", borderRadius:8, padding:"8px 16px", fontSize:"0.85rem", cursor:"pointer" }}>
                Close
              </button>
              {canAdvance && (
                <button onClick={()=>{
                  const nextStage = STAGES[currentIdx+1];
                  if (nextStage==="closed_won" && !(detailEdit?.notes?.trim())) {
                    setNotesWarning(true);
                    return;
                  }
                  setNotesWarning(false);
                  setAdvanceConfirm(true);
                }}
                  style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"8px 20px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer" }}>
                  Advance Stage →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Rollback confirm ─────────────────────────────────────────────────── */}
      {rollbackConfirm && selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:24, width:"100%", maxWidth:360 }}>
            <h3 style={{ color:"#fafafa", fontWeight:700, fontSize:"1rem", margin:"0 0 6px" }}>Roll back stage?</h3>
            <p style={{ color:"#71717a", fontSize:"0.85rem", margin:"0 0 4px" }}>
              Roll back from <strong style={{ color:STAGE_COLORS[detailEdit?.stage] }}>{STAGE_LABELS[detailEdit?.stage]}</strong> to <strong style={{ color:STAGE_COLORS[STAGES[currentIdx-1]] }}>{STAGE_LABELS[STAGES[currentIdx-1]]}</strong>?
            </p>
            <p style={{ color:"#52525b", fontSize:"0.75rem", margin:"0 0 20px" }}>This action will be logged.</p>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={()=>setRollbackConfirm(false)} style={{ background:"none", border:"1px solid #27272a", color:"#71717a", borderRadius:8, padding:"7px 16px", fontSize:"0.85rem", cursor:"pointer" }}>Cancel</button>
              <button onClick={handleRollback} style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"7px 16px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer" }}>Confirm rollback</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Advance confirm ──────────────────────────────────────────────────── */}
      {advanceConfirm && selected && canAdvance && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:24, width:"100%", maxWidth:360 }}>
            <h3 style={{ color:"#fafafa", fontWeight:700, fontSize:"1rem", margin:"0 0 6px" }}>Advance stage?</h3>
            <p style={{ color:"#71717a", fontSize:"0.85rem", margin:"0 0 4px" }}>
              Move from <strong style={{ color:STAGE_COLORS[detailEdit?.stage] }}>{STAGE_LABELS[detailEdit?.stage]}</strong> to <strong style={{ color:STAGE_COLORS[STAGES[currentIdx+1]] }}>{STAGE_LABELS[STAGES[currentIdx+1]]}</strong>?
            </p>
            <p style={{ color:"#52525b", fontSize:"0.75rem", margin:"0 0 20px" }}>This action will be logged.</p>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={()=>setAdvanceConfirm(false)} style={{ background:"none", border:"1px solid #27272a", color:"#71717a", borderRadius:8, padding:"7px 16px", fontSize:"0.85rem", cursor:"pointer" }}>Cancel</button>
              <button onClick={handleAdvanceStage} style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"7px 16px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer" }}>Advance Stage →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ───────────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:24, width:"100%", maxWidth:360 }}>
            <h3 style={{ color:"#f87171", fontWeight:700, fontSize:"1rem", margin:"0 0 8px" }}>Delete this lead?</h3>
            <p style={{ color:"#71717a", fontSize:"0.85rem", margin:"0 0 20px" }}>This cannot be undone.</p>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={()=>setDeleteConfirm(false)} style={{ background:"none", border:"1px solid #27272a", color:"#71717a", borderRadius:8, padding:"7px 16px", fontSize:"0.85rem", cursor:"pointer" }}>Cancel</button>
              <button onClick={handleDelete} style={{ background:"rgba(248,113,113,0.15)", border:"1px solid rgba(248,113,113,0.3)", color:"#f87171", borderRadius:8, padding:"7px 16px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Lead Modal ───────────────────────────────────────────────────── */}
      {showAdd && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:14, padding:28, width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h2 style={{ color:"#fafafa", fontWeight:700, margin:0 }}>New Lead</h2>
              <button onClick={()=>setShowAdd(false)} style={{ background:"none", border:"none", color:"#52525b", fontSize:"1.2rem", cursor:"pointer" }}>✕</button>
            </div>
            <form onSubmit={handleAddDeal} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              {[{label:"Deal Title *",key:"title",full:true},{label:"Company",key:"company"},{label:"Contact Name",key:"contact_name"},{label:"Contact Email",key:"contact_email",type:"email"},{label:"Contact Phone",key:"contact_phone",type:"tel"},{label:"Value ($) *",key:"value",type:"number"},{label:"Probability (%)",key:"probability",type:"number"},{label:"Expected Close",key:"expected_close_date",type:"date",maxWidth:240}].map((f:any)=>(
                <div key={f.key} style={{ gridColumn:(f as any).full?"1/-1":undefined }}>
                  <label style={lbl}>{f.label}</label>
                  <input style={{ ...inp, maxWidth:f.maxWidth }} type={f.type||"text"} value={(newDeal as any)[f.key]} onChange={e=>setNewDeal((p:any)=>({...p,[f.key]:e.target.value}))} required={f.label.includes("*")} />
                </div>
              ))}
              <div style={{ gridColumn:"1/-1" }}>
                <label style={lbl}>Stage</label>
                <select style={inp} value={newDeal.stage} onChange={e=>setNewDeal(p=>({...p,stage:e.target.value}))}>
                  {STAGES.map(s=><option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={lbl}>Commission Tier</label>
                <select style={inp} value={newDeal.commission_tier_id||""} onChange={e=>setNewDeal((p:any)=>({...p,commission_tier_id:e.target.value}))}>
                  <option value="">— None —</option>
                  {commissionTiers.map((t:any)=><option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>)}
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={lbl}>Notes</label>
                <textarea style={{ ...inp, resize:"vertical", minHeight:60 }} value={newDeal.notes} onChange={e=>setNewDeal(p=>({...p,notes:e.target.value}))} />
              </div>
              {addMsg && <p style={{ gridColumn:"1/-1", color:"#f87171", fontSize:"0.82rem", margin:0 }}>{addMsg}</p>}
              <div style={{ gridColumn:"1/-1", display:"flex", justifyContent:"flex-end", gap:10 }}>
                <button type="button" onClick={()=>setShowAdd(false)} style={{ background:"none", border:"1px solid #27272a", color:"#71717a", borderRadius:8, padding:"8px 16px", fontSize:"0.85rem", cursor:"pointer" }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"8px 20px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer" }}>{saving?"Saving...":"Add Lead"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DASH Import Modal ─────────────────────────────────────────────────── */}
      {dashModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:14, padding:28, width:"100%", maxWidth:700, maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ color:"#fafafa", fontWeight:700, fontSize:"1.05rem", margin:0 }}>📂 Import DASH Deals</h2>
              <button onClick={()=>{setDashModal(false);setDashJobs([]);setDashSelected(new Set());setDashError("");}} style={{ background:"none",border:"none",color:"#52525b",fontSize:"1.2rem",cursor:"pointer" }}>✕</button>
            </div>
            {dashLoading && <div style={{ textAlign:"center",padding:"40px 0",color:"#71717a" }}>Parsing DASH export...</div>}
            {dashError && !dashLoading && <div style={{ background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:8,padding:"12px 16px",marginBottom:16 }}><p style={{ color:"#f87171",fontSize:"0.85rem",margin:0 }}>{dashError}</p></div>}
            {!dashLoading && !dashError && dashJobs.length===0 && (
              <div style={{ textAlign:"center",padding:"32px 0",color:"#52525b" }}>
                <div style={{ fontSize:"2.5rem",marginBottom:12 }}>📊</div>
                <p style={{ margin:"0 0 16px",fontSize:"0.9rem",color:"#a1a1aa" }}>Upload your DASH Open Jobs export</p>
                <label style={{ background:"#C9A84C",color:"#000",borderRadius:8,padding:"9px 20px",fontWeight:700,fontSize:"0.85rem",cursor:"pointer" }}>
                  Choose File<input type="file" accept=".xls,.xlsx,.html,.htm" style={{ display:"none" }} onChange={handleDashFile} />
                </label>
              </div>
            )}
            {dashJobs.length>0 && !dashLoading && (
              <>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                  <span style={{ color:"#52525b",fontSize:"0.82rem" }}>{dashJobs.length} deals · {dashSelected.size} selected</span>
                  <div style={{ display:"flex",gap:8 }}>
                    <button onClick={()=>setDashSelected(new Set(dashJobs.map((_:any,i:number)=>i)))} style={{ background:"none",border:"1px solid #27272a",color:"#a1a1aa",borderRadius:6,padding:"4px 10px",fontSize:"0.75rem",cursor:"pointer" }}>Select All</button>
                    <button onClick={()=>setDashSelected(new Set())} style={{ background:"none",border:"1px solid #27272a",color:"#a1a1aa",borderRadius:6,padding:"4px 10px",fontSize:"0.75rem",cursor:"pointer" }}>Clear</button>
                  </div>
                </div>
                <div style={{ flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:6,marginBottom:16 }}>
                  {dashJobs.map((job:any,idx:number)=>{
                    const sel=dashSelected.has(idx);const sc=STAGE_COLORS[job.stage]??"#71717a";
                    return (<div key={idx} onClick={()=>setDashSelected(prev=>{const n=new Set(prev);n.has(idx)?n.delete(idx):n.add(idx);return n;})} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:sel?"#18181b":"#0f0f10",border:`1px solid ${sel?"#27272a":"#1c1c1f"}`,borderLeft:`3px solid ${sel?sc:"#27272a"}`,borderRadius:8,cursor:"pointer" }}>
                      <div style={{ width:18,height:18,borderRadius:4,border:`2px solid ${sel?"#C9A84C":"#27272a"}`,background:sel?"#C9A84C":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"0.7rem",color:"#000",fontWeight:700 }}>{sel?"✓":""}</div>
                      <div style={{ flex:1,minWidth:0 }}><span style={{ color:sel?"#fafafa":"#71717a",fontWeight:700,fontSize:"0.85rem" }}>{job.title}</span>{job.company&&<p style={{ color:"#52525b",fontSize:"0.75rem",margin:"2px 0 0" }}>{job.company}</p>}</div>
                      <p style={{ color:job.value>0?"#C9A84C":"#3f3f46",fontWeight:700,fontSize:"0.88rem",margin:0,fontFamily:"monospace" }}>{job.value>=1000?"$"+(job.value/1000).toFixed(1)+"K":job.value>0?"$"+job.value:"—"}</p>
                    </div>);
                  })}
                </div>
                {dashImported>0&&<div style={{ background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:8,padding:"10px 14px",marginBottom:12 }}><p style={{ color:"#34d399",fontSize:"0.85rem",margin:0,fontWeight:600 }}>✓ {dashImported} deal{dashImported!==1?"s":""} added</p></div>}
                <div style={{ display:"flex",gap:10,justifyContent:"flex-end",borderTop:"1px solid #1c1c1f",paddingTop:16 }}>
                  <button onClick={()=>{setDashModal(false);setDashJobs([]);setDashSelected(new Set());setDashError("");}} style={{ background:"none",border:"1px solid #27272a",color:"#71717a",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:"0.85rem" }}>Cancel</button>
                  <button onClick={handleDashImport} disabled={dashImporting||dashSelected.size===0} style={{ background:"#C9A84C",color:"#000",border:"none",borderRadius:8,padding:"8px 20px",fontWeight:700,fontSize:"0.85rem",cursor:"pointer",opacity:dashSelected.size>0&&!dashImporting?1:0.5 }}>{dashImporting?"Adding...":`Add ${dashSelected.size} Deal${dashSelected.size!==1?"s":""}`}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Spreadsheet Import Modal ──────────────────────────────────────────── */}
      {importModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:700, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:14, padding:28, width:"100%", maxWidth:720, maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ color:"#fafafa", fontWeight:700, fontSize:"1.05rem", margin:0 }}>📥 Import from Spreadsheet</h2>
              <button onClick={()=>{setImportModal(false);setImportDeals([]);setImportSelected(new Set());setImportError("");}} style={{ background:"none",border:"none",color:"#52525b",fontSize:"1.2rem",cursor:"pointer" }}>✕</button>
            </div>
            {importLoading&&<div style={{ textAlign:"center",padding:"40px 0",color:"#71717a" }}>Parsing file...</div>}
            {importError&&!importLoading&&<div style={{ background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:8,padding:"12px 16px",marginBottom:16 }}><p style={{ color:"#f87171",fontSize:"0.85rem",margin:"0 0 4px",fontWeight:600 }}>Could not parse file</p><p style={{ color:"#a1a1aa",fontSize:"0.82rem",margin:0 }}>{importError}</p></div>}
            {!importLoading&&!importError&&importDeals.length===0&&(
              <div style={{ textAlign:"center",padding:"32px 0",color:"#52525b" }}>
                <div style={{ fontSize:"2.5rem",marginBottom:12 }}>📊</div>
                <p style={{ margin:"0 0 20px",fontSize:"0.9rem",color:"#a1a1aa" }}>Upload an Excel or CSV file</p>
                <div style={{ display:"flex",gap:10,justifyContent:"center" }}>
                  <label style={{ background:"#C9A84C",color:"#000",borderRadius:8,padding:"9px 20px",fontWeight:700,fontSize:"0.85rem",cursor:"pointer" }}>Choose File<input type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={handleImportFile} /></label>
                  <a href="/api/deals/template" download style={{ background:"#1c1c1f",border:"1px solid #27272a",color:"#a1a1aa",borderRadius:8,padding:"9px 20px",fontWeight:600,fontSize:"0.85rem",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6 }}>↓ Template</a>
                </div>
              </div>
            )}
            {importDeals.length>0&&!importLoading&&(
              <>
                <div style={{ background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.15)",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",gap:16,flexWrap:"wrap",alignItems:"center" }}>
                  <span style={{ color:"#34d399",fontSize:"0.82rem",fontWeight:600 }}>✓ {importDeals.length} rows detected</span>
                  <span style={{ color:"#52525b",fontSize:"0.78rem" }}>Columns: {importDetected.join(", ")}</span>
                </div>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                  <span style={{ color:"#52525b",fontSize:"0.82rem" }}>{importSelected.size} of {importDeals.length} selected</span>
                  <div style={{ display:"flex",gap:8 }}>
                    <button onClick={()=>setImportSelected(new Set(importDeals.map((_:any,i:number)=>i)))} style={{ background:"none",border:"1px solid #27272a",color:"#a1a1aa",borderRadius:6,padding:"4px 10px",fontSize:"0.75rem",cursor:"pointer" }}>Select All</button>
                    <button onClick={()=>setImportSelected(new Set())} style={{ background:"none",border:"1px solid #27272a",color:"#a1a1aa",borderRadius:6,padding:"4px 10px",fontSize:"0.75rem",cursor:"pointer" }}>Clear</button>
                  </div>
                </div>
                <div style={{ flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:5,marginBottom:16 }}>
                  {importDeals.map((d:any,idx:number)=>{
                    const sel=importSelected.has(idx);const sc=STAGE_COLORS[d.stage]??"#71717a";
                    return (<div key={idx} onClick={()=>setImportSelected(prev=>{const n=new Set(prev);n.has(idx)?n.delete(idx):n.add(idx);return n;})} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:sel?"#18181b":"#0f0f10",border:`1px solid ${sel?"#27272a":"#1c1c1f"}`,borderLeft:`3px solid ${sel?sc:"#27272a"}`,borderRadius:8,cursor:"pointer" }}>
                      <div style={{ width:18,height:18,borderRadius:4,border:`2px solid ${sel?"#C9A84C":"#27272a"}`,background:sel?"#C9A84C":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"0.7rem",color:"#000",fontWeight:700 }}>{sel?"✓":""}</div>
                      <div style={{ flex:1,minWidth:0 }}><span style={{ color:sel?"#fafafa":"#71717a",fontWeight:700,fontSize:"0.85rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:280,display:"block" }}>{d.title}</span>{d.company&&<span style={{ color:"#52525b",fontSize:"0.73rem" }}>{d.company}</span>}</div>
                      <div style={{ textAlign:"right",flexShrink:0 }}>
                        <p style={{ color:d.value>0?"#C9A84C":"#3f3f46",fontWeight:700,fontSize:"0.88rem",margin:0,fontFamily:"monospace" }}>{d.value>=1000?"$"+(d.value/1000).toFixed(1)+"K":d.value>0?"$"+d.value:"—"}</p>
                        <span style={{ fontSize:"0.68rem",fontWeight:600,color:sc,background:sc+"22",padding:"1px 6px",borderRadius:4 }}>{STAGE_LABELS[d.stage]??d.stage}</span>
                      </div>
                    </div>);
                  })}
                </div>
                {importDone>0&&<div style={{ background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:8,padding:"10px 14px",marginBottom:12 }}><p style={{ color:"#34d399",fontSize:"0.85rem",margin:0,fontWeight:600 }}>✓ {importDone} deal{importDone!==1?"s":""} imported</p></div>}
                <div style={{ display:"flex",gap:10,justifyContent:"flex-end",borderTop:"1px solid #1c1c1f",paddingTop:16 }}>
                  <a href="/api/deals/template" download style={{ background:"none",border:"1px solid #27272a",color:"#71717a",borderRadius:8,padding:"8px 14px",fontSize:"0.82rem",textDecoration:"none",display:"flex",alignItems:"center" }}>↓ Template</a>
                  <button onClick={()=>{setImportModal(false);setImportDeals([]);setImportSelected(new Set());setImportError("");}} style={{ background:"none",border:"1px solid #27272a",color:"#71717a",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:"0.85rem" }}>Cancel</button>
                  <button onClick={handleImportSave} disabled={importSaving||importSelected.size===0} style={{ background:"#C9A84C",color:"#000",border:"none",borderRadius:8,padding:"8px 20px",fontWeight:700,fontSize:"0.85rem",cursor:"pointer",opacity:importSelected.size>0&&!importSaving?1:0.5 }}>{importSaving?"Importing...":`Import ${importSelected.size} Deal${importSelected.size!==1?"s":""}`}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
