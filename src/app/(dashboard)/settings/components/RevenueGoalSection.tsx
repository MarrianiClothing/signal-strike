"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type PeriodType = "monthly" | "quarterly" | "annual" | "multi-year";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const QUARTERS: Record<string, { label: string; start: [number,number]; end: [number,number] }> = {
  Q1: { label: "Q1 (Jan–Mar)", start: [1,1],  end: [3,31]  },
  Q2: { label: "Q2 (Apr–Jun)", start: [4,1],  end: [6,30]  },
  Q3: { label: "Q3 (Jul–Sep)", start: [7,1],  end: [9,30]  },
  Q4: { label: "Q4 (Oct–Dec)", start: [10,1], end: [12,31] },
};

function pad(n: number) { return String(n).padStart(2,"0"); }
function lastDay(y: number, m: number) { return new Date(y, m, 0).getDate(); }

function buildDates(pt: PeriodType, month: number, quarter: string, year: number, sy: number, ey: number) {
  if (pt === "monthly") return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${lastDay(year,month)}`, refYear: year };
  if (pt === "quarterly") {
    const q = QUARTERS[quarter];
    return { start: `${year}-${pad(q.start[0])}-${pad(q.start[1])}`, end: `${year}-${pad(q.end[0])}-${pad(q.end[1])}`, refYear: year };
  }
  if (pt === "annual") return { start: `${year}-01-01`, end: `${year}-12-31`, refYear: year };
  return { start: `${sy}-01-01`, end: `${ey}-12-31`, refYear: sy };
}

function yearRange() {
  const y = new Date().getFullYear();
  return Array.from({ length: 10 }, (_, i) => y - 2 + i);
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function periodLabel(g: any) {
  const s = new Date(g.period_start + "T00:00:00");
  const e = new Date(g.period_end   + "T00:00:00");
  if (g.period_type === "monthly")    return `${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
  if (g.period_type === "quarterly") {
    const m = s.getMonth() + 1;
    const q = m <= 3 ? "Q1" : m <= 6 ? "Q2" : m <= 9 ? "Q3" : "Q4";
    return `${q} ${s.getFullYear()}`;
  }
  if (g.period_type === "annual")     return `${s.getFullYear()} Annual`;
  return `${s.getFullYear()}–${e.getFullYear()} Multi-Year`;
}

function isActive(g: any) {
  const today = new Date().toISOString().slice(0, 10);
  return g.period_start <= today && today <= g.period_end;
}

const s = {
  label:  { color: "#a1a1aa", fontSize: "0.8rem", textTransform: "uppercase" as const, marginBottom: 6, display: "block" },
  input:  { width: "100%", background: "#1c1c1f", border: "1px solid #27272a", borderRadius: 8, padding: "10px 12px", color: "#fafafa", fontSize: "0.9rem", boxSizing: "border-box" as const },
  select: { width: "100%", background: "#1c1c1f", border: "1px solid #27272a", borderRadius: 8, padding: "10px 12px", color: "#fafafa", fontSize: "0.9rem", boxSizing: "border-box" as const },
};

export default function RevenueGoalSection({ userId }: { userId: string }) {
  const supabase = createClient();
  const now = new Date();
  const [periodType, setPeriodType] = useState<PeriodType>("annual");
  const [month,      setMonth]      = useState(now.getMonth() + 1);
  const [quarter,    setQuarter]    = useState("Q1");
  const [year,       setYear]       = useState(now.getFullYear());
  const [startYear,  setStartYear]  = useState(now.getFullYear());
  const [endYear,    setEndYear]    = useState(now.getFullYear() + 2);
  const [target,     setTarget]     = useState("");
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState<{ ok: boolean; text: string } | null>(null);
  const [goals,      setGoals]      = useState<any[]>([]);
  const years = yearRange();

  async function refresh() {
    const { data } = await supabase.from("goals").select("*").eq("user_id", userId).order("period_start", { ascending: false }).limit(12);
    if (data) setGoals(data);
  }

  useEffect(() => { if (userId) refresh(); }, [userId]);

  async function handleSave() {
    const amount = parseFloat(target.replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0) { setMsg({ ok: false, text: "Enter a valid revenue target." }); return; }
    if (periodType === "multi-year" && endYear <= startYear) { setMsg({ ok: false, text: "End year must be after start year." }); return; }
    setSaving(true); setMsg(null);
    const { start, end, refYear } = buildDates(periodType, month, quarter, year, startYear, endYear);
    const { data: existing } = await supabase.from("goals").select("id").eq("user_id", userId).eq("period_start", start).eq("period_end", end).maybeSingle();
    const payload = { user_id: userId, year: refYear, annual_target: amount, period_type: periodType, period_start: start, period_end: end, target_revenue: amount, updated_at: new Date().toISOString() };
    const { error } = existing?.id
      ? await supabase.from("goals").update({ target_revenue: amount, annual_target: amount, updated_at: new Date().toISOString() }).eq("id", existing.id)
      : await supabase.from("goals").insert(payload);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Goal saved!" });
    if (!error) { setTarget(""); refresh(); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("goals").delete().eq("id", id);
    setGoals(g => g.filter(x => x.id !== id));
  }

  return (
    <div style={{ background: "#111113", borderRadius: 12, padding: 24, marginBottom: 24 }}>
      <h2 style={{ color: "#fafafa", fontWeight: 700, marginBottom: 4 }}>Revenue Goal</h2>
      <p style={{ color: "#71717a", fontSize: "0.8rem", marginBottom: 20 }}>Set monthly, quarterly, annual, or multi-year targets. The active goal shows on your Dashboard.</p>

      {/* Period Type Buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {(["monthly","quarterly","annual","multi-year"] as PeriodType[]).map(pt => (
          <button key={pt} onClick={() => setPeriodType(pt)} style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${periodType === pt ? "#C9A84C" : "#27272a"}`, background: periodType === pt ? "#C9A84C" : "#1c1c1f", color: periodType === pt ? "#000" : "#fafafa", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
            {pt.charAt(0).toUpperCase() + pt.slice(1)}
          </button>
        ))}
      </div>

      {/* Period Pickers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        {periodType === "monthly" && (
          <>
            <div><label style={s.label}>Month</label>
              <select style={s.select} value={month} onChange={e => setMonth(Number(e.target.value))}>
                {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div><label style={s.label}>Year</label>
              <select style={s.select} value={year} onChange={e => setYear(Number(e.target.value))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </>
        )}
        {periodType === "quarterly" && (
          <>
            <div><label style={s.label}>Quarter</label>
              <select style={s.select} value={quarter} onChange={e => setQuarter(e.target.value)}>
                {Object.entries(QUARTERS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div><label style={s.label}>Year</label>
              <select style={s.select} value={year} onChange={e => setYear(Number(e.target.value))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </>
        )}
        {periodType === "annual" && (
          <div><label style={s.label}>Year</label>
            <select style={s.select} value={year} onChange={e => setYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        {periodType === "multi-year" && (
          <>
            <div><label style={s.label}>Start Year</label>
              <select style={s.select} value={startYear} onChange={e => setStartYear(Number(e.target.value))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div><label style={s.label}>End Year</label>
              <select style={s.select} value={endYear} onChange={e => setEndYear(Number(e.target.value))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </>
        )}
        <div><label style={s.label}>Target Revenue ($)</label>
          <input style={s.input} type="number" placeholder="e.g. 500000" value={target} onChange={e => setTarget(e.target.value)} />
        </div>
      </div>

      {msg && <div style={{ color: msg.ok ? "#4ade80" : "#f87171", fontSize: "0.85rem", marginBottom: 12 }}>{msg.text}</div>}
      <button onClick={handleSave} disabled={saving} style={{ background: "#C9A84C", color: "#000", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, cursor: "pointer", marginBottom: 24 }}>
        {saving ? "Saving..." : "Save Goal"}
      </button>

      {goals.length > 0 && (
        <div>
          <h3 style={{ color: "#a1a1aa", fontSize: "0.78rem", textTransform: "uppercase", marginBottom: 10 }}>Saved Goals</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {goals.map(g => (
              <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1c1c1f", borderRadius: 8, padding: "10px 14px", border: `1px solid ${isActive(g) ? "#C9A84C" : "#27272a"}` }}>
                <div>
                  <span style={{ color: "#fafafa", fontSize: "0.88rem", fontWeight: 600 }}>{periodLabel(g)}</span>
                  {isActive(g) && <span style={{ marginLeft: 8, background: "#C9A84C", color: "#000", fontSize: "0.7rem", fontWeight: 700, borderRadius: 4, padding: "2px 6px" }}>ACTIVE</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: "#C9A84C", fontWeight: 700, fontSize: "0.88rem" }}>{fmt(g.target_revenue)}</span>
                  <button onClick={() => handleDelete(g.id)} style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", fontSize: "1rem", lineHeight: 1 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
