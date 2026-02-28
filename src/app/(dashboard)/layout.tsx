"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "" },
  { href: "/pipeline", label: "Pipeline", icon: "deal" },
  { href: "/deals", label: "Deals", icon: "" },
  { href: "/settings", label: "Settings", icon: "" },
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
        width: 220, background: "#111113", borderRight: "1px solid #18181b",
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
          <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em", textAlign: "center" }}>
            Signal Strike
          </h1>
          <p style={{ color: "#ffffff", fontSize: "0.72rem", marginTop: 4, textAlign: "center" }}>Revenue CRM</p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0 10px" }}>
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <a key={item.href} href={item.href} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 8, marginBottom: 2,
                background: active ? "#C9A84C22" : "transparent",
                color: active ? "#C9A84C" : "#a1a1aa",
                textDecoration: "none", fontSize: "0.88rem", fontWeight: active ? 600 : 400,
                transition: "background 0.15s",
              }}>
                <span style={{ fontSize: "1rem" }}>{item.icon}</span>
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Sign out */}
        <div style={{ padding: "0 10px" }}>
          <button onClick={handleSignOut} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "9px 12px", borderRadius: 8, background: "none",
            border: "none", color: "#52525b", fontSize: "0.88rem",
            cursor: "pointer", textAlign: "left",
          }}>
            <span></span> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        {/* ── Top Header Bar ── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          padding: "14px 28px",
          background: "rgba(10,10,11,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #18181b",
        }}>
          {/* Avatar Button with Dropdown */}
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => setDropdownOpen(prev => !prev)}
              style={{
                width: 40, height: 40, borderRadius: "50%",
                background: dropdownOpen ? "rgba(201,168,76,0.2)" : "rgba(201,168,76,0.1)",
                border: `2px solid ${dropdownOpen ? "#C9A84C" : "rgba(201,168,76,0.35)"}`,
                color: "#C9A84C",
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
        </div>

        {children}
      </main>
    </div>
  );
}
