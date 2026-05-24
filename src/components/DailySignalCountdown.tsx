"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function getSecondsUntilNext(sendTimeStr: string): number {
  const [hh, mm] = sendTimeStr.split(":").map(Number);
  const now  = new Date();
  const next = new Date();
  next.setHours(hh, mm, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return Math.floor((next.getTime() - now.getTime()) / 1000);
}

function formatCountdown(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return {
    h: String(h).padStart(2, "0"),
    m: String(m).padStart(2, "0"),
    s: String(s).padStart(2, "0"),
  };
}

function fmtLastSent(ts: string | null): string {
  if (!ts) return "Never";
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (isToday)     return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + `, ${time}`;
}

function fmtScheduledTime(t: string): string {
  const [hh, mm] = t.split(":").map(Number);
  const d = new Date(); d.setHours(hh, mm, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function DailySignalCountdown({ userId }: { userId: string }) {
  const supabase = createClient();
  const [seconds,      setSeconds]      = useState<number | null>(null);
  const [sendTime,     setSendTime]     = useState<string | null>(null);
  const [lastSentAt,   setLastSentAt]   = useState<string | null>(null);
  const [sending,      setSending]      = useState(false);
  const [flash,        setFlash]        = useState<"sent" | "error" | null>(null);

  useEffect(() => {
    supabase.from("profiles")
      .select("daily_signal_enabled, daily_signal_time, last_signal_sent_at")
      .eq("id", userId).single()
      .then(({ data }) => {
        if (data?.daily_signal_enabled && data?.daily_signal_time) {
          setSendTime(data.daily_signal_time);
          setSeconds(getSecondsUntilNext(data.daily_signal_time));
        }
        setLastSentAt(data?.last_signal_sent_at ?? null);
      });
  }, [userId]);

  useEffect(() => {
    if (seconds === null || !sendTime) return;
    const iv = setInterval(() => {
      setSeconds(prev => {
        if (prev === null) return null;
        if (prev <= 1) return getSecondsUntilNext(sendTime);
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [seconds !== null, sendTime]);

  async function handleEarlySend() {
    setSending(true); setFlash(null);
    try {
      const res = await fetch("/api/daily-signal/send?preview=true");
      if (res.ok) {
        setFlash("sent");
        setLastSentAt(new Date().toISOString());
      } else { setFlash("error"); }
    } catch { setFlash("error"); }
    setSending(false);
    setTimeout(() => setFlash(null), 3000);
  }

  if (seconds === null) return null;

  const { h, m, s } = formatCountdown(seconds);
  const isImminent  = seconds < 300;

  return (
    <div style={{
      background: "#111113",
      border: "1px solid #27272a",
      borderRadius: 12,
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      width: "100%",
    }}>
      {/* Top row — label + schedule/last sent meta */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 6 }}>
        <p style={{
          color: "#71717a", fontSize: "0.72rem", fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.08em", margin: 0,
        }}>
          Next Daily Signal
        </p>
        <div style={{ textAlign: "right" }}>
          {sendTime && (
            <p style={{ color: "#52525b", fontSize: "0.82rem", margin: "0 0 3px" }}>
              Scheduled daily at <strong style={{ color: "#a1a1aa" }}>{fmtScheduledTime(sendTime)}</strong>
            </p>
          )}
          <p style={{ color: "#52525b", fontSize: "0.82rem", margin: 0 }}>
            Last sent: <strong style={{ color: "#a1a1aa" }}>{fmtLastSent(lastSentAt)}</strong>
          </p>
        </div>
      </div>

      {/* Countdown */}
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {[h, m, s].map((unit, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <span style={{
              fontFamily: "monospace", fontSize: "1.9rem", fontWeight: 800,
              color: isImminent ? "#C9A84C" : "#fafafa",
              minWidth: 36, textAlign: "center", lineHeight: 1, transition: "color 0.3s",
            }}>
              {unit}
            </span>
            {i < 2 && (
              <span style={{ color: "#52525b", fontSize: "1.5rem", fontWeight: 700, marginBottom: 2 }}>:</span>
            )}
          </span>
        ))}
      </div>

      {/* Send Early Signal button */}
      <button
        onClick={handleEarlySend}
        disabled={sending}
        style={{
  
          padding: "8px 0",
          fontSize: "0.75rem", fontWeight: 700,
          letterSpacing: "0.06em", textTransform: "uppercase",
          border: "1px solid #27272a", borderRadius: 8,
          cursor: sending ? "not-allowed" : "pointer",
          transition: "all 0.2s",
          background: flash === "sent"  ? "rgba(74,222,128,0.08)"
                    : flash === "error" ? "rgba(248,113,113,0.08)"
                    : sending           ? "#18181b" : "#1c1c1f",
          color: flash === "sent"  ? "#4ade80"
               : flash === "error" ? "#f87171" : "#a1a1aa",
        }}
      >
        {sending ? "Sending..." : flash === "sent" ? "✓ Sent!" : flash === "error" ? "Failed — retry" : "Send Early Signal"}
      </button>
    </div>
  );
}
