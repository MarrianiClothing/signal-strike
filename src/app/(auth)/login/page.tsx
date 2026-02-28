"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/dashboard");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "inherit" }}>

      {/* ── Left panel ── */}
      <div style={{
        flex: "0 0 45%", background: "#0a0a0b",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "60px 48px", position: "relative",
      }}>
        {/* Subtle border-right */}
        <div style={{ position: "absolute", top: 0, right: 0, width: 1, height: "100%", background: "linear-gradient(to bottom, transparent, #C9A84C44, transparent)" }} />

        <div style={{ textAlign: "center", maxWidth: 320 }}>
          {/* Logo */}
          <img
            src="/logo-white.png"
            alt="Signal Strike"
            style={{ width: 110, marginBottom: 28, opacity: 0.95 }}
          />

          {/* Brand name */}
          <h1 style={{
            fontSize: "2rem", fontWeight: 800, color: "#ffffff",
            letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6,
            fontFamily: "var(--font-cinzel, serif)",
          }}>
            Signal Strike
          </h1>

          {/* Category */}
          <p style={{
            fontSize: "0.72rem", fontWeight: 500, color: "#C9A84C",
            letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 32,
          }}>
            Revenue CRM
          </p>

          {/* Divider */}
          <div style={{ width: 48, height: 1, background: "#C9A84C", margin: "0 auto 28px" }} />

          {/* Tagline */}
          <p style={{ color: "#71717a", fontSize: "0.88rem", lineHeight: 1.7 }}>
            Track deals, manage your pipeline,<br />and drive revenue growth.
          </p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{
        flex: 1, background: "#111113",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "60px 48px",
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>

          {/* Heading */}
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: "1.9rem", fontWeight: 700, color: "#fafafa", marginBottom: 8, fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.04em" }}>
              Welcome Back
            </h2>
            <p style={{ color: "#71717a", fontSize: "0.88rem" }}>Sign in to your account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Email */}
            <div>
              <label style={{
                color: "#a1a1aa", fontSize: "0.78rem", fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                display: "block", marginBottom: 8,
              }}>Email</label>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                  color: "#52525b", fontSize: "0.9rem", pointerEvents: "none",
                }}></span>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: "100%", background: "#0a0a0b", border: "1px solid #27272a",
                    borderRadius: 10, padding: "13px 14px 13px 38px", color: "#fafafa",
                    fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={e => e.target.style.borderColor = "#C9A84C"}
                  onBlur={e => e.target.style.borderColor = "#27272a"}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{
                color: "#a1a1aa", fontSize: "0.78rem", fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                display: "block", marginBottom: 8,
              }}>Password</label>
              <input
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••"
                style={{
                  width: "100%", background: "#0a0a0b", border: "1px solid #27272a",
                  borderRadius: 10, padding: "13px 14px", color: "#fafafa",
                  fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => e.target.style.borderColor = "#C9A84C"}
                onBlur={e => e.target.style.borderColor = "#27272a"}
              />
            </div>

            {error && (
              <p style={{ color: "#f87171", fontSize: "0.82rem", marginTop: -8 }}>{error}</p>
            )}

            {/* Remember Me */}
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
              <div
                onClick={() => setRememberMe(p => !p)}
                style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  background: rememberMe ? "#C9A84C" : "transparent",
                  border: `2px solid ${rememberMe ? "#C9A84C" : "#3f3f46"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s", cursor: "pointer",
                }}
              >
                {rememberMe && <span style={{ color: "#000", fontSize: "0.7rem", fontWeight: 900, lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ color: "#a1a1aa", fontSize: "0.83rem" }}>Remember me</span>
            </label>

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              style={{
                marginTop: 4, background: "#C9A84C", color: "#000", border: "none",
                borderRadius: 10, padding: "14px", fontWeight: 700, fontSize: "0.95rem",
                cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
                letterSpacing: "0.03em", transition: "opacity 0.2s",
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Footer link */}
          <p style={{ textAlign: "center", marginTop: 28, color: "#52525b", fontSize: "0.83rem" }}>
            Don&apos;t have an account?{" "}
            <a href="/signup" style={{ color: "#C9A84C", textDecoration: "none", fontWeight: 600 }}>
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
