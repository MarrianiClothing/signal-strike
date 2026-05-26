"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

const STATUS_COLORS: Record<string,string> = { pending:"#fbbf24", active:"#60a5fa", in_progress:"#a78bfa", completed:"#34d399", on_hold:"#71717a" };
const STATUS_LABELS: Record<string,string> = { pending:"Pending", active:"Active", in_progress:"In Progress", completed:"Completed", on_hold:"On Hold" };
const STATUS_OPTIONS = ["pending","active","in_progress","on_hold","completed"];

function fmt(n: number|null|undefined) {
  if (!n||isNaN(n)) return "$0";
  if (n>=1_000_000) return "$"+(n/1_000_000).toFixed(2)+"M";
  if (n>=1_000)     return "$"+(n/1_000).toFixed(1)+"K";
  return "$"+n.toFixed(0);
}
function fmtDate(d: string|null|undefined, offsetDays=0) {
  if (!d) return "—";
  const dt = new Date(new Date(d+"T00:00:00").getTime() + offsetDays*86400000);
  return dt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}

export default function WorkOrderDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const supabase = createClient();
  const isMobile = useIsMobile();

  const [project,    setProject]    = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [userId,     setUserId]     = useState("");
  const [loading,    setLoading]    = useState(true);
  const [statusOpen, setStatusOpen] = useState(false);
  const [rollbackMs, setRollbackMs] = useState<string|null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [addMsText,  setAddMsText]  = useState("");
  const [addingMs,   setAddingMs]   = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [{ data: proj }, { data: ms }] = await Promise.all([
      supabase.from("projects").select("*, deals(title,company,value)").eq("id", id).maybeSingle(),
      supabase.from("work_order_milestones").select("*").eq("project_id", id).order("sort_order"),
    ]);

    setProject(proj);
    setMilestones(ms || []);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { load(); }, [load]);

  async function toggleMilestone(msId: string, completed: boolean) {
    const updates = { completed, completed_at: completed ? new Date().toISOString() : null };
    await supabase.from("work_order_milestones").update(updates).eq("id", msId);
    const updatedMs = milestones.map(m => m.id===msId ? {...m,...updates} : m);
    setMilestones(updatedMs);

    // Fire in-app notification (separate from client email — always runs)
    if (completed) {
      const ms = updatedMs.find(m => m.id===msId);
      // Fire and forget; failures shouldn't block the user
      fetch("/api/notifications/milestone-completed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: id,
          milestone_id: msId,
          milestone_name: ms?.name ?? "Milestone",
        }),
      }).catch(err => console.error("[milestone notify] failed:", err));
    }

    // Fire client email notification when marking complete (not on rollback)
    if (completed && project?.email_client_updates) {
      const doneCount = updatedMs.filter(m => m.completed).length;
      const total     = updatedMs.length;
      const ms        = updatedMs.find(m => m.id===msId);
      fetch("/api/milestones/notify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          project_id:       id,
          milestone_name:   ms?.name ?? "Milestone",
          milestone_index:  doneCount,
          milestone_total:  total,
        }),
      }).catch(() => {}); // fire-and-forget
    }
  }

  async function rollbackMilestone(msId: string) {
    await supabase.from("work_order_milestones")
      .update({ completed:false, completed_at:null }).eq("id", msId);
    setMilestones(prev => prev.map(m => m.id===msId ? {...m,completed:false,completed_at:null} : m));
    setRollbackMs(null);
  }

  async function updateStatus(status: string) {
    await supabase.from("projects").update({ status, updated_at:new Date().toISOString() }).eq("id", id);
    setProject((p:any) => ({...p, status}));
    setStatusOpen(false);
  }

  async function handleDelete() {
    await supabase.from("work_order_milestones").delete().eq("project_id", id);
    await supabase.from("projects").delete().eq("id", id);
    router.push("/projects");
  }

  async function handleAddMilestone() {
    if (!addMsText.trim()) return;
    setAddingMs(true);
    const { data } = await supabase.from("work_order_milestones").insert({
      project_id: id, user_id: userId, name: addMsText.trim(),
      sort_order: milestones.length, completed: false,
    }).select().single();
    if (data) setMilestones(prev => [...prev, data]);
    setAddMsText(""); setAddingMs(false);
  }

  if (loading)  return <div style={{padding:32,color:"#71717a"}}>Loading...</div>;
  if (!project) return <div style={{padding:32,color:"#f87171"}}>Work order not found.</div>;

  const msTotal    = milestones.length;
  const msDone     = milestones.filter(m=>m.completed).length;
  const msProgress = msTotal>0 ? Math.round((msDone/msTotal)*100) : 0;
  const value      = project.value || project.deals?.value || 0;
  const sc         = STATUS_COLORS[project.status] ?? "#71717a";
  const allDone    = msTotal>0 && msDone===msTotal;

  return (
    <div style={{ padding:isMobile?16:32, maxWidth:720 }}>

      {/* Back */}
      <button onClick={()=>router.push("/projects")}
        style={{background:"none",border:"none",color:"#71717a",cursor:"pointer",fontSize:"0.85rem",marginBottom:20,padding:0,display:"flex",alignItems:"center",gap:6}}>
        ← Jobs
      </button>

      {/* ── WO Header ────────────────────────────────────────────────────────── */}
      <div style={{background:"#111113",border:"1px solid #27272a",borderRadius:14,overflow:"hidden",marginBottom:16}}>

        {/* Title bar */}
        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #1c1c1f"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
            <div>
              {(project.wo_display || project.wo_number) && <p style={{color:"#52525b",fontSize:"0.72rem",fontFamily:"monospace",margin:"0 0 4px"}}>{project.wo_display || ("WO-" + project.wo_number)}</p>}
              <h1 style={{color:"#fafafa",fontWeight:800,fontSize:isMobile?"1.1rem":"1.3rem",margin:0,lineHeight:1.3}}>{project.name}</h1>
              {(project.service_type||project.deals?.company) && (
                <p style={{color:"#71717a",fontSize:"0.82rem",margin:"4px 0 0"}}>{project.service_type||project.deals?.company}</p>
              )}
            </div>
            {/* Status badge — clickable */}
            <div style={{position:"relative"}}>
              <button onClick={()=>setStatusOpen(!statusOpen)}
                style={{fontSize:"0.8rem",fontWeight:700,color:sc,background:sc+"22",border:`1px solid ${sc}44`,borderRadius:20,padding:"5px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                {STATUS_LABELS[project.status]??project.status}
                <span style={{fontSize:"0.65rem"}}>▾</span>
              </button>
              {statusOpen && (
                <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:"#1c1c1f",border:"1px solid #27272a",borderRadius:10,overflow:"hidden",zIndex:50,minWidth:140}}>
                  {STATUS_OPTIONS.map(s=>(
                    <button key={s} onClick={()=>updateStatus(s)}
                      style={{display:"block",width:"100%",padding:"9px 14px",textAlign:"left",background:project.status===s?"#27272a":"transparent",border:"none",color:STATUS_COLORS[s]??"#a1a1aa",fontSize:"0.82rem",fontWeight:project.status===s?700:400,cursor:"pointer"}}>
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:"1px solid #1c1c1f"}}>
          <div style={{padding:"14px 20px",borderRight:"1px solid #1c1c1f"}}>
            <p style={{color:"#52525b",fontSize:"0.68rem",textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 4px"}}>Value</p>
            <p style={{color:"#C9A84C",fontWeight:800,fontFamily:"monospace",fontSize:"1.05rem",margin:0}}>{fmt(value)}</p>
          </div>
          <div style={{padding:"14px 20px",borderRight:"1px solid #1c1c1f"}}>
            <p style={{color:"#52525b",fontSize:"0.68rem",textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 4px"}}>Progress</p>
            <p style={{color:msProgress===100?"#34d399":"#fafafa",fontWeight:800,fontSize:"1.05rem",margin:0}}>{msProgress}%</p>
          </div>
          <div style={{padding:"14px 20px"}}>
            <p style={{color:"#52525b",fontSize:"0.68rem",textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 4px"}}>Due</p>
            <p style={{color:"#a1a1aa",fontWeight:600,fontSize:"0.9rem",margin:0}}>{fmtDate(project.due_date)}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{height:6,background:"#27272a"}}>
          <div style={{height:"100%",background:msProgress===100?"#34d399":"#C9A84C",width:`${msProgress}%`,transition:"width 0.4s"}} />
        </div>
      </div>

      {/* ── Cash Flow Projection ─────────────────────────────────────────────── */}
      {value > 0 && (
        <div style={{background:"#111113",border:"1px solid #27272a",borderRadius:12,overflow:"hidden",marginBottom:16}}>
          <div style={{background:"#0f0f10",padding:"10px 18px",borderBottom:"1px solid #27272a"}}>
            <p style={{color:"#71717a",fontSize:"0.7rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",margin:0}}>Cash Flow Projection</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr"}}>
            <div style={{padding:"14px 18px",borderRight:isMobile?"none":"1px solid #27272a"}}>
              <p style={{color:"#52525b",fontSize:"0.7rem",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 6px"}}>Est. Completion Date</p>
              <p style={{color:"#a1a1aa",fontSize:"0.9rem",fontWeight:600,margin:0}}>{fmtDate(project.due_date)}</p>
            </div>
            <div style={{padding:"14px 18px",borderRight:isMobile?"none":"1px solid #27272a"}}>
              <p style={{color:"#52525b",fontSize:"0.7rem",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 4px"}}>Net 30 Payment</p>
              <p style={{color:"#34d399",fontSize:"1rem",fontWeight:700,fontFamily:"monospace",margin:"0 0 3px"}}>{fmt(value*0.5)}</p>
              {project.due_date && <p style={{color:"#52525b",fontSize:"0.72rem",margin:0}}>Due {fmtDate(project.due_date,30)}</p>}
            </div>
            <div style={{padding:"14px 18px"}}>
              <p style={{color:"#52525b",fontSize:"0.7rem",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 4px"}}>Net 60 (Balance)</p>
              <p style={{color:"#34d399",fontSize:"1rem",fontWeight:700,fontFamily:"monospace",margin:"0 0 3px"}}>{fmt(value*0.5)}</p>
              {project.due_date && <p style={{color:"#52525b",fontSize:"0.72rem",margin:0}}>Due {fmtDate(project.due_date,60)}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── Milestones ───────────────────────────────────────────────────────── */}
      <div style={{background:"#111113",border:"1px solid #27272a",borderRadius:12,padding:"18px 20px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <p style={{color:"#71717a",fontSize:"0.7rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",margin:0}}>
            Milestones <span style={{color:"#3f3f46",fontWeight:400,textTransform:"none"}}>(click to toggle)</span>
          </p>
          {project.email_client_updates && (
            <label style={{display:"flex",alignItems:"center",gap:6,color:"#52525b",fontSize:"0.72rem"}}>
              <input type="checkbox" checked readOnly style={{accentColor:"#C9A84C"}} />
              Email client on updates
            </label>
          )}
        </div>

        {milestones.length === 0 ? (
          <p style={{color:"#3f3f46",fontSize:"0.82rem",marginBottom:12}}>No milestones yet.</p>
        ) : (
          <div style={{display:"flex",flexDirection:"column"}}>
            {milestones.map((m:any, i:number) => {
              const prev     = i > 0 ? milestones[i-1] : null;
              const prevDone = !prev || prev.completed;
              const isNext   = !m.completed && prevDone;
              return (
                <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:i<milestones.length-1?"1px solid #1c1c1f":"none",position:"relative"}}>
                  {/* Vertical connector line */}
                  {i < milestones.length-1 && (
                    <div style={{position:"absolute",left:13,top:39,height:"calc(100% - 18px)",width:2,background:"#1c1c1f"}} />
                  )}
                  {/* Circle */}
                  <div onClick={()=>prevDone && toggleMilestone(m.id,!m.completed)}
                    style={{width:28,height:28,borderRadius:"50%",flexShrink:0,zIndex:1,
                      background:m.completed?"#34d399":isNext?"rgba(201,168,76,0.15)":"#1c1c1f",
                      border:`2px solid ${m.completed?"#34d399":isNext?"#C9A84C":"#27272a"}`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      cursor:prevDone?"pointer":"not-allowed"}}>
                    {m.completed && <span style={{color:"#000",fontSize:"0.72rem",fontWeight:800}}>✓</span>}
                    {isNext && <span style={{color:"#C9A84C",fontSize:"0.55rem"}}>●</span>}
                  </div>
                  {/* Label */}
                  <div style={{flex:1,cursor:prevDone?"pointer":"default"}}
                    onClick={()=>prevDone && toggleMilestone(m.id,!m.completed)}>
                    <p style={{color:m.completed?"#52525b":isNext?"#fafafa":"#3f3f46",fontWeight:isNext?600:400,fontSize:"0.88rem",margin:0,textDecoration:m.completed?"line-through":"none"}}>
                      {m.name} {m.completed?"✓":""}
                    </p>
                    {m.completed && m.completed_at && (
                      <p style={{color:"#3f3f46",fontSize:"0.7rem",margin:"2px 0 0"}}>
                        {new Date(m.completed_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})} · {new Date(m.completed_at).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}
                      </p>
                    )}
                  </div>
                  {/* Roll back */}
                  {m.completed && (
                    <button onClick={e=>{e.stopPropagation();setRollbackMs(m.id);}}
                      style={{background:"none",border:"1px solid #27272a",color:"#71717a",borderRadius:6,padding:"4px 10px",fontSize:"0.72rem",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                      ↩ Roll back
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add milestone inline */}
        <div style={{display:"flex",gap:8,marginTop:14}}>
          <input
            style={{flex:1,background:"#1c1c1f",border:"1px solid #27272a",borderRadius:8,padding:"8px 12px",color:"#fafafa",fontSize:"0.82rem",boxSizing:"border-box"}}
            placeholder="Add milestone..."
            value={addMsText} onChange={e=>setAddMsText(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleAddMilestone()} />
          <button onClick={handleAddMilestone} disabled={addingMs||!addMsText.trim()}
            style={{background:"#1c1c1f",border:"1px solid #27272a",color:"#a1a1aa",borderRadius:8,padding:"8px 14px",fontWeight:600,fontSize:"0.82rem",cursor:"pointer",opacity:addMsText.trim()?1:0.4}}>
            Add
          </button>
        </div>
      </div>

      {/* ── All milestones done banner ───────────────────────────────────────── */}
      {allDone && project.status !== "completed" && (
        <div style={{background:"rgba(52,211,153,0.07)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:10,padding:"14px 18px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <p style={{color:"#34d399",fontWeight:600,fontSize:"0.88rem",margin:0}}>🎉 All milestones complete!</p>
          <button onClick={()=>updateStatus("completed")}
            style={{background:"#34d399",color:"#000",border:"none",borderRadius:8,padding:"7px 16px",fontWeight:700,fontSize:"0.82rem",cursor:"pointer"}}>
            Mark Completed ✓
          </button>
        </div>
      )}

      {/* ── Footer actions ───────────────────────────────────────────────────── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <button onClick={()=>setDeleteConfirm(true)}
          style={{background:"none",border:"1px solid #27272a",color:"#f87171",borderRadius:8,padding:"8px 16px",fontSize:"0.85rem",cursor:"pointer"}}>
          Delete
        </button>
        <button onClick={()=>router.push(`/projects/${id}/schedule`)}
          style={{background:"#1c1c1f",border:"1px solid #27272a",color:"#a1a1aa",borderRadius:8,padding:"8px 18px",fontWeight:600,fontSize:"0.85rem",cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
          📅 View Schedule
        </button>
      </div>

      {/* ── Rollback confirm ────────────────────────────────────────────────── */}
      {rollbackMs && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:800,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#111113",border:"1px solid #27272a",borderRadius:12,padding:24,width:"100%",maxWidth:360}}>
            <h3 style={{color:"#fafafa",fontWeight:700,fontSize:"1rem",margin:"0 0 8px"}}>Roll back milestone?</h3>
            <p style={{color:"#71717a",fontSize:"0.85rem",margin:"0 0 4px"}}>
              <strong style={{color:"#fafafa"}}>{milestones.find(m=>m.id===rollbackMs)?.name}</strong> will be marked incomplete.
            </p>
            <p style={{color:"#52525b",fontSize:"0.75rem",margin:"0 0 20px"}}>This action will be logged.</p>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setRollbackMs(null)} style={{background:"none",border:"1px solid #27272a",color:"#71717a",borderRadius:8,padding:"7px 16px",fontSize:"0.85rem",cursor:"pointer"}}>Cancel</button>
              <button onClick={()=>rollbackMilestone(rollbackMs)} style={{background:"#C9A84C",color:"#000",border:"none",borderRadius:8,padding:"7px 16px",fontWeight:700,fontSize:"0.85rem",cursor:"pointer"}}>↩ Roll back</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ───────────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:800,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#111113",border:"1px solid #27272a",borderRadius:12,padding:24,width:"100%",maxWidth:360}}>
            <h3 style={{color:"#f87171",fontWeight:700,fontSize:"1rem",margin:"0 0 8px"}}>Delete work order?</h3>
            <p style={{color:"#71717a",fontSize:"0.85rem",margin:"0 0 20px"}}>This will permanently delete the work order and all its milestones. This cannot be undone.</p>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setDeleteConfirm(false)} style={{background:"none",border:"1px solid #27272a",color:"#71717a",borderRadius:8,padding:"7px 16px",fontSize:"0.85rem",cursor:"pointer"}}>Cancel</button>
              <button onClick={handleDelete} style={{background:"rgba(248,113,113,0.15)",border:"1px solid rgba(248,113,113,0.3)",color:"#f87171",borderRadius:8,padding:"7px 16px",fontWeight:700,fontSize:"0.85rem",cursor:"pointer"}}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
