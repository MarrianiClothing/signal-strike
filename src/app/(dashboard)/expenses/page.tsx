"use client";
import { useEffect, useState, useRef } from "react";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return (
    <div style={{ padding: isMobile ? "0 16px 24px" : 32, maxWidth: isMobile ? "100%" : 1200, boxSizing: "border-box", width: "100%" }}>

      {/* Header */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: 24, gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fafafa", margin: 0 }}>Expenses</h1>
          <p style={{ color: "#71717a", fontSize: "0.85rem", marginTop: 4 }}>{expenses.length} total expense{expenses.length !== 1 ? "s" : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 10, width: isMobile ? "100%" : "auto" }}>
          <button onClick={() => { setReportModal(true); setReportMsg(""); }} style={{
            flex: isMobile ? 1 : undefined,
            background: "transparent", color: "#C9A84C", border: "1px solid #C9A84C",
            borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
          }}>⬇ Report</button>
          <button onClick={openAdd} style={{
            flex: isMobile ? 1 : undefined,
            background: "#C9A84C", color: "#000", border: "none", borderRadius: 8,
            padding: "10px 16px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
          }}>+ Add Expense</button>
        </div>
      </div>

      {/* Stats — 2 col on mobile, 4 on desktop */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 16, marginBottom: 24 }}>
        {[
          { label: "Total Expenses", value: fmt(totalAmt),    color: "#fafafa" },
          { label: "Pending",        value: fmt(pendingAmt),  color: "#fbbf24" },
          { label: "Approved",       value: fmt(approvedAmt), color: "#34d399" },
          { label: "This Month",     value: fmt(thisMonth),   color: "#C9A84C" },
        ].map(s => (
          <div key={s.label} style={card}>
            <p style={{ color: "#71717a", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{s.label}</p>
            <p style={{ fontSize: isMobile ? "1.2rem" : "1.6rem", fontWeight: 800, color: s.color, fontFamily: "var(--font-cinzel, serif)" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter bars — scrollable rows */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, paddingRight: 4 }}>
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
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginTop: 6, paddingRight: 4 }}>
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

      {/* Expense list */}
      {filtered.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "48px 24px", marginBottom: 16 }}>
          <p style={{ color: "#52525b", fontSize: "0.9rem" }}>No expenses found.</p>
          <button onClick={openAdd} style={{ marginTop: 12, background: "transparent", border: "1px solid #27272a", color: "#a1a1aa", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: "0.82rem" }}>
            Add your first expense
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {filtered.map(exp => {
            const deal = deals.find(d => d.id === exp.deal_id);
            const statusColor = STATUS_COLORS[exp.status] || "#71717a";
            const catIdx = CATEGORIES.indexOf(exp.category);
            const catColor = CAT_COLORS[catIdx] || "#71717a";
            return (
              <div key={exp.id} style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 12, borderLeft: `3px solid ${catColor}`, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Date */}
                  <div style={{ textAlign: "center", flexShrink: 0, width: 40 }}>
                    <div style={{ color: "#C9A84C", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase" }}>
                      {new Date(exp.expense_date + "T12:00:00").toLocaleString("en-US", { month: "short" })}
                    </div>
                    <div style={{ color: "#fafafa", fontSize: "1rem", fontWeight: 800, lineHeight: 1 }}>
                      {new Date(exp.expense_date + "T12:00:00").getDate()}
                    </div>
                  </div>
                  <div style={{ width: 1, height: 32, background: "#27272a", flexShrink: 0 }} />
                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                      <p style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.88rem", margin: 0 }}>{exp.merchant}</p>
                      <span style={{ fontSize: "0.65rem", padding: "2px 7px", borderRadius: 10, background: catColor + "22", color: catColor, fontWeight: 600, flexShrink: 0 }}>{exp.category}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {deal && <span style={{ color: "#52525b", fontSize: "0.72rem" }}>📎 {deal.title}</span>}
                      {exp.notes && <span style={{ color: "#52525b", fontSize: "0.72rem", fontStyle: "italic" }}>"{exp.notes}"</span>}
                      {exp.receipt_url && <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", fontSize: "0.7rem", textDecoration: "none" }}>📄 Receipt</a>}
                    </div>
                  </div>
                  {/* Amount + status + actions */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ color: "#fafafa", fontWeight: 800, fontSize: "1rem", fontFamily: "var(--font-cinzel, serif)", margin: "0 0 4px" }}>{fmt(exp.amount)}</p>
                    <span style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: 10, background: statusColor + "22", color: statusColor, fontWeight: 600, display: "block", marginBottom: 6 }}>{exp.status}</span>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button onClick={() => openEdit(exp)} style={{ background: "#27272a", border: "none", color: "#a1a1aa", borderRadius: 5, padding: "4px 8px", cursor: "pointer", fontSize: "0.72rem" }}>Edit</button>
                      <button onClick={() => handleDelete(exp.id)} style={{ background: "rgba(248,113,113,0.1)", border: "none", color: "#f87171", borderRadius: 5, padding: "4px 8px", cursor: "pointer", fontSize: "0.72rem" }}>✕</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Charts — stack vertically (desktop shows side by side in the grid) */}
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={card}>
            <h2 style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.95rem", marginBottom: 20 }}>By Category</h2>
            <DonutChart data={chartData} />
          </div>
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
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={card}>
              <h2 style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.95rem", marginBottom: 20 }}>By Category</h2>
              <DonutChart data={chartData} />
            </div>
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
      )}

      {/* Report Modal */}
      {reportModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={e => { if (e.target === e.currentTarget) setReportModal(false); }}>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ color: "#fafafa", fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>Generate Expense Report</h2>
              <button onClick={() => setReportModal(false)} style={{ background: "transparent", border: "none", color: "#71717a", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label style={{ display: "block", color: "#71717a", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Filter By</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["month", "deal"] as const).map(t => (
                    <button key={t} onClick={() => setReportType(t)} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1px solid", borderColor: reportType === t ? "#C9A84C" : "#27272a", background: reportType === t ? "rgba(201,168,76,0.12)" : "transparent", color: reportType === t ? "#C9A84C" : "#71717a", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>{t === "month" ? "📅 Month" : "📎 Deal"}</button>
                  ))}
                </div>
              </div>
              {reportType === "month" ? (
                <div>
                  <label style={{ display: "block", color: "#71717a", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Month</label>
                  <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} style={{ width: "100%", background: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#fafafa", padding: "10px 12px", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" as const }} />
                </div>
              ) : (
                <div>
                  <label style={{ display: "block", color: "#71717a", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Deal</label>
                  <select value={reportDealId} onChange={e => setReportDealId(e.target.value)} style={{ width: "100%", background: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#fafafa", padding: "10px 12px", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" as const }}>
                    <option value="">— Select a deal —</option>
                    {deals.map(d => <option key={d.id} value={d.id}>{d.title}{d.company ? ` · ${d.company}` : ""}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ display: "block", color: "#71717a", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Delivery</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["download", "email"] as const).map(m => (
                    <button key={m} onClick={() => setReportMode(m)} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1px solid", borderColor: reportMode === m ? "#C9A84C" : "#27272a", background: reportMode === m ? "rgba(201,168,76,0.12)" : "transparent", color: reportMode === m ? "#C9A84C" : "#71717a", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>{m === "download" ? "⬇ PDF" : "✉ Email"}</button>
                  ))}
                </div>
              </div>
              {reportMode === "email" && (
                <div>
                  <label style={{ display: "block", color: "#71717a", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Recipient Email</label>
                  <input type="email" placeholder="client@example.com" value={reportEmail} onChange={e => setReportEmail(e.target.value)} style={{ width: "100%", background: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#fafafa", padding: "10px 12px", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" as const }} />
                </div>
              )}
              {reportMsg && <p style={{ color: reportMsg.startsWith("✓") ? "#34d399" : "#f87171", fontSize: "0.85rem", margin: 0 }}>{reportMsg}</p>}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setReportModal(false)} style={{ flex: 1, padding: "11px", borderRadius: 8, background: "transparent", border: "1px solid #27272a", color: "#71717a", cursor: "pointer", fontSize: "0.85rem" }}>Cancel</button>
                <button onClick={handleReport} disabled={reportLoading || (reportMode === "email" && !reportEmail) || (reportType === "deal" && !reportDealId)} style={{ flex: 2, padding: "11px", borderRadius: 8, background: reportLoading ? "#8a7235" : "#C9A84C", border: "none", color: "#000", fontWeight: 700, cursor: reportLoading ? "not-allowed" : "pointer", fontSize: "0.85rem" }}>
                  {reportLoading ? "Generating..." : reportMode === "download" ? "Download PDF" : "Send Report"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 16, padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ color: "#fafafa", fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>{editing ? "Edit Expense" : "Add Expense"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "transparent", border: "none", color: "#71717a", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Merchant *</label>
                  <input style={inputStyle} placeholder="e.g. Delta Airlines" value={form.merchant} onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Amount *</label>
                  <input style={inputStyle} type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input style={inputStyle} type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Link to Deal</label>
                  <select style={inputStyle} value={form.deal_id} onChange={e => setForm(f => ({ ...f, deal_id: e.target.value }))}>
                    <option value="">— None —</option>
                    {deals.map(d => <option key={d.id} value={d.id}>{d.title}{d.company ? ` · ${d.company}` : ""}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 64 }} placeholder="Optional description..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Receipt</label>
                {form.receipt_url && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
                    <span style={{ color: "#34d399", fontSize: "0.8rem", flex: 1 }}>✓ Receipt attached</span>
                    <a href={form.receipt_url} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", fontSize: "0.75rem", textDecoration: "none" }}>View</a>
                    <button onClick={() => setForm(f => ({ ...f, receipt_url: "" }))} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.8rem", padding: 0 }}>✕</button>
                  </div>
                )}
                {uploading ? (
                  <div style={{ background: "#18181b", border: "1px dashed #3f3f46", borderRadius: 8, color: "#71717a", padding: "12px 16px", fontSize: "0.82rem", textAlign: "center" }}>Uploading...</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button onClick={() => cameraRef.current?.click()} style={{ background: "#18181b", border: "1px dashed #3f3f46", borderRadius: 8, color: "#a1a1aa", padding: "12px 10px", cursor: "pointer", fontSize: "0.82rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: "1.3rem" }}>📷</span><span>Take Photo</span>
                    </button>
                    <button onClick={() => fileRef.current?.click()} style={{ background: "#18181b", border: "1px dashed #3f3f46", borderRadius: 8, color: "#a1a1aa", padding: "12px 10px", cursor: "pointer", fontSize: "0.82rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: "1.3rem" }}>📎</span><span>Upload File</span>
                    </button>
                  </div>
                )}
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleReceiptUpload} />
                <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={handleReceiptUpload} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={() => setModal(false)} style={{ flex: 1, padding: "11px", borderRadius: 8, background: "transparent", border: "1px solid #27272a", color: "#71717a", cursor: "pointer", fontSize: "0.85rem" }}>Cancel</button>
                <button onClick={handleSave} disabled={saving || uploading || !form.merchant || !form.amount} style={{ flex: 2, padding: "11px", borderRadius: 8, background: saving ? "#8a7235" : "#C9A84C", border: "none", color: "#000", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontSize: "0.85rem" }}>
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
