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

export default function DailySignalCountdown({ userId }: { userId: string }) {
  const supabase = createClient();
  const isMobile = useIsMobile();
  const [seconds,   setSeconds]  = useState<number | null>(null);
  const [sendTime,  setSendTime] = useState<string | null>(null);
  const [sending,   setSending]  = useState(false);
  const [flash,     setFlash]    = useState<"sent" | "error" | null>(null);

  useEffect(() => {
    supabase.from("profiles")
      .select("daily_signal_enabled, daily_signal_time")
      .eq("id", userId).single()
      .then(({ data }) => {
        if (data?.daily_signal_enabled && data?.daily_signal_time) {
          setSendTime(data.daily_signal_time);
          setSeconds(getSecondsUntilNext(data.daily_signal_time));
        }
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
      if (res.ok) { setFlash("sent"); } else { setFlash("error"); }
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
      alignItems: "center",
      gap: 10,
      width: isMobile ? "100%" : undefined,
      minWidth: isMobile ? undefined : 240,
    }}>
      {/* Label */}
      <p style={{
        color: "#71717a", fontSize: "0.72rem", fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.1em",
        margin: 0, textAlign: "center",
      }}>
        Next Daily Signal
      </p>

      {/* Countdown */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
        {[h, m, s].map((unit, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <span style={{
              fontFamily: "monospace", fontSize: isMobile ? "1.6rem" : "1.9rem", fontWeight: 800,
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
          width: "100%", padding: "8px 0",
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
