"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ActivityLog from "@/components/ActivityLog";

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


const STAGES = ["prospecting","qualification","proposal","negotiation","closed_won","closed_lost"];
const STAGE_LABELS: Record<string,string> = {
  prospecting:"Prospecting", qualification:"Qualified", proposal:"Proposal",
  negotiation:"Negotiation", closed_won:"Won", closed_lost:"Lost",
};
const STAGE_COLORS: Record<string,string> = {
  prospecting:"#71717a", qualification:"#60a5fa", proposal:"#a78bfa",
  negotiation:"#fbbf24", closed_won:"#C9A84C", closed_lost:"#f87171",
};

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n/1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return "$" + (n/1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}

const inputStyle = {
  width: "100%", background: "#1c1c1f", border: "1px solid #27272a",
  borderRadius: 8, padding: "9px 12px", color: "#fafafa",
  fontSize: "0.875rem", boxSizing: "border-box" as const,
};
const labelStyle = {
  color: "#71717a", fontSize: "0.75rem", textTransform: "uppercase" as const,
  letterSpacing: "0.05em", marginBottom: 5, display: "block",
};

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router   = useRouter();
  const supabase = createClient();

  const [deal,    setDeal]    = useState<any>(null);
  const [userId,  setUserId]  = useState("");
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<{ok:boolean;text:string}|null>(null);
  const [edit,    setEdit]    = useState<any>(null);
  const [tiers,      setTiers]      = useState<any[]>([]);
  const [contracts,  setContracts]  = useState<any[]>([]);
  const [uploading,  setUploading]  = useState(false);
  const [uploadMsg,  setUploadMsg]  = useState<{ok:boolean;text:string}|null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user!.id);
      const { data } = await supabase
        .from("deals")
        .select("*")
        .eq("id", id)
        .single();
      const { data: tiersData } = await supabase
        .from("commission_tiers")
        .select("*")
        .eq("user_id", user!.id)
        .order("rate", { ascending: false });
      setTiers(tiersData || []);
      setDeal(data);
      setEdit(data);
      // Load contracts via server-side API (service role key)
      try {
        const res = await fetch(`/api/contracts/list?prefix=${user!.id}/${id}`);
        const json = await res.json();
        setContracts(json.files || []);
      } catch {
        setContracts([]);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSave() {
    setSaving(true); setMsg(null);
    const prevTask = (deal?.next_task ?? "").trim();
    const nextTask = (edit.next_task ?? "").trim();
    const taskChanged = nextTask !== prevTask;
    const { error } = await supabase.from("deals").update({
      title:               edit.title,
      company:             edit.company,
      contact_name:        edit.contact_name,
      contact_email:       edit.contact_email,
      contact_phone:       edit.contact_phone || null,
      value:               parseFloat(edit.value),
      stage:               edit.stage,
      probability:         parseInt(edit.probability),
      expected_close_date: edit.expected_close_date || null,
      notes:               edit.notes || null,
      commission_tier_id:  edit.commission_tier_id || null,
      next_task:           nextTask || null,
      updated_at:          new Date().toISOString(),
    }).eq("id", id);
    if (!error) {
      setDeal({ ...edit, next_task: nextTask || null });
      setMsg({ ok: true, text: "Deal saved!" });
      if (taskChanged) {
        const activityTitle = nextTask
          ? `Next task: ${nextTask}`
          : "Next task cleared";
        const { error: logError } = await supabase.from("activities").insert({
          user_id:     userId,
          deal_id:     id,
          type:        "note",
          title:       activityTitle,
          body:        null,
          occurred_at: new Date().toISOString(),
        });
        if (logError) console.error("Activity log error:", logError);
      }
    } else {
      setMsg({ ok: false, text: error.message });
    }
    setSaving(false);
  }

  async function handleContractUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadMsg(null);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${userId}/${id}/${Date.now()}_${safeName}`;

    try {
      // Upload directly from browser → Supabase (no Vercel function involved, no size limit)
      const { error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(filePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        setUploadMsg({ ok: false, text: "Upload failed: " + uploadError.message });
      } else {
        setUploadMsg({ ok: true, text: `✓ ${file.name} uploaded` });
        // Refresh list via server-side API
        const listRes  = await fetch(`/api/contracts/list?prefix=${userId}/${id}`);
        const listJson = await listRes.json();
        setContracts(listJson.files || []);
        // Log to activity
        await supabase.from("activities").insert({
          user_id: userId, deal_id: id, type: "note",
          title: `Contract uploaded: ${file.name}`,
          body: null, occurred_at: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.error("[upload] caught:", err);
      setUploadMsg({ ok: false, text: "Upload failed: " + (err?.message ?? "Unknown error") });
    }

    setUploading(false);
    e.target.value = "";
  }

  async function handleContractDelete(fileName: string) {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return;
    const path = `${userId}/${id}/${fileName}`;
    // Delete directly via Supabase client (RLS policy ensures user can only delete their own files)
    const { error } = await supabase.storage.from("contracts").remove([path]);
    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }
    setContracts(prev => prev.filter((c:any) => c.name !== fileName));
  }

  function getContractUrl(fileName: string) {
    const { data } = supabase.storage.from("contracts").getPublicUrl(`${userId}/${id}/${fileName}`);
    return data.publicUrl;
  }

  async function handleDelete() {
    if (!confirm("Delete this deal? This cannot be undone.")) return;
    await supabase.from("deals").delete().eq("id", id);
    router.push("/deals");
  }

  if (loading) return <div style={{ padding: 32, color: "#71717a" }}>Loading...</div>;
  if (!deal)   return <div style={{ padding: 32, color: "#f87171" }}>Deal not found.</div>;

  const stageColor = STAGE_COLORS[edit?.stage] ?? "#71717a";
  const activeTier = deal.commission_tiers || tiers.find((t:any) => t.id === edit?.commission_tier_id);
  const commission = activeTier ? (deal.value || 0) * (activeTier.rate / 100) : null;

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1100 }}>
      <button onClick={() => router.back()}
        style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer",
          fontSize: "0.85rem", marginBottom: 20, padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
        ← Back
      </button>

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fafafa", marginBottom: 4 }}>{deal.title}</h1>
          <span style={{ fontSize: "0.8rem", color: stageColor, background: stageColor + "22",
            padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>
            {STAGE_LABELS[deal.stage]}
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "2rem", fontWeight: 800, color: "#C9A84C", fontFamily: "monospace" }}>{fmt(deal.value)}</p>
          {commission !== null && (
            <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:"16px 20px", marginTop:12 }}>
              <p style={{ color:"#71717a", fontSize:"0.7rem", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Commission</p>
              <p style={{ fontSize:"1.5rem", fontWeight:800, color:"#34d399", fontFamily:"monospace", marginBottom:4 }}>{fmt(commission)}</p>
              <p style={{ color:"#52525b", fontSize:"0.75rem" }}>{activeTier.name} · {activeTier.rate}% of {fmt(deal.value)}</p>
            </div>
          )}
          <p style={{ fontSize: "0.75rem", color: "#52525b", marginTop: 8 }}>{deal.probability}% probability</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 380px", gap: 20 }}>
        {/* Left — Edit form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 12, padding: 24 }}>
            <h2 style={{ color: "#fafafa", fontWeight: 700, marginBottom: 20, fontSize: "0.95rem" }}>Deal Details</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={labelStyle}>Deal Title</label>
                <input style={inputStyle} value={edit.title ?? ""} onChange={e => setEdit((p:any)=>({...p,title:e.target.value}))} />
              </div>
              <div>
                <label style={labelStyle}>Company</label>
                <input style={inputStyle} value={edit.company ?? ""} onChange={e => setEdit((p:any)=>({...p,company:e.target.value}))} />
              </div>
              <div>
                <label style={labelStyle}>Value ($)</label>
                <input style={inputStyle} type="number" value={edit.value ?? ""} onChange={e => setEdit((p:any)=>({...p,value:e.target.value}))} />
              </div>
              <div>
                <label style={labelStyle}>Contact Name</label>
                <input style={inputStyle} value={edit.contact_name ?? ""} onChange={e => setEdit((p:any)=>({...p,contact_name:e.target.value}))} />
              </div>
              <div>
                <label style={labelStyle}>Contact Email</label>
                <input style={inputStyle} value={edit.contact_email ?? ""} onChange={e => setEdit((p:any)=>({...p,contact_email:e.target.value}))} />
              </div>
              <div>
                <label style={labelStyle}>Contact Phone</label>
                <input style={inputStyle} type="tel" placeholder="(555) 000-0000" value={edit.contact_phone ?? ""} onChange={e => setEdit((p:any)=>({...p,contact_phone:e.target.value}))} />
              </div>
              <div>
                <label style={labelStyle}>Stage</label>
                <select style={inputStyle} value={edit.stage ?? ""} onChange={e => setEdit((p:any)=>({...p,stage:e.target.value}))}>
                  {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Probability (%)</label>
                <input style={inputStyle} type="number" min="0" max="100" value={edit.probability ?? ""} onChange={e => setEdit((p:any)=>({...p,probability:e.target.value}))} />
              </div>
              <div>
                <label style={labelStyle}>Expected Close Date</label>
                <input style={inputStyle} type="date" value={edit.expected_close_date ?? ""} onChange={e => setEdit((p:any)=>({...p,expected_close_date:e.target.value}))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 80 }} value={edit.notes ?? ""} onChange={e => setEdit((p:any)=>({...p,notes:e.target.value}))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={labelStyle}>Commission Tier</label>
                <select style={inputStyle} value={edit.commission_tier_id ?? ""} onChange={e => setEdit((p:any)=>({...p,commission_tier_id:e.target.value}))}>
                  <option value="">-- None --</option>
                  {tiers.map((t:any) => <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ ...labelStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Next Task</span>
                  <span style={{ color: "#3f3f46", fontSize: "0.7rem", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>Optional</span>
                </label>
                <div style={{ position: "relative" }}>
                  <textarea
                    style={{ ...inputStyle, resize: "vertical", minHeight: 72, paddingRight: edit.next_task ? 32 : 12 }}
                    placeholder="e.g. Follow up with contact by Friday, send proposal draft..."
                    value={edit.next_task ?? ""}
                    onChange={e => setEdit((p:any) => ({ ...p, next_task: e.target.value }))}
                  />
                  {edit.next_task && (
                    <button
                      onClick={() => setEdit((p:any) => ({ ...p, next_task: "" }))}
                      style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none",
                        color: "#52525b", cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: 2 }}>
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>

            {msg && <p style={{ color: msg.ok ? "#4ade80" : "#f87171", fontSize: "0.85rem", marginTop: 12 }}>{msg.text}</p>}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
              <button onClick={handleDelete}
                style={{ background: "none", border: "1px solid #27272a", color: "#f87171",
                  borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
                Delete Deal
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ background: "#C9A84C", color: "#000", border: "none",
                  borderRadius: 8, padding: "8px 20px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
          {/* Contracts */}
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.95rem", margin: 0 }}>📄 Contracts & Documents</h2>
              <label style={{
                background: "#C9A84C", color: "#000", borderRadius: 8, padding: "7px 14px",
                fontWeight: 700, fontSize: "0.78rem", cursor: uploading ? "not-allowed" : "pointer",
                opacity: uploading ? 0.6 : 1, whiteSpace: "nowrap",
              }}>
                {uploading ? "Uploading..." : "+ Attach File"}
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" style={{ display: "none" }} onChange={handleContractUpload} disabled={uploading} />
              </label>
            </div>

            {uploadMsg && (
              <p style={{ color: uploadMsg.ok ? "#4ade80" : "#f87171", fontSize: "0.82rem", marginBottom: 12 }}>{uploadMsg.text}</p>
            )}

            {contracts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0", color: "#3f3f46" }}>
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>📁</div>
                <p style={{ fontSize: "0.82rem", margin: 0 }}>No files attached yet.</p>
                <p style={{ fontSize: "0.75rem", margin: "4px 0 0", color: "#27272a" }}>PDF, Word, Excel, or images</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {contracts.map((c: any) => {
                  const rawName = c.name.replace(/^\d+_/, "");
                  const ext = rawName.split(".").pop()?.toLowerCase() || "";
                  const icon = ["pdf"].includes(ext) ? "📕" : ["doc","docx"].includes(ext) ? "📘" : ["xls","xlsx"].includes(ext) ? "📗" : ["png","jpg","jpeg"].includes(ext) ? "🖼️" : "📄";
                  const sizeKB = c.metadata?.size ? (c.metadata.size / 1024).toFixed(1) + " KB" : "";
                  return (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#18181b", borderRadius: 8, border: "1px solid #27272a" }}>
                      <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>{icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: "#fafafa", fontSize: "0.85rem", fontWeight: 600, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rawName}</p>
                        {sizeKB && <p style={{ color: "#52525b", fontSize: "0.72rem", margin: 0 }}>{sizeKB}</p>}
                      </div>
                      <a href={getContractUrl(c.name)} target="_blank" rel="noopener noreferrer"
                        style={{ background: "#27272a", border: "none", color: "#a1a1aa", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: "0.75rem", textDecoration: "none", flexShrink: 0 }}>
                        View
                      </a>
                      <button onClick={() => handleContractDelete(c.name)}
                        style={{ background: "rgba(248,113,113,0.08)", border: "none", color: "#f87171", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: "0.75rem", flexShrink: 0 }}>
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right — Activity Log */}
        <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 12, padding: 24 }}>
          <ActivityLog dealId={id} userId={userId} />
        </div>
      </div>
    </div>
  );
}
