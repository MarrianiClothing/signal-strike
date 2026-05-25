"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import { LayoutGrid, Users, Radar, FileText, Receipt, UserPlus, LineChart, MessageSquare, LogOut, Settings as SettingsIcon, CreditCard, ChevronUp, Bell, Search, Menu, X } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import SignalSearchModal from "@/components/SignalSearchModal";
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
  { href: "/dashboard",  label: "Dashboard",  Icon: LayoutGrid    },
  { href: "/deals",      label: "Pipeline",   Icon: Users         },
  { href: "/prospects",  label: "Scout",      Icon: Radar         },
  { href: "/projects",   label: "Jobs",       Icon: FileText      },
  { href: "/expenses",   label: "Expenses",   Icon: Receipt       },
  { href: "/team",       label: "Team",       Icon: UserPlus      },
  { href: "/manager",    label: "Manager",    Icon: LineChart     },
  { href: "/ask-signal", label: "Ask Signal", Icon: MessageSquare },
];

function SidebarInner() {
  const pathname  = usePathname();
  const router    = useRouter();
  const supabase  = createClient();
  const { initials, fullName } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  // [hydration-fix] flip after first client render so SSR and client agree on first paint
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMobile    = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node))
        setMobileMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => { setSidebarOpen(false); setMobileMenuOpen(false); }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const pageTitle = NAV.find(n =>
    n.href === pathname || (n.href !== "/dashboard" && pathname.startsWith(n.href))
  )?.label ?? "Dashboard";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0b" }}>
      {isMobile && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
          height: "calc(56px + env(safe-area-inset-top))",
          paddingTop: "env(safe-area-inset-top)",
          background: "#000000", borderBottom: "1px solid #18181b",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "env(safe-area-inset-top) 16px 0 16px",
        }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{
            width: 44, height: 44, borderRadius: 8, background: "transparent",
            border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 4, padding: 0,
          }}>
            {sidebarOpen
              ? <X size={22} color="#C9A84C" strokeWidth={2} />
              : <Menu size={22} color="#C9A84C" strokeWidth={2} />
            }
          </button>
          <span style={{
            position: "absolute", left: "50%", top: "calc(env(safe-area-inset-top) + 28px)",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            color: "#C9A84C", fontSize: "1rem", fontWeight: 700,
            fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}>{pageTitle}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Open Signal Search"
              style={{
                width: 44, height: 44, borderRadius: 22,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: "none", cursor: "pointer",
                color: "#C9A84C", padding: 0,
              }}
            ><Search size={22} strokeWidth={2} /></button>
            {!isMobile && <NotificationBell size={44} />}
            <div ref={mobileMenuRef} style={{ position: "relative" }}>
            <button
              onClick={() => router.push("/dashboard")}
              aria-label="Go to dashboard"
              title="Dashboard"
              style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "rgba(201,168,76,0.15)",
                border: "1px solid #C9A84C",
                color: "#C9A84C",
                fontSize: "0.72rem", fontWeight: 700,
                fontFamily: "var(--font-montserrat, sans-serif)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", padding: 0, transition: "all 0.15s",
              }}
            >{hydrated ? initials : "?"}</button>

            {mobileMenuOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0,
                minWidth: 200, background: "#18181b",
                border: "1px solid #27272a", borderRadius: 10,
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)", overflow: "hidden",
                zIndex: 250,
              }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid #27272a" }}>
                  <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "#fafafa", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hydrated ? (fullName || "User") : "User"}</p>
                  <p style={{ fontSize: "0.62rem", color: "#71717a", margin: "2px 0 0", letterSpacing: "0.08em", textTransform: "uppercase" }}>HillTop Ave</p>
                </div>
                <div style={{ padding: 6 }}>
                  <a href="/settings" onClick={() => setMobileMenuOpen(false)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "11px 12px",
                    borderRadius: 7, color: "#a1a1aa", textDecoration: "none",
                    fontSize: "0.88rem", fontWeight: 500, minHeight: 44,
                  }}>
                    <span>⚙</span> Settings
                  </a>
                  <a href="/account" onClick={() => setMobileMenuOpen(false)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "11px 12px",
                    borderRadius: 7, color: "#a1a1aa", textDecoration: "none",
                    fontSize: "0.88rem", fontWeight: 500, minHeight: 44,
                  }}>
                    <span>💳</span> Account & Billing
                  </a>
                  <div style={{ height: 1, background: "#27272a", margin: "4px 0" }} />
                  <button onClick={handleSignOut} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "11px 12px", borderRadius: 7, background: "transparent",
                    border: "none", color: "#f87171", fontSize: "0.88rem", fontWeight: 500,
                    cursor: "pointer", textAlign: "left", minHeight: 44,
                  }}>
                    <span>↩</span> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 149, background: "rgba(0,0,0,0.6)",
        }} />
      )}

      <aside style={{
        width: 220, background: "#000000", borderRight: "1px solid #18181b",
        display: "flex", flexDirection: "column", padding: "24px 0", flexShrink: 0,
        ...(isMobile ? {
          position: "fixed", top: "calc(56px + env(safe-area-inset-top))", left: 0, height: "calc(100dvh - 56px - env(safe-area-inset-top))", zIndex: 150,
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
          boxShadow: sidebarOpen ? "4px 0 32px rgba(0,0,0,0.8)" : "none",
        } : {
          position: "sticky", top: 0, height: "100vh",
        }),
      }}>
        {isMobile ? (
          <div style={{ padding: "8px 16px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo-white.png" alt="Signal Strike Logo"
              style={{ width: 32, height: "auto", flexShrink: 0, opacity: 0.9 }} />
            <h1 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#ffffff", letterSpacing: "0.1em", margin: 0, fontFamily: "var(--font-cinzel, serif)", textTransform: "uppercase" }}>
              Signal Strike
            </h1>
          </div>
        ) : (
          <div style={{ padding: "0 20px 28px", textAlign: "center" }}>
            <img src="/logo-white.png" alt="Signal Strike Logo"
              style={{ width: "110px", height: "auto", maxWidth: "100%", display: "block", margin: "0 auto 12px auto", opacity: 0.9 }} />
            <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff", letterSpacing: "0.12em", textAlign: "center", fontFamily: "var(--font-cinzel, serif)", textTransform: "uppercase" }}>
              Signal Strike
            </h1>
            <p style={{ color: "#71717a", fontSize: "0.62rem", marginTop: 4, textAlign: "center", letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "var(--font-montserrat, sans-serif)" }}>
              Revenue CRM
            </p>
          </div>
        )}

        <div ref={dropdownRef} style={{ padding: "0 10px 16px", position: "relative" }}>
          <button onClick={() => setDropdownOpen(p => !p)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "8px 12px", borderRadius: 8, background: "transparent",
            border: "none", cursor: "pointer",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: hydrated && dropdownOpen ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${hydrated && dropdownOpen ? "#ffffff" : "rgba(255,255,255,0.2)"}`,
              color: "#ffffff", fontSize: "0.75rem", fontWeight: 700,
              fontFamily: "var(--font-montserrat, sans-serif)",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
            }}>{hydrated ? initials : "?"}</div>
            <div style={{ textAlign: "left", minWidth: 0 }}>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fafafa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hydrated ? (fullName || "User") : "User"}</p>
              <p style={{ fontSize: "0.65rem", color: "#52525b", letterSpacing: "0.08em", textTransform: "uppercase" }}>HillTop Ave</p>
            </div>
            <ChevronUp style={{ marginLeft: "auto", color: "#52525b", width: 14, height: 14, transition: "transform 0.2s", transform: dropdownOpen ? "rotate(0deg)" : "rotate(180deg)" }} />
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
                  <SettingsIcon size={15} strokeWidth={2} /> Settings
                </a>
                <a href="/account" onClick={() => setDropdownOpen(false)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                  borderRadius: 7, color: "#a1a1aa", textDecoration: "none", fontSize: "0.85rem", fontWeight: 500,
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#27272a")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <CreditCard size={15} strokeWidth={2} /> Account & Billing
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
                  <LogOut size={15} strokeWidth={2} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: "0 10px" }}>
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <a key={href} href={href} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", borderRadius: 8, marginBottom: 2,
                background: active ? "rgba(201,168,76,0.12)" : "transparent",
                color: active ? "#C9A84C" : "#71717a",
                textDecoration: "none", fontSize: "0.82rem",
                fontWeight: active ? 600 : 500,
                fontFamily: "var(--font-montserrat, sans-serif)",
                letterSpacing: "0.04em",
                transition: "all 0.15s",
                border: active ? "1px solid rgba(201,168,76,0.25)" : "1px solid transparent",
              }}>
                <Icon size={17} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                {label}
              </a>
            );
          })}
        </nav>

        <div style={{ padding: "12px 10px", borderTop: "1px solid #18181b" }}>
          <a href="https://hilltopave.com" target="_blank" rel="noopener noreferrer" style={{
            color: "#fafafa", display: "block", textAlign: "center", textDecoration: "none",
            fontSize: "0.6rem", fontFamily: "var(--font-cinzel, serif)",
            letterSpacing: "0.12em", textTransform: "uppercase", transition: "color 0.15s",
          }}>Powered By HillTop Ave</a>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: "auto", position: "relative", minWidth: 0 }}>
        {isMobile && <div style={{ height: 56 }} />}
        <SidebarChildren />
      </main>
      <SignalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

// Workaround to pass children through context-aware component
let _children: React.ReactNode = null;
function SidebarChildren() { return <>{_children}</>; }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  _children = children;
  return (
    <AuthProvider>
      <SidebarInner />
    </AuthProvider>
  );
}
