"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const s = {
  card:   { background: "#111113", border: "1px solid #27272a", borderRadius: 12, padding: "20px 22px", marginBottom: 20 },
  h2:     { color: "#fafafa", fontSize: "1.1rem", fontWeight: 700, margin: "0 0 4px", fontFamily: "var(--font-cinzel, serif)", display: "flex", alignItems: "center", gap: 10 },
  sub:    { color: "#71717a", fontSize: "0.8rem", margin: "0 0 18px" },
  label:  { color: "#a1a1aa", fontSize: "0.72rem", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6, display: "block", fontWeight: 600 },
  input:  { width: "100%", background: "#1c1c1f", border: "1px solid #27272a", borderRadius: 8, padding: "10px 12px", color: "#fafafa", fontSize: "0.9rem", boxSizing: "border-box" as const, fontFamily: "var(--font-montserrat, sans-serif)" },
  select: { width: "100%", background: "#1c1c1f", border: "1px solid #27272a", borderRadius: 8, padding: "10px 12px", color: "#fafafa", fontSize: "0.9rem", boxSizing: "border-box" as const, fontFamily: "var(--font-montserrat, sans-serif)" },
  row:    { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 },
  preview:{ background: "#1c1c1f", border: "1px dashed #3f3f46", borderRadius: 8, padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "baseline", gap: 10 },
  previewLabel: { color: "#71717a", fontSize: "0.7rem", textTransform: "uppercase" as const, letterSpacing: "0.08em" },
  previewVal:   { color: "#C9A84C", fontSize: "1.05rem", fontWeight: 700, fontFamily: "monospace" },
  btn:    { background: "#C9A84C", color: "#000", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em" },
  btnDis: { background: "#27272a", color: "#52525b", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: "0.8rem", fontWeight: 700, cursor: "not-allowed", letterSpacing: "0.04em" },
  toggleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  toggleLabel: { color: "#fafafa", fontSize: "0.9rem", fontWeight: 600 },
  toggleSub:   { color: "#71717a", fontSize: "0.75rem", margin: "2px 0 0" },
  rolePill: { padding: "3px 10px", borderRadius: 12, fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, background: "rgba(201,168,76,0.15)", color: "#C9A84C" },
  readOnlyBanner: { background: "rgba(82,82,91,0.15)", border: "1px solid #3f3f46", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#a1a1aa", fontSize: "0.8rem" },
  msgOk:  { color: "#4ade80", fontSize: "0.8rem", marginTop: 12 },
  msgErr: { color: "#f87171", fontSize: "0.8rem", marginTop: 12 },
};

const EDITABLE_ROLES = new Set(["owner", "manager"]);

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      aria-pressed={checked}
      disabled={disabled}
      style={{
        width: 44, height: 26, borderRadius: 13, border: "none",
        background: checked ? "#C9A84C" : "#3f3f46",
        position: "relative", cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.15s",
        padding: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 21 : 3,
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        transition: "left 0.15s",
      }} />
    </button>
  );
}

export default function TeamJobNumberingSection({ userId }: { userId: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<{ ok: boolean; text: string } | null>(null);

  const [teamId,   setTeamId]   = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [role,     setRole]     = useState<string | null>(null);

  // Editable team config
  const [enabled,  setEnabled]  = useState(false);
  const [prefix,   setPrefix]   = useState("");
  const [nextNum,  setNextNum]  = useState("1000");
  const [padding,  setPadding]  = useState("4");

  useEffect(() => {
    if (!userId) return;
    async function load() {
      // Find the user's team membership
      const { data: tm } = await supabase
        .from("team_members")
        .select("team_id, role, teams(id, name, wo_enabled, wo_prefix, wo_next_number, wo_padding_width)")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (tm && tm.teams) {
        const t: any = tm.teams;
        setTeamId(t.id);
        setTeamName(t.name ?? null);
        setRole(tm.role ?? null);
        setEnabled(!!t.wo_enabled);
        setPrefix(t.wo_prefix ?? "");
        setNextNum(String(t.wo_next_number ?? 1000));
        setPadding(String(t.wo_padding_width ?? 4));
      }
      setLoading(false);
    }
    load();
  }, [userId]);

  function previewOf(prefixVal: string, num: number | string, pad: number | string): string {
    const n = Number(num) || 0;
    const p = Number(pad) || 0;
    return prefixVal + (p > 0 ? String(n).padStart(p, "0") : String(n));
  }

  async function save() {
    if (!teamId) return;
    setSaving(true);
    setMsg(null);
    const n = Number(nextNum);
    const p = Number(padding);
    if (!Number.isFinite(n) || n < 0) {
      setMsg({ ok: false, text: "Next number must be 0 or higher." });
      setSaving(false);
      return;
    }
    if (!Number.isFinite(p) || p < 0 || p > 10) {
      setMsg({ ok: false, text: "Padding width must be between 0 and 10." });
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("teams").update({
      wo_enabled: enabled,
      wo_prefix: prefix,
      wo_next_number: n,
      wo_padding_width: p,
    }).eq("id", teamId);
    if (error) {
      setMsg({ ok: false, text: error.message });
    } else {
      setMsg({ ok: true, text: "Saved." });
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  }

  // Hide entirely if user isn't on a team
  if (loading) {
    return (
      <div style={s.card}>
        <h2 style={s.h2}>Team Job Numbering</h2>
        <p style={s.sub}>Loading team configuration…</p>
      </div>
    );
  }
  if (!teamId) return null;

  const canEdit = role !== null && EDITABLE_ROLES.has(role);
  const livePreview = previewOf(prefix, nextNum, padding);

  return (
    <div style={s.card}>
      <h2 style={s.h2}>
        <span>Team Job Numbering</span>
        {role && <span style={s.rolePill}>{role}</span>}
      </h2>
      <p style={s.sub}>Shared work-order numbering for your team{teamName ? ` "${teamName}"` : ""}. When enabled here, it overrides every team member's personal numbering for jobs they create.</p>

      {!canEdit && (
        <div style={s.readOnlyBanner}>
          You're viewing this in read-only mode. Only team owners and managers can edit team job numbering.
        </div>
      )}

      <div style={s.toggleRow}>
        <div>
          <div style={s.toggleLabel}>Enable team job numbering</div>
          <div style={s.toggleSub}>When on, every team member's new jobs use the team prefix and counter instead of their personal one.</div>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} disabled={!canEdit} />
      </div>

      <div style={s.row}>
        <div>
          <label style={s.label}>Prefix</label>
          <input
            style={s.input}
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="e.g. TEAM-"
            maxLength={20}
            disabled={!canEdit || !enabled}
          />
        </div>
        <div>
          <label style={s.label}>Next number</label>
          <input
            style={s.input}
            type="number"
            value={nextNum}
            onChange={(e) => setNextNum(e.target.value)}
            min={0}
            disabled={!canEdit || !enabled}
          />
        </div>
        <div>
          <label style={s.label}>Padding width</label>
          <select
            style={s.select}
            value={padding}
            onChange={(e) => setPadding(e.target.value)}
            disabled={!canEdit || !enabled}
          >
            <option value="0">No padding (1, 2, 3)</option>
            <option value="3">3 digits (001)</option>
            <option value="4">4 digits (0001)</option>
            <option value="5">5 digits (00001)</option>
            <option value="6">6 digits (000001)</option>
          </select>
        </div>
      </div>

      <div style={s.preview}>
        <span style={s.previewLabel}>Next team job will be</span>
        <span style={s.previewVal}>{livePreview || "(empty)"}</span>
        <span style={{ marginLeft: "auto", ...s.rolePill, background: enabled ? "rgba(201,168,76,0.15)" : "rgba(82,82,91,0.18)", color: enabled ? "#C9A84C" : "#71717a" }}>
          {enabled ? "Active" : "Disabled"}
        </span>
      </div>

      {canEdit && (
        <button
          onClick={save}
          disabled={saving}
          style={saving ? s.btnDis : s.btn}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      )}

      {msg && <div style={msg.ok ? s.msgOk : s.msgErr}>{msg.text}</div>}
    </div>
  );
}
