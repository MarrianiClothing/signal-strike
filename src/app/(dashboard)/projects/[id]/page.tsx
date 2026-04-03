"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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

// ── Types ──────────────────────────────────────────────────────────────────────
interface Project  { id:string; user_id:string; deal_id:string|null; name:string; status:string; }
interface Phase    { id:string; project_id:string; name:string; start_date:string|null; end_date:string|null; color:string; status:string; sort_order:number; }
interface Task     { id:string; phase_id:string; name:string; assignee:string|null; start_date:string|null; due_date:string|null; status:string; notes:string|null; sort_order:number; }
interface Timeline { minTime:number; maxTime:number; totalMs:number; }

// ── Gantt helpers ──────────────────────────────────────────────────────────────
function buildTimeline(phases: Phase[]): Timeline | null {
  const dp = phases.filter(p => p.start_date && p.end_date);
  if (!dp.length) return null;
  const minTime = Math.min(...dp.map(p => new Date(p.start_date!).getTime()));
  const maxTime = Math.max(...dp.map(p => new Date(p.end_date!).getTime())) + 86400000;
  return { minTime, maxTime, totalMs: maxTime - minTime };
}
function toPct(t: number, tl: Timeline) {
  return Math.min(100, Math.max(0, (t - tl.minTime) / tl.totalMs * 100));
}
function getMonths(tl: Timeline) {
  const out: { label:string; lp:number; wp:number }[] = [];
  let cur = new Date(tl.minTime);
  cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
  while (cur.getTime() < tl.maxTime) {
    const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const s = Math.max(cur.getTime(), tl.minTime);
    const e = Math.min(next.getTime(), tl.maxTime);
    const lp = toPct(s, tl);
    const wp = toPct(e, tl) - lp;
    if (wp > 0) out.push({ label: cur.toLocaleString("en-US",{month:"short",year:"2-digit"}), lp, wp });
    cur = next;
  }
  return out;
}
function getPhaseBar(p: Phase, tl: Timeline) {
  if (!p.start_date || !p.end_date) return null;
  const l = toPct(new Date(p.start_date).getTime(), tl);
  const r = toPct(new Date(p.end_date).getTime() + 86400000, tl);
  return { lp: l, wp: Math.max(r - l, 0.5) };
}
function getTaskPos(t: Task, tl: Timeline) {
  if (t.start_date && t.due_date) {
    const l = toPct(new Date(t.start_date).getTime(), tl);
    const r = toPct(new Date(t.due_date).getTime() + 86400000, tl);
    return { lp: l, wp: Math.max(r - l, 0.5), milestone: false };
  }
  if (t.due_date) return { lp: toPct(new Date(t.due_date).getTime(), tl), wp: 0, milestone: true };
  return null;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const COLORS   = ["#C9A84C","#60a5fa","#34d399","#a78bfa","#fb923c","#f87171"];
const ST_OPTS  = ["not_started","in_progress","completed","blocked"];
const ST_LBL: Record<string,string> = { not_started:"Not Started", in_progress:"In Progress", completed:"Completed", blocked:"Blocked" };
const ST_CLR: Record<string,string> = { not_started:"#52525b", in_progress:"#C9A84C", completed:"#34d399", blocked:"#f87171" };
const ST_ICO: Record<string,string> = { not_started:"○", in_progress:"◑", completed:"●", blocked:"✕" };
const PR_CLR: Record<string,string> = { active:"#C9A84C", on_hold:"#71717a", completed:"#34d399" };

const inp: React.CSSProperties = { width:"100%", background:"#1c1c1f", border:"1px solid #27272a", borderRadius:8, padding:"9px 12px", color:"#fafafa", fontSize:"0.875rem", boxSizing:"border-box" };
const lbl: React.CSSProperties = { color:"#71717a", fontSize:"0.72rem", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:5, display:"block" };
const BPH = { name:"", start_date:"", end_date:"", color:"#C9A84C", status:"not_started" };
const BTK = { name:"", assignee:"", start_date:"", due_date:"", status:"not_started", notes:"" };

// ── Component ──────────────────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router   = useRouter();
  const supabase = createClient();
  const isMobile = useIsMobile();

  const [project,   setProject]   = useState<Project|null>(null);
  const [phases,    setPhases]    = useState<Phase[]>([]);
  const [taskMap,   setTaskMap]   = useState<Record<string,Task[]>>({});
  const [dealTitle, setDealTitle] = useState("");
  const [loading,   setLoading]   = useState(true);
  const [viewMode,  setViewMode]  = useState<"list"|"gantt">("list");
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());

  const [phaseModal,  setPhaseModal]  = useState<{open:boolean;editing:Phase|null}>({open:false,editing:null});
  const [phaseForm,   setPhaseForm]   = useState(BPH);
  const [phaseSaving, setPhaseSaving] = useState(false);

  const [taskModal,  setTaskModal]  = useState<{open:boolean;phaseId:string;editing:Task|null}>({open:false,phaseId:"",editing:null});
  const [taskForm,   setTaskForm]   = useState(BTK);
  const [taskSaving, setTaskSaving] = useState(false);

  const loadAll = useCallback(async () => {
    const { data: proj } = await supabase.from("projects").select("*").eq("id", id).single();
    if (!proj) { setLoading(false); return; }
    setProject(proj);
    if (proj.deal_id) {
      const { data: deal } = await supabase.from("deals").select("title").eq("id", proj.deal_id).single();
      setDealTitle(deal?.title ?? "");
    }
    const { data: ph } = await supabase.from("project_phases").select("*").eq("project_id", id).order("sort_order").order("created_at");
    const phList = ph || [];
    setPhases(phList);
    if (phList.length) {
      const { data: tasks } = await supabase.from("project_tasks").select("*").in("phase_id", phList.map(p => p.id)).order("sort_order").order("created_at");
      const map: Record<string,Task[]> = {};
      for (const t of (tasks || [])) { if (!map[t.phase_id]) map[t.phase_id] = []; map[t.phase_id].push(t); }
      setTaskMap(map);
    } else { setTaskMap({}); }
    setExpanded(new Set(phList.map(p => p.id)));
    setLoading(false);
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const allTasks  = Object.values(taskMap).flat();
  const doneTasks = allTasks.filter(t => t.status === "completed").length;
  const progPct   = allTasks.length ? Math.round(doneTasks / allTasks.length * 100) : 0;

  const togglePhase = (phId: string) => setExpanded(prev => { const n = new Set(prev); n.has(phId)?n.delete(phId):n.add(phId); return n; });

  // Phase CRUD
  function openAddPhase()    { setPhaseForm(BPH); setPhaseModal({open:true,editing:null}); }
  function openEditPhase(p: Phase) { setPhaseForm({name:p.name,start_date:p.start_date??"",end_date:p.end_date??"",color:p.color,status:p.status}); setPhaseModal({open:true,editing:p}); }
  async function savePhase() {
    if (!phaseForm.name.trim()) return;
    setPhaseSaving(true);
    const pay = { name:phaseForm.name.trim(), start_date:phaseForm.start_date||null, end_date:phaseForm.end_date||null, color:phaseForm.color, status:phaseForm.status };
    if (phaseModal.editing) await supabase.from("project_phases").update(pay).eq("id", phaseModal.editing.id);
    else await supabase.from("project_phases").insert({...pay, project_id:id, sort_order:phases.length});
    setPhaseModal({open:false,editing:null}); setPhaseSaving(false); loadAll();
  }
  async function deletePhase(phId: string) {
    if (!confirm("Delete this phase and all its tasks? This cannot be undone.")) return;
    await supabase.from("project_phases").delete().eq("id", phId); loadAll();
  }

  // Task CRUD
  function openAddTask(phaseId: string) { setTaskForm(BTK); setTaskModal({open:true,phaseId,editing:null}); }
  function openEditTask(t: Task) { setTaskForm({name:t.name,assignee:t.assignee??"",start_date:t.start_date??"",due_date:t.due_date??"",status:t.status,notes:t.notes??""}); setTaskModal({open:true,phaseId:t.phase_id,editing:t}); }
  async function saveTask() {
    if (!taskForm.name.trim()) return;
    setTaskSaving(true);
    const pay = { name:taskForm.name.trim(), assignee:taskForm.assignee||null, start_date:taskForm.start_date||null, due_date:taskForm.due_date||null, status:taskForm.status, notes:taskForm.notes||null };
    if (taskModal.editing) await supabase.from("project_tasks").update(pay).eq("id", taskModal.editing.id);
    else await supabase.from("project_tasks").insert({...pay, phase_id:taskModal.phaseId, sort_order:(taskMap[taskModal.phaseId]||[]).length});
    setTaskModal({open:false,phaseId:"",editing:null}); setTaskSaving(false); loadAll();
  }
  async function deleteTask(taskId: string) {
    if (!confirm("Delete this task?")) return;
    await supabase.from("project_tasks").delete().eq("id", taskId); loadAll();
  }
  async function cycleStatus(task: Task) {
    const cycle = ["not_started","in_progress","completed"];
    const next  = cycle[(cycle.indexOf(task.status) + 1) % cycle.length];
    await supabase.from("project_tasks").update({status:next}).eq("id", task.id);
    setTaskMap(prev => ({ ...prev, [task.phase_id]: (prev[task.phase_id]||[]).map(t => t.id===task.id?{...t,status:next}:t) }));
  }
  async function updateProjectStatus(status: string) {
    await supabase.from("projects").update({status}).eq("id", id);
    setProject(prev => prev ? {...prev,status} : prev);
  }

  const timeline    = buildTimeline(phases);
  const todayPct    = timeline ? toPct(Date.now(), timeline) : null;
  const monthHdrs   = timeline ? getMonths(timeline) : [];

  if (loading) return <div style={{padding:32,color:"#71717a"}}>Loading...</div>;
  if (!project) return <div style={{padding:32,color:"#f87171"}}>Project not found.</div>;

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1200 }}>

      {/* Back */}
      <button onClick={() => router.push("/projects")}
        style={{background:"none",border:"none",color:"#71717a",cursor:"pointer",fontSize:"0.85rem",marginBottom:20,padding:0,display:"flex",alignItems:"center",gap:6}}>
        ← Projects
      </button>

      {/* Header */}
      <div style={{marginBottom:24}}>
        <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:12,marginBottom:10}}>
          <h1 style={{fontSize:"1.5rem",fontWeight:800,color:"#fafafa",margin:0}}>{project.name}</h1>
          {dealTitle && <span style={{fontSize:"0.8rem",color:"#C9A84C",background:"rgba(201,168,76,0.1)",padding:"3px 10px",borderRadius:6}}>{dealTitle}</span>}
          <select value={project.status} onChange={e => updateProjectStatus(e.target.value)}
            style={{background:"#111113",border:"1px solid #27272a",borderRadius:6,color:PR_CLR[project.status]??"#fafafa",fontSize:"0.78rem",fontWeight:600,padding:"4px 10px",cursor:"pointer"}}>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{flex:1,height:6,background:"#27272a",borderRadius:3}}>
            <div style={{height:"100%",width:progPct+"%",background:progPct===100?"#34d399":"#C9A84C",borderRadius:3,transition:"width 0.4s"}} />
          </div>
          <span style={{fontSize:"0.8rem",color:progPct===100?"#34d399":"#C9A84C",fontWeight:700,minWidth:36}}>{progPct}%</span>
          <span style={{fontSize:"0.75rem",color:"#52525b"}}>{doneTasks}/{allTasks.length} tasks</span>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <button onClick={openAddPhase}
          style={{background:"#C9A84C",color:"#000",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,fontSize:"0.82rem",cursor:"pointer"}}>
          + Add Phase
        </button>
        <div style={{display:"flex",gap:3,background:"#111113",border:"1px solid #27272a",borderRadius:8,padding:3}}>
          {(["list","gantt"] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              style={{background:viewMode===m?"#27272a":"transparent",border:"none",color:viewMode===m?"#fafafa":"#71717a",borderRadius:6,padding:"5px 14px",fontWeight:600,fontSize:"0.78rem",cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.05em"}}>
              {m==="list"?"≡ List":"▦ Gantt"}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {phases.length === 0 && (
        <div style={{textAlign:"center",padding:"80px 0",color:"#3f3f46"}}>
          <div style={{fontSize:"3rem",marginBottom:12}}>🏗️</div>
          <p style={{color:"#52525b",fontSize:"0.95rem",margin:"0 0 6px"}}>No phases yet</p>
          <p style={{fontSize:"0.82rem",margin:"0 0 20px"}}>Add phases to build out your project schedule</p>
          <button onClick={openAddPhase} style={{background:"#C9A84C",color:"#000",border:"none",borderRadius:8,padding:"9px 18px",fontWeight:700,fontSize:"0.85rem",cursor:"pointer"}}>
            + Add First Phase
          </button>
        </div>
      )}

      {/* ── Gantt View ─────────────────────────────────────────────────────────── */}
      {phases.length > 0 && viewMode === "gantt" && (
        !timeline ? (
          <div style={{background:"#111113",border:"1px solid #27272a",borderRadius:12,padding:32,textAlign:"center"}}>
            <p style={{color:"#52525b",margin:0}}>Add start and end dates to phases to view the Gantt chart.</p>
          </div>
        ) : (
          <div style={{background:"#111113",border:"1px solid #27272a",borderRadius:12,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <div style={{display:"flex",minWidth:720}}>

                {/* Sticky label column */}
                <div style={{width:200,flexShrink:0,borderRight:"1px solid #27272a",position:"sticky",left:0,background:"#111113",zIndex:10}}>
                  <div style={{height:32,background:"#0d0d0f",borderBottom:"1px solid #27272a"}} />
                  {phases.map(ph => (
                    <div key={ph.id}>
                      <div style={{height:40,display:"flex",alignItems:"center",padding:"0 14px",borderBottom:"1px solid #1c1c1f",gap:8}}>
                        <div style={{width:10,height:10,borderRadius:2,background:ph.color,flexShrink:0}} />
                        <span style={{fontSize:"0.8rem",color:"#fafafa",fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ph.name}</span>
                      </div>
                      {(taskMap[ph.id]||[]).map(t => (
                        <div key={t.id} style={{height:28,display:"flex",alignItems:"center",padding:"0 14px 0 28px",borderBottom:"1px solid #1c1c1f",gap:6}}>
                          <span style={{fontSize:"0.72rem",color:ST_CLR[t.status]??"#52525b",lineHeight:1}}>{ST_ICO[t.status]}</span>
                          <span style={{fontSize:"0.72rem",color:"#a1a1aa",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Timeline */}
                <div style={{flex:1,position:"relative",minWidth:520}}>
                  {/* Month headers */}
                  <div style={{height:32,position:"relative",background:"#0d0d0f",borderBottom:"1px solid #27272a"}}>
                    {monthHdrs.map(m => (
                      <div key={m.label} style={{position:"absolute",top:0,left:m.lp+"%",width:m.wp+"%",height:"100%",borderRight:"1px solid #1c1c1f",display:"flex",alignItems:"center",padding:"0 8px",overflow:"hidden"}}>
                        <span style={{fontSize:"0.68rem",color:"#71717a",fontWeight:600,whiteSpace:"nowrap"}}>{m.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Today line */}
                  {todayPct !== null && todayPct >= 0 && todayPct <= 100 && (
                    <div style={{position:"absolute",top:32,bottom:0,left:todayPct+"%",width:1,background:"#f87171",opacity:0.5,zIndex:5,pointerEvents:"none"}} />
                  )}

                  {/* Grid lines + bars */}
                  {phases.map(ph => {
                    const bar = getPhaseBar(ph, timeline);
                    return (
                      <div key={ph.id}>
                        {/* Phase row */}
                        <div style={{height:40,position:"relative",borderBottom:"1px solid #1c1c1f",display:"flex",alignItems:"center"}}>
                          {monthHdrs.map(m => <div key={m.label} style={{position:"absolute",top:0,left:m.lp+"%",width:m.wp+"%",height:"100%",borderRight:"1px solid #1c1c1f",pointerEvents:"none"}} />)}
                          {bar && (
                            <div onClick={() => openEditPhase(ph)}
                              style={{position:"absolute",left:bar.lp+"%",width:bar.wp+"%",height:22,background:ph.color,borderRadius:4,display:"flex",alignItems:"center",padding:"0 8px",overflow:"hidden",cursor:"pointer",zIndex:2}}>
                              {bar.wp > 8 && <span style={{fontSize:"0.7rem",color:"#000",fontWeight:700,whiteSpace:"nowrap"}}>{ph.name}</span>}
                            </div>
                          )}
                        </div>
                        {/* Task rows */}
                        {(taskMap[ph.id]||[]).map(t => {
                          const tp = getTaskPos(t, timeline);
                          return (
                            <div key={t.id} style={{height:28,position:"relative",borderBottom:"1px solid #1c1c1f"}}>
                              {monthHdrs.map(m => <div key={m.label} style={{position:"absolute",top:0,left:m.lp+"%",width:m.wp+"%",height:"100%",borderRight:"1px solid #1c1c1f",pointerEvents:"none"}} />)}
                              {tp && !tp.milestone && (
                                <div style={{position:"absolute",top:"50%",transform:"translateY(-50%)",left:tp.lp+"%",width:Math.max(tp.wp,1)+"%",height:10,background:ph.color+"88",borderRadius:2,zIndex:2}} />
                              )}
                              {tp && tp.milestone && (
                                <span style={{position:"absolute",top:"50%",transform:"translateY(-50%) translateX(-50%)",left:tp.lp+"%",color:ph.color,fontSize:"0.75rem",lineHeight:1,zIndex:2}}>◆</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* ── List View ──────────────────────────────────────────────────────────── */}
      {phases.length > 0 && viewMode === "list" && (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {phases.map(ph => {
            const phaseTasks = taskMap[ph.id] || [];
            const isOpen     = expanded.has(ph.id);
            const doneCount  = phaseTasks.filter(t => t.status==="completed").length;
            const sc         = ST_CLR[ph.status] ?? "#52525b";
            return (
              <div key={ph.id} style={{background:"#111113",border:"1px solid #27272a",borderRadius:12,overflow:"hidden"}}>
                {/* Phase header */}
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",borderBottom:isOpen?"1px solid #1c1c1f":"none"}}>
                  <button onClick={() => togglePhase(ph.id)}
                    style={{background:"none",border:"none",color:"#52525b",cursor:"pointer",fontSize:"0.68rem",padding:0,flexShrink:0,transition:"transform 0.2s",transform:isOpen?"rotate(90deg)":"rotate(0deg)"}}>▶</button>
                  <div style={{width:12,height:12,borderRadius:2,background:ph.color,flexShrink:0}} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:"0.9rem",fontWeight:700,color:"#fafafa"}}>{ph.name}</span>
                      <span style={{fontSize:"0.68rem",fontWeight:600,color:sc,background:sc+"22",padding:"2px 8px",borderRadius:4}}>{ST_LBL[ph.status]??ph.status}</span>
                      {ph.start_date && ph.end_date && (
                        <span style={{fontSize:"0.72rem",color:"#52525b"}}>
                          {new Date(ph.start_date).toLocaleDateString("en-US",{month:"short",day:"numeric"})} – {new Date(ph.end_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{fontSize:"0.72rem",color:"#52525b",flexShrink:0}}>{doneCount}/{phaseTasks.length}</span>
                  <button onClick={() => openAddTask(ph.id)}
                    style={{background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.15)",color:"#C9A84C",borderRadius:6,padding:"4px 10px",fontSize:"0.72rem",fontWeight:600,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                    + Task
                  </button>
                  <button onClick={() => openEditPhase(ph)} style={{background:"none",border:"none",color:"#52525b",cursor:"pointer",fontSize:"0.82rem",padding:"2px 6px",flexShrink:0}}>✎</button>
                  <button onClick={() => deletePhase(ph.id)} style={{background:"none",border:"none",color:"#3f3f46",cursor:"pointer",fontSize:"0.82rem",padding:"2px 6px",flexShrink:0}}>✕</button>
                </div>

                {/* Tasks */}
                {isOpen && (
                  <div style={{padding:"8px 12px 12px"}}>
                    {phaseTasks.length === 0 ? (
                      <p style={{color:"#3f3f46",fontSize:"0.8rem",textAlign:"center",padding:"12px 0",margin:0}}>
                        No tasks yet — click + Task to add one
                      </p>
                    ) : (
                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        {phaseTasks.map(t => (
                          <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#18181b",borderRadius:8,border:"1px solid #1c1c1f"}}>
                            <button onClick={() => cycleStatus(t)}
                              style={{background:"none",border:"none",color:ST_CLR[t.status]??"#52525b",cursor:"pointer",fontSize:"1rem",padding:0,flexShrink:0,lineHeight:1,width:20,textAlign:"center"}}>
                              {ST_ICO[t.status]}
                            </button>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{color:t.status==="completed"?"#52525b":"#fafafa",fontSize:"0.85rem",fontWeight:600,margin:"0 0 2px",textDecoration:t.status==="completed"?"line-through":"none"}}>{t.name}</p>
                              <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                                {t.assignee && <span style={{fontSize:"0.72rem",color:"#71717a"}}>👤 {t.assignee}</span>}
                                {t.due_date  && <span style={{fontSize:"0.72rem",color:"#71717a"}}>📅 {new Date(t.due_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>}
                                {t.notes     && <span style={{fontSize:"0.72rem",color:"#52525b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180}}>📝 {t.notes}</span>}
                              </div>
                            </div>
                            <button onClick={() => openEditTask(t)} style={{background:"none",border:"none",color:"#52525b",cursor:"pointer",fontSize:"0.82rem",padding:"2px 6px",flexShrink:0}}>✎</button>
                            <button onClick={() => deleteTask(t.id)} style={{background:"none",border:"none",color:"#3f3f46",cursor:"pointer",fontSize:"0.82rem",padding:"2px 6px",flexShrink:0}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Phase Modal ─────────────────────────────────────────────────────────── */}
      {phaseModal.open && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#111113",border:"1px solid #27272a",borderRadius:14,padding:28,width:"100%",maxWidth:460}}>
            <h2 style={{color:"#fafafa",fontWeight:700,fontSize:"1.05rem",margin:"0 0 20px"}}>{phaseModal.editing?"Edit Phase":"Add Phase"}</h2>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Phase Name *</label>
              <input style={inp} autoFocus value={phaseForm.name} onChange={e => setPhaseForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Pre-Construction" />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div><label style={lbl}>Start Date</label><input style={inp} type="date" value={phaseForm.start_date} onChange={e => setPhaseForm(f=>({...f,start_date:e.target.value}))} /></div>
              <div><label style={lbl}>End Date</label><input style={inp} type="date" value={phaseForm.end_date} onChange={e => setPhaseForm(f=>({...f,end_date:e.target.value}))} /></div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Color</label>
              <div style={{display:"flex",gap:8}}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => setPhaseForm(f=>({...f,color:c}))}
                    style={{width:28,height:28,borderRadius:6,background:c,border:phaseForm.color===c?"2px solid #fff":"2px solid transparent",cursor:"pointer",flexShrink:0}} />
                ))}
              </div>
            </div>
            <div style={{marginBottom:24}}>
              <label style={lbl}>Status</label>
              <select style={inp} value={phaseForm.status} onChange={e => setPhaseForm(f=>({...f,status:e.target.value}))}>
                {ST_OPTS.map(s => <option key={s} value={s}>{ST_LBL[s]}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={() => setPhaseModal({open:false,editing:null})}
                style={{background:"none",border:"1px solid #27272a",color:"#71717a",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:"0.85rem"}}>Cancel</button>
              <button onClick={savePhase} disabled={phaseSaving||!phaseForm.name.trim()}
                style={{background:"#C9A84C",color:"#000",border:"none",borderRadius:8,padding:"8px 18px",fontWeight:700,fontSize:"0.85rem",cursor:"pointer",opacity:phaseForm.name.trim()?1:0.5}}>
                {phaseSaving?"Saving...":phaseModal.editing?"Save Changes":"Add Phase"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Task Modal ──────────────────────────────────────────────────────────── */}
      {taskModal.open && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#111113",border:"1px solid #27272a",borderRadius:14,padding:28,width:"100%",maxWidth:460}}>
            <h2 style={{color:"#fafafa",fontWeight:700,fontSize:"1.05rem",margin:"0 0 20px"}}>{taskModal.editing?"Edit Task":"Add Task"}</h2>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Task Name *</label>
              <input style={inp} autoFocus value={taskForm.name} onChange={e => setTaskForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Submit building permits" />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div><label style={lbl}>Assignee</label><input style={inp} value={taskForm.assignee} onChange={e => setTaskForm(f=>({...f,assignee:e.target.value}))} placeholder="Name or role" /></div>
              <div><label style={lbl}>Status</label>
                <select style={inp} value={taskForm.status} onChange={e => setTaskForm(f=>({...f,status:e.target.value}))}>
                  {ST_OPTS.map(s => <option key={s} value={s}>{ST_LBL[s]}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div><label style={lbl}>Start Date</label><input style={inp} type="date" value={taskForm.start_date} onChange={e => setTaskForm(f=>({...f,start_date:e.target.value}))} /></div>
              <div><label style={lbl}>Due Date</label><input style={inp} type="date" value={taskForm.due_date} onChange={e => setTaskForm(f=>({...f,due_date:e.target.value}))} /></div>
            </div>
            <div style={{marginBottom:24}}>
              <label style={lbl}>Notes</label>
              <textarea style={{...inp,resize:"vertical",minHeight:72}} value={taskForm.notes} onChange={e => setTaskForm(f=>({...f,notes:e.target.value}))} placeholder="Optional notes..." />
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={() => setTaskModal({open:false,phaseId:"",editing:null})}
                style={{background:"none",border:"1px solid #27272a",color:"#71717a",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:"0.85rem"}}>Cancel</button>
              <button onClick={saveTask} disabled={taskSaving||!taskForm.name.trim()}
                style={{background:"#C9A84C",color:"#000",border:"none",borderRadius:8,padding:"8px 18px",fontWeight:700,fontSize:"0.85rem",cursor:"pointer",opacity:taskForm.name.trim()?1:0.5}}>
                {taskSaving?"Saving...":taskModal.editing?"Save Changes":"Add Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
