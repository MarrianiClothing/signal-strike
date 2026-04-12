"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router    = useRouter();
  const supabase  = createClient();

  const [status, setStatus] = useState<"loading"|"auth"|"accepting"|"done"|"error">("loading");
  const [error,  setError]  = useState("");
  const [email,  setEmail]  = useState("");
  const [pw,     setPw]     = useState("");
  const [name,   setName]   = useState("");
  const [mode,   setMode]   = useState<"signup"|"login">("signup");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setStatus("accepting"); acceptInvite(user.id); }
      else      { setStatus("auth"); }
    });
  }, [token]);

  async function acceptInvite(userId: string) {
    const res  = await fetch("/api/team/accept", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, user_id: userId }),
    });
    const json = await res.json();
    if (res.ok) { setStatus("done"); setTimeout(() => router.push("/dashboard"), 2000); }
    else        { setStatus("error"); setError(json.error ?? "Failed to accept invite"); }
  }

  async function handleSignup() {
    setSaving(true);
    const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { data: { full_name: name } } });
    if (error) { setError(error.message); setSaving(false); return; }
    if (data.user) await acceptInvite(data.user.id);
    setSaving(false);
  }

  async function handleLogin() {
    setSaving(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) { setError(error.message); setSaving(false); return; }
    if (data.user) await acceptInvite(data.user.id);
    setSaving(false);
  }

  const inp: React.CSSProperties = { width:"100%", background:"#1c1c1f", border:"1px solid #27272a", borderRadius:8, padding:"10px 14px", color:"#fafafa", fontSize:"0.9rem", boxSizing:"border-box" };

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0b", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:14, padding:36, width:"100%", maxWidth:420, textAlign:"center" }}>
        <p style={{ color:"#C9A84C", fontSize:"11px", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8 }}>Signal Strike · Team Invite</p>
        <h1 style={{ fontSize:"1.4rem", fontWeight:800, color:"#fafafa", margin:"0 0 8px" }}>Join the Team</h1>

        {status === "loading" && <p style={{ color:"#71717a" }}>Checking invite...</p>}

        {status === "accepting" && <p style={{ color:"#71717a" }}>Accepting invite...</p>}

        {status === "done" && (
          <div>
            <div style={{ fontSize:"2.5rem", marginBottom:12 }}>✅</div>
            <p style={{ color:"#34d399", fontWeight:700, fontSize:"1rem", margin:"0 0 8px" }}>You're in!</p>
            <p style={{ color:"#71717a", fontSize:"0.85rem" }}>Redirecting to dashboard...</p>
          </div>
        )}

        {status === "error" && (
          <div>
            <div style={{ fontSize:"2.5rem", marginBottom:12 }}>⚠️</div>
            <p style={{ color:"#f87171", fontWeight:700, margin:"0 0 8px" }}>Invite Error</p>
            <p style={{ color:"#a1a1aa", fontSize:"0.85rem" }}>{error}</p>
          </div>
        )}

        {status === "auth" && (
          <div style={{ textAlign:"left" }}>
            <p style={{ color:"#a1a1aa", fontSize:"0.85rem", marginBottom:20, textAlign:"center" }}>
              {mode === "signup" ? "Create an account to accept your invite" : "Sign in to accept your invite"}
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:16 }}>
              {mode === "signup" && (
                <input style={inp} placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} />
              )}
              <input style={inp} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
              <input style={inp} type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} />
            </div>
            {error && <p style={{ color:"#f87171", fontSize:"0.82rem", marginBottom:12 }}>{error}</p>}
            <button onClick={mode === "signup" ? handleSignup : handleLogin} disabled={saving}
              style={{ width:"100%", background:"#C9A84C", color:"#000", border:"none", borderRadius:8, padding:"11px", fontWeight:700, fontSize:"0.9rem", cursor:"pointer", marginBottom:12 }}>
              {saving ? "..." : mode === "signup" ? "Create Account & Join" : "Sign In & Join"}
            </button>
            <p style={{ color:"#52525b", fontSize:"0.82rem", textAlign:"center" }}>
              {mode === "signup" ? "Already have an account? " : "New to Signal Strike? "}
              <button onClick={() => setMode(mode === "signup" ? "login" : "signup")}
                style={{ background:"none", border:"none", color:"#C9A84C", cursor:"pointer", fontSize:"0.82rem", padding:0 }}>
                {mode === "signup" ? "Sign in" : "Sign up"}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
