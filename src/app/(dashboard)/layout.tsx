"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pipeline",  label: "Pipeline"  },
  { href: "/deals",     label: "Deals"     },
  { href: "/expenses",  label: "Expenses"  },
  { href: "/settings",  label: "Settings"  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const supabase  = createClient();
  const [initials,     setInitials]     = useState("?");
  const [fullName,     setFullName]     = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMobile    = useIsMobile();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("id", user.id).single();
      if (profile?.full_name) {
        setFullName(profile.full_name);
        const parts = profile.full_name.trim().split(" ");
        setInitials(parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : parts[0].slice(0, 2).toUpperCase());
      }
    }
    loadProfile();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Auto-close sidebar on navigation
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const pageTitle = NAV.find(n =>
    n.href === pathname || (n.href !== "/dashboard" && pathname.startsWith(n.href))
  )?.label ?? "Dashboard";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0b" }}>

      {/* ── Mobile top bar ── */}
      {isMobile && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
          height: 56, background: "#000000", borderBottom: "1px solid #18181b",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 16px",
        }}>
          {/* Hamburger */}
          <button onClick={() => setSidebarOpen(o => !o)} style={{
            width: 36, height: 36, borderRadius: 8, background: "transparent",
            border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 4, padding: 0,
          }}>
            {sidebarOpen
              ? <span style={{ fontSize: "1.1rem", color: "#C9A84C" }}>✕</span>
              : <>
                  <span style={{ width: 20, height: 2, background: "#C9A84C", borderRadius: 2, display: "block" }} />
                  <span style={{ width: 20, height: 2, background: "#C9A84C", borderRadius: 2, display: "block" }} />
                  <span style={{ width: 20, height: 2, background: "#C9A84C", borderRadius: 2, display: "block" }} />
                </>
            }
          </button>

          {/* Page title */}
          <span style={{
            color: "#C9A84C", fontSize: "1rem", fontWeight: 700,
            fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}>
            {pageTitle}
          </span>

          {/* Avatar */}
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(201,168,76,0.15)", border: "1px solid #C9A84C",
            color: "#C9A84C", fontSize: "0.72rem", fontWeight: 700,
            fontFamily: "var(--font-montserrat, sans-serif)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {initials}
          </div>
        </div>
      )}

      {/* ── Mobile backdrop ── */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 149, background: "rgba(0,0,0,0.6)",
        }} />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width: 220, background: "#000000", borderRight: "1px solid #18181b",
        display: "flex", flexDirection: "column", padding: "24px 0", flexShrink: 0,
        ...(isMobile ? {
          position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 150,
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
          boxShadow: sidebarOpen ? "4px 0 32px rgba(0,0,0,0.8)" : "none",
        } : {
          position: "sticky", top: 0, height: "100vh",
        }),
      }}>
        {/* Logo */}
        <div style={{ padding: "0 20px 28px", textAlign: "center" }}>
          <img src="/logo-white.png" alt="Signal Strike Logo"
            style={{ width: "90px", display: "block", margin: "0 auto 12px auto", opacity: 0.9 }} />
          <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff", letterSpacing: "0.12em", textAlign: "center", fontFamily: "var(--font-cinzel, serif)", textTransform: "uppercase" }}>
            Signal Strike
          </h1>
          <p style={{ color: "#71717a", fontSize: "0.62rem", marginTop: 4, textAlign: "center", letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "var(--font-montserrat, sans-serif)" }}>
            Revenue CRM
          </p>
        </div>

        {/* Avatar / user */}
        <div ref={dropdownRef} style={{ padding: "0 10px 16px", position: "relative" }}>
          <button onClick={() => setDropdownOpen(p => !p)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "8px 12px", borderRadius: 8, background: "transparent",
            border: "none", cursor: "pointer",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: dropdownOpen ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${dropdownOpen ? "#ffffff" : "rgba(255,255,255,0.2)"}`,
              color: "#ffffff", fontSize: "0.75rem", fontWeight: 700,
              fontFamily: "var(--font-montserrat, sans-serif)",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
            }}>{initials}</div>
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
                  borderRadius: 7, color: "#a1a1aa", textDecoration: "none", fontSize: "0.85rem", fontWeight: 500,
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#27272a")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <span>⚙</span> Settings
                </a>
                <div style={{ height: 1, background: "#27272a", margin: "4px 0" }} />
                <button onClick={handleSignOut} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 7, background: "transparent",
                  border: "none", color: "#f87171", fontSize: "0.85rem", fontWeight: 500,
                  cursor: "pointer", textAlign: "left",
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <span>↩</span> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: "0 10px" }}>
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <a key={item.href} href={item.href} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 14px", borderRadius: 8, marginBottom: 2,
                background: active ? "rgba(255,255,255,0.06)" : "transparent",
                color: active ? "#ffffff" : "#71717a",
                textDecoration: "none", fontSize: "0.78rem",
                fontWeight: active ? 600 : 400,
                fontFamily: "var(--font-montserrat, sans-serif)",
                letterSpacing: active ? "0.08em" : "0.05em",
                textTransform: "uppercase", transition: "all 0.15s",
                borderLeft: active ? "2px solid #ffffff" : "2px solid transparent",
              }}>
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Powered by */}
        <div style={{ padding: "12px 10px", borderTop: "1px solid #18181b" }}>
          <a href="https://hilltopave.com" target="_blank" rel="noopener noreferrer" style={{
            color: "#fafafa", display: "block", textAlign: "center", textDecoration: "none",
            fontSize: "0.6rem", fontFamily: "var(--font-cinzel, serif)",
            letterSpacing: "0.12em", textTransform: "uppercase", transition: "color 0.15s",
          }}>
            Powered By HillTop Ave
          </a>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflowY: "auto", position: "relative", minWidth: 0 }}>
        {/* Spacer for mobile top bar */}
        {isMobile && <div style={{ height: 56 }} />}
        {children}
      </main>
    </div>
  );
}
