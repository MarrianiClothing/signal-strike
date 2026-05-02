"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  // Mode: "signin" (default) or "recovery" (set new password)
  const [mode, setMode] = useState<"signin" | "recovery">("signin");
  const [showWelcome, setShowWelcome] = useState(false);

  // Mobile breakpoint
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Detect ?welcome=1
  useEffect(() => {
    if (searchParams.get("welcome") === "1") {
      setShowWelcome(true);
    }
  }, [searchParams]);

  // Detect URL fragment for recovery flow + handle already-authed users
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Check URL fragment for recovery token
      // Supabase puts it in #access_token=...&type=recovery&...
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const isRecovery = hash.includes("type=recovery");

      if (isRecovery) {
        if (!cancelled) {
          setMode("recovery");
          setInfo("Set a new password to continue.");
          // Clean the fragment from the URL bar without triggering a reload
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
        return;
      }

      // Not a recovery flow — check if user is already signed in
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !cancelled) {
        router.push("/account");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // Password set. User is now fully authenticated. Off to /account.
    router.push("/account");
  }

  const isRecovery = mode === "recovery";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: isMobile ? "column" : "row", fontFamily: "inherit", background: "#0a0a0b" }}>

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
              Revenue CRM
            </p>
            <div style={{ width: 48, height: 1, background: "#C9A84C", margin: "0 auto 28px" }} />
            <p style={{ color: "#71717a", fontSize: "0.88rem", lineHeight: 1.7 }}>
              Track deals, manage your pipeline,<br />and drive revenue growth.
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
        minHeight: isMobile ? "100vh" : "auto",
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>

          {/* Mobile logo */}
          {isMobile && (
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <img src="/logo-white.png" alt="Signal Strike" style={{ width: 72, marginBottom: 16, opacity: 0.95 }} />
              <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#ffffff", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4, fontFamily: "var(--font-cinzel, serif)" }}>
                Signal Strike
              </h1>
              <p style={{ fontSize: "0.65rem", color: "#C9A84C", letterSpacing: "0.18em", textTransform: "uppercase" }}>Revenue CRM</p>
            </div>
          )}

          {/* Welcome banner (only when ?welcome=1 and NOT recovery mode) */}
          {showWelcome && !isRecovery && (
            <div style={{
              marginBottom: 24,
              padding: "14px 16px",
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              borderRadius: 8,
              color: "#86efac",
              fontSize: "0.85rem",
              lineHeight: 1.5,
            }}>
              👋 <strong>Welcome to Signal Strike.</strong> Sign in to access your account.
            </div>
          )}

          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: isMobile ? "1.5rem" : "1.9rem", fontWeight: 700, color: "#fafafa", marginBottom: 8, fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.04em" }}>
              {isRecovery ? "Set Your Password" : "Welcome Back"}
            </h2>
            <p style={{ color: "#71717a", fontSize: "0.88rem" }}>
              {isRecovery ? "Choose a password to access your account." : "Sign in to your account"}
            </p>
          </div>

          {/* Info message */}
          {info && (
            <p style={{
              color: "#86efac",
              fontSize: "0.85rem",
              marginBottom: 16,
              padding: "10px 12px",
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              borderRadius: 8,
            }}>
              {info}
            </p>
          )}

          {/* Form */}
          {isRecovery ? (
            // ─── Recovery / Set Password form ───
            <form onSubmit={handleSetPassword} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ color: "#a1a1aa", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>New Password</label>
                <input
                  type="password" required value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  style={{ width: "100%", background: "#0a0a0b", border: "1px solid #27272a", borderRadius: 10, padding: "13px 14px", color: "#fafafa", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = "#C9A84C"}
                  onBlur={e => e.target.style.borderColor = "#27272a"}
                />
              </div>

              <div>
                <label style={{ color: "#a1a1aa", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Confirm Password</label>
                <input
                  type="password" required value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Type it again"
                  minLength={8}
                  style={{ width: "100%", background: "#0a0a0b", border: "1px solid #27272a", borderRadius: 10, padding: "13px 14px", color: "#fafafa", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = "#C9A84C"}
                  onBlur={e => e.target.style.borderColor = "#27272a"}
                />
              </div>

              {error && <p style={{ color: "#f87171", fontSize: "0.82rem", marginTop: -8 }}>{error}</p>}

              <button type="submit" disabled={loading} style={{ marginTop: 4, background: "#C9A84C", color: "#000", border: "none", borderRadius: 10, padding: "14px", fontWeight: 700, fontSize: "0.95rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, letterSpacing: "0.03em" }}>
                {loading ? "Setting password..." : "Set Password & Continue"}
              </button>
            </form>
          ) : (
            // ─── Normal sign-in form ───
            <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ color: "#a1a1aa", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Email</label>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ width: "100%", background: "#0a0a0b", border: "1px solid #27272a", borderRadius: 10, padding: "13px 14px", color: "#fafafa", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = "#C9A84C"}
                  onBlur={e => e.target.style.borderColor = "#27272a"}
                />
              </div>

              <div>
                <label style={{ color: "#a1a1aa", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Password</label>
                <input
                  type="password" required value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  style={{ width: "100%", background: "#0a0a0b", border: "1px solid #27272a", borderRadius: 10, padding: "13px 14px", color: "#fafafa", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = "#C9A84C"}
                  onBlur={e => e.target.style.borderColor = "#27272a"}
                />
              </div>

              {error && <p style={{ color: "#f87171", fontSize: "0.82rem", marginTop: -8 }}>{error}</p>}

              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                <div onClick={() => setRememberMe(p => !p)} style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: rememberMe ? "#C9A84C" : "transparent", border: `2px solid ${rememberMe ? "#C9A84C" : "#3f3f46"}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", cursor: "pointer" }}>
                  {rememberMe && <span style={{ color: "#000", fontSize: "0.7rem", fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </div>
                <span style={{ color: "#a1a1aa", fontSize: "0.83rem" }}>Remember me</span>
              </label>

              <button type="submit" disabled={loading} style={{ marginTop: 4, background: "#C9A84C", color: "#000", border: "none", borderRadius: 10, padding: "14px", fontWeight: 700, fontSize: "0.95rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, letterSpacing: "0.03em" }}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          {!isRecovery && (
            <p style={{ textAlign: "center", marginTop: 28, color: "#52525b", fontSize: "0.83rem" }}>
              Don&apos;t have an account?{" "}
              <a href="/landing#pricing" style={{ color: "#C9A84C", textDecoration: "none", fontWeight: 600 }}>Sign up</a>
            </p>
          )}

          <p style={{ textAlign: "center", marginTop: 16, color: "#52525b", fontSize: "0.75rem" }}>
            <a href="/terms" style={{ color: "#71717a", textDecoration: "none" }}>Terms</a>
            <span style={{ margin: "0 8px", color: "#3f3f46" }}>·</span>
            <a href="/privacy" style={{ color: "#71717a", textDecoration: "none" }}>Privacy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
