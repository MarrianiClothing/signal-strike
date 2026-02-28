"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/deals", label: "Deals" },
  { href: "/settings", label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [initials, setInitials] = useState("?");
  const [fullName, setFullName] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (profile?.full_name) {
        setFullName(profile.full_name);
        const parts = profile.full_name.trim().split(" ");
        const ini = parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : parts[0].slice(0, 2).toUpperCase();
        setInitials(ini);
      }
    }
    loadProfile();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // Get page title from pathname
  const pageTitle = NAV.find(n => n.href === pathname || (n.href !== "/dashboard" && pathname.startsWith(n.href)))?.label ?? "Dashboard";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0b" }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 220, background: "#000000", borderRight: "1px solid #18181b",
        display: "flex", flexDirection: "column", padding: "24px 0", flexShrink: 0,
        position: "sticky", top: 0, height: "100vh",
      }}>
        {/* Logo */}
        <div style={{ padding: "0 20px 28px", textAlign: "center" }}>
          <img
            src="/logo-white.png"
            alt="Signal Strike Logo"
            style={{ width: "90px", display: "block", margin: "0 auto 12px auto", opacity: 0.9 }}
          />
          <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff", letterSpacing: "0.12em", textAlign: "center", fontFamily: "var(--font-cinzel, serif)", textTransform: "uppercase" }}>
            Signal Strike
          </h1>
          <p style={{ color: "#71717a", fontSize: "0.62rem", marginTop: 4, textAlign: "center", letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "var(--font-montserrat, sans-serif)" }}>Revenue CRM</p>
        </div>

        {/* Avatar */}
        <div ref={dropdownRef} style={{ padding: "0 10px 16px", position: "relative" }}>
          <button
            onClick={() => setDropdownOpen(prev => !prev)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px", borderRadius: 8, background: "transparent",
              border: "none", cursor: "pointer",
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: dropdownOpen ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${dropdownOpen ? "#ffffff" : "rgba(255,255,255,0.2)"}`,
              color: "#ffffff", fontSize: "0.75rem", fontWeight: 700,
              fontFamily: "var(--font-montserrat, sans-serif)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}>
              {initials}
            </div>
            <div style={{ textAlign: "left", minWidth: 0 }}>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fafafa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fullName || "User"}</p>
              <p style={{ fontSize: "0.65rem", color: "#52525b", letterSpacing: "0.08em", textTransform: "uppercase" }}>HillTop Ave</p>
            </div>
            <span style={{ marginLeft: "auto", color: "#52525b", fontSize: "0.7rem" }}>▾</span>
          </button>

          {dropdownOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 10, right: 10,
              background: "#18181b", border: "1px solid #27272a", borderRadius: 10,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)", overflow: "hidden", zIndex: 100,
            }}>
              <div style={{ padding: "6px" }}>
                <a href="/settings" onClick={() => setDropdownOpen(false)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                  borderRadius: 7, color: "#a1a1aa", textDecoration: "none",
                  fontSize: "0.85rem", fontWeight: 500,
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#27272a")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span>⚙</span> Settings
                </a>
                <div style={{ height: 1, background: "#27272a", margin: "4px 0" }} />
                <button onClick={handleSignOut} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 7, background: "transparent",
                  border: "none", color: "#f87171", fontSize: "0.85rem",
                  fontWeight: 500, cursor: "pointer", textAlign: "left",
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span>↩</span> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0 10px" }}>
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <a key={item.href} href={item.href} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 14px", borderRadius: 8, marginBottom: 2,
                background: active ? "rgba(255,255,255,0.06)" : "transparent",
                color: active ? "#ffffff" : "#71717a",
                textDecoration: "none",
                fontSize: "0.78rem",
                fontWeight: active ? 600 : 400,
                fontFamily: "var(--font-montserrat, sans-serif)",
                letterSpacing: active ? "0.08em" : "0.05em",
                textTransform: "uppercase",
                transition: "all 0.15s",
                borderLeft: active ? "2px solid #ffffff" : "2px solid transparent",
              }}>
                {item.label}
              </a>
            );
          })}
        </nav>


        {/* Powered By */}
        <div style={{ padding: "12px 10px", borderTop: "1px solid #18181b" }}>
          <a
            href="https://hilltopave.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#fafafa", color: "#fafafa", color: "#fafafa",
              display: "block", textAlign: "center",
              textDecoration: "none",
              fontSize: "0.6rem",
              color: "#3f3f46",
              fontFamily: "var(--font-cinzel, serif)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              transition: "color 0.15s",
            }}
          >
            Powered By HillTop Ave
          </a>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        <div style={{ display: "none" }}>
            <button
              onClick={() => setDropdownOpen(prev => !prev)}
              style={{
                width: 40, height: 40, borderRadius: "50%",
                background: dropdownOpen ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                border: `2px solid ${dropdownOpen ? "#ffffff" : "rgba(255,255,255,0.3)"}`,
                color: "#ffffff",
                fontSize: "0.8rem", fontWeight: 700,
                fontFamily: "var(--font-montserrat, sans-serif)",
                letterSpacing: "0.05em",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              {initials}
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                width: 200, background: "#18181b",
                border: "1px solid #27272a", borderRadius: 10,
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                overflow: "hidden",
                animation: "fadeIn 0.1s ease",
              }}>
                {/* User info header */}
                <div style={{
                  padding: "14px 16px", borderBottom: "1px solid #27272a",
                  background: "#111113",
                }}>
                  <p style={{
                    fontSize: "0.85rem", fontWeight: 700, color: "#fafafa",
                    fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.04em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {fullName || "User"}
                  </p>
                  <p style={{ fontSize: "0.72rem", color: "#52525b", marginTop: 2, letterSpacing: "0.06em" }}>
                    HillTop Ave
                  </p>
                </div>

                {/* Menu items */}
                <div style={{ padding: "6px" }}>
                  <a
                    href="/settings"
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", borderRadius: 7,
                      color: "#a1a1aa", textDecoration: "none",
                      fontSize: "0.85rem", fontWeight: 500,
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#27272a")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: "1rem" }}>⚙</span>
                    Settings
                  </a>

                  <div style={{ height: 1, background: "#27272a", margin: "4px 0" }} />

                  <button
                    onClick={handleSignOut}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", borderRadius: 7,
                      background: "transparent", border: "none",
                      color: "#f87171", fontSize: "0.85rem", fontWeight: 500,
                      cursor: "pointer", textAlign: "left",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: "1rem" }}>↩</span>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
        </div>

        {children}
      </main>
    </div>
  );
}
