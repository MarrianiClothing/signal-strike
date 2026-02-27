"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: "◈" },
  { href: "/pipeline", label: "Pipeline", icon: "◫" },
  { href: "/deals", label: "Deals", icon: "◉" },
  { href: "/settings", label: "Settings", icon: "◎" },
];

export function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <aside style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0, background: "#111113", borderRight: "1px solid #27272a" }}>
      <div style={{ padding: "20px 16px", borderBottom: "1px solid #27272a", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative", width: 28, height: 38, flexShrink: 0 }}>
          <Image src="/logo.png" alt="Signal Strike" fill style={{ objectFit: "contain", filter: "drop-shadow(0 0 6px rgba(201,168,76,0.4))" }} />
        </div>
        <div>
          <p style={{ fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.05em", color: "#fafafa" }}>SIGNAL STRIKE</p>
          <p style={{ fontSize: "0.6rem", color: "#52525b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Revenue CRM</p>
        </div>
      </div>
      <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        {navItems.map((item) => {
          const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, textDecoration: "none", background: isActive ? "#1c1c1f" : "transparent", color: isActive ? "#fafafa" : "#71717a", fontSize: "0.85rem", fontWeight: isActive ? 600 : 400 }}>
              <span style={{ color: isActive ? "#C9A84C" : "inherit", fontSize: "1rem" }}>{item.icon}</span>
              {item.label}
              {isActive && <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#C9A84C" }} />}
            </Link>
          );
        })}
      </nav>
      <div style={{ padding: "12px 8px", borderTop: "1px solid #27272a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "#C9A84C" }}>
            {profile?.full_name?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fafafa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.full_name ?? "User"}</p>
            <p style={{ fontSize: "0.7rem", color: "#52525b", textTransform: "capitalize" }}>{profile?.role ?? "sales_rep"}</p>
          </div>
        </div>
        <button onClick={handleSignOut} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", color: "#52525b", fontSize: "0.8rem" }}>
          <span>↩</span> Sign Out
        </button>
      </div>
    </aside>
  );
}
