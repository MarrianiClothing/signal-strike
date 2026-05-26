"use client";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile breakpoint
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // If user is already signed in, bounce them to /account
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        // Clear stale cookies if any so we don't loop
        const { data: { session } } = await supabase.auth.getSession();
        if (session) await supabase.auth.signOut();
        return;
      }
      if (!cancelled) router.push("/account");
    }
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  // Success state — branded card, not a bare success line
  if (success) {
    return (
      <div style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0b",
        padding: 24,
      }}>
        <div style={{
          width: "100%",
          maxWidth: 420,
          background: "#111113",
          border: "1px solid #27272a",
          borderRadius: 16,
          padding: "40px 32px",
          textAlign: "center",
        }}>
          <img src="/logo-white.png" alt="Signal Strike" style={{ width: 64, marginBottom: 20, opacity: 0.95 }} />
          <h2 style={{
            fontSize: "1.4rem",
            fontWeight: 700,
            color: "#fafafa",
            marginBottom: 10,
            fontFamily: "var(--font-cinzel, serif)",
            letterSpacing: "0.04em",
          }}>
            Account Created
          </h2>
          <p style={{ color: "#a1a1aa", fontSize: "0.9rem", lineHeight: 1.6 }}>
            Welcome to Signal Strike. Redirecting you to your dashboard…
          </p>
          <div style={{
            margin: "24px auto 0",
            width: 32,
            height: 32,
            border: "3px solid #27272a",
            borderTopColor: "#C9A84C",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <style jsx>{`
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
        </div>
      </div>
    );
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
              <p style={{ fontSize: "0.65rem", color: "#C9A84C", letterSpacing: "0.18em", textTransform: "uppercase" }}>Revenue CRM</p>
            </div>
          )}

          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: isMobile ? "1.5rem" : "1.9rem", fontWeight: 700, color: "#fafafa", marginBottom: 8, fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.04em" }}>
              Create Your Account
            </h2>
            <p style={{ color: "#71717a", fontSize: "0.88rem" }}>
              Start tracking deals in under a minute.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={{ color: "#a1a1aa", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Full Name</label>
              <input
                type="text" required value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="John Smith"
                autoComplete="name"
                style={{ width: "100%", background: "#0a0a0b", border: "1px solid #27272a", borderRadius: 10, padding: "13px 14px", color: "#fafafa", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#C9A84C"}
                onBlur={e => e.target.style.borderColor = "#27272a"}
              />
            </div>

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
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                autoComplete="new-password"
                style={{ width: "100%", background: "#0a0a0b", border: "1px solid #27272a", borderRadius: 10, padding: "13px 14px", color: "#fafafa", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#C9A84C"}
                onBlur={e => e.target.style.borderColor = "#27272a"}
              />
            </div>

            {error && <p style={{ color: "#f87171", fontSize: "0.82rem", marginTop: -8 }}>{error}</p>}

            <button type="submit" disabled={loading} style={{
              marginTop: 4,
              background: "#C9A84C",
              color: "#000",
              border: "none",
              borderRadius: 10,
              padding: "14px",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              letterSpacing: "0.03em",
            }}>
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 24, color: "#71717a", fontSize: "0.78rem", lineHeight: 1.5 }}>
            By creating an account, you agree to our{" "}
            <a href="/terms" style={{ color: "#a1a1aa", textDecoration: "underline" }}>Terms</a>
            {" "}and{" "}
            <a href="/privacy" style={{ color: "#a1a1aa", textDecoration: "underline" }}>Privacy Policy</a>.
          </p>

          <p style={{ textAlign: "center", marginTop: 20, color: "#52525b", fontSize: "0.83rem" }}>
            Already have an account?{" "}
            <a href="/login" style={{ color: "#C9A84C", textDecoration: "none", fontWeight: 600 }}>Sign in</a>
          </p>

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

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageContent />
    </Suspense>
  );
}
