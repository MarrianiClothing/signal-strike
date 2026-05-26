"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = "loading" | "auth" | "confirm" | "accepting" | "done" | "error";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [authedEmail, setAuthedEmail] = useState("");
  const [authedUserId, setAuthedUserId] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile breakpoint
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Initial: check if user is signed in
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setAuthedEmail(user.email ?? "");
        setAuthedUserId(user.id);
        setStatus("confirm");
      } else {
        setStatus("auth");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function acceptInvite(userId: string) {
    setStatus("accepting");
    const res = await fetch("/api/team/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, user_id: userId }),
    });
    const json = await res.json();
    if (res.ok) {
      setStatus("done");
      setTimeout(() => router.push("/dashboard"), 2000);
    } else {
      setStatus("error");
      setError(json.error ?? "Failed to accept invite");
    }
  }

  async function handleSignup() {
    setSaving(true);
    setError("");
    if (pw.length < 8) {
      setError("Password must be at least 8 characters.");
      setSaving(false);
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pw,
      options: { data: { full_name: name } },
    });
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    if (data.user) await acceptInvite(data.user.id);
    setSaving(false);
  }

  async function handleLogin() {
    setSaving(true);
    setError("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pw,
    });
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    if (data.user) await acceptInvite(data.user.id);
    setSaving(false);
  }

  async function handleSignOutAndSwitch() {
    await supabase.auth.signOut();
    setAuthedEmail("");
    setAuthedUserId("");
    setStatus("auth");
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: isMobile ? "column" : "row", fontFamily: "inherit", background: "#0a0a0b" }}>

      {/* ── Left panel — desktop only ── */}
      {!isMobile && (
        <div style={{
          flex: "0 0 45%", background: "#0a0a0b",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "60px 48px", position: "relative",
        }}>
          <div style={{ position: "absolute", top: 0, right: 0, width: 1, height: "100%", background: "linear-gradient(to bottom, transparent, #C9A84C44, transparent)" }} />
          <div style={{ textAlign: "center", maxWidth: 320 }}>
            <img src="/logo-white.png" alt="Signal Strike" style={{ width: 110, marginBottom: 28, opacity: 0.95 }} />
            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#ffffff", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6, fontFamily: "var(--font-cinzel, serif)" }}>
              Signal Strike
            </h1>
            <p style={{ fontSize: "0.72rem", fontWeight: 500, color: "#C9A84C", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 32 }}>
              Team Invitation
            </p>
            <div style={{ width: 48, height: 1, background: "#C9A84C", margin: "0 auto 28px" }} />
            <p style={{ color: "#71717a", fontSize: "0.88rem", lineHeight: 1.7 }}>
              You&apos;ve been invited to collaborate<br />on a Signal Strike team.
            </p>
          </div>
        </div>
      )}

      {/* ── Right panel / Mobile full screen ── */}
      <div style={{
        flex: 1, background: "#111113",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: isMobile ? "48px 24px" : "60px 48px",
        minHeight: isMobile ? "100dvh" : "auto",
        paddingTop: isMobile ? "env(safe-area-inset-top)" : undefined,
        paddingBottom: isMobile ? "env(safe-area-inset-bottom)" : undefined,
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>

          {/* Mobile logo */}
          {isMobile && (
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <img src="/logo-white.png" alt="Signal Strike" style={{ width: 48, marginBottom: 10, opacity: 0.95 }} />
              <h1 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#ffffff", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4, fontFamily: "var(--font-cinzel, serif)" }}>
                Signal Strike
              </h1>
              <p style={{ fontSize: "0.65rem", color: "#C9A84C", letterSpacing: "0.18em", textTransform: "uppercase" }}>Team Invitation</p>
            </div>
          )}

          {/* ─── Loading ─── */}
          {status === "loading" && (
            <div style={{ textAlign: "center" }}>
              <div style={{
                margin: "0 auto 20px",
                width: 32,
                height: 32,
                border: "3px solid #27272a",
                borderTopColor: "#C9A84C",
                borderRadius: "50%",
                animation: "ssSpin 0.8s linear infinite",
              }} />
              <p style={{ color: "#71717a", fontSize: "0.9rem" }}>Checking your invitation…</p>
            </div>
          )}

          {/* ─── Accepting ─── */}
          {status === "accepting" && (
            <div style={{ textAlign: "center" }}>
              <div style={{
                margin: "0 auto 20px",
                width: 32,
                height: 32,
                border: "3px solid #27272a",
                borderTopColor: "#C9A84C",
                borderRadius: "50%",
                animation: "ssSpin 0.8s linear infinite",
              }} />
              <p style={{ color: "#71717a", fontSize: "0.9rem" }}>Adding you to the team…</p>
            </div>
          )}

          {/* ─── Done ─── */}
          {status === "done" && (
            <div style={{ textAlign: "center" }}>
              <div aria-hidden style={{
                width: 64, height: 64,
                borderRadius: "50%",
                background: "rgba(201, 168, 76, 0.12)",
                border: "1px solid #C9A84C",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 24px",
                color: "#C9A84C",
                fontSize: 28, fontWeight: 600,
              }}>
                ✓
              </div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fafafa", marginBottom: 10, fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.04em" }}>
                You&apos;re In
              </h2>
              <p style={{ color: "#a1a1aa", fontSize: "0.9rem", lineHeight: 1.6 }}>
                Welcome to the team. Redirecting to your dashboard…
              </p>
            </div>
          )}

          {/* ─── Error ─── */}
          {status === "error" && (
            <div style={{ textAlign: "center" }}>
              <div aria-hidden style={{
                width: 64, height: 64,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.10)",
                border: "1px solid #ef4444",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 24px",
                color: "#ef4444",
                fontSize: 28, fontWeight: 600,
              }}>
                !
              </div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fafafa", marginBottom: 10, fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.04em" }}>
                Invitation Error
              </h2>
              <p style={{ color: "#a1a1aa", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: 24 }}>
                {error}
              </p>
              <a
                href="/login"
                style={{
                  display: "inline-block",
                  background: "transparent",
                  color: "#fafafa",
                  border: "1px solid #C9A84C",
                  borderRadius: 10,
                  padding: "12px 22px",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  letterSpacing: "0.03em",
                }}
              >
                Back to Sign In
              </a>
            </div>
          )}

          {/* ─── Confirm (already signed in) ─── */}
          {status === "confirm" && (
            <>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: isMobile ? "1.5rem" : "1.9rem", fontWeight: 700, color: "#fafafa", marginBottom: 8, fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.04em" }}>
                  Accept Invitation
                </h2>
                <p style={{ color: "#71717a", fontSize: "0.88rem", lineHeight: 1.5 }}>
                  You&apos;re signed in as{" "}
                  <span style={{ color: "#fafafa", fontWeight: 600 }}>{authedEmail}</span>
                  . Confirm to join the team with this account.
                </p>
              </div>

              {error && <p style={{ color: "#f87171", fontSize: "0.82rem", marginBottom: 16 }}>{error}</p>}

              <button
                onClick={() => acceptInvite(authedUserId)}
                disabled={saving}
                style={{
                  width: "100%",
                  marginBottom: 12,
                  background: "#C9A84C",
                  color: "#000",
                  border: "none",
                  borderRadius: 10,
                  padding: "14px",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  letterSpacing: "0.03em",
                }}
              >
                Confirm & Join Team
              </button>

              <button
                onClick={handleSignOutAndSwitch}
                style={{
                  width: "100%",
                  background: "transparent",
                  color: "#a1a1aa",
                  border: "1px solid #27272a",
                  borderRadius: 10,
                  padding: "12px",
                  fontWeight: 500,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Use a different account
              </button>
            </>
          )}

          {/* ─── Auth (sign up / sign in) ─── */}
          {status === "auth" && (
            <>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: isMobile ? "1.5rem" : "1.9rem", fontWeight: 700, color: "#fafafa", marginBottom: 8, fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.04em" }}>
                  {mode === "signup" ? "Join the Team" : "Sign In to Join"}
                </h2>
                <p style={{ color: "#71717a", fontSize: "0.88rem" }}>
                  {mode === "signup"
                    ? "Create an account to accept your invitation."
                    : "Sign in to accept your invitation."}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {mode === "signup" && (
                  <div>
                    <label style={{ color: "#a1a1aa", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Full Name</label>
                    <input
                      type="text" required value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="John Smith"
                      autoComplete="name"
                      style={{ width: "100%", background: "#0a0a0b", border: "1px solid #27272a", borderRadius: 10, padding: "13px 14px", color: "#fafafa", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = "#C9A84C"}
                      onBlur={e => e.target.style.borderColor = "#27272a"}
                    />
                  </div>
                )}

                <div>
                  <label style={{ color: "#a1a1aa", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Email</label>
                  <input
                    type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    style={{ width: "100%", background: "#0a0a0b", border: "1px solid #27272a", borderRadius: 10, padding: "13px 14px", color: "#fafafa", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = "#C9A84C"}
                    onBlur={e => e.target.style.borderColor = "#27272a"}
                  />
                </div>

                <div>
                  <label style={{ color: "#a1a1aa", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Password</label>
                  <input
                    type="password" required value={pw}
                    onChange={e => setPw(e.target.value)}
                    placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                    minLength={mode === "signup" ? 8 : undefined}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    style={{ width: "100%", background: "#0a0a0b", border: "1px solid #27272a", borderRadius: 10, padding: "13px 14px", color: "#fafafa", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = "#C9A84C"}
                    onBlur={e => e.target.style.borderColor = "#27272a"}
                  />
                </div>

                {error && <p style={{ color: "#f87171", fontSize: "0.82rem", marginTop: -8 }}>{error}</p>}

                <button
                  onClick={mode === "signup" ? handleSignup : handleLogin}
                  disabled={saving}
                  style={{
                    marginTop: 4,
                    background: "#C9A84C",
                    color: "#000",
                    border: "none",
                    borderRadius: 10,
                    padding: "14px",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                    letterSpacing: "0.03em",
                  }}
                >
                  {saving ? "Working..." : mode === "signup" ? "Create Account & Join" : "Sign In & Join"}
                </button>
              </div>

              <p style={{ textAlign: "center", marginTop: 24, color: "#52525b", fontSize: "0.83rem" }}>
                {mode === "signup" ? "Already have an account? " : "New to Signal Strike? "}
                <button
                  onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }}
                  style={{ background: "none", border: "none", color: "#C9A84C", cursor: "pointer", fontSize: "0.83rem", padding: 0, fontWeight: 600 }}
                >
                  {mode === "signup" ? "Sign in" : "Sign up"}
                </button>
              </p>
            </>
          )}

          {/* ─── Footer (terms / privacy) ─── */}
          {(status === "auth" || status === "confirm" || status === "error") && (
            <p style={{ textAlign: "center", marginTop: 28, color: "#52525b", fontSize: "0.75rem" }}>
              <a href="/terms" style={{ color: "#71717a", textDecoration: "none" }}>Terms</a>
              <span style={{ margin: "0 8px", color: "#3f3f46" }}>·</span>
              <a href="/privacy" style={{ color: "#71717a", textDecoration: "none" }}>Privacy</a>
            </p>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes ssSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
