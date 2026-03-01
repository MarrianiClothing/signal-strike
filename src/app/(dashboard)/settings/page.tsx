"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import RevenueGoalSection from "./components/RevenueGoalSection";

export default function SettingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [profile, setProfile] = useState({
    id: "",
    full_name: "",
    email: "",
    commission_rate: "10",
    notify_new_deal: true,
    notify_stage_change: true,
    notify_goal_reached: true,
    open_deals_goal: "",
  });
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Email sync state
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [outlookEmail, setOutlookEmail] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<"gmail" | "outlook" | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Handle OAuth redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") {
      setSyncMsg("Gmail connected successfully!");
      window.history.replaceState({}, "", "/settings");
    } else if (params.get("gmail") === "error") {
      setSyncMsg("Gmail connection failed. Please try again.");
      window.history.replaceState({}, "", "/settings");
    } else if (params.get("outlook") === "connected") {
      setSyncMsg("Outlook connected successfully!");
      window.history.replaceState({}, "", "/settings");
    } else if (params.get("outlook") === "error") {
      setSyncMsg("Outlook connection failed. Please try again.");
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

      setProfile({
        id: user.id,
        full_name: data?.full_name ?? user.user_metadata?.full_name ?? "",
        email: user.email ?? "",
        commission_rate: data?.commission_rate ?? "10",
        notify_new_deal: data?.notify_new_deal ?? true,
        notify_stage_change: data?.notify_stage_change ?? true,
        notify_goal_reached: data?.notify_goal_reached ?? true,
        open_deals_goal: data?.open_deals_goal ?? "",
      });

      // Check Gmail connection
      const { data: gmailToken } = await supabase.from("gmail_tokens").select("email").eq("user_id", user.id).maybeSingle();
      if (gmailToken?.email) setGmailEmail(gmailToken.email);

      // Check Outlook connection
      const { data: outlookToken } = await supabase.from("outlook_tokens").select("email").eq("user_id", user.id).maybeSingle();
      if (outlookToken?.email) setOutlookEmail(outlookToken.email);

      setLoading(false);
    }
    load();
  }, []);

  async function handleSaveProfile() {
    setSaving(true); setMsg(null);
    const { error } = await supabase.from("profiles").upsert({
      id: profile.id,
      full_name: profile.full_name,
      commission_rate: profile.commission_rate,
      notify_new_deal: profile.notify_new_deal,
      notify_stage_change: profile.notify_stage_change,
      notify_goal_reached: profile.notify_goal_reached,
      open_deals_goal: profile.open_deals_goal ? Number(profile.open_deals_goal) : null,
      updated_at: new Date().toISOString(),
    });
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Profile saved!" });
    setSaving(false);
  }

  async function handleChangePassword() {
    if (pwForm.newPw !== pwForm.confirm) { setPwMsg({ ok: false, text: "Passwords don't match." }); return; }
    if (pwForm.newPw.length < 8) { setPwMsg({ ok: false, text: "Password must be at least 8 characters." }); return; }
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw });
    setPwMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Password updated!" });
    if (!error) setPwForm({ current: "", newPw: "", confirm: "" });
  }

  async function syncGmail() {
    setSyncing("gmail"); setSyncMsg(null);
    const res = await fetch("/api/gmail/sync", { method: "POST" });
    const data = await res.json();
    if (data.error) setSyncMsg("Sync failed: " + data.error);
    else setSyncMsg(`Gmail sync complete — ${data.synced} new email${data.synced === 1 ? "" : "s"} logged.`);
    setSyncing(null);
  }

  async function syncOutlook() {
    setSyncing("outlook"); setSyncMsg(null);
    const res = await fetch("/api/outlook/sync", { method: "POST" });
    const data = await res.json();
    if (data.error) setSyncMsg("Sync failed: " + data.error);
    else setSyncMsg(`Outlook sync complete — ${data.synced} new email${data.synced === 1 ? "" : "s"} logged.`);
    setSyncing(null);
  }

  const sectionStyle: React.CSSProperties = {
    background: "#111113", borderRadius: 12, padding: 24, marginBottom: 24,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#1c1c1f", border: "1px solid #27272a",
    borderRadius: 8, padding: "10px 12px", color: "#fafafa", fontSize: "0.9rem",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    color: "#a1a1aa", fontSize: "0.8rem", textTransform: "uppercase",
    marginBottom: 6, display: "block",
  };

  if (loading) return <div style={{ padding: 32, color: "#71717a" }}>Loading...</div>;

  return (
    <div style={{ padding: 32, maxWidth: 720 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fafafa", marginBottom: 28 }}>Settings</h1>

      {/* Revenue Goal */}
      <RevenueGoalSection userId={profile.id} />

      {/* Email Sync */}
      <div style={sectionStyle}>
        <h2 style={{ color: "#fafafa", fontWeight: 700, marginBottom: 4 }}>Email Sync</h2>
        <p style={{ color: "#71717a", fontSize: "0.8rem", marginBottom: 20 }}>Connect Gmail and/or Outlook to auto-log emails in deal activity timelines.</p>

        {/* Gmail */}
        <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid #27272a" }}>
          <p style={{ color: "#fafafa", fontSize: "0.88rem", fontWeight: 600, marginBottom: 10 }}>Gmail</p>
          {gmailEmail ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} />
                <span style={{ color: "#fafafa", fontSize: "0.85rem" }}>{gmailEmail}</span>
                <span style={{ fontSize: "0.72rem", color: "#4ade80" }}>Connected</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={syncGmail} disabled={syncing === "gmail"}
                  style={{ background: "#C9A84C", color: "#000", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>
                  {syncing === "gmail" ? "Syncing..." : "Sync Now"}
                </button>
                <a href="/api/auth/gmail/connect" style={{ background: "#27272a", color: "#fafafa", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                  Reconnect
                </a>
              </div>
            </div>
          ) : (
            <a href="/api/auth/gmail/connect" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: "#000", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: "0.85rem", textDecoration: "none" }}>
              <span></span> Connect Gmail
            </a>
          )}
        </div>

        {/* Outlook */}
        <div>
          <p style={{ color: "#fafafa", fontSize: "0.88rem", fontWeight: 600, marginBottom: 10 }}>Outlook</p>
          {outlookEmail ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} />
                <span style={{ color: "#fafafa", fontSize: "0.85rem" }}>{outlookEmail}</span>
                <span style={{ fontSize: "0.72rem", color: "#4ade80" }}>Connected</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={syncOutlook} disabled={syncing === "outlook"}
                  style={{ background: "#0078d4", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>
                  {syncing === "outlook" ? "Syncing..." : "Sync Now"}
                </button>
                <a href="/api/auth/outlook/connect" style={{ background: "#27272a", color: "#fafafa", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                  Reconnect
                </a>
              </div>
            </div>
          ) : (
            <a href="/api/auth/outlook/connect" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#0078d4", color: "#fff", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: "0.85rem", textDecoration: "none" }}>
              <span></span> Connect Outlook
            </a>
          )}
        </div>

        {syncMsg && (
          <p style={{ color: syncMsg.includes("failed") ? "#f87171" : "#4ade80", fontSize: "0.85rem", marginTop: 14 }}>{syncMsg}</p>
        )}
      </div>

      {/* Profile */}
      <div style={sectionStyle}>
        <h2 style={{ color: "#fafafa", fontWeight: 700, marginBottom: 20 }}>Profile</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={labelStyle}>Full Name</label>
            <input style={inputStyle} value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={labelStyle}>Email</label>
            <input style={{ ...inputStyle, opacity: 0.6 }} value={profile.email} disabled />
          </div>
          <div>
            <label style={labelStyle}>Commission Rate (%)</label>
            <input style={inputStyle} type="number" min="0" max="100" value={profile.commission_rate} onChange={e => setProfile(p => ({ ...p, commission_rate: e.target.value }))} />
            <label style={{ color: "#a1a1aa", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginTop: 16, marginBottom: 6 }}>Open Deals Goal</label>
            <input style={inputStyle} type="number" min="0" placeholder="e.g. 12" value={profile.open_deals_goal} onChange={e => setProfile(p => ({ ...p, open_deals_goal: e.target.value }))} />
            <p style={{ color: "#52525b", fontSize: "0.72rem", marginTop: 4 }}>Sets color on the Open Deals card: red &lt;50%, green ≥50%, gold ≥100%</p>
          </div>
        </div>

        {/* Notifications */}
        <h3 style={{ color: "#a1a1aa", fontSize: "0.78rem", textTransform: "uppercase", marginBottom: 12 }}>Notifications</h3>
        {[
          { key: "notify_new_deal", label: "New deal added" },
          { key: "notify_stage_change", label: "Deal stage changed" },
          { key: "notify_goal_reached", label: "Revenue goal reached" },
        ].map(n => (
          <div key={n.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ color: "#fafafa", fontSize: "0.88rem" }}>{n.label}</span>
            <button
              onClick={() => setProfile(p => ({ ...p, [n.key]: !(p as any)[n.key] }))}
              style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative", background: (profile as any)[n.key] ? "#C9A84C" : "#27272a", transition: "background 0.2s" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: (profile as any)[n.key] ? 23 : 3, transition: "left 0.2s" }} />
            </button>
          </div>
        ))}

        {msg && <p style={{ color: msg.ok ? "#4ade80" : "#f87171", fontSize: "0.85rem", marginTop: 12 }}>{msg.text}</p>}

        <button onClick={handleSaveProfile} disabled={saving} style={{ marginTop: 16, background: "#C9A84C", color: "#000", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>

      {/* Change Password */}
      <div style={sectionStyle}>
        <h2 style={{ color: "#fafafa", fontWeight: 700, marginBottom: 20 }}>Change Password</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>New Password</label>
            <input style={inputStyle} type="password" placeholder="Min 8 characters" value={pwForm.newPw} onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Confirm Password</label>
            <input style={inputStyle} type="password" placeholder="Repeat new password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
          </div>
          {pwMsg && <p style={{ color: pwMsg.ok ? "#4ade80" : "#f87171", fontSize: "0.85rem" }}>{pwMsg.text}</p>}
          <button onClick={handleChangePassword} style={{ background: "#27272a", color: "#fafafa", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, cursor: "pointer", alignSelf: "flex-start" }}>
            Update Password
          </button>
        </div>
      </div>
    </div>
  );
}
