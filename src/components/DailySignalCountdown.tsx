"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => { const c = () => setM(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);
  return m;
}

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
  const isMobile = useIsMobile();
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

  const digit = (val: string, label: string, key: number) => (
    <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span style={{
        fontFamily: "monospace",
        fontSize: isMobile ? "1.6rem" : "2.1rem",
        fontWeight: 800,
        color: isImminent ? "#C9A84C" : "#fafafa",
        minWidth: isMobile ? 36 : 44,
        textAlign: "center",
        lineHeight: 1,
        transition: "color 0.3s",
      }}>
        {val}
      </span>
      <span style={{
        color: "#52525b",
        fontSize: "0.55rem",
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}>
        {label}
      </span>
    </div>
  );

  const colon = (key: string) => (
    <span key={key} style={{
      color: "#3f3f46",
      fontSize: isMobile ? "1.4rem" : "1.7rem",
      fontWeight: 700,
      marginBottom: 14,
      lineHeight: 1,
    }}>:</span>
  );

  return (
    <div style={{
      background: "#111113",
      border: "1px solid #27272a",
      borderRadius: 12,
      padding: isMobile ? "16px 20px" : "18px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      width: isMobile ? "100%" : undefined,
      minWidth: isMobile ? undefined : 280,
    }}>
      {/* Label */}
      <p style={{
        color: "#71717a",
        fontSize: "0.7rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        margin: 0,
        textAlign: isMobile ? "center" : "left",
      }}>
        Next Daily Signal
      </p>

      {/* Hero countdown */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: isMobile ? 4 : 8,
      }}>
        {digit(h, "Hrs", 0)}
        {colon("c1")}
        {digit(m, "Min", 1)}
        {colon("c2")}
        {digit(s, "Sec", 2)}
      </div>

      {/* Divider */}
      <div style={{
        height: 1,
        background: "linear-gradient(90deg, transparent 0%, rgba(201,168,76,0.25) 50%, transparent 100%)",
        margin: "2px 0",
      }} />

      {/* Footer stat strip */}
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: isMobile ? 6 : 12,
        justifyContent: "space-between",
        alignItems: isMobile ? "center" : "stretch",
      }}>
        {sendTime && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: isMobile ? "center" : "flex-start" }}>
            <span style={{ fontSize: "0.85rem", lineHeight: 1 }}>⏰</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ color: "#52525b", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1 }}>
                Scheduled
              </span>
              <span style={{ color: "#a1a1aa", fontSize: "0.78rem", fontWeight: 600, lineHeight: 1.2 }}>
                {fmtScheduledTime(sendTime)} daily
              </span>
            </div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: isMobile ? "center" : "flex-end" }}>
          <span style={{ fontSize: "0.85rem", lineHeight: 1 }}>📨</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, alignItems: isMobile ? "center" : "flex-end" }}>
            <span style={{ color: "#52525b", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1 }}>
              Last Sent
            </span>
            <span style={{ color: "#a1a1aa", fontSize: "0.78rem", fontWeight: 600, lineHeight: 1.2 }}>
              {fmtLastSent(lastSentAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Send Early Signal button */}
      <button
        onClick={handleEarlySend}
        disabled={sending}
        style={{
          width: "100%", padding: "9px 0",
          fontSize: "0.72rem", fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase",
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
