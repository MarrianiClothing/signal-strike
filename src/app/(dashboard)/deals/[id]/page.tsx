"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ActivityLog from "@/components/ActivityLog";

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
  const router  = useRouter();
  const supabase = createClient();

  const [deal,    setDeal]    = useState<any>(null);
  const [userId,  setUserId]  = useState("");
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<{ok:boolean;text:string}|null>(null);
  const [edit,    setEdit]    = useState<any>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user!.id);
      const { data } = await supabase.from("deals").select("*").eq("id", id).single();
      setDeal(data);
      setEdit(data);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSave() {
    setSaving(true); setMsg(null);
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
      updated_at:          new Date().toISOString(),
    }).eq("id", id);
    if (!error) { setDeal({ ...edit }); setMsg({ ok: true, text: "Deal saved!" }); }
    else setMsg({ ok: false, text: error.message });
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this deal? This cannot be undone.")) return;
    await supabase.from("deals").delete().eq("id", id);
    router.push("/deals");
  }

  if (loading) return <div style={{ padding: 32, color: "#71717a" }}>Loading...</div>;
  if (!deal)   return <div style={{ padding: 32, color: "#f87171" }}>Deal not found.</div>;

  const stageColor = STAGE_COLORS[edit?.stage] ?? "#71717a";

  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      <button onClick={() => router.back()}
        style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer",
          fontSize: "0.85rem", marginBottom: 20, padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
        ← Back
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fafafa", marginBottom: 4 }}>{deal.title}</h1>
          <span style={{ fontSize: "0.8rem", color: stageColor, background: stageColor + "22",
            padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>
            {STAGE_LABELS[deal.stage]}
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "2rem", fontWeight: 800, color: "#C9A84C", fontFamily: "monospace" }}>{fmt(deal.value)}</p>
          <p style={{ fontSize: "0.75rem", color: "#52525b" }}>{deal.probability}% probability</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 }}>
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
        </div>

        {/* Right — Activity Log */}
        <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 12, padding: 24 }}>
          <ActivityLog dealId={id} userId={userId} />
        </div>
      </div>
    </div>
  );
}
