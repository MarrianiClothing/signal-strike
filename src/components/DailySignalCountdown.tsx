"use client";
import { useEffect, useState } from "react";
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
  const [seconds, setSeconds] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [sendTime, setSendTime] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("daily_signal_enabled, daily_signal_time")
        .eq("id", userId)
        .single();
      if (data?.daily_signal_enabled && data?.daily_signal_time) {
        setEnabled(true);
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

  if (!enabled || seconds === null) return null;

  const { h, m, s } = formatCountdown(seconds);
  const isImminent = seconds < 300;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
      <span style={{
        fontSize: "10px", fontWeight: 700, color: "#52525b",
        textTransform: "uppercase", letterSpacing: "0.1em",
      }}>
        Next Daily Signal
      </span>
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
              <span style={{
                color: "#52525b", fontSize: "18px", fontWeight: 700, marginBottom: "2px",
              }}>
                :
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
