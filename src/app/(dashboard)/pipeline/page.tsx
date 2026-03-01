"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STAGES = [
  { id: "prospecting", label: "Prospecting", color: "#71717a" },
  { id: "qualification", label: "Qualified", color: "#60a5fa" },
  { id: "proposal", label: "Proposal", color: "#a78bfa" },
  { id: "negotiation", label: "Negotiation", color: "#fbbf24" },
  { id: "closed_won", label: "Won", color: "#C9A84C" },
  { id: "closed_lost", label: "Lost", color: "#f87171" },
];

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}

export default function PipelinePage() {
  const router = useRouter();
  const supabase = createClient();
  const [deals, setDeals] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newDeal, setNewDeal] = useState({ title: "", company: "", contact_name: "", contact_email: "", value: "", stage: "prospecting", probability: "20", expected_close_date: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase.from("deals").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setDeals(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function handleDrop(stage: string) {
    if (!dragging || dragging === stage) return;
    const deal = deals.find(d => d.id === dragging);
    if (!deal || deal.stage === stage) return;
    setDeals(prev => prev.map(d => d.id === dragging ? { ...d, stage } : d));
    await supabase.from("deals").update({ stage, updated_at: new Date().toISOString() }).eq("id", dragging);
    setDragging(null);
  }

  async function handleAddDeal(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg("");
    const { error } = await supabase.from("deals").insert({
      user_id: userId,
      title: newDeal.title,
      company: newDeal.company,
      contact_name: newDeal.contact_name,
      contact_email: newDeal.contact_email,
      value: parseFloat(newDeal.value) || 0,
      stage: newDeal.stage,
      probability: parseInt(newDeal.probability) || 20,
      expected_close_date: newDeal.expected_close_date || null,
      notes: newDeal.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (!error) {
      setNewDeal({ title: "", company: "", contact_name: "", contact_email: "", value: "", stage: "prospecting", probability: "20", expected_close_date: "", notes: "" });
      setShowAdd(false);
      await load();
    } else setMsg(error.message);
    setSaving(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#1c1c1f", border: "1px solid #27272a",
    borderRadius: 8, padding: "9px 12px", color: "#fafafa", fontSize: "0.875rem",
  };

  if (loading) return <div style={{ padding: 32, color: "#71717a" }}>Loading pipeline...</div>;

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fafafa" }}>Pipeline</h1>
          <p style={{ color: "#71717a", fontSize: "0.82rem", marginTop: 3 }}>{deals.length} deals</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="text"
            placeholder="Search pipeline..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: "#111113", border: "1px solid #27272a", borderRadius: 8,
              color: "#fafafa", padding: "8px 14px", fontSize: "0.875rem",
              outline: "none", width: 220,
            }}
          />
          <button onClick={() => setShowAdd(true)} style={{
            background: "#C9A84C", color: "#000", border: "none", borderRadius: 8,
            padding: "9px 20px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
          }}>+ Add Deal</button>
        </div>
      </div>

      {/* Add Deal Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000000bb", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 14, padding: 28, width: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ color: "#fafafa", fontWeight: 700, marginBottom: 20 }}>New Deal</h2>
            <form onSubmit={handleAddDeal} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { label: "Deal Title *", key: "title", full: true },
                { label: "Company", key: "company" },
                { label: "Contact Name", key: "contact_name" },
                { label: "Contact Email", key: "contact_email", type: "email" },
                { label: "Value ($) *", key: "value", type: "number" },
                { label: "Probability (%)", key: "probability", type: "number" },
                { label: "Expected Close", key: "expected_close_date", type: "date" },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: (f as any).full ? "1/-1" : undefined }}>
                  <label style={{ color: "#a1a1aa", fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: 5 }}>{f.label}</label>
                  <input style={inputStyle} type={(f as any).type || "text"} required={f.label.includes("*")}
                    value={(newDeal as any)[f.key]} onChange={e => setNewDeal(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={{ color: "#a1a1aa", fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Stage</label>
                <select style={inputStyle} value={newDeal.stage} onChange={e => setNewDeal(p => ({ ...p, stage: e.target.value }))}>
                  {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ color: "#a1a1aa", fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Notes</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} value={newDeal.notes} onChange={e => setNewDeal(p => ({ ...p, notes: e.target.value }))} />
              </div>
              {msg && <p style={{ gridColumn: "1/-1", color: "#f87171", fontSize: "0.82rem" }}>{msg}</p>}
              <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowAdd(false)} style={{ background: "#1c1c1f", color: "#fafafa", border: "1px solid #27272a", borderRadius: 8, padding: "9px 18px", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ background: "#C9A84C", color: "#000", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 700, cursor: "pointer" }}>
                  {saving ? "Saving..." : "Add Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 16 }}>
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.id && (!search || d.title?.toLowerCase().includes(search.toLowerCase()) || d.company?.toLowerCase().includes(search.toLowerCase()) || d.contact_name?.toLowerCase().includes(search.toLowerCase())));
          const stageValue = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
          return (
            <div key={stage.id}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(stage.id)}
              style={{ minWidth: 240, flex: "0 0 240px", background: "#111113", borderRadius: 12, border: "1px solid #27272a", padding: 14 }}>
              {/* Column header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid #1c1c1f" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color }} />
                  <span style={{ color: "#fafafa", fontSize: "0.82rem", fontWeight: 600 }}>{stage.label}</span>
                  <span style={{ color: "#52525b", fontSize: "0.72rem" }}>{stageDeals.length}</span>
                </div>
                <span style={{ color: stage.color, fontSize: "0.72rem", fontWeight: 600 }}>{fmt(stageValue)}</span>
              </div>

              {/* Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stageDeals.map(deal => (
                  <div key={deal.id}
                    draggable
                    onDragStart={() => setDragging(deal.id)}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => router.push("/deals/" + deal.id)}
                    style={{
                      background: "#1c1c1f", borderRadius: 8, padding: "12px", cursor: "pointer",
                      border: "1px solid #27272a",
                      opacity: dragging === deal.id ? 0.5 : 1,
                    }}>
                    <p style={{ color: "#fafafa", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>{deal.title}</p>
                    {deal.company && <p style={{ color: "#71717a", fontSize: "0.75rem", marginBottom: 6 }}>{deal.company}</p>}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#C9A84C", fontSize: "0.82rem", fontWeight: 700 }}>{fmt(deal.value)}</span>
                      <span style={{ color: "#52525b", fontSize: "0.72rem" }}>{deal.probability}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
