"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Tier { id?: string; name: string; rate: string; description: string; }
const blank: Tier = { name: "", rate: "", description: "" };

export default function CommissionTiersSection({ userId }: { userId: string }) {
  const supabase = createClient();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [editing, setEditing] = useState<Tier | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const inp: React.CSSProperties = { background: "#1c1c1f", border: "1px solid #27272a", borderRadius: 8, padding: "9px 12px", color: "#fafafa", fontSize: "0.875rem", width: "100%", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { color: "#a1a1aa", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 };

  async function load() {
    const { data } = await supabase.from("commission_tiers").select("*").eq("user_id", userId).order("rate", { ascending: false });
    setTiers(data || []);
  }
  useEffect(() => { if (userId) load(); }, [userId]);

  async function handleSave() {
    if (!editing?.name || !editing?.rate) { setMsg({ ok: false, text: "Name and rate required." }); return; }
    setSaving(true); setMsg(null);
    const payload = { user_id: userId, name: editing.name, rate: parseFloat(editing.rate), description: editing.description };
    const { error } = editing.id ? await supabase.from("commission_tiers").update(payload).eq("id", editing.id) : await supabase.from("commission_tiers").insert(payload);
    if (error) setMsg({ ok: false, text: error.message });
    else { setMsg({ ok: true, text: "Saved!" }); setEditing(null); await load(); }
    setSaving(false);
  }
  async function handleDelete(id: string) { await supabase.from("commission_tiers").delete().eq("id", id); await load(); }

  return (
    <section style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 14, padding: 28, marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ color: "#fafafa", fontWeight: 800, fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Commission Tiers</h2>
        {!editing && <button onClick={() => setEditing({ ...blank })} style={{ background: "#C9A84C", color: "#000", border: "none", borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>+ Add Tier</button>}
      </div>
      {tiers.length === 0 && !editing && <p style={{ color: "#52525b", fontSize: "0.85rem" }}>No tiers yet. Add one to assign commission rates per deal type.</p>}
      {tiers.map(t => (
        <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#18181b", borderRadius: 8, marginBottom: 8 }}>
          <div>
            <span style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.9rem" }}>{t.name}</span>
            {t.description && <span style={{ color: "#71717a", fontSize: "0.78rem", marginLeft: 10 }}>{t.description}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#C9A84C", fontWeight: 800, fontSize: "1rem" }}>{t.rate}%</span>
            <button onClick={() => setEditing({ ...t, rate: String(t.rate) })} style={{ background: "transparent", border: "1px solid #27272a", color: "#a1a1aa", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: "0.75rem" }}>Edit</button>
            <button onClick={() => handleDelete(t.id!)} style={{ background: "transparent", border: "1px solid #3f1f1f", color: "#f87171", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: "0.75rem" }}>Delete</button>
          </div>
        </div>
      ))}
      {editing && (
        <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 10, padding: 18, marginTop: 12 }}>
          <h3 style={{ color: "#fafafa", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 14, marginTop: 0 }}>{editing.id ? "Edit Tier" : "New Tier"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12, marginBottom: 12 }}>
            <div><label style={lbl}>Tier Name *</label><input style={inp} placeholder="e.g. Residential, Commercial" value={editing.name} onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))} /></div>
            <div><label style={lbl}>Rate (%) *</label><input style={inp} type="number" min="0" max="100" step="0.1" placeholder="8.5" value={editing.rate} onChange={e => setEditing(p => ({ ...p!, rate: e.target.value }))} /></div>
          </div>
          <div style={{ marginBottom: 14 }}><label style={lbl}>Description</label><input style={inp} placeholder="Optional notes" value={editing.description} onChange={e => setEditing(p => ({ ...p!, description: e.target.value }))} /></div>
          {msg && <p style={{ color: msg.ok ? "#4ade80" : "#f87171", fontSize: "0.82rem", marginBottom: 10 }}>{msg.text}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => { setEditing(null); setMsg(null); }} style={{ background: "#27272a", color: "#fafafa", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ background: "#C9A84C", color: "#000", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, cursor: "pointer" }}>{saving ? "Saving..." : "Save Tier"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
