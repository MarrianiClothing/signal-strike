"use client";
import { useEffect, useState } from "react";

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => { const c = () => setM(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);
  return m;
}
import { createClient } from "@/lib/supabase/client";

function getSecondsUntilNext(sendTimeStr: string): number {
  const [hh, mm] = sendTimeStr.split(":").map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(hh, mm, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return Math.floor((next.getTime() - now.getTime()) / 1000);
}

function formatCountdown(secs: number): { h: string; m: string; s: string } {
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
  const [seconds, setSeconds]   = useState<number | null>(null);
  const [sendTime, setSendTime] = useState<string | null>(null);
  const [sending, setSending]   = useState(false);
  const [flash, setFlash]       = useState<"sent" | "error" | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("daily_signal_enabled, daily_signal_time")
        .eq("id", userId)
        .single();
      if (data?.daily_signal_enabled && data?.daily_signal_time) {
        setSendTime(data.daily_signal_time);
        setSeconds(getSecondsUntilNext(data.daily_signal_time));
      }
    }
    load();
  }, [userId]);

  useEffect(() => {
    if (seconds === null || !sendTime) return;
    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev === null) return null;
        if (prev <= 1) return getSecondsUntilNext(sendTime);
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [seconds !== null, sendTime]);

  async function handleEarlySend() {
    setSending(true);
    setFlash(null);
    try {
      const res = await fetch("/api/daily-signal/send?preview=true");
      setFlash(res.ok ? "sent" : "error");
    } catch {
      setFlash("error");
    } finally {
      setSending(false);
      setTimeout(() => setFlash(null), 3000);
    }
  }

  if (seconds === null) return null;

  const { h, m, s } = formatCountdown(seconds);
  const isImminent = seconds < 300;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isMobile ? "center" : "flex-end", gap: "6px", width: isMobile ? "100%" : "auto" }}>

      {/* Label */}
      <span style={{
        fontSize: "10px", fontWeight: 700, color: "#e4e4e7",
        textTransform: "uppercase", letterSpacing: "0.1em",
      }}>
        Next Daily Signal
      </span>

      {/* Countdown digits */}
      <div style={{
        display: "flex", alignItems: "center", gap: "2px",
        background: "#111113", border: "1px solid #27272a",
        borderRadius: "8px", padding: "6px 12px",
      }}>
        {[h, m, s].map((unit, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            <span style={{
              fontFamily: "monospace", fontSize: "20px", fontWeight: 800,
              color: isImminent ? "#C9A84C" : "#ffffff",
              minWidth: "26px", textAlign: "center", transition: "color 0.3s",
            }}>
              {unit}
            </span>
            {i < 2 && (
              <span style={{ color: "#52525b", fontSize: "18px", fontWeight: 700, marginBottom: "2px" }}>
                :
              </span>
            )}
          </span>
        ))}
      </div>

      {/* Send Early Signal button */}
      <button
        onClick={handleEarlySend}
        disabled={sending}
        style={{
          width: "100%",
          padding: "5px 12px",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          border: "1px solid #27272a",
          borderRadius: "6px",
          cursor: sending ? "not-allowed" : "pointer",
          transition: "all 0.2s",
          background: flash === "sent"
            ? "#14532d"
            : flash === "error"
            ? "#450a0a"
            : sending
            ? "#1a1a1d"
            : "#18181b",
          color: flash === "sent"
            ? "#4ade80"
            : flash === "error"
            ? "#f87171"
            : "#a1a1aa",
        }}
      >
        {sending
          ? "Sending..."
          : flash === "sent"
          ? "✓ Sent!"
          : flash === "error"
          ? "Failed — retry"
          : "Send Early Signal"}
      </button>

    </div>
  );
}
