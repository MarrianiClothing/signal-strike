"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const inputStyle = {
  background: "#1c1c1f", border: "1px solid #27272a", borderRadius: 8,
  padding: "9px 12px", color: "#fafafa", fontSize: "0.875rem",
  boxSizing: "border-box" as const,
};
const labelStyle = {
  color: "#71717a", fontSize: "0.75rem", textTransform: "uppercase" as const,
  letterSpacing: "0.05em", marginBottom: 5, display: "block",
};

export default function DailySignalSection({ userId }: { userId: string }) {
  const supabase = createClient();
  const [enabled, setEnabled]   = useState(false);
  const [time,    setTime]      = useState("08:00");
  const [saving,  setSaving]    = useState(false);
  const [msg,     setMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting]   = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("daily_signal_enabled, daily_signal_time")
        .eq("id", userId)
        .single();
      if (data) {
        setEnabled(data.daily_signal_enabled ?? false);
        setTime(data.daily_signal_time ?? "08:00");
      }
    }
    load();
  }, [userId]);

  async function handleSave() {
    setSaving(true); setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ daily_signal_enabled: enabled, daily_signal_time: time })
      .eq("id", userId);
    setMsg(error
      ? { ok: false, text: error.message }
      : { ok: true,  text: "Daily Signal settings saved!" }
    );
    setSaving(false);
  }

  async function handleTest() {
    setTesting(true); setMsg(null);
    try {
      const res = await fetch("/api/daily-signal/send?preview=true");
      const json = await res.json();
      setMsg(json.ok
        ? { ok: true,  text: "Test email sent! Check your inbox." }
        : { ok: false, text: json.error || "Failed to send test email." }
      );
    } catch {
      setMsg({ ok: false, text: "Failed to reach email service." });
    }
    setTesting(false);
  }

  return (
    <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 12, padding: 24, marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 style={{ color: "#fafafa", fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>Daily Signal</h2>
          <p style={{ color: "#71717a", fontSize: "0.82rem" }}>
            Receive a daily email summary of all your deals and next tasks.
          </p>
        </div>
        {/* Toggle */}
        <div
          onClick={() => setEnabled(e => !e)}
          style={{
            width: 44, height: 24, borderRadius: 12, cursor: "pointer",
            background: enabled ? "#C9A84C" : "#27272a",
            position: "relative", transition: "background 0.2s", flexShrink: 0,
          }}>
          <div style={{
            position: "absolute", top: 3, left: enabled ? 23 : 3,
            width: 18, height: 18, borderRadius: "50%", background: "#fafafa",
            transition: "left 0.2s",
          }} />
        </div>
      </div>

      {enabled && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ maxWidth: 200 }}>
            <label style={labelStyle}>Send Time (your local time)</label>
            <input
              type="time"
              style={{ ...inputStyle, width: "100%", colorScheme: "dark" }}
              value={time}
              onChange={e => setTime(e.target.value)}
            />
          </div>

          <div style={{ background: "#18181b", borderRadius: 8, padding: "10px 14px" }}>
            <p style={{ color: "#71717a", fontSize: "0.78rem", lineHeight: 1.6 }}>
              📬 The Daily Signal email includes all active deals, deal values, stages,
              commission amounts, and your next task per deal. Delivered every day at your chosen time.
            </p>
          </div>
        </div>
      )}

      {msg && (
        <p style={{ color: msg.ok ? "#4ade80" : "#f87171", fontSize: "0.85rem", marginTop: 14 }}>
          {msg.text}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button onClick={handleSave} disabled={saving}
          style={{ background: "#C9A84C", color: "#000", border: "none", borderRadius: 8,
            padding: "8px 20px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
        <button onClick={handleTest} disabled={testing}
          style={{ background: "none", border: "1px solid #27272a", color: "#a1a1aa",
            borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
          {testing ? "Sending..." : "Send Test Email"}
        </button>
      </div>
    </div>
  );
}
