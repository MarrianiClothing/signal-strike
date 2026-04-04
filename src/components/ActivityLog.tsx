"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type ActivityType = "call" | "email" | "meeting" | "note" | "stage_change" | "deal_created";

interface Activity {
  id: string;
  deal_id: string;
  type: ActivityType;
  title: string;
  body: string | null;
  occurred_at: string;
}

const TYPE_META: Record<ActivityType, { icon: string; color: string; label: string }> = {
  call:         { icon: "📞", color: "#34d399", label: "Call"         },
  email:        { icon: "✉",  color: "#60a5fa", label: "Email"        },
  meeting:      { icon: "🤝", color: "#a78bfa", label: "Meeting"      },
  note:         { icon: "📝", color: "#fbbf24", label: "Note"         },
  stage_change: { icon: "⚡", color: "#C9A84C", label: "Stage Change" },
  deal_created: { icon: "🎯", color: "#71717a", label: "Deal Created" },
};

const EDITABLE_TYPES: ActivityType[] = ["call","email","meeting","note"];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ActivityLog({ dealId, userId }: { dealId: string; userId: string }) {
  const supabase = createClient();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);

  // Add form state
  const [type,       setType]       = useState<ActivityType>("note");
  const [title,      setTitle]      = useState("");
  const [body,       setBody]       = useState("");
  const [saving,     setSaving]     = useState(false);
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16));

  // Edit state
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editType,     setEditType]     = useState<ActivityType>("note");
  const [editTitle,    setEditTitle]    = useState("");
  const [editBody,     setEditBody]     = useState("");
  const [editDate,     setEditDate]     = useState("");
  const [editSaving,   setEditSaving]   = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("activities")
      .select("*")
      .eq("deal_id", dealId)
      .order("occurred_at", { ascending: false });
    setActivities(data ?? []);
    setLoading(false);
  }, [dealId, supabase]);

  useEffect(() => { load(); }, [load]);

  // ── Add ────────────────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!title.trim()) return;
    setSaving(true);
    await supabase.from("activities").insert({
      user_id:     userId,
      deal_id:     dealId,
      type,
      title:       title.trim(),
      body:        body.trim() || null,
      occurred_at: new Date(occurredAt).toISOString(),
    });
    setTitle(""); setBody(""); setShowForm(false);
    setOccurredAt(new Date().toISOString().slice(0, 16));
    await load();
    setSaving(false);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm("Delete this activity? This cannot be undone.")) return;
    await supabase.from("activities").delete().eq("id", id);
    setActivities(a => a.filter(x => x.id !== id));
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  function openEdit(a: Activity) {
    setEditingId(a.id);
    setEditType(a.type);
    setEditTitle(a.title);
    setEditBody(a.body ?? "");
    setEditDate(new Date(a.occurred_at).toISOString().slice(0, 16));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle(""); setEditBody(""); setEditDate("");
  }

  async function handleSaveEdit(id: string) {
    if (!editTitle.trim()) return;
    setEditSaving(true);
    await supabase.from("activities").update({
      type:        editType,
      title:       editTitle.trim(),
      body:        editBody.trim() || null,
      occurred_at: new Date(editDate).toISOString(),
    }).eq("id", id);
    setActivities(prev => prev.map(a =>
      a.id === id
        ? { ...a, type:editType, title:editTitle.trim(), body:editBody.trim()||null, occurred_at:new Date(editDate).toISOString() }
        : a
    ));
    setEditingId(null);
    setEditSaving(false);
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "#1c1c1f", border: "1px solid #27272a",
    borderRadius: 8, padding: "9px 12px", color: "#fafafa",
    fontSize: "0.875rem", boxSizing: "border-box",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h3 style={{ color:"#fafafa", fontWeight:700, fontSize:"1rem", margin:0 }}>Activity Log</h3>
        <button onClick={() => { setShowForm(f => !f); cancelEdit(); }}
          style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8,
            padding:"7px 16px", fontWeight:700, fontSize:"0.82rem", cursor:"pointer" }}>
          {showForm ? "Cancel" : "+ Log Activity"}
        </button>
      </div>

      {/* ── Add Form ────────────────────────────────────────────────────────── */}
      {showForm && (
        <div style={{ background:"#1c1c1f", border:"1px solid #27272a", borderRadius:10,
          padding:16, marginBottom:20, display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {EDITABLE_TYPES.map(t => (
              <button key={t} onClick={() => setType(t)}
                style={{ padding:"5px 12px", borderRadius:20, border:"1px solid",
                  borderColor: type===t ? TYPE_META[t].color : "#27272a",
                  background:  type===t ? TYPE_META[t].color+"22" : "transparent",
                  color:       type===t ? TYPE_META[t].color : "#71717a",
                  fontSize:"0.78rem", fontWeight:600, cursor:"pointer" }}>
                {TYPE_META[t].icon} {TYPE_META[t].label}
              </button>
            ))}
          </div>
          <input style={inp} placeholder="Title (e.g. Left voicemail, Sent proposal)"
            value={title} onChange={e => setTitle(e.target.value)} />
          <textarea style={{ ...inp, resize:"vertical", minHeight:72 }}
            placeholder="Notes (optional)" value={body} onChange={e => setBody(e.target.value)} />
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={{ color:"#71717a", fontSize:"0.75rem", display:"block", marginBottom:4 }}>Date &amp; Time</label>
              <input type="datetime-local" style={inp} value={occurredAt} onChange={e => setOccurredAt(e.target.value)} />
            </div>
            <button onClick={handleAdd} disabled={saving || !title.trim()}
              style={{ marginTop:20, background:saving||!title.trim()?"#27272a":"#C9A84C",
                color:saving||!title.trim()?"#52525b":"#000",
                border:"none", borderRadius:8, padding:"9px 20px",
                fontWeight:700, fontSize:"0.85rem", cursor:saving?"not-allowed":"pointer" }}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* ── Timeline ────────────────────────────────────────────────────────── */}
      {loading ? (
        <p style={{ color:"#52525b", fontSize:"0.85rem" }}>Loading...</p>
      ) : activities.length === 0 ? (
        <div style={{ textAlign:"center", padding:"24px 0", color:"#52525b" }}>
          <p style={{ fontSize:"1.5rem", marginBottom:6 }}>📋</p>
          <p style={{ fontSize:"0.85rem" }}>No activity yet. Log a call, email, or meeting.</p>
        </div>
      ) : (
        <div style={{ position:"relative" }}>
          <div style={{ position:"absolute", left:15, top:0, bottom:0, width:2, background:"#27272a" }} />
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            {activities.map((a, i) => {
              const meta      = TYPE_META[a.type] ?? TYPE_META.note;
              const isEditing = editingId === a.id;
              const canEdit   = EDITABLE_TYPES.includes(a.type);

              return (
                <div key={a.id} style={{ display:"flex", gap:16, paddingBottom: i===activities.length-1?0:20 }}>
                  {/* Icon */}
                  <div style={{ width:32, height:32, borderRadius:"50%",
                    background:meta.color+"22", border:`2px solid ${meta.color}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:"0.85rem", flexShrink:0, zIndex:1 }}>
                    {meta.icon}
                  </div>

                  <div style={{ flex:1, paddingTop:4, minWidth:0 }}>

                    {/* ── Inline Edit Form ──────────────────────────────────── */}
                    {isEditing ? (
                      <div style={{ background:"#1c1c1f", border:"1px solid #27272a", borderRadius:10, padding:14, display:"flex", flexDirection:"column", gap:10 }}>
                        {/* Type pills */}
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                          {EDITABLE_TYPES.map(t => (
                            <button key={t} onClick={() => setEditType(t)}
                              style={{ padding:"4px 10px", borderRadius:20, border:"1px solid",
                                borderColor: editType===t ? TYPE_META[t].color : "#27272a",
                                background:  editType===t ? TYPE_META[t].color+"22" : "transparent",
                                color:       editType===t ? TYPE_META[t].color : "#71717a",
                                fontSize:"0.75rem", fontWeight:600, cursor:"pointer" }}>
                              {TYPE_META[t].icon} {TYPE_META[t].label}
                            </button>
                          ))}
                        </div>
                        <input style={inp} placeholder="Title"
                          value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                        <textarea style={{ ...inp, resize:"vertical", minHeight:64 }}
                          placeholder="Notes (optional)"
                          value={editBody} onChange={e => setEditBody(e.target.value)} />
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ flex:1 }}>
                            <label style={{ color:"#71717a", fontSize:"0.72rem", display:"block", marginBottom:4 }}>Date &amp; Time</label>
                            <input type="datetime-local" style={inp} value={editDate} onChange={e => setEditDate(e.target.value)} />
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                          <button onClick={cancelEdit}
                            style={{ background:"none", border:"1px solid #27272a", color:"#71717a",
                              borderRadius:8, padding:"7px 14px", fontSize:"0.82rem", cursor:"pointer" }}>
                            Cancel
                          </button>
                          <button onClick={() => handleSaveEdit(a.id)}
                            disabled={editSaving || !editTitle.trim()}
                            style={{ background:"#C9A84C", color:"#000", border:"none",
                              borderRadius:8, padding:"7px 16px", fontWeight:700,
                              fontSize:"0.82rem", cursor:"pointer",
                              opacity:editTitle.trim()&&!editSaving?1:0.5 }}>
                            {editSaving ? "Saving..." : "Save Changes"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Normal view ────────────────────────────────────── */
                      <>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                          <div style={{ minWidth:0 }}>
                            <span style={{ color:"#fafafa", fontWeight:600, fontSize:"0.875rem" }}>{a.title}</span>
                            <span style={{ marginLeft:8, fontSize:"0.7rem", padding:"2px 7px", borderRadius:4,
                              background:meta.color+"22", color:meta.color, whiteSpace:"nowrap" }}>
                              {meta.label}
                            </span>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                            <span style={{ fontSize:"0.72rem", color:"#52525b", whiteSpace:"nowrap" }}>
                              {timeAgo(a.occurred_at)}
                            </span>
                            {canEdit && (
                              <>
                                <button onClick={() => { openEdit(a); setShowForm(false); }}
                                  title="Edit"
                                  style={{ background:"none", border:"none", color:"#52525b",
                                    cursor:"pointer", fontSize:"0.8rem", padding:"2px 4px",
                                    lineHeight:1, borderRadius:4, transition:"color 0.15s" }}
                                  onMouseEnter={e => (e.currentTarget.style.color="#a1a1aa")}
                                  onMouseLeave={e => (e.currentTarget.style.color="#52525b")}>
                                  ✎
                                </button>
                                <button onClick={() => handleDelete(a.id)}
                                  title="Delete"
                                  style={{ background:"none", border:"none", color:"#52525b",
                                    cursor:"pointer", fontSize:"0.8rem", padding:"2px 4px",
                                    lineHeight:1, borderRadius:4, transition:"color 0.15s" }}
                                  onMouseEnter={e => (e.currentTarget.style.color="#f87171")}
                                  onMouseLeave={e => (e.currentTarget.style.color="#52525b")}>
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {a.body && (
                          <p style={{ color:"#a1a1aa", fontSize:"0.82rem", marginTop:4, lineHeight:1.5 }}>{a.body}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
