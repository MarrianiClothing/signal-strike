"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCache, setCache } from "@/lib/cache";

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


const STAGES = [
  { id: "prospecting", label: "Prospecting", color: "#71717a" },
  { id: "qualification", label: "Qualified", color: "#60a5fa" },
  { id: "proposal", label: "Proposal", color: "#a78bfa" },
  { id: "negotiation", label: "Negotiation", color: "#fbbf24" },
  { id: "closed_won", label: "Won", color: "#C9A84C" },
  { id: "closed_lost", label: "Lost", color: "#f87171" },
];

function cleanTitle(title: string, company?: string | null): string {
  if (!title) return title;
  const parts = title.split(" — ");
  if (parts.length === 2) {
    const a = parts[0].trim(), b = parts[1].trim();
    if (a === b) return a;
    if (company && (a === company.trim() || b === company.trim())) return a;
  }
  return title;
}

function fmt(n: number | null | undefined) {
  if (!n || isNaN(n)) return "$0";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}

export default function PipelinePage() {
  const router = useRouter();
  const supabase = createClient();
  const { userId: authUserId, ready: authReady } = useAuth();
  const [deals, setDeals] = useState<any[]>(() => getCache<any[]>("deals") ?? []);
  const [userId, setUserId] = useState(authUserId);
  const [loading, setLoading] = useState(!getCache<any[]>("deals"));
  const [dragging, setDragging] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newDeal, setNewDeal] = useState({ title: "", company: "", contact_name: "", contact_email: "", contact_phone: "", value: "", stage: "prospecting", probability: "20", expected_close_date: "", notes: "", commission_tier_id: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [commissionTiers, setCommissionTiers] = useState<any[]>([]);
  const [filterStage, setFilterStage] = useState("All");
  const isMobile = useIsMobile();

  // DASH import state
  const [dashModal,     setDashModal]     = useState(false);
  const [dashJobs,      setDashJobs]      = useState<any[]>([]);
  const [dashSelected,  setDashSelected]  = useState<Set<number>>(new Set());
  const [dashLoading,   setDashLoading]   = useState(false);
  const [dashImporting, setDashImporting] = useState(false);
  const [dashError,     setDashError]     = useState("");
  const [dashImported,  setDashImported]  = useState(0);

  // Generic spreadsheet import state
  const [importModal,    setImportModal]    = useState(false);
  const [importDeals,    setImportDeals]    = useState<any[]>([]);
  const [importSelected, setImportSelected] = useState<Set<number>>(new Set());
  const [importLoading,  setImportLoading]  = useState(false);
  const [importSaving,   setImportSaving]   = useState(false);
  const [importError,    setImportError]    = useState("");
  const [importDone,     setImportDone]     = useState(0);
  const [importDetected, setImportDetected] = useState<string[]>([]);

  const load = useCallback(async () => {
    // Use getSession (local) instead of getUser (network round-trip)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const uid = session.user.id;
    setUserId(uid);

    // Load cached tiers instantly
    const cachedTiers = getCache<any[]>("commission_tiers");
    if (cachedTiers) setCommissionTiers(cachedTiers);

    const [{ data }, { data: tiersData }] = await Promise.all([
      supabase.from("deals").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("commission_tiers").select("*").eq("user_id", uid).order("rate", { ascending: false }),
    ]);
    const freshDeals = data || [];
    setDeals(freshDeals);
    setCache("deals", freshDeals);
    setCommissionTiers(tiersData || []);
    setCache("commission_tiers", tiersData || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (authReady && authUserId && !userId) setUserId(authUserId);
  }, [authReady, authUserId]);
  useEffect(() => { load(); }, [load]);

  async function handleDrop(stage: string) {
    if (!dragging || dragging === stage) return;
    const deal = deals.find(d => d.id === dragging);
    if (!deal || deal.stage === stage) return;
    setDeals(prev => prev.map(d => d.id === dragging ? { ...d, stage } : d));
    await supabase.from("deals").update({ stage, updated_at: new Date().toISOString() }).eq("id", dragging);
    setDragging(null);
  }

  async function handleAddDeal(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg("");
    const { error } = await supabase.from("deals").insert({
      user_id: userId,
      title: newDeal.title,
      company: newDeal.company,
      contact_name: newDeal.contact_name,
      contact_email: newDeal.contact_email,
      contact_phone: newDeal.contact_phone || null,
      value: parseFloat(newDeal.value) || 0,
      stage: newDeal.stage,
      probability: parseInt(newDeal.probability) || 20,
      expected_close_date: newDeal.expected_close_date || null,
      notes: newDeal.notes || null,
      commission_tier_id: newDeal.commission_tier_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (!error) {
      setNewDeal({ title: "", company: "", contact_name: "", contact_email: "", contact_phone: "", value: "", stage: "prospecting", probability: "20", expected_close_date: "", notes: "", commission_tier_id: "" });
      setShowAdd(false);
      await load();
    } else setMsg(error.message);
    setSaving(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#1c1c1f", border: "1px solid #27272a",
    borderRadius: 8, padding: "9px 12px", color: "#fafafa", fontSize: "0.875rem",
  };

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
    setTimeout(() => {
      setImportModal(false); setImportDeals([]); setImportSelected(new Set()); setImportDone(0);
      load();
    }, 1800);
  }

  if (loading) return <div style={{ padding: 32, color: "#71717a" }}>Loading pipeline...</div>;

  return (
    <div style={{ padding: isMobile ? 16 : 32 }}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: 28, gap: 12, width: "100%", boxSizing: "border-box" as const }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fafafa" }}>Pipeline</h1>
          <p style={{ color: "#71717a", fontSize: "0.82rem", marginTop: 3 }}>{deals.length} deals</p>
        </div>
        {isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            <input
              type="text"
              placeholder="Search pipeline..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, color: "#fafafa", padding: "8px 14px", fontSize: "0.875rem", outline: "none", width: "100%", boxSizing: "border-box" as const }}
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
            <button onClick={() => setShowAdd(true)} style={{ background: "#C9A84C", color: "#000", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", width: "100%" }}>+ Add Deal</button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <input
            type="text"
            placeholder="Search pipeline..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: "#111113", border: "1px solid #27272a", borderRadius: 8,
              color: "#fafafa", padding: "8px 14px", fontSize: "0.875rem",
              outline: "none", flex: isMobile ? 1 : "1 1 180px", minWidth: 120, maxWidth: 220,
            }}
          />
          <label style={{ background:"#1c1c1f", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:8, padding:"9px 16px", fontWeight:600, fontSize:"0.85rem", cursor:"pointer", display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap" }}>
            📂 Import DASH Deals
            <input type="file" accept=".xls,.xlsx,.html,.htm" style={{ display:"none" }}
              onChange={e => { setDashModal(true); setDashError(""); setDashJobs([]); handleDashFile(e); }} />
          </label>
          <label style={{ background:"#1c1c1f", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:8, padding:"9px 16px", fontWeight:600, fontSize:"0.85rem", cursor:"pointer", display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap" }}>
            📥 Import Spreadsheet
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }}
              onChange={e => { setImportModal(true); setImportError(""); setImportDeals([]); handleImportFile(e); }} />
          </label>
            <button onClick={() => setShowAdd(true)} style={{ background: "#C9A84C", color: "#000", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>+ Add Deal</button>
          </div>
        )}
      </div>

      {/* Add Deal Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000000bb", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 14, padding: 28, width: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ color: "#fafafa", fontWeight: 700, marginBottom: 20 }}>New Deal</h2>
            <form onSubmit={handleAddDeal} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { label: "Deal Title *", key: "title", full: true },
                { label: "Company", key: "company" },
                { label: "Contact Name", key: "contact_name" },
                { label: "Contact Email", key: "contact_email", type: "email" },
                { label: "Contact Phone", key: "contact_phone", type: "tel" },
                { label: "Value ($) *", key: "value", type: "number" },
                { label: "Probability (%)", key: "probability", type: "number" },
                { label: "Expected Close", key: "expected_close_date", type: "date" },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: (f as any).full ? "1/-1" : undefined }}>
                  <label style={{ color: "#a1a1aa", fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: 5 }}>{f.label}</label>
                  <input style={inputStyle} type={(f as any).type || "text"} required={f.label.includes("*")}
                    value={(newDeal as any)[f.key]} onChange={e => setNewDeal(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={{ color: "#a1a1aa", fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Stage</label>
                <select style={inputStyle} value={newDeal.stage} onChange={e => setNewDeal(p => ({ ...p, stage: e.target.value }))}>
                  {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              {commissionTiers.length > 0 && (
                <div>
                  <label style={{ color: "#a1a1aa", fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Commission Tier</label>
                  <select style={inputStyle} value={newDeal.commission_tier_id} onChange={e => setNewDeal(p => ({ ...p, commission_tier_id: e.target.value }))}>
                    <option value="">— Select tier —</option>
                    {commissionTiers.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ color: "#a1a1aa", fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Notes</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} value={newDeal.notes} onChange={e => setNewDeal(p => ({ ...p, notes: e.target.value }))} />
              </div>
              {msg && <p style={{ gridColumn: "1/-1", color: "#f87171", fontSize: "0.82rem" }}>{msg}</p>}
              <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowAdd(false)} style={{ background: "#1c1c1f", color: "#fafafa", border: "1px solid #27272a", borderRadius: 8, padding: "9px 18px", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ background: "#C9A84C", color: "#000", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 700, cursor: "pointer" }}>
                  {saving ? "Saving..." : "Add Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stage filter pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {["All", ...STAGES.map(s => s.label)].map(label => {
          const stage = STAGES.find(s => s.label === label);
          const isActive = filterStage === label;
          return (
            <button key={label} onClick={() => setFilterStage(label)} style={{
              padding: "6px 14px", borderRadius: 20, border: "1px solid",
              borderColor: isActive ? (stage?.color ?? "#C9A84C") : "#27272a",
              background: isActive ? (stage?.color ?? "#C9A84C") + "22" : "transparent",
              color: isActive ? (stage?.color ?? "#C9A84C") : "#71717a",
              fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
            }}>{label}</button>
          );
        })}
      </div>

      {/* Pipeline — vertical list on all screen sizes */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 860 }}>
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.id && (!search || d.title?.toLowerCase().includes(search.toLowerCase()) || d.company?.toLowerCase().includes(search.toLowerCase()) || d.contact_name?.toLowerCase().includes(search.toLowerCase())));
          if (stageDeals.length === 0) return null;
          if (filterStage !== "All" && filterStage !== stage.label) return null;
          const stageValue = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
          return (
            <div key={stage.id} style={{ background: "#111113", borderRadius: 12, border: "1px solid #27272a", overflow: "hidden" }}>
              {/* Stage header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid #1c1c1f", background: "#0e0e10" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: stage.color }} />
                  <span style={{ color: "#fafafa", fontSize: "0.9rem", fontWeight: 700 }}>{stage.label}</span>
                  <span style={{ color: "#52525b", fontSize: "0.75rem" }}>({stageDeals.length})</span>
                </div>
                <span style={{ color: stage.color, fontSize: "0.88rem", fontWeight: 700 }}>{fmt(stageValue)}</span>
              </div>
              {/* Deal rows */}
              <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {stageDeals.map(deal => (
                  <div key={deal.id} onClick={() => router.push("/deals/" + deal.id)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#18181b", borderRadius: 8, borderLeft: `3px solid ${stage.color}`, cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#222225")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#18181b")}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {deal.job_number && (
                        <div style={{
                          fontFamily: "ui-monospace, SFMono-Regular, monospace",
                          fontSize: "0.7rem",
                          color: "#C9A84C",
                          letterSpacing: "0.04em",
                          marginBottom: 3,
                        }}>
                          #{deal.job_number}
                        </div>
                      )}
                      <p style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.95rem", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cleanTitle(deal.title, deal.company)}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        {deal.company && <p style={{ color: "#71717a", fontSize: "0.78rem", margin: 0 }}>{deal.company}</p>}
                        {deal.contact_name && deal.contact_name !== deal.company && <p style={{ color: "#52525b", fontSize: "0.75rem", margin: 0 }}>{deal.contact_name}</p>}
                        {deal.expected_close_date && <p style={{ color: "#52525b", fontSize: "0.75rem", margin: 0 }}>Closes {new Date(deal.expected_close_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 20 }}>
                      <p style={{ color: "#C9A84C", fontWeight: 800, fontSize: "1rem", margin: "0 0 3px", fontFamily: "var(--font-cinzel, serif)" }}>{fmt(deal.value)}</p>
                      <p style={{ color: "#52525b", fontSize: "0.72rem", margin: 0 }}>{deal.probability}% probability</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
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

      {/* ── Import Spreadsheet Modal ─────────────────────────────────────────── */}
      {importModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:700, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:14, padding:28, width:"100%", maxWidth:720, maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div>
                <h2 style={{ color:"#fafafa", fontWeight:700, fontSize:"1.05rem", margin:"0 0 3px" }}>📥 Import Deals from Spreadsheet</h2>
                <p style={{ color:"#52525b", fontSize:"0.78rem", margin:0 }}>Excel or CSV — columns detected automatically</p>
              </div>
              <button onClick={() => { setImportModal(false); setImportDeals([]); setImportSelected(new Set()); setImportError(""); }}
                style={{ background:"none", border:"none", color:"#52525b", fontSize:"1.2rem", cursor:"pointer" }}>✕</button>
            </div>

            {importLoading && <div style={{ textAlign:"center", padding:"40px 0", color:"#71717a" }}><p>Parsing file...</p></div>}

            {importError && !importLoading && (
              <div style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:8, padding:"12px 16px", marginBottom:16 }}>
                <p style={{ color:"#f87171", fontSize:"0.85rem", margin:"0 0 4px", fontWeight:600 }}>Could not parse file</p>
                <p style={{ color:"#a1a1aa", fontSize:"0.82rem", margin:0 }}>{importError}</p>
              </div>
            )}

            {!importLoading && !importError && importDeals.length === 0 && (
              <div style={{ textAlign:"center", padding:"32px 0", color:"#52525b" }}>
                <div style={{ fontSize:"2.5rem", marginBottom:12 }}>📊</div>
                <p style={{ margin:"0 0 8px", fontSize:"0.9rem", color:"#a1a1aa" }}>Upload an Excel or CSV file</p>
                <p style={{ margin:"0 0 6px", fontSize:"0.8rem", lineHeight:1.6 }}>Recognized columns: <strong style={{ color:"#71717a" }}>Title, Company, Contact Name, Email, Phone, Value, Stage, Probability, Close Date, Notes</strong></p>
                <p style={{ margin:"0 0 20px", fontSize:"0.78rem", color:"#3f3f46" }}>Column names are flexible — "Deal Name", "Opportunity", "Job" all map to Title</p>
                <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
                  <label style={{ background:"#C9A84C", color:"#000", borderRadius:8, padding:"9px 20px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer" }}>
                    Choose File
                    <input type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={handleImportFile} />
                  </label>
                  <a href="/api/deals/template" download style={{ background:"#1c1c1f", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:8, padding:"9px 20px", fontWeight:600, fontSize:"0.85rem", textDecoration:"none", display:"inline-flex", alignItems:"center", gap:6 }}>
                    ↓ Download Template
                  </a>
                </div>
              </div>
            )}

            {importDeals.length > 0 && !importLoading && (
              <>
                <div style={{ background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.15)", borderRadius:8, padding:"10px 14px", marginBottom:12, display:"flex", gap:16, flexWrap:"wrap", alignItems:"center" }}>
                  <span style={{ color:"#34d399", fontSize:"0.82rem", fontWeight:600 }}>✓ {importDeals.length} rows detected</span>
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
                          {sel?"✓":""}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                            <span style={{ color:sel?"#fafafa":"#71717a", fontWeight:700, fontSize:"0.85rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:280 }}>{d.title}</span>
                            <span style={{ fontSize:"0.68rem", fontWeight:600, color:sc, background:sc+"22", padding:"2px 7px", borderRadius:4 }}>{SL[d.stage]??d.stage}</span>
                          </div>
                          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop:2 }}>
                            {d.company      && <span style={{ color:"#52525b", fontSize:"0.73rem" }}>{d.company}</span>}
                            {d.contact_name && <span style={{ color:"#52525b", fontSize:"0.73rem" }}>· {d.contact_name}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <p style={{ color:d.value>0?"#C9A84C":"#3f3f46", fontWeight:700, fontSize:"0.88rem", margin:0, fontFamily:"monospace" }}>
                            {d.value>=1000000?"$"+(d.value/1000000).toFixed(2)+"M":d.value>=1000?"$"+(d.value/1000).toFixed(1)+"K":d.value>0?"$"+d.value.toFixed(0):"—"}
                          </p>
                          {d.expected_close_date && <p style={{ color:"#3f3f46", fontSize:"0.7rem", margin:"2px 0 0" }}>{d.expected_close_date}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {importDone > 0 && (
                  <div style={{ background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:8, padding:"10px 14px", marginBottom:12 }}>
                    <p style={{ color:"#34d399", fontSize:"0.85rem", margin:0, fontWeight:600 }}>✓ {importDone} deal{importDone!==1?"s":""} imported</p>
                  </div>
                )}
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end", borderTop:"1px solid #1c1c1f", paddingTop:16 }}>
                  <a href="/api/deals/template" download style={{ background:"none", border:"1px solid #27272a", color:"#71717a", borderRadius:8, padding:"8px 14px", fontSize:"0.82rem", textDecoration:"none", display:"flex", alignItems:"center", gap:5 }}>↓ Template</a>
                  <button onClick={() => { setImportModal(false); setImportDeals([]); setImportSelected(new Set()); setImportError(""); }}
                    style={{ background:"none", border:"1px solid #27272a", color:"#71717a", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontSize:"0.85rem" }}>Cancel</button>
                  <button onClick={handleImportSave} disabled={importSaving||importSelected.size===0}
                    style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"8px 20px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", opacity:importSelected.size>0&&!importSaving?1:0.5 }}>
                    {importSaving?"Importing...":`Import ${importSelected.size} Deal${importSelected.size!==1?"s":""}`}
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