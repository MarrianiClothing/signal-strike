"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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

const DEFAULT_MILESTONES = ["Permits & Planning","Demolition","Rough-In","Finishing","Final Inspection"];
const STATUS_COLORS: Record<string,string> = { pending:"#fbbf24", active:"#60a5fa", in_progress:"#a78bfa", completed:"#34d399", on_hold:"#71717a" };
const STATUS_LABELS: Record<string,string> = { pending:"Pending", active:"Active", in_progress:"In Progress", completed:"Completed", on_hold:"On Hold" };

function fmt(n: number|null|undefined) {
  if (!n||isNaN(n)) return "$0";
  if (n>=1_000_000) return "$"+(n/1_000_000).toFixed(2)+"M";
  if (n>=1_000)     return "$"+(n/1_000).toFixed(1)+"K";
  return "$"+n.toFixed(0);
}

const inp: React.CSSProperties = { width:"100%", background:"#1c1c1f", border:"1px solid #27272a", borderRadius:8, padding:"9px 12px", color:"#fafafa", fontSize:"0.875rem", boxSizing:"border-box" };
const lbl: React.CSSProperties = { color:"#71717a", fontSize:"0.72rem", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:5, display:"block" };

export default function ProjectsPage() {
  const router   = useRouter();
  const supabase = createClient();
  const isMobile = useIsMobile();

  const [projects,   setProjects]   = useState<any[]>(() => getCache<any[]>("projects") ?? []);
  const [loading,    setLoading]    = useState(!getCache<any[]>("projects"));
  const [userId,     setUserId]     = useState("");
  const [filter,     setFilter]     = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [wonDeals,   setWonDeals]   = useState<any[]>([]);

  // Create WO form
  const [form,       setForm]       = useState({ name:"", deal_id:"", service_type:"", due_date:"", email_client_updates:true });
  const [milestones, setMilestones] = useState<string[]>([...DEFAULT_MILESTONES]);
  const [newMs,      setNewMs]      = useState("");
  const [saving,     setSaving]     = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: projs } = await supabase
      .from("projects")
      .select("*, deals(title,company,value), work_order_milestones(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const enriched = (projs || []).map((p: any) => {
      const ms = p.work_order_milestones || [];
      const total = ms.length;
      const done  = ms.filter((m: any) => m.completed).length;
      return { ...p, milestoneTotal: total, milestoneDone: done, progress: total > 0 ? Math.round((done/total)*100) : 0 };
    });

    setProjects(enriched);
    setCache("projects", enriched);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function openCreate() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("deals").select("id,title,company,value").eq("user_id", user.id).eq("stage","closed_won").order("updated_at",{ascending:false});
    setWonDeals(data || []);
    setMilestones([...DEFAULT_MILESTONES]);
    setForm({ name:"", deal_id:"", service_type:"", due_date:"", email_client_updates:true });
    setShowCreate(true);
  }

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    const deal = wonDeals.find(d => d.id === form.deal_id);

    // Get next WO number
    const { data: maxRow } = await supabase.from("projects").select("wo_number").order("wo_number",{ascending:false}).limit(1).maybeSingle();
    const nextNum = (maxRow?.wo_number ?? 999) + 1;

    const { data: proj, error } = await supabase.from("projects").insert({
      user_id:               userId,
      name:                  form.name.trim(),
      deal_id:               form.deal_id || null,
      service_type:          form.service_type || deal?.company || null,
      due_date:              form.due_date || null,
      email_client_updates:  form.email_client_updates,
      value:                 deal?.value ?? 0,
      status:                "pending",
      wo_number:             nextNum,
      created_at:            new Date().toISOString(),
    }).select("id").single();

    if (!error && proj) {
      // Insert milestones
      const msRows = milestones.filter(m=>m.trim()).map((name,i) => ({
        project_id: proj.id, user_id: userId, name: name.trim(), sort_order: i, completed: false,
      }));
      if (msRows.length) await supabase.from("work_order_milestones").insert(msRows);
      setShowCreate(false);
      await load();
      router.push(`/projects/${proj.id}`);
    }
    setSaving(false);
  }

  function addMilestone() {
    if (!newMs.trim()) return;
    setMilestones(prev => [...prev, newMs.trim()]);
    setNewMs("");
  }
  function removeMilestone(i: number) { setMilestones(prev => prev.filter((_,idx)=>idx!==i)); }

  const filtered = filter==="all" ? projects : projects.filter(p=>p.status===filter);

  return (
    <div style={{ padding: isMobile?16:28, maxWidth:1200 }}>

      {/* Header */}
      <div style={{ display:"flex", flexDirection:isMobile?"column":"row", justifyContent:"space-between", alignItems:isMobile?"flex-start":"center", marginBottom:24, gap:12 }}>
        <div>
          <h1 style={{ fontSize:"1.5rem", fontWeight:800, color:"#fafafa", margin:"0 0 3px", fontFamily:"var(--font-cinzel,serif)", letterSpacing:"0.06em", textTransform:"uppercase" }}>Work Orders</h1>
          <p style={{ color:"#52525b", fontSize:"0.82rem", margin:0 }}>{projects.length} total</p>
        </div>
        <button onClick={openCreate}
          style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"9px 20px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", whiteSpace:"nowrap" }}>
          + Create Work Order
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap" }}>
        {["all","pending","in_progress","completed","on_hold"].map(s=>(
          <button key={s} onClick={()=>setFilter(s)}
            style={{ padding:"5px 14px", borderRadius:20, border:`1px solid ${filter===s?(STATUS_COLORS[s]||"#C9A84C"):"#27272a"}`,
              background: filter===s?(STATUS_COLORS[s]||"#C9A84C")+"22":"transparent",
              color: filter===s?(STATUS_COLORS[s]||"#C9A84C"):"#71717a",
              fontSize:"0.75rem", fontWeight:600, cursor:"pointer" }}>
            {s==="all"?"All":STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Card grid */}
      {loading ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#52525b" }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:"60px 0", textAlign:"center" }}>
          <div style={{ fontSize:"2.5rem", marginBottom:12 }}>🔨</div>
          <p style={{ color:"#52525b", fontSize:"0.95rem", margin:"0 0 6px" }}>{filter!=="all"?"No work orders with that status.":"No work orders yet."}</p>
          {filter==="all"&&<p style={{ color:"#3f3f46", fontSize:"0.82rem" }}>Create one from a won deal to start tracking</p>}
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
          {filtered.map((p:any) => {
            const sc = STATUS_COLORS[p.status] ?? "#71717a";
            const progress = p.progress ?? 0;
            const deal = p.deals;
            return (
              <div key={p.id} onClick={()=>router.push(`/projects/${p.id}`)}
                style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:20, cursor:"pointer", transition:"border-color 0.15s" }}
                onMouseEnter={e=>(e.currentTarget.style.borderColor="#3f3f46")}
                onMouseLeave={e=>(e.currentTarget.style.borderColor="#27272a")}>

                {/* Card header */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                  <div style={{ minWidth:0 }}>
                    {p.wo_number && <span style={{ color:"#52525b", fontSize:"0.72rem", fontFamily:"monospace" }}>{p.wo_number}</span>}
                    <p style={{ color:"#fafafa", fontWeight:700, fontSize:"1rem", margin:"2px 0 0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:240 }}>{p.name}</p>
                  </div>
                  <span style={{ fontSize:"0.72rem", fontWeight:700, color:sc, background:sc+"22", padding:"3px 10px", borderRadius:20, flexShrink:0, marginLeft:8 }}>
                    {STATUS_LABELS[p.status]??p.status}
                  </span>
                </div>

                {/* Meta row */}
                <div style={{ display:"flex", gap:20, marginBottom:14 }}>
                  <div>
                    <p style={{ color:"#52525b", fontSize:"0.68rem", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 2px" }}>Service</p>
                    <p style={{ color:"#a1a1aa", fontSize:"0.82rem", margin:0 }}>{p.service_type || deal?.company || "—"}</p>
                  </div>
                  {p.due_date && (
                    <div>
                      <p style={{ color:"#52525b", fontSize:"0.68rem", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 2px" }}>Due</p>
                      <p style={{ color:"#a1a1aa", fontSize:"0.82rem", margin:0 }}>
                        {new Date(p.due_date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                      </p>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ color:"#52525b", fontSize:"0.72rem", textTransform:"uppercase", letterSpacing:"0.05em" }}>Progress</span>
                    <span style={{ color: progress===100?"#34d399":"#a1a1aa", fontSize:"0.78rem", fontWeight:700 }}>{progress}%</span>
                  </div>
                  <div style={{ height:6, background:"#27272a", borderRadius:3 }}>
                    <div style={{ height:"100%", borderRadius:3, background: progress===100?"#34d399":"#C9A84C", width:`${progress}%`, transition:"width 0.3s" }} />
                  </div>
                </div>

                {/* Value */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ color:"#C9A84C", fontWeight:800, fontFamily:"monospace", fontSize:"0.95rem" }}>{fmt(p.value||deal?.value)}</span>
                  {p.milestoneDone !== undefined && (
                    <span style={{ color:"#52525b", fontSize:"0.75rem" }}>{p.milestoneDone}/{p.milestoneTotal} milestones</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Work Order Modal ──────────────────────────────────────────── */}
      {showCreate && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:500, display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center", padding:isMobile?0:16 }}>
          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:isMobile?"16px 16px 0 0":"14px", width:"100%", maxWidth:560, maxHeight:isMobile?"92dvh":"90vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Modal header */}
            <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid #1c1c1f", flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <h2 style={{ color:"#fafafa", fontWeight:700, fontSize:"1.05rem", margin:0 }}>Create Work Order</h2>
              <button onClick={()=>setShowCreate(false)} style={{ background:"none", border:"none", color:"#52525b", fontSize:"1.2rem", cursor:"pointer" }}>✕</button>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>

              {/* Source opportunity */}
              <div style={{ marginBottom:14 }}>
                <label style={lbl}>Source Opportunity (Won Leads)</label>
                <select style={inp} value={form.deal_id} onChange={e=>{
                  const deal = wonDeals.find(d=>d.id===e.target.value);
                  setForm(p=>({...p, deal_id:e.target.value, name: deal ? deal.title : p.name }));
                }}>
                  <option value="">Select won lead...</option>
                  {wonDeals.map(d=>(
                    <option key={d.id} value={d.id}>{d.title} — {fmt(d.value)}</option>
                  ))}
                </select>
              </div>

              {/* WO Name */}
              <div style={{ marginBottom:14 }}>
                <label style={lbl}>Work Order Name *</label>
                <input style={inp} placeholder="e.g. Smith Residence — Water Restoration" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} />
              </div>

              {/* Service type + Due date */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div>
                  <label style={lbl}>Service Type</label>
                  <input style={inp} placeholder="e.g. Restoration" value={form.service_type} onChange={e=>setForm(p=>({...p,service_type:e.target.value}))} />
                </div>
                <div>
                  <label style={lbl}>Due Date</label>
                  <input style={{ ...inp, maxWidth:240 }} type="date" value={form.due_date} onChange={e=>setForm(p=>({...p,due_date:e.target.value}))} />
                </div>
              </div>

              {/* Email toggle */}
              <div style={{ display:"flex", alignItems:"flex-start", gap:10, background:"#18181b", border:"1px solid #27272a", borderRadius:8, padding:"12px 14px", marginBottom:20, cursor:"pointer" }}
                onClick={()=>setForm(p=>({...p,email_client_updates:!p.email_client_updates}))}>
                <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${form.email_client_updates?"#C9A84C":"#27272a"}`, background:form.email_client_updates?"#C9A84C":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                  {form.email_client_updates && <span style={{ color:"#000", fontSize:"0.7rem", fontWeight:700 }}>✓</span>}
                </div>
                <div>
                  <p style={{ color:"#fafafa", fontSize:"0.85rem", fontWeight:600, margin:"0 0 2px" }}>Email client on milestone updates</p>
                  <p style={{ color:"#52525b", fontSize:"0.75rem", margin:0 }}>The client will receive an email each time a milestone is marked complete.</p>
                </div>
              </div>

              {/* Milestones */}
              <div>
                <label style={lbl}>Milestones</label>
                <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
                  {milestones.map((m,i)=>(
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:"#18181b", border:"1px solid #27272a", borderRadius:8 }}>
                      <span style={{ color:"#52525b", fontSize:"0.75rem", cursor:"grab" }}>⠿</span>
                      <span style={{ flex:1, color:"#a1a1aa", fontSize:"0.85rem" }}>{m}</span>
                      <button onClick={()=>removeMilestone(i)} style={{ background:"none", border:"none", color:"#f87171", cursor:"pointer", fontSize:"0.9rem", padding:"0 2px" }}>×</button>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <input style={{ ...inp, flex:1 }} placeholder="Add milestone..." value={newMs}
                    onChange={e=>setNewMs(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&addMilestone()} />
                  <button onClick={addMilestone} style={{ background:"#1c1c1f", border:"1px solid #27272a", color:"#a1a1aa", borderRadius:8, padding:"9px 16px", fontWeight:600, fontSize:"0.85rem", cursor:"pointer", whiteSpace:"nowrap" }}>Add</button>
                </div>
              </div>
            </div>

            <div style={{ padding:"14px 24px", borderTop:"1px solid #1c1c1f", display:"flex", gap:10, justifyContent:"flex-end", flexShrink:0 }}>
              <button onClick={()=>setShowCreate(false)} style={{ background:"none", border:"1px solid #27272a", color:"#71717a", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontSize:"0.85rem" }}>Cancel</button>
              <button onClick={handleCreate} disabled={saving||!form.name.trim()}
                style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"8px 20px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", opacity:form.name.trim()?1:0.5 }}>
                {saving?"Creating...":"+ Create Work Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
