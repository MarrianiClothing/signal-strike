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

  useEffect(() => {
    supabase.auth.getUser().then(({ data:{ user }}) => { if (user) setUserId(user.id); });
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
    setEnriching(prev => ({ ...prev, [p.id]: true }));
    try {
      const res  = await fetch("/api/apollo/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person_id:         p.id,
          first_name:        p.first_name,
          last_name:         p.last_name,
          organization_name: p.organization?.name,
          linkedin_url:      p.linkedin_url,
        }),
      });
      const json = await res.json();
      if (res.ok && !json.error) {
        setEnriched(prev => ({ ...prev, [p.id]: json }));
      }
    } catch {}
    setEnriching(prev => ({ ...prev, [p.id]: false }));
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

  const fullName = (p: Prospect) => p.name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "—";

  return (
    <div style={{ padding: isMobile ? 16 : 28, maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize:"1.5rem", fontWeight:800, color:"#fafafa", margin:"0 0 4px", fontFamily:"var(--font-cinzel,serif)", letterSpacing:"0.06em", textTransform:"uppercase" }}>
          Prospect Finder
        </h1>
        <p style={{ color:"#52525b", fontSize:"0.82rem", margin:0 }}>
          Powered by Apollo · Search contacts, enrich with email/phone, add to pipeline
        </p>
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
