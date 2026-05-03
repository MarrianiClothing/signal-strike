"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TIMEZONES, DEFAULT_TIMEZONE } from "@/lib/timezones";

type Props = {
  userId: string;
  initialTimezone: string | null;
};

export function TimezoneSelector({ userId, initialTimezone }: Props) {
  const supabase = createClient();
  const [value, setValue] = useState<string>(initialTimezone || DEFAULT_TIMEZONE);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleChange(newValue: string) {
    setValue(newValue);
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ timezone: newValue })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      setMsg({ ok: false, text: "Couldn't save. Try again." });
    } else {
      setMsg({ ok: true, text: "Saved." });
      setTimeout(() => setMsg(null), 2000);
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <label
        style={{
          color: "#71717a",
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 8,
          display: "block",
        }}
      >
        Your Timezone
      </label>
      <select
        value={value}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#1c1c1f",
          border: "1px solid #27272a",
          borderRadius: 8,
          padding: "9px 12px",
          color: "#fafafa",
          fontSize: "0.875rem",
        }}
      >
        {TIMEZONES.map((tz) => (
          <option key={tz.value} value={tz.value}>
            {tz.label}
          </option>
        ))}
      </select>
      <p
        style={{
          color: "#52525b",
          fontSize: "0.75rem",
          marginTop: 6,
        }}
      >
        Used for email send times, deadline reminders, and timestamp display.
        Also determines when your job number sequence resets each year.
      </p>
      {msg && (
        <p
          style={{
            color: msg.ok ? "#10b981" : "#f87171",
            fontSize: "0.75rem",
            marginTop: 4,
          }}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
