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

interface Project {
  id: string; name: string; status: string; created_at: string; deal_id: string | null;
  deals?: { title: string; company: string } | null;
  phaseCount?: number; taskTotal?: number; taskDone?: number;
}
interface WonDeal { id: string; title: string; company: string; }

const STATUS_COLOR: Record<string,string> = { active:"#C9A84C", on_hold:"#71717a", completed:"#34d399" };
const STATUS_LABEL: Record<string,string> = { active:"Active", on_hold:"On Hold", completed:"Completed" };
const inp: React.CSSProperties = { width:"100%", background:"#1c1c1f", border:"1px solid #27272a", borderRadius:8, padding:"9px 12px", color:"#fafafa", fontSize:"0.875rem", boxSizing:"border-box" };
const lbl: React.CSSProperties = { color:"#71717a", fontSize:"0.72rem", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:5, display:"block" };

export default function ProjectsPage() {
  const router   = useRouter();
  const supabase = createClient();
  const isMobile = useIsMobile();

  const [projects,  setProjects]  = useState<Project[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [userId,    setUserId]    = useState("");
  const [showModal, setShowModal] = useState(false);
  const [wonDeals,  setWonDeals]  = useState<WonDeal[]>([]);
  const [form,      setForm]      = useState({ name:"", deal_id:"" });
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: projs } = await supabase
        .from("projects").select("*, deals(title,company)")
        .eq("user_id", user.id).order("created_at", { ascending: false });
      const enriched = await Promise.all((projs || []).map(async (p: any) => {
        const { data: ph } = await supabase.from("project_phases").select("id").eq("project_id", p.id);
        const ids = (ph || []).map((x: any) => x.id);
        let taskTotal = 0, taskDone = 0;
        if (ids.length) {
          const { data: tasks } = await supabase.from("project_tasks").select("status").in("phase_id", ids);
          taskTotal = (tasks || []).length;
          taskDone  = (tasks || []).filter((t: any) => t.status === "completed").length;
        }
        return { ...p, phaseCount: ids.length, taskTotal, taskDone };
      }));
      setProjects(enriched);
      setLoading(false);
    }
    load();
  }, []);

  async function openModal() {
    const { data } = await supabase.from("deals").select("id,title,company").eq("stage","closed_won").order("title");
    setWonDeals(data || []);
    setForm({ name:"", deal_id:"" });
    setShowModal(true);
  }

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("projects")
      .insert({ user_id:userId, deal_id:form.deal_id||null, name:form.name.trim(), status:"active" })
      .select("id").single();
    if (!error && data) router.push(`/projects/${data.id}`);
    setSaving(false);
  }

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1100 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:"1.6rem", fontWeight:800, color:"#fafafa", margin:"0 0 4px", fontFamily:"var(--font-cinzel,serif)", letterSpacing:"0.06em", textTransform:"uppercase" }}>
            Projects
          </h1>
          <p style={{ color:"#52525b", fontSize:"0.82rem", margin:0 }}>
            {loading ? "Loading..." : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button onClick={openModal}
          style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"9px 18px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer" }}>
          + New Project
        </button>
      </div>

      {loading ? (
        <p style={{ color:"#52525b", textAlign:"center", padding:"48px 0" }}>Loading...</p>
      ) : projects.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 0", color:"#3f3f46" }}>
          <div style={{ fontSize:"3rem", marginBottom:12 }}>📋</div>
          <p style={{ fontSize:"0.95rem", color:"#52525b", margin:"0 0 6px" }}>No projects yet</p>
          <p style={{ fontSize:"0.82rem", margin:"0 0 20px" }}>Projects are launched from won deals or created manually</p>
          <button onClick={openModal}
            style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"9px 18px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer" }}>
            + New Project
          </button>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(320px,1fr))", gap:16 }}>
          {projects.map(p => {
            const pct = p.taskTotal ? Math.round((p.taskDone! / p.taskTotal) * 100) : 0;
            const sc  = STATUS_COLOR[p.status] ?? "#71717a";
            return (
              <div key={p.id} onClick={() => router.push(`/projects/${p.id}`)}
                style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:20, cursor:"pointer", transition:"border-color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#C9A84C")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#27272a")}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontSize:"0.7rem", fontWeight:600, color:sc, background:sc+"22", padding:"3px 8px", borderRadius:5 }}>{STATUS_LABEL[p.status]??p.status}</span>
                  {p.deals && <span style={{ fontSize:"0.72rem", color:"#52525b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:140 }}>{p.deals.company||p.deals.title}</span>}
                </div>
                <h2 style={{ fontSize:"1rem", fontWeight:700, color:"#fafafa", margin:"0 0 4px", lineHeight:1.3 }}>{p.name}</h2>
                {p.deals && <p style={{ fontSize:"0.78rem", color:"#C9A84C", margin:"0 0 14px" }}>{p.deals.title}</p>}
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:"0.72rem", color:"#71717a" }}>{p.phaseCount} phase{p.phaseCount !== 1 ? "s" : ""} · {p.taskDone}/{p.taskTotal} tasks</span>
                    <span style={{ fontSize:"0.72rem", color: pct===100?"#34d399":"#C9A84C", fontWeight:600 }}>{pct}%</span>
                  </div>
                  <div style={{ height:4, background:"#27272a", borderRadius:2 }}>
                    <div style={{ height:"100%", width:pct+"%", background: pct===100?"#34d399":"#C9A84C", borderRadius:2, transition:"width 0.4s" }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:14, padding:28, width:"100%", maxWidth:440 }}>
            <h2 style={{ color:"#fafafa", fontWeight:700, fontSize:"1.05rem", margin:"0 0 20px" }}>New Project</h2>
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Project Name *</label>
              <input style={inp} autoFocus placeholder="e.g. KC-26-0168 Quality Inn Renovation"
                value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} />
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={lbl}>Link to Won Deal (optional)</label>
              <select style={inp} value={form.deal_id} onChange={e => setForm(f => ({ ...f, deal_id:e.target.value }))}>
                <option value="">-- No deal --</option>
                {wonDeals.map(d => <option key={d.id} value={d.id}>{d.title}{d.company ? ` · ${d.company}` : ""}</option>)}
              </select>
              {wonDeals.length === 0 && <p style={{ color:"#52525b", fontSize:"0.75rem", marginTop:6 }}>No won deals yet — you can still create an unlinked project.</p>}
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={() => setShowModal(false)}
                style={{ background:"none", border:"1px solid #27272a", color:"#71717a", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontSize:"0.85rem" }}>Cancel</button>
              <button onClick={handleCreate} disabled={saving || !form.name.trim()}
                style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"8px 18px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", opacity:form.name.trim()?1:0.5 }}>
                {saving ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
