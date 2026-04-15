"use client";
import { useState, useEffect } from "react";
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

interface Prospect {
  id: string;
  first_name: string | null;
  last_name:  string | null;
  name:       string | null;
  title:      string | null;
  email:      string | null;
  phone:      string | null;
  linkedin_url: string | null;
  organization?: { name?: string; website_url?: string; estimated_num_employees?: number; } | null;
  city:    string | null;
  state:   string | null;
  country: string | null;
  seniority: string | null;
}

interface DashJob {
  job_number: string;
  title: string;
  company: string | null;
  contact_name: string | null;
  value: number;
  stage: string;
  dash_status: string;
  location: string;
  received_date: string | null;
  notes: string | null;
  description: string | null;
}

const SENIORITY_OPTS = ["owner","founder","c_suite","partner","vp","head","director","manager","senior","mid","junior","entry"];
const COMPANY_SIZE_OPTS = [
  { label:"1–10",    value:"1,10"    },
  { label:"11–50",   value:"11,50"   },
  { label:"51–200",  value:"51,200"  },
  { label:"201–500", value:"201,500" },
  { label:"501–1000",value:"501,1000"},
  { label:"1000+",   value:"1001,10000"},
];

const inp: React.CSSProperties = {
  width:"100%", background:"#1c1c1f", border:"1px solid #27272a",
  borderRadius:8, padding:"9px 12px", color:"#fafafa",
  fontSize:"0.85rem", boxSizing:"border-box",
};
const lbl: React.CSSProperties = {
  color:"#71717a", fontSize:"0.72rem", textTransform:"uppercase",
  letterSpacing:"0.05em", marginBottom:5, display:"block",
};

function pill(active: boolean, color = "#C9A84C"): React.CSSProperties {
  return {
    padding:"4px 12px", borderRadius:20, border:`1px solid ${active ? color : "#27272a"}`,
    background: active ? color+"22" : "transparent",
    color: active ? color : "#71717a",
    fontSize:"0.75rem", fontWeight:600, cursor:"pointer", whiteSpace:"nowrap",
  };
}

export default function ProspectsPage() {
  const supabase = createClient();
  const router   = useRouter();
  const isMobile = useIsMobile();

  const [userId,   setUserId]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [prospects,setProspects]= useState<Prospect[]>([]);

  // Credit wallet state
  const [credits,       setCredits]       = useState<number | null>(null);
  const [isInternal,    setIsInternal]    = useState(false);
  const [creditsLoading,setCreditsLoading] = useState(true);
  const [buyModal,      setBuyModal]      = useState(false);
  const [purchasing,    setPurchasing]    = useState<string | null>(null);
  const [creditMsg,     setCreditMsg]     = useState("");
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [totalPages,setTotalPages] = useState(1);
  const [error,    setError]    = useState("");

  // Filters
  const [keywords,    setKeywords]    = useState("");
  const [titles,      setTitles]      = useState("");
  const [location,    setLocation]    = useState("");
  const [seniorities, setSeniorities] = useState<string[]>([]);
  const [companySizes,setCompanySizes]= useState<string[]>([]);

  // Per-prospect state
  const [enriching,   setEnriching]   = useState<Record<string,boolean>>({});
  const [enriched,    setEnriched]    = useState<Record<string,any>>({});
  const [addingPipeline, setAddingPipeline] = useState<Record<string,boolean>>({});
  const [addedPipeline,  setAddedPipeline]  = useState<Record<string,string>>({});  // id → deal_id

  // DASH import state
  const [dashModal,     setDashModal]     = useState(false);
  const [dashJobs,      setDashJobs]      = useState<DashJob[]>([]);
  const [dashSelected,  setDashSelected]  = useState<Set<number>>(new Set());
  const [dashLoading,   setDashLoading]   = useState(false);
  const [dashImporting, setDashImporting] = useState(false);
  const [dashError,     setDashError]     = useState("");
  const [dashImported,  setDashImported]  = useState(0);

  // Load credit balance — show cached value instantly, refresh in background
  useEffect(() => {
    // Step 1: Show cached value immediately (zero network delay)
    const cached = localStorage.getItem("ss_credits_cache");
    if (cached) {
      try {
        const { balance, is_internal } = JSON.parse(cached);
        setIsInternal(is_internal);
        setCredits(is_internal ? null : balance);
      } catch {}
    }
    setCreditsLoading(false);

    // Step 2: Fetch fresh value in background, update silently
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch("/api/credits/balance", {
            headers: { "Authorization": `Bearer ${session.access_token}` },
          });
          const json = await res.json();
          if (!json.error) {
            setIsInternal(json.is_internal);
            setCredits(json.is_internal ? null : json.balance);
            // Update cache for next visit
            localStorage.setItem("ss_credits_cache", JSON.stringify({
              balance: json.balance,
              is_internal: json.is_internal,
            }));
          }
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data:{ user }}) => {
      if (!user) return;
      setUserId(user.id);
      // Check for post-purchase redirect
      const params = new URLSearchParams(window.location.search);
      if (params.get("credits") === "success") {
        setCreditMsg("Credits added to your account!");
        window.history.replaceState({}, "", "/prospects");
      }
    });
  }, []);

  async function handleSearch(p = 1) {
    setLoading(true); setError(""); setPage(p);
    try {
      const res  = await fetch("/api/apollo/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords:     keywords.trim() || undefined,
          titles:       titles.trim() ? titles.split(",").map(t=>t.trim()).filter(Boolean) : undefined,
          location:     location.trim() ? [location.trim()] : undefined,
          seniority:    seniorities.length ? seniorities : undefined,
          company_size: companySizes.length ? companySizes : undefined,
          page: p, per_page: 25,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setError(json.error ?? "Search failed"); setLoading(false); return; }
      setProspects(json.people || []);
      setTotal(json.total || 0);
      setTotalPages(json.total_pages || 1);
    } catch (err: any) {
      setError(err?.message ?? "Network error");
    }
    setLoading(false);
  }

  async function handleEnrich(p: Prospect) {
    // Check credits before attempting (commercial users only)
    if (!isInternal && credits !== null && credits <= 0) {
      setBuyModal(true);
      return;
    }
    setEnriching(prev => ({ ...prev, [p.id]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res  = await fetch("/api/apollo/enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          person_id:         p.id,
          first_name:        p.first_name,
          last_name:         p.last_name,
          organization_name: p.organization?.name,
          linkedin_url:      p.linkedin_url,
        }),
      });
      const json = await res.json();
      if (res.status === 402) {
        // Insufficient credits
        setBuyModal(true);
      } else if (res.ok && !json.error) {
        setEnriched(prev => ({ ...prev, [p.id]: json }));
        // Deduct from local balance display
        if (!isInternal && credits !== null) {
          setCredits(prev => Math.max((prev ?? 1) - 1, 0));
        }
      }
    } catch {}
    setEnriching(prev => ({ ...prev, [p.id]: false }));
  }

  async function handleBuyCredits(bundleId: string) {
    setPurchasing(bundleId);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/credits/purchase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ bundle_id: bundleId }),
    });
    const json = await res.json();
    if (json.url) {
      window.location.href = json.url;
    } else {
      setPurchasing(null);
      alert("Checkout failed: " + (json.error ?? JSON.stringify(json)));
    }
  }

  async function handleAddPipeline(p: Prospect) {
    if (!userId) return;
    setAddingPipeline(prev => ({ ...prev, [p.id]: true }));
    const contact = enriched[p.id] ?? {};
    try {
      const res  = await fetch("/api/apollo/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id:       userId,
          contact_name:  p.name || [p.first_name, p.last_name].filter(Boolean).join(" "),
          contact_email: contact.email  || p.email  || null,
          contact_phone: contact.phone  || p.phone  || null,
          company:       p.organization?.name || null,
          title:         p.title || null,
          linkedin_url:  p.linkedin_url || null,
        }),
      });
      const json = await res.json();
      if (res.ok && json.deal_id) {
        setAddedPipeline(prev => ({ ...prev, [p.id]: json.deal_id }));
      }
    } catch {}
    setAddingPipeline(prev => ({ ...prev, [p.id]: false }));
  }

  function toggleSeniority(s: string) {
    setSeniorities(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev, s]);
  }
  function toggleSize(s: string) {
    setCompanySizes(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev, s]);
  }

  // DASH import handlers
  async function handleDashFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDashLoading(true); setDashError(""); setDashJobs([]); setDashSelected(new Set());
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res  = await fetch("/api/dash/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) { setDashError(json.error ?? "Parse failed"); }
      else {
        setDashJobs(json.jobs || []);
        // Select all by default
        setDashSelected(new Set((json.jobs || []).map((_: any, i: number) => i)));
      }
    } catch (err: any) { setDashError(err?.message ?? "Upload failed"); }
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
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
    // Close after short delay
    setTimeout(() => { setDashModal(false); setDashJobs([]); setDashSelected(new Set()); setDashImported(0); }, 2000);
  }

  function toggleDashJob(idx: number) {
    setDashSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  function fmt(n: number) {
    if (n >= 1_000_000) return "$" + (n/1_000_000).toFixed(2) + "M";
    if (n >= 1_000)     return "$" + (n/1_000).toFixed(1) + "K";
    return n > 0 ? "$" + n.toFixed(0) : "—";
  }

  const STAGE_CLR: Record<string,string> = {
    prospecting:"#71717a", qualification:"#60a5fa", proposal:"#a78bfa",
    negotiation:"#fbbf24", closed_won:"#C9A84C", closed_lost:"#f87171",
  };
  const STAGE_LBL: Record<string,string> = {
    prospecting:"Prospecting", qualification:"Qualified", proposal:"Proposal",
    negotiation:"Negotiation", closed_won:"Won", closed_lost:"Lost",
  };

  const fullName = (p: Prospect) => p.name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "—";

  return (
    <div style={{ padding: isMobile ? 16 : 28, maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize:"1.5rem", fontWeight:800, color:"#fafafa", margin:"0 0 4px", fontFamily:"var(--font-cinzel,serif)", letterSpacing:"0.06em", textTransform:"uppercase" }}>
          Prospect Finder
        </h1>
        <p style={{ color:"#52525b", fontSize:"0.82rem", margin:0 }}>
          Powered by Hilltop Ave · Search contacts, enrich with email/phone, add to pipeline
        </p>
      </div>

      {/* Credit balance bar */}
      {!isInternal && !creditsLoading && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"10px 16px", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:"0.82rem", color:"#71717a" }}>Enrichment Credits</span>
            <span style={{ fontSize:"1rem", fontWeight:700, color: credits === 0 ? "#f87171" : "#C9A84C" }}>
              {credits ?? 0}
            </span>
            {credits === 0 && <span style={{ fontSize:"0.72rem", color:"#f87171" }}>— out of credits</span>}
          </div>
          <button onClick={() => setBuyModal(true)}
            style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:7, padding:"6px 16px", fontWeight:700, fontSize:"0.78rem", cursor:"pointer" }}>
            + Buy Credits
          </button>
        </div>
      )}
      {creditMsg && (
        <div style={{ background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:8, padding:"10px 16px", marginBottom:12 }}>
          <p style={{ color:"#34d399", fontSize:"0.85rem", margin:0, fontWeight:600 }}>✓ {creditMsg}</p>
        </div>
      )}

      {/* DASH Import button */}
      <div style={{ marginBottom: 16, display:"flex", justifyContent:"flex-end" }}>
        <label style={{ background:"#1c1c1f", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:8, padding:"8px 16px", fontWeight:600, fontSize:"0.82rem", cursor:"pointer", display:"flex", alignItems:"center", gap:8 }}
          onClick={() => setDashModal(true)}>
          📂 Import DASH Deals
          <input type="file" accept=".xls,.xlsx,.html,.htm" style={{ display:"none" }}
            onChange={e => { setDashModal(true); setDashError(""); setDashJobs([]); handleDashFile(e); }} />
        </label>
      </div>

      {/* ── Filter Panel ─────────────────────────────────────────────────────── */}
      <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:20, marginBottom:20 }}>
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap:14, marginBottom:16 }}>
          <div>
            <label style={lbl}>Keywords</label>
            <input style={inp} placeholder="e.g. restoration, commercial roofing"
              value={keywords} onChange={e => setKeywords(e.target.value)}
              onKeyDown={e => e.key==="Enter" && handleSearch(1)} />
          </div>
          <div>
            <label style={lbl}>Job Titles <span style={{ color:"#3f3f46", fontWeight:400 }}>(comma-separated)</span></label>
            <input style={inp} placeholder="e.g. VP Operations, Facilities Manager"
              value={titles} onChange={e => setTitles(e.target.value)}
              onKeyDown={e => e.key==="Enter" && handleSearch(1)} />
          </div>
          <div>
            <label style={lbl}>Location</label>
            <input style={inp} placeholder="e.g. Kansas City, MO"
              value={location} onChange={e => setLocation(e.target.value)}
              onKeyDown={e => e.key==="Enter" && handleSearch(1)} />
          </div>
        </div>

        {/* Seniority pills */}
        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Seniority</label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {SENIORITY_OPTS.map(s => (
              <button key={s} onClick={() => toggleSeniority(s)} style={pill(seniorities.includes(s))}>
                {s.replace("_"," ").replace(/\w/g,c=>c.toUpperCase())}
              </button>
            ))}
          </div>
        </div>

        {/* Company size pills */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Company Size</label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {COMPANY_SIZE_OPTS.map(s => (
              <button key={s.value} onClick={() => toggleSize(s.value)} style={pill(companySizes.includes(s.value))}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={() => { setKeywords(""); setTitles(""); setLocation(""); setSeniorities([]); setCompanySizes([]); setProspects([]); setTotal(0); }}
            style={{ background:"none", border:"1px solid #27272a", color:"#71717a", borderRadius:8, padding:"8px 16px", fontSize:"0.85rem", cursor:"pointer" }}>
            Clear
          </button>
          <button onClick={() => handleSearch(1)} disabled={loading}
            style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"8px 24px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", opacity:loading?0.7:1 }}>
            {loading ? "Searching..." : "Search Prospects"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
          <p style={{ color:"#f87171", fontSize:"0.85rem", margin:0 }}>{error}</p>
        </div>
      )}

      {/* Results header */}
      {prospects.length > 0 && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <p style={{ color:"#52525b", fontSize:"0.82rem", margin:0 }}>
            {total.toLocaleString()} results · page {page} of {totalPages}
          </p>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => handleSearch(page-1)} disabled={page<=1||loading}
              style={{ background:"#1c1c1f", border:"1px solid #27272a", color: page<=1?"#3f3f46":"#a1a1aa", borderRadius:6, padding:"5px 12px", fontSize:"0.78rem", cursor:page<=1?"not-allowed":"pointer" }}>
              ← Prev
            </button>
            <button onClick={() => handleSearch(page+1)} disabled={page>=totalPages||loading}
              style={{ background:"#1c1c1f", border:"1px solid #27272a", color:page>=totalPages?"#3f3f46":"#a1a1aa", borderRadius:6, padding:"5px 12px", fontSize:"0.78rem", cursor:page>=totalPages?"not-allowed":"pointer" }}>
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Results Grid ─────────────────────────────────────────────────────── */}
      {prospects.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {prospects.map(p => {
            const name       = fullName(p);
            const company    = p.organization?.name ?? "—";
            const location   = [p.city, p.state, p.country].filter(Boolean).join(", ") || "—";
            const enrichData = enriched[p.id];
            const isEnriching = enriching[p.id];
            const dealId     = addedPipeline[p.id];
            const isAdding   = addingPipeline[p.id];

            return (
              <div key={p.id} style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:"16px 18px" }}>
                <div style={{ display:"flex", flexDirection: isMobile?"column":"row", gap:14, alignItems: isMobile?"flex-start":"center" }}>

                  {/* Avatar */}
                  <div style={{ width:44, height:44, borderRadius:"50%", background:"rgba(201,168,76,0.12)", border:"1px solid rgba(201,168,76,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem", fontWeight:700, color:"#C9A84C", flexShrink:0 }}>
                    {(p.first_name?.[0] ?? p.name?.[0] ?? "?").toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:3 }}>
                      <span style={{ color:"#fafafa", fontWeight:700, fontSize:"0.95rem" }}>{name}</span>
                      {p.seniority && (
                        <span style={{ fontSize:"0.68rem", fontWeight:600, color:"#C9A84C", background:"rgba(201,168,76,0.1)", padding:"2px 8px", borderRadius:4 }}>
                          {p.seniority.replace("_"," ").toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p style={{ color:"#a1a1aa", fontSize:"0.82rem", margin:"0 0 2px" }}>{p.title || "—"}</p>
                    <p style={{ color:"#71717a", fontSize:"0.78rem", margin:0 }}>{company} · {location}</p>

                    {/* Enriched data */}
                    {enrichData && (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginTop:8 }}>
                        {enrichData.email && (
                          <a href={`mailto:${enrichData.email}`} style={{ color:"#60a5fa", fontSize:"0.78rem", textDecoration:"none" }}>
                            ✉ {enrichData.email}
                          </a>
                        )}
                        {enrichData.phone && (
                          <a href={`tel:${enrichData.phone}`} style={{ color:"#34d399", fontSize:"0.78rem", textDecoration:"none" }}>
                            📞 {enrichData.phone}
                          </a>
                        )}
                        {!enrichData.email && !enrichData.phone && (
                          <span style={{ color:"#52525b", fontSize:"0.78rem" }}>No contact info found</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display:"flex", gap:8, flexShrink:0, flexWrap:"wrap" }}>
                    {p.linkedin_url && (
                      <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer"
                        style={{ background:"#1c1c1f", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:8, padding:"7px 12px", fontSize:"0.75rem", textDecoration:"none", display:"flex", alignItems:"center", gap:5 }}>
                        in LinkedIn
                      </a>
                    )}

                    {!enrichData ? (
                      <button onClick={() => handleEnrich(p)} disabled={isEnriching}
                        style={{ background:"#1c1c1f", border:"1px solid #27272a", color:isEnriching?"#52525b":"#a1a1aa", borderRadius:8, padding:"7px 14px", fontSize:"0.78rem", fontWeight:600, cursor:isEnriching?"not-allowed":"pointer" }}>
                        {isEnriching ? "Enriching..." : "⚡ Get Contact Info"}
                      </button>
                    ) : null}

                    {dealId ? (
                      <button onClick={() => router.push(`/deals/${dealId}`)}
                        style={{ background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.3)", color:"#34d399", borderRadius:8, padding:"7px 14px", fontSize:"0.78rem", fontWeight:700, cursor:"pointer" }}>
                        ✓ View Deal →
                      </button>
                    ) : (
                      <button onClick={() => handleAddPipeline(p)} disabled={isAdding}
                        style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"7px 16px", fontSize:"0.78rem", fontWeight:700, cursor:isAdding?"not-allowed":"pointer", opacity:isAdding?0.7:1 }}>
                        {isAdding ? "Adding..." : "+ Add to Pipeline"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── DASH Import Modal ───────────────────────────────────────────────── */}
      {dashModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:14, padding:28, width:"100%", maxWidth:700, maxHeight:"85vh", display:"flex", flexDirection:"column" }}>

            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div>
                <h2 style={{ color:"#fafafa", fontWeight:700, fontSize:"1.05rem", margin:"0 0 3px" }}>📂 Import DASH Deals</h2>
                <p style={{ color:"#52525b", fontSize:"0.78rem", margin:0 }}>Select which jobs to add to your Signal Strike pipeline</p>
              </div>
              <button onClick={() => { setDashModal(false); setDashJobs([]); setDashSelected(new Set()); setDashError(""); }}
                style={{ background:"none", border:"none", color:"#52525b", fontSize:"1.2rem", cursor:"pointer" }}>✕</button>
            </div>

            {/* Loading */}
            {dashLoading && (
              <div style={{ textAlign:"center", padding:"40px 0", color:"#71717a" }}>
                <p>Parsing DASH export...</p>
              </div>
            )}

            {/* Error */}
            {dashError && !dashLoading && (
              <div style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:8, padding:"12px 16px", marginBottom:16 }}>
                <p style={{ color:"#f87171", fontSize:"0.85rem", margin:0 }}>{dashError}</p>
              </div>
            )}

            {/* No file yet */}
            {!dashLoading && !dashError && dashJobs.length === 0 && (
              <div style={{ textAlign:"center", padding:"32px 0", color:"#52525b" }}>
                <div style={{ fontSize:"2.5rem", marginBottom:12 }}>📊</div>
                <p style={{ margin:"0 0 8px", fontSize:"0.9rem", color:"#a1a1aa" }}>Upload your DASH Open Jobs export</p>
                <p style={{ margin:"0 0 16px", fontSize:"0.8rem", lineHeight:1.6 }}>
                  In DASH: <strong style={{ color:"#71717a" }}>Reports → Open Jobs → Export to Excel</strong>
                </p>
                <label style={{ background:"#C9A84C", color:"#000", borderRadius:8, padding:"9px 20px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", display:"inline-block" }}>
                  Choose File
                  <input type="file" accept=".xls,.xlsx,.html,.htm" style={{ display:"none" }} onChange={handleDashFile} />
                </label>
              </div>
            )}

            {/* Job list */}
            {dashJobs.length > 0 && !dashLoading && (
              <>
                {/* Select all bar */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <span style={{ color:"#52525b", fontSize:"0.82rem" }}>
                    {dashJobs.length} jobs found · {dashSelected.size} selected
                  </span>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => setDashSelected(new Set(dashJobs.map((_,i)=>i)))}
                      style={{ background:"none", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:6, padding:"4px 10px", fontSize:"0.75rem", cursor:"pointer" }}>
                      Select All
                    </button>
                    <button onClick={() => setDashSelected(new Set())}
                      style={{ background:"none", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:6, padding:"4px 10px", fontSize:"0.75rem", cursor:"pointer" }}>
                      Clear
                    </button>
                  </div>
                </div>

                {/* Job rows */}
                <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
                  {dashJobs.map((job, idx) => {
                    const selected  = dashSelected.has(idx);
                    const stageClr  = STAGE_CLR[job.stage] ?? "#71717a";
                    return (
                      <div key={idx} onClick={() => toggleDashJob(idx)}
                        style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background: selected ? "#18181b" : "#0f0f10", border:`1px solid ${selected ? "#27272a" : "#1c1c1f"}`, borderLeft:`3px solid ${selected ? stageClr : "#27272a"}`, borderRadius:8, cursor:"pointer" }}>
                        {/* Checkbox */}
                        <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${selected ? "#C9A84C" : "#27272a"}`, background: selected ? "#C9A84C" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"0.7rem", color:"#000", fontWeight:700 }}>
                          {selected ? "✓" : ""}
                        </div>
                        {/* Info */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                            <span style={{ color: selected?"#fafafa":"#71717a", fontWeight:700, fontSize:"0.85rem" }}>{job.title}</span>
                            <span style={{ fontSize:"0.68rem", fontWeight:600, color:stageClr, background:stageClr+"22", padding:"2px 7px", borderRadius:4 }}>
                              {job.dash_status}
                            </span>
                          </div>
                          {job.company && <p style={{ color:"#52525b", fontSize:"0.75rem", margin:"2px 0 0" }}>{job.company}</p>}
                        </div>
                        {/* Value */}
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <p style={{ color: job.value > 0 ? "#C9A84C" : "#3f3f46", fontWeight:700, fontSize:"0.88rem", margin:0, fontFamily:"monospace" }}>
                            {fmt(job.value)}
                          </p>
                          {job.received_date && <p style={{ color:"#3f3f46", fontSize:"0.7rem", margin:"2px 0 0" }}>{job.received_date}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Success message */}
                {dashImported > 0 && (
                  <div style={{ background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:8, padding:"10px 14px", marginBottom:12 }}>
                    <p style={{ color:"#34d399", fontSize:"0.85rem", margin:0, fontWeight:600 }}>✓ {dashImported} job{dashImported!==1?"s":""} added to pipeline</p>
                  </div>
                )}

                {/* Footer */}
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end", borderTop:"1px solid #1c1c1f", paddingTop:16 }}>
                  <button onClick={() => { setDashModal(false); setDashJobs([]); setDashSelected(new Set()); setDashError(""); }}
                    style={{ background:"none", border:"1px solid #27272a", color:"#71717a", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontSize:"0.85rem" }}>
                    Cancel
                  </button>
                  <button onClick={handleDashImport} disabled={dashImporting || dashSelected.size === 0}
                    style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"8px 20px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", opacity: dashSelected.size > 0 && !dashImporting ? 1 : 0.5 }}>
                    {dashImporting ? "Adding to Pipeline..." : `Add ${dashSelected.size} Job${dashSelected.size!==1?"s":""} to Pipeline`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Buy Credits Modal ────────────────────────────────────────────────── */}
      {buyModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:800, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:14, padding:32, width:"100%", maxWidth:480 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div>
                <h2 style={{ color:"#fafafa", fontWeight:700, fontSize:"1.1rem", margin:"0 0 4px" }}>Buy Enrichment Credits</h2>
                <p style={{ color:"#52525b", fontSize:"0.78rem", margin:0 }}>Reveal direct email & phone for any prospect</p>
              </div>
              <button onClick={() => setBuyModal(false)} style={{ background:"none", border:"none", color:"#52525b", fontSize:"1.2rem", cursor:"pointer" }}>✕</button>
            </div>

            {[
              { id:"starter",  credits:25,  price:"$4.99",  per:"$0.20/credit", popular:false },
              { id:"standard", credits:100, price:"$14.99", per:"$0.15/credit", popular:true  },
              { id:"pro",      credits:500, price:"$49.99", per:"$0.10/credit", popular:false },
            ].map(b => (
              <div key={b.id} onClick={() => !purchasing && handleBuyCredits(b.id)}
                style={{ background: b.popular ? "rgba(201,168,76,0.08)" : "#18181b", border:`1px solid ${b.popular ? "rgba(201,168,76,0.4)" : "#27272a"}`, borderRadius:10, padding:"14px 18px", marginBottom:10, cursor:purchasing ? "not-allowed" : "pointer", display:"flex", justifyContent:"space-between", alignItems:"center", opacity: purchasing && purchasing !== b.id ? 0.5 : 1 }}>
                <div>
                  <p style={{ color:"#fafafa", fontWeight:700, fontSize:"0.95rem", margin:"0 0 2px" }}>
                    {b.credits} Credits
                    {b.popular && <span style={{ marginLeft:8, fontSize:"0.65rem", fontWeight:700, color:"#C9A84C", background:"rgba(201,168,76,0.15)", padding:"2px 8px", borderRadius:10 }}>BEST VALUE</span>}
                  </p>
                  <p style={{ color:"#71717a", fontSize:"0.75rem", margin:0 }}>{b.per}</p>
                </div>
                <div style={{ textAlign:"right" }}>
                  <p style={{ color:"#C9A84C", fontWeight:800, fontSize:"1.1rem", margin:"0 0 2px" }}>{b.price}</p>
                  <p style={{ color:"#52525b", fontSize:"0.68rem", margin:0 }}>one-time</p>
                </div>
              </div>
            ))}

            {purchasing && (
              <p style={{ color:"#71717a", fontSize:"0.82rem", textAlign:"center", marginTop:12 }}>Redirecting to checkout...</p>
            )}
            <p style={{ color:"#3f3f46", fontSize:"0.72rem", textAlign:"center", marginTop:16 }}>
              Secured by Stripe · No subscription · Credits never expire
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && prospects.length === 0 && !error && (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#3f3f46" }}>
          <div style={{ fontSize:"3rem", marginBottom:12 }}>🔍</div>
          <p style={{ color:"#52525b", fontSize:"0.95rem", margin:"0 0 6px" }}>Search for prospects</p>
          <p style={{ fontSize:"0.82rem", margin:0 }}>Use the filters above to find contacts by title, location, seniority, or company size</p>
        </div>
      )}
    </div>
  );
}
