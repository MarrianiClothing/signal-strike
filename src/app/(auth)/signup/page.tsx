"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setSuccess(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  const input: React.CSSProperties = {
    width: "100%", background: "#1c1c1f", border: "1px solid #27272a",
    borderRadius: 8, padding: "11px 14px", color: "#fafafa",
    fontSize: "0.9rem", outline: "none",
  };

  if (success) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0b" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "1.5rem", marginBottom: 8 }}></p>
        <p style={{ color: "#4ade80", fontWeight: 600 }}>Account created! Redirecting...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0b" }}>
      <div style={{ width: 380, background: "#111113", border: "1px solid #27272a", borderRadius: 16, padding: 36 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#C9A84C" }}>Signal Strike</h1>
          <p style={{ color: "#71717a", fontSize: "0.85rem", marginTop: 6 }}>Create your account</p>
        </div>
        <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ color: "#a1a1aa", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Full Name</label>
            <input style={input} required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Smith" />
          </div>
          <div>
            <label style={{ color: "#a1a1aa", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Email</label>
            <input style={input} type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label style={{ color: "#a1a1aa", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Password</label>
            <input style={input} type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" />
          </div>
          {error && <p style={{ color: "#f87171", fontSize: "0.82rem" }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            marginTop: 6, background: "#C9A84C", color: "#000", border: "none",
            borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
          }}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: 20, color: "#71717a", fontSize: "0.82rem" }}>
          Already have an account?{" "}
          <a href="/login" style={{ color: "#C9A84C", textDecoration: "none", fontWeight: 600 }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}
