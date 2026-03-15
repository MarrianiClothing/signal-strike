"use client";
import { useEffect, useState, useRef } from "react";

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

import { createClient } from "@/lib/supabase/client";

const CATEGORIES = ["Travel", "Meals & Entertainment", "Marketing", "Client Expenses"];
const STATUSES = ["Pending", "Submitted", "Approved", "Reimbursed"];

const STATUS_COLORS: Record<string, string> = {
  Pending:    "#fbbf24",
  Submitted:  "#60a5fa",
  Approved:   "#34d399",
  Reimbursed: "#C9A84C",
};

const CAT_COLORS = ["#C9A84C", "#34d399", "#a78bfa", "#60a5fa"];

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(2);
}

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div style={{ color: "#52525b", fontSize: "0.82rem", textAlign: "center", padding: "40px 0" }}>No expenses yet</div>;

  const size = 160;
  const radius = 58;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = data.filter(d => d.value > 0).map((d, i) => {
    const pct = d.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const seg = { ...d, dash, gap, offset, pct };
    offset += dash;
    return seg;
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#27272a" strokeWidth={22} />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={22}
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-s.offset + circumference * 0.25}
            style={{ transition: "all 0.4s" }}
          />
        ))}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#fafafa" fontSize={13} fontWeight={700}>{fmt(total)}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#71717a" fontSize={9}>TOTAL</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: "#a1a1aa", fontSize: "0.78rem" }}>{s.label}</span>
            <span style={{ color: "#fafafa", fontSize: "0.78rem", fontWeight: 600, marginLeft: "auto" }}>{fmt(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  merchant: "", amount: "", category: CATEGORIES[0], status: "Pending",
  expense_date: new Date().toISOString().slice(0, 10),
  deal_id: "", notes: "", receipt_url: "",
};

export default function ExpensesPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState("");
  const [expenses, setExpenses] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCat, setFilterCat] = useState("All");
  const fileRef   = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Report modal state
  const [reportModal, setReportModal] = useState(false);
  const [reportType, setReportType] = useState<"month" | "deal">("month");
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportDealId, setReportDealId] = useState("");
  const [reportEmail, setReportEmail] = useState("");
  const [reportMode, setReportMode] = useState<"download" | "email">("download");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMsg, setReportMsg] = useState("");
  const isMobile = useIsMobile();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const [expRes, dealRes] = await Promise.all([
        supabase.from("expenses").select("*").eq("user_id", user.id).order("expense_date", { ascending: false }),
        supabase.from("deals").select("id, title, company").eq("user_id", user.id).not("stage", "in", '("closed_lost")'),
      ]);
      setExpenses(expRes.data || []);
      setDeals(dealRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function reload() {
    const { data } = await supabase.from("expenses").select("*").eq("user_id", userId).order("expense_date", { ascending: false });
    setExpenses(data || []);
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModal(true);
  }

  function openEdit(exp: any) {
    setEditing(exp);
    setForm({
      merchant: exp.merchant || "",
      amount: exp.amount?.toString() || "",
      category: exp.category || CATEGORIES[0],
      status: exp.status || "Pending",
      expense_date: exp.expense_date || new Date().toISOString().slice(0, 10),
      deal_id: exp.deal_id || "",
      notes: exp.notes || "",
      receipt_url: exp.receipt_url || "",
    });
    setModal(true);
  }

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("receipts").upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
      setForm(f => ({ ...f, receipt_url: urlData.publicUrl }));
    }
    setUploading(false);
  }

  async function handleSave() {
    if (!form.merchant || !form.amount) return;
    setSaving(true);
    const payload = {
      user_id: userId,
      merchant: form.merchant,
      amount: parseFloat(form.amount),
      category: form.category,
      status: form.status,
      expense_date: form.expense_date,
      deal_id: form.deal_id || null,
      notes: form.notes || null,
      receipt_url: form.receipt_url || null,
    };
    if (editing) {
      await supabase.from("expenses").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("expenses").insert([payload]);
    }
    await reload();
    setSaving(false);
    setModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    await reload();
  }

  const filtered = expenses.filter(e =>
    (filterStatus === "All" || e.status === filterStatus) &&
    (filterCat === "All" || e.category === filterCat)
  );

  const totalAmt    = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const pendingAmt  = expenses.filter(e => e.status === "Pending").reduce((s, e) => s + (e.amount || 0), 0);
  const approvedAmt = expenses.filter(e => e.status === "Approved").reduce((s, e) => s + (e.amount || 0), 0);
  const thisMonth   = expenses.filter(e => e.expense_date?.startsWith(new Date().toISOString().slice(0, 7)))
                              .reduce((s, e) => s + (e.amount || 0), 0);

  const chartData = CATEGORIES.map((cat, i) => ({
    label: cat,
    value: expenses.filter(e => e.category === cat).reduce((s, e) => s + (e.amount || 0), 0),
    color: CAT_COLORS[i],
  }));

  async function handleReport() {
    setReportLoading(true);
    setReportMsg("");
    try {
      const params: Record<string, string> = { mode: reportMode };
      if (reportType === "month") params.month = reportMonth;
      else if (reportDealId) params.deal_id = reportDealId;
      if (reportMode === "email") params.email = reportEmail;

      const res = await fetch("/api/expenses/report?" + new URLSearchParams(params));
      if (reportMode === "download") {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Expense-Report-${reportType === "month" ? reportMonth : "deal"}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setReportMsg("✓ PDF downloaded");
      } else {
        const json = await res.json();
        setReportMsg(json.ok ? "✓ Report emailed successfully" : "✗ " + (json.error || "Failed"));
      }
    } catch (e: any) {
      setReportMsg("✗ Error: " + e.message);
    }
    setReportLoading(false);
  }

  const card: React.CSSProperties = {
    background: "#111113", border: "1px solid #27272a", borderRadius: 12, padding: 24,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#18181b", border: "1px solid #27272a", borderRadius: 8,
    color: "#fafafa", padding: "10px 12px", fontSize: "0.85rem", outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", color: "#71717a", fontSize: "0.72rem",
    fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6,
  };

  if (loading) return <div style={{ padding: 32, color: "#71717a" }}>Loading...</div>;

  return (
    <div style={{ padding: isMobile ? "16px 0" : 32, maxWidth: isMobile ? "100%" : 1200 }}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: 28, gap: 12, margin: isMobile ? "0 16px" : 0 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fafafa", margin: 0 }}>Expenses</h1>
          <p style={{ color: "#71717a", fontSize: "0.85rem", marginTop: 4 }}>{expenses.length} total expense{expenses.length !== 1 ? "s" : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 10, width: isMobile ? "100%" : "auto" }}>
          <button onClick={() => { setReportModal(true); setReportMsg(""); }} style={{
            background: "transparent", color: "#C9A84C", border: "1px solid #C9A84C",
            borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: "0.85rem",
            cursor: "pointer", fontFamily: "var(--font-montserrat, sans-serif)", letterSpacing: "0.06em",
          }}>
            ⬇ Generate Report
          </button>
          <button onClick={openAdd} style={{
            background: "#C9A84C", color: "#000", border: "none", borderRadius: 8,
            padding: "10px 20px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
            fontFamily: "var(--font-montserrat, sans-serif)", letterSpacing: "0.06em",
          }}>
            + Add Expense
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: isMobile ? 10 : 16, marginBottom: 24, margin: isMobile ? "0 16px" : 0 }}>
        {[
          { label: "Total Expenses",  value: fmt(totalAmt),    color: "#fafafa" },
          { label: "Pending",         value: fmt(pendingAmt),  color: "#fbbf24" },
          { label: "Approved",        value: fmt(approvedAmt), color: "#34d399" },
          { label: "This Month",      value: fmt(thisMonth),   color: "#C9A84C" },
        ].map(s => (
          <div key={s.label} style={card}>
            <p style={{ color: "#71717a", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{s.label}</p>
            <p style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color, fontFamily: "var(--font-cinzel, serif)" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 20, marginBottom: 24, margin: isMobile ? "0 16px" : 0 }}>
        {/* Filters + list */}
        <div>
          {/* Filter bar — scrollable on mobile */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch" as any }}>
              {["All", ...STATUSES].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  padding: "6px 12px", borderRadius: 20, border: "1px solid", flexShrink: 0,
                  borderColor: filterStatus === s ? "#C9A84C" : "#27272a",
                  background: filterStatus === s ? "rgba(201,168,76,0.12)" : "transparent",
                  color: filterStatus === s ? "#C9A84C" : "#71717a",
                  fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                }}>{s}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" as any, marginTop: 6 }}>
              {["All", ...CATEGORIES].map(c => (
                <button key={c} onClick={() => setFilterCat(c)} style={{
                  padding: "6px 12px", borderRadius: 20, border: "1px solid", flexShrink: 0,
                  borderColor: filterCat === c ? "#a78bfa" : "#27272a",
                  background: filterCat === c ? "rgba(167,139,250,0.12)" : "transparent",
                  color: filterCat === c ? "#a78bfa" : "#71717a",
                  fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                }}>{c}</button>
              ))}
            </div>
          </div>

          {/* Expense cards */}
          {filtered.length === 0 ? (
            <div style={{ ...card, textAlign: "center", padding: "48px 24px" }}>
              <p style={{ color: "#52525b", fontSize: "0.9rem" }}>No expenses found.</p>
              <button onClick={openAdd} style={{ marginTop: 12, background: "transparent", border: "1px solid #27272a", color: "#a1a1aa", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: "0.82rem" }}>
                Add your first expense
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map(exp => {
                const deal = deals.find(d => d.id === exp.deal_id);
                const statusColor = STATUS_COLORS[exp.status] || "#71717a";
                const catIdx = CATEGORIES.indexOf(exp.category);
                const catColor = CAT_COLORS[catIdx] || "#71717a";
                return (
                  <div key={exp.id} style={{
                    background: "#111113", border: "1px solid #27272a", borderRadius: 12,
                    borderLeft: `3px solid ${catColor}`, overflow: "hidden",
                  }}>
                    <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                      {/* Date */}
                      <div style={{ textAlign: "center", flexShrink: 0, width: 44 }}>
                        <div style={{ color: "#C9A84C", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase" }}>
                          {new Date(exp.expense_date + "T12:00:00").toLocaleString("en-US", { month: "short" })}
                        </div>
                        <div style={{ color: "#fafafa", fontSize: "1.1rem", fontWeight: 800, lineHeight: 1 }}>
                          {new Date(exp.expense_date + "T12:00:00").getDate()}
                        </div>
                      </div>

                      <div style={{ width: 1, height: 36, background: "#27272a", flexShrink: 0 }} />

                      {/* Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <p style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.92rem", margin: 0 }}>{exp.merchant}</p>
                          <span style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: 10, background: catColor + "22", color: catColor, fontWeight: 600 }}>{exp.category}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {deal && <span style={{ color: "#52525b", fontSize: "0.75rem" }}>📎 {deal.title}</span>}
                          {exp.notes && <span style={{ color: "#52525b", fontSize: "0.75rem", fontStyle: "italic" }}>"{exp.notes}"</span>}
                          {exp.receipt_url && (
                            <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer"
                              style={{ color: "#60a5fa", fontSize: "0.72rem", textDecoration: "none" }}>
                              📄 Receipt
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Amount + Status */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ color: "#fafafa", fontWeight: 800, fontSize: "1.1rem", fontFamily: "var(--font-cinzel, serif)", margin: 0 }}>{fmt(exp.amount)}</p>
                        <span style={{ fontSize: "0.7rem", padding: "3px 10px", borderRadius: 10, background: statusColor + "22", color: statusColor, fontWeight: 600 }}>
                          {exp.status}
                        </span>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => openEdit(exp)} style={{ background: "#27272a", border: "none", color: "#a1a1aa", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: "0.78rem" }}>Edit</button>
                        <button onClick={() => handleDelete(exp.id)} style={{ background: "rgba(248,113,113,0.1)", border: "none", color: "#f87171", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: "0.78rem" }}>✕</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chart */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={card}>
            <h2 style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.95rem", marginBottom: 20 }}>By Category</h2>
            <DonutChart data={chartData} />
          </div>

          {/* Status breakdown */}
          <div style={card}>
            <h2 style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.95rem", marginBottom: 16 }}>By Status</h2>
            {STATUSES.map(s => {
              const amt = expenses.filter(e => e.status === s).reduce((sum, e) => sum + (e.amount || 0), 0);
              const count = expenses.filter(e => e.status === s).length;
              if (count === 0) return null;
              return (
                <div key={s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[s] }} />
                    <span style={{ color: "#a1a1aa", fontSize: "0.82rem" }}>{s}</span>
                    <span style={{ color: "#52525b", fontSize: "0.72rem" }}>({count})</span>
                  </div>
                  <span style={{ color: "#fafafa", fontSize: "0.82rem", fontWeight: 600 }}>{fmt(amt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {reportModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }} onClick={e => { if (e.target === e.currentTarget) setReportModal(false); }}>
          <div style={{
            background: "#111113", border: "1px solid #27272a", borderRadius: 16,
            padding: 28, width: "100%", maxWidth: 480,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ color: "#fafafa", fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>Generate Expense Report</h2>
              <button onClick={() => setReportModal(false)} style={{ background: "transparent", border: "none", color: "#71717a", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Report type toggle */}
              <div>
                <label style={{ display: "block", color: "#71717a", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Filter By</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["month", "deal"] as const).map(t => (
                    <button key={t} onClick={() => setReportType(t)} style={{
                      flex: 1, padding: "9px", borderRadius: 8, border: "1px solid",
                      borderColor: reportType === t ? "#C9A84C" : "#27272a",
                      background: reportType === t ? "rgba(201,168,76,0.12)" : "transparent",
                      color: reportType === t ? "#C9A84C" : "#71717a",
                      fontWeight: 600, fontSize: "0.85rem", cursor: "pointer",
                      textTransform: "capitalize",
                    }}>{t === "month" ? "📅 Month" : "📎 Deal"}</button>
                  ))}
                </div>
              </div>

              {/* Month picker or Deal picker */}
              {reportType === "month" ? (
                <div>
                  <label style={{ display: "block", color: "#71717a", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Month</label>
                  <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)}
                    style={{ width: "100%", background: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#fafafa", padding: "10px 12px", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" as const }} />
                </div>
              ) : (
                <div>
                  <label style={{ display: "block", color: "#71717a", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Deal</label>
                  <select value={reportDealId} onChange={e => setReportDealId(e.target.value)}
                    style={{ width: "100%", background: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#fafafa", padding: "10px 12px", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" as const }}>
                    <option value="">— Select a deal —</option>
                    {deals.map(d => <option key={d.id} value={d.id}>{d.title}{d.company ? ` · ${d.company}` : ""}</option>)}
                  </select>
                </div>
              )}

              {/* Delivery method */}
              <div>
                <label style={{ display: "block", color: "#71717a", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Delivery</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["download", "email"] as const).map(m => (
                    <button key={m} onClick={() => setReportMode(m)} style={{
                      flex: 1, padding: "9px", borderRadius: 8, border: "1px solid",
                      borderColor: reportMode === m ? "#C9A84C" : "#27272a",
                      background: reportMode === m ? "rgba(201,168,76,0.12)" : "transparent",
                      color: reportMode === m ? "#C9A84C" : "#71717a",
                      fontWeight: 600, fontSize: "0.85rem", cursor: "pointer",
                    }}>{m === "download" ? "⬇ PDF Download" : "✉ Send Email"}</button>
                  ))}
                </div>
              </div>

              {/* Email input */}
              {reportMode === "email" && (
                <div>
                  <label style={{ display: "block", color: "#71717a", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Recipient Email</label>
                  <input type="email" placeholder="client@example.com" value={reportEmail}
                    onChange={e => setReportEmail(e.target.value)}
                    style={{ width: "100%", background: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#fafafa", padding: "10px 12px", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" as const }} />
                </div>
              )}

              {/* Feedback */}
              {reportMsg && (
                <p style={{ color: reportMsg.startsWith("✓") ? "#34d399" : "#f87171", fontSize: "0.85rem", margin: 0 }}>{reportMsg}</p>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setReportModal(false)} style={{
                  flex: 1, padding: "11px", borderRadius: 8, background: "transparent",
                  border: "1px solid #27272a", color: "#71717a", cursor: "pointer", fontSize: "0.85rem",
                }}>Cancel</button>
                <button
                  onClick={handleReport}
                  disabled={reportLoading || (reportMode === "email" && !reportEmail) || (reportType === "deal" && !reportDealId)}
                  style={{
                    flex: 2, padding: "11px", borderRadius: 8,
                    background: reportLoading ? "#8a7235" : "#C9A84C",
                    border: "none", color: "#000", fontWeight: 700,
                    cursor: reportLoading ? "not-allowed" : "pointer", fontSize: "0.85rem",
                    fontFamily: "var(--font-montserrat, sans-serif)", letterSpacing: "0.06em",
                  }}>
                  {reportLoading ? "Generating..." : reportMode === "download" ? "Download PDF" : "Send Report"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expense Add/Edit Modal */}
      {modal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }} onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div style={{
            background: "#111113", border: "1px solid #27272a", borderRadius: 16,
            padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ color: "#fafafa", fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>
                {editing ? "Edit Expense" : "Add Expense"}
              </h2>
              <button onClick={() => setModal(false)} style={{ background: "transparent", border: "none", color: "#71717a", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Merchant + Amount */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Merchant *</label>
                  <input style={inputStyle} placeholder="e.g. Delta Airlines" value={form.merchant}
                    onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Amount *</label>
                  <input style={inputStyle} type="number" step="0.01" placeholder="0.00" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>

              {/* Category + Status */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select style={inputStyle} value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select style={inputStyle} value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Date + Deal */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input style={inputStyle} type="date" value={form.expense_date}
                    onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Link to Deal</label>
                  <select style={inputStyle} value={form.deal_id}
                    onChange={e => setForm(f => ({ ...f, deal_id: e.target.value }))}>
                    <option value="">— None —</option>
                    {deals.map(d => <option key={d.id} value={d.id}>{d.title}{d.company ? ` · ${d.company}` : ""}</option>)}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 72 }} placeholder="Optional description..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              {/* Receipt Upload */}
              <div>
                <label style={labelStyle}>Receipt</label>

                {/* Status / preview row */}
                {form.receipt_url && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)",
                    borderRadius: 8, padding: "8px 12px", marginBottom: 10,
                  }}>
                    <span style={{ color: "#34d399", fontSize: "0.8rem", flex: 1 }}>
                      ✓ Receipt attached
                    </span>
                    <a href={form.receipt_url} target="_blank" rel="noopener noreferrer"
                      style={{ color: "#60a5fa", fontSize: "0.75rem", textDecoration: "none" }}>
                      View
                    </a>
                    <button onClick={() => setForm(f => ({ ...f, receipt_url: "" }))}
                      style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.8rem", padding: 0 }}>
                      ✕
                    </button>
                  </div>
                )}

                {uploading ? (
                  <div style={{
                    background: "#18181b", border: "1px dashed #3f3f46", borderRadius: 8,
                    color: "#71717a", padding: "12px 16px", fontSize: "0.82rem", textAlign: "center",
                  }}>
                    Uploading receipt...
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {/* Camera capture — opens rear camera on mobile */}
                    <button onClick={() => cameraRef.current?.click()} style={{
                      background: "#18181b", border: "1px dashed #3f3f46", borderRadius: 8,
                      color: "#a1a1aa", padding: "12px 10px", cursor: "pointer",
                      fontSize: "0.82rem", textAlign: "center", display: "flex",
                      flexDirection: "column", alignItems: "center", gap: 6,
                    }}>
                      <span style={{ fontSize: "1.3rem" }}>📷</span>
                      <span>Take Photo</span>
                    </button>

                    {/* File picker — for desktop or existing files */}
                    <button onClick={() => fileRef.current?.click()} style={{
                      background: "#18181b", border: "1px dashed #3f3f46", borderRadius: 8,
                      color: "#a1a1aa", padding: "12px 10px", cursor: "pointer",
                      fontSize: "0.82rem", textAlign: "center", display: "flex",
                      flexDirection: "column", alignItems: "center", gap: 6,
                    }}>
                      <span style={{ fontSize: "1.3rem" }}>📎</span>
                      <span>Upload File</span>
                    </button>
                  </div>
                )}

                {/* Camera input — capture="environment" opens rear camera on mobile */}
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={handleReceiptUpload}
                />
                {/* File input — standard picker for desktop + any file type */}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: "none" }}
                  onChange={handleReceiptUpload}
                />
              </div>

              {/* Save */}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={() => setModal(false)} style={{
                  flex: 1, padding: "11px", borderRadius: 8, background: "transparent",
                  border: "1px solid #27272a", color: "#71717a", cursor: "pointer", fontSize: "0.85rem",
                }}>Cancel</button>
                <button onClick={handleSave} disabled={saving || uploading || !form.merchant || !form.amount} style={{
                  flex: 2, padding: "11px", borderRadius: 8,
                  background: saving ? "#8a7235" : "#C9A84C",
                  border: "none", color: "#000", fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer", fontSize: "0.85rem",
                  fontFamily: "var(--font-montserrat, sans-serif)", letterSpacing: "0.06em",
                }}>
                  {saving ? "Saving..." : editing ? "Save Changes" : "Add Expense"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}