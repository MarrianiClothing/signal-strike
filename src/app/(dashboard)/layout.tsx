"use client";
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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0b" }}>
      {/* Sidebar */}
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
            style={{ width: '90px', display: 'block', margin: '0 auto 12px auto', opacity: 0.9 }}
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

      {/* Main content */}
      <main style={{ flex: 1, overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
