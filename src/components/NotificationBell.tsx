"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, ChevronRight, Trophy, X, Plus, CheckCircle2,
  FileText, UserCheck, UserPlus, Mail, AlertTriangle,
  CheckCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Notification, NotificationType } from "@/types/notifications";

// Map notification type → Lucide icon component
const ICONS: Record<NotificationType, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  deal_advanced:        ChevronRight,
  deal_won:             Trophy,
  deal_lost:            X,
  deal_added:           Plus,
  milestone_completed:  CheckCircle2,
  project_created:      FileText,
  team_invite_accepted: UserCheck,
  team_member_added:    UserPlus,
  daily_signal_sent:    Mail,
  daily_signal_failed:  AlertTriangle,
  system:               Bell,
};

const COLORS: Record<NotificationType, string> = {
  deal_advanced:        "#C9A84C",
  deal_won:             "#34d399",
  deal_lost:            "#f87171",
  deal_added:           "#a1a1aa",
  milestone_completed:  "#34d399",
  project_created:      "#a78bfa",
  team_invite_accepted: "#34d399",
  team_member_added:    "#60a5fa",
  daily_signal_sent:    "#C9A84C",
  daily_signal_failed:  "#f87171",
  system:               "#a1a1aa",
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.floor((now - then) / 1000);
  if (sec < 60)        return "just now";
  if (sec < 3600)      return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400)     return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface NotificationBellProps {
  size?: number;
}

export default function NotificationBell({ size = 44 }: NotificationBellProps) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // ── Auth check FIRST. No Supabase queries until we have a confirmed user.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function checkAuth() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (error || !user) {
          setUserId(null);
        } else {
          setUserId(user.id);
        }
      } catch (e) {
        console.error("[NotificationBell] auth check failed:", e);
        if (!cancelled) setUserId(null);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }

    checkAuth();
    return () => { cancelled = true; };
  }, []);

  // ── Load notifications + subscribe to realtime, only once authed
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const supabase = createClient();

    async function loadAll() {
      try {
        const [listRes, countRes] = await Promise.all([
          supabase
            .from("notifications")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(30),
          supabase
            .from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("read", false),
        ]);

        if (cancelled) return;

        if (listRes.error) {
          console.error("[NotificationBell] list query failed:", listRes.error.message);
        } else {
          setItems((listRes.data ?? []) as Notification[]);
        }

        if (countRes.error) {
          console.error("[NotificationBell] count query failed:", countRes.error.message);
        } else {
          setUnread(countRes.count ?? 0);
        }
      } catch (e) {
        console.error("[NotificationBell] loadAll error:", e);
      }
    }

    loadAll();

    // Realtime: any change to this user's notifications triggers a reload
    const channel = supabase
      .channel("notifications_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          if (!cancelled) loadAll();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // ── Outside-click closes panel
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  async function handleItemClick(n: Notification) {
    setOpen(false);
    if (!n.read) {
      // Optimistic UI update
      setItems(prev => prev.map(it => it.id === n.id ? { ...it, read: true } : it));
      setUnread(prev => Math.max(0, prev - 1));
      try {
        const supabase = createClient();
        await supabase
          .from("notifications")
          .update({ read: true, read_at: new Date().toISOString() })
          .eq("id", n.id);
      } catch (e) {
        console.error("[NotificationBell] markRead failed:", e);
      }
    }
    if (n.link) router.push(n.link);
  }

  async function handleMarkAllRead() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("read", false);
      setUnread(0);
      setItems(prev => prev.map(it => ({ ...it, read: true })));
    } catch (e) {
      console.error("[NotificationBell] markAllRead failed:", e);
    } finally {
      setLoading(false);
    }
  }

  // ── Render guard: nothing renders until auth check completes.
  // If no user, render nothing — bell shouldn't appear on /login etc.
  if (!authChecked) return null;
  if (!userId) return null;

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(p => !p)}
        aria-label="Notifications"
        style={{
          width: size, height: size, borderRadius: "50%",
          background: open ? "rgba(201,168,76,0.15)" : "transparent",
          border: "none", cursor: "pointer", padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", transition: "background 0.15s",
        }}
      >
        <Bell size={20} color="#C9A84C" strokeWidth={2} />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 4, right: 4,
            minWidth: 18, height: 18, borderRadius: 9,
            background: "#C9A84C", color: "#000",
            fontSize: "0.65rem", fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 5px",
            fontFamily: "var(--font-montserrat, sans-serif)",
            border: "2px solid #000",
            lineHeight: 1,
          }}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          right: 0,
          width: 340,
          maxWidth: "calc(100vw - 24px)",
          maxHeight: "min(70vh, 540px)",
          background: "#111113",
          border: "1px solid #27272a",
          borderRadius: 12,
          boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
          overflow: "hidden",
          zIndex: 300,
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{
            padding: "12px 14px",
            borderBottom: "1px solid #1c1c1f",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <h3 style={{
              fontSize: "0.85rem", fontWeight: 700, color: "#fafafa",
              margin: 0, letterSpacing: "0.04em",
              fontFamily: "var(--font-montserrat, sans-serif)",
            }}>
              Notifications {unread > 0 && (
                <span style={{ color: "#71717a", fontWeight: 500, marginLeft: 4 }}>
                  ({unread})
                </span>
              )}
            </h3>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                style={{
                  background: "none", border: "none", color: "#C9A84C",
                  cursor: "pointer", fontSize: "0.72rem", fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "4px 6px", borderRadius: 6,
                  opacity: loading ? 0.5 : 1,
                }}
              >
                <CheckCheck size={13} strokeWidth={2.2} />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {items.length === 0 ? (
              <div style={{
                padding: "40px 20px",
                textAlign: "center",
                color: "#52525b",
                fontSize: "0.82rem",
              }}>
                <Bell size={26} color="#3f3f46" strokeWidth={1.5} style={{ marginBottom: 8 }} />
                <p style={{ margin: 0 }}>No notifications yet</p>
                <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "#3f3f46" }}>
                  We&apos;ll signal you when something needs attention.
                </p>
              </div>
            ) : (
              items.map(n => {
                const Icon = ICONS[n.type] ?? Bell;
                const iconColor = COLORS[n.type] ?? "#a1a1aa";
                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "12px 14px",
                      background: n.read ? "transparent" : "rgba(201,168,76,0.04)",
                      border: "none",
                      borderBottom: "1px solid #18181b",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,168,76,0.08)")}
                    onMouseLeave={e => (e.currentTarget.style.background = n.read ? "transparent" : "rgba(201,168,76,0.04)")}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: `${iconColor}1f`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, marginTop: 1,
                    }}>
                      <Icon size={15} color={iconColor} strokeWidth={2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "flex-start", gap: 8, marginBottom: 2,
                      }}>
                        <p style={{
                          fontSize: "0.82rem",
                          fontWeight: n.read ? 500 : 700,
                          color: n.read ? "#a1a1aa" : "#fafafa",
                          margin: 0, lineHeight: 1.3,
                        }}>{n.title}</p>
                        <span style={{
                          fontSize: "0.65rem",
                          color: "#52525b",
                          flexShrink: 0,
                          marginTop: 1,
                        }}>{relativeTime(n.created_at)}</span>
                      </div>
                      {n.body && (
                        <p style={{
                          fontSize: "0.74rem",
                          color: "#71717a",
                          margin: 0,
                          lineHeight: 1.4,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}>{n.body}</p>
                      )}
                    </div>
                    {!n.read && (
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: "#C9A84C", flexShrink: 0, marginTop: 8,
                      }} />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
