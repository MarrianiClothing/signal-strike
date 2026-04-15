"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCache, setCache } from "@/lib/cache";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n/1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return "$" + (n/1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}

const inp: React.CSSProperties = { width:"100%", background:"#1c1c1f", border:"1px solid #27272a", borderRadius:8, padding:"9px 12px", color:"#fafafa", fontSize:"0.875rem", boxSizing:"border-box" };

export default function TeamPage() {
  const router   = useRouter();
  const supabase = createClient();
  const isMobile = useIsMobile();

  const { userId: authUserId, fullName: authFullName, ready: authReady } = useAuth();
  const [userId,    setUserId]    = useState(authUserId);
  const [userName,  setUserName]  = useState(authFullName);
  const [team,      setTeam]      = useState<any>(() => getCache<any>("team") ?? null);
  const [members,   setMembers]   = useState<any[]>(() => getCache<any[]>("team_members") ?? []);
  const [pending,   setPending]   = useState<any[]>(() => getCache<any[]>("team_pending") ?? []);
  const [loading,   setLoading]   = useState(!getCache<any>("team"));
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting,    setInviting]   = useState(false);
  const [inviteMsg,   setInviteMsg]  = useState<{ok:boolean;text:string}|null>(null);
  const [teamName,    setTeamName]   = useState("");
  const [editingName, setEditingName] = useState(false);

  async function load(uid: string) {
    const res  = await fetch(`/api/team/members?owner_id=${uid}`);
    const json = await res.json();
    setTeam(json.team);
    setMembers(json.members || []);
    setPending(json.pending_invites || []);
    if (json.team?.name) setTeamName(json.team.name);
    // Cache for instant next load
    setCache("team", json.team);
    setCache("team_members", json.members || []);
    setCache("team_pending", json.pending_invites || []);
    setLoading(false);
  }

  // Sync from auth context immediately
  useEffect(() => {
    if (authReady && authUserId) {
      setUserId(authUserId);
      setUserName(authFullName);
    }
  }, [authReady, authUserId, authFullName]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      setUserName(authFullName || "");

      // Only run team setup if no cached team (avoids blocking load)
      const cachedTeam = getCache<any>("team");
      if (!cachedTeam) {
        await fetch("/api/team/setup", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id, name: "My Team" }),
        });
      } else {
        // Run setup in background without blocking
        fetch("/api/team/setup", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id, name: "My Team" }),
        });
      }
      await load(user.id);
    });
  }, []);

  async function handleInvite() {
    if (!inviteEmail.trim() || !team) return;
    setInviting(true); setInviteMsg(null);
    const res  = await fetch("/api/team/invite", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: team.id, email: inviteEmail.trim(), inviter_name: userName }),
    });
    const json = await res.json();
    if (res.ok) {
      setInviteMsg({ ok: true, text: `Invite sent to ${inviteEmail}` });
      setInviteEmail("");
      await load(userId);
    } else {
      setInviteMsg({ ok: false, text: json.error ?? "Failed to send invite" });
    }
    setInviting(false);
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!confirm("Revoke this invite?")) return;
    await supabase.from("team_invites").delete().eq("id", inviteId);
    await load(userId);
  }

  async function handleRemoveMember(memberId: string, name: string) {
    if (!confirm(`Remove ${name} from your team? They will lose access to team features.`)) return;
    if (!team) return;
    await supabase.from("team_members").delete().eq("team_id", team.id).eq("user_id", memberId);
    await load(userId);
  }

  const me = members.find(m => m.user_id === userId);
  const teammates = members.filter(m => m.user_id !== userId);

  if (loading) return <div style={{ padding:32, color:"#71717a" }}>Loading team...</div>;

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 900 }}>

      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:4 }}>
          {editingName ? (
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input style={{ ...inp, width:240, fontSize:"1.3rem", fontWeight:800 }}
                value={teamName} onChange={e => setTeamName(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === "Enter") {
                    await supabase.from("teams").update({ name: teamName }).eq("id", team.id);
                    setEditingName(false); await load(userId);
                  }
                  if (e.key === "Escape") setEditingName(false);
                }} autoFocus />
              <button onClick={async () => { await supabase.from("teams").update({ name: teamName }).eq("id", team.id); setEditingName(false); await load(userId); }}
                style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:6, padding:"6px 12px", fontWeight:700, fontSize:"0.82rem", cursor:"pointer" }}>Save</button>
              <button onClick={() => setEditingName(false)}
                style={{ background:"none", border:"1px solid #27272a", color:"#71717a", borderRadius:6, padding:"6px 10px", fontSize:"0.82rem", cursor:"pointer" }}>Cancel</button>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize:"1.6rem", fontWeight:800, color:"#fafafa", margin:0, fontFamily:"var(--font-cinzel,serif)", letterSpacing:"0.05em", textTransform:"uppercase" }}>
                {teamName || "My Team"}
              </h1>
              <button onClick={() => setEditingName(true)}
                style={{ background:"none", border:"none", color:"#52525b", cursor:"pointer", fontSize:"0.85rem", padding:"2px 6px" }}>✎</button>
            </>
          )}
        </div>
        <p style={{ color:"#52525b", fontSize:"0.82rem", margin:0 }}>
          {teammates.length} teammate{teammates.length !== 1 ? "s" : ""} · {pending.length} pending invite{pending.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Invite form */}
      <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:20, marginBottom:24 }}>
        <h2 style={{ color:"#fafafa", fontWeight:700, fontSize:"0.95rem", margin:"0 0 14px" }}>Invite a Teammate</h2>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <input style={{ ...inp, flex:1, minWidth:200 }} type="email"
            placeholder="colleague@example.com"
            value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleInvite()} />
          <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
            style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"9px 20px", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", opacity:inviteEmail.trim()&&!inviting?1:0.5 }}>
            {inviting ? "Sending..." : "Send Invite"}
          </button>
        </div>
        {inviteMsg && (
          <p style={{ color:inviteMsg.ok?"#34d399":"#f87171", fontSize:"0.82rem", marginTop:10, margin:"10px 0 0" }}>{inviteMsg.text}</p>
        )}

        {/* Pending invites */}
        {pending.length > 0 && (
          <div style={{ marginTop:16, borderTop:"1px solid #1c1c1f", paddingTop:14 }}>
            <p style={{ color:"#71717a", fontSize:"0.72rem", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 10px" }}>Pending Invites</p>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {pending.map((inv: any) => (
                <div key={inv.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"#18181b", borderRadius:8 }}>
                  <div>
                    <span style={{ color:"#a1a1aa", fontSize:"0.85rem" }}>{inv.email}</span>
                    <span style={{ marginLeft:10, fontSize:"0.72rem", color:"#fbbf24", background:"rgba(251,191,36,0.1)", padding:"2px 8px", borderRadius:4 }}>Pending</span>
                  </div>
                  <button onClick={() => handleRevokeInvite(inv.id)}
                    style={{ background:"none", border:"none", color:"#52525b", cursor:"pointer", fontSize:"0.8rem" }}>Revoke</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Team members */}
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {teammates.length === 0 ? (
          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:"40px 0", textAlign:"center", color:"#3f3f46" }}>
            <div style={{ fontSize:"2.5rem", marginBottom:12 }}>👥</div>
            <p style={{ color:"#52525b", fontSize:"0.95rem", margin:"0 0 6px" }}>No teammates yet</p>
            <p style={{ fontSize:"0.82rem", margin:0 }}>Send an invite above to add your first teammate</p>
          </div>
        ) : (
          teammates.map((m: any) => (
            <div key={m.user_id} style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:"16px 20px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                {/* Avatar */}
                <div style={{ width:44, height:44, borderRadius:"50%", background:"rgba(201,168,76,0.12)", border:"1px solid rgba(201,168,76,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, color:"#C9A84C", fontSize:"1rem", flexShrink:0 }}>
                  {(m.full_name?.[0] ?? "?").toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ color:"#fafafa", fontWeight:700, fontSize:"0.95rem", margin:"0 0 2px" }}>{m.full_name}</p>
                  <p style={{ color:"#52525b", fontSize:"0.78rem", margin:0 }}>{m.email}</p>
                </div>

                {/* Stats */}
                <div style={{ display:"flex", gap:20, flexShrink:0, flexWrap:"wrap" }}>
                  <div style={{ textAlign:"center" }}>
                    <p style={{ color:"#C9A84C", fontWeight:700, fontSize:"0.95rem", margin:0, fontFamily:"monospace" }}>{fmt(m.pipeline)}</p>
                    <p style={{ color:"#52525b", fontSize:"0.68rem", margin:"2px 0 0", textTransform:"uppercase", letterSpacing:"0.05em" }}>Pipeline</p>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <p style={{ color:"#34d399", fontWeight:700, fontSize:"0.95rem", margin:0, fontFamily:"monospace" }}>{fmt(m.won_revenue)}</p>
                    <p style={{ color:"#52525b", fontSize:"0.68rem", margin:"2px 0 0", textTransform:"uppercase", letterSpacing:"0.05em" }}>Won</p>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <p style={{ color:"#fafafa", fontWeight:700, fontSize:"0.95rem", margin:0 }}>{m.open_deals}</p>
                    <p style={{ color:"#52525b", fontSize:"0.68rem", margin:"2px 0 0", textTransform:"uppercase", letterSpacing:"0.05em" }}>Open</p>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <p style={{ color:"#fafafa", fontWeight:700, fontSize:"0.95rem", margin:0 }}>{m.projects}</p>
                    <p style={{ color:"#52525b", fontSize:"0.68rem", margin:"2px 0 0", textTransform:"uppercase", letterSpacing:"0.05em" }}>Projects</p>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                  <button onClick={() => router.push(`/team/${m.user_id}`)}
                    style={{ background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"7px 16px", fontWeight:700, fontSize:"0.78rem", cursor:"pointer" }}>
                    View →
                  </button>
                  <button onClick={() => handleRemoveMember(m.user_id, m.full_name)}
                    style={{ background:"none", border:"1px solid #27272a", color:"#f87171", borderRadius:8, padding:"7px 12px", fontSize:"0.78rem", cursor:"pointer" }}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
