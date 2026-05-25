/**
 * Notification types for Signal Strike.
 * Mirrors the notification_type enum in supabase/migrations/20260525_notifications.sql
 */

export type NotificationType =
  | "deal_advanced"
  | "deal_won"
  | "deal_lost"
  | "deal_added"
  | "milestone_completed"
  | "project_created"
  | "team_invite_accepted"
  | "team_member_added"
  | "daily_signal_sent"
  | "daily_signal_failed"
  | "system";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  created_at: string;
  read_at: string | null;
}

/** Icon glyph and color hints for each notification type. Used by the UI. */
export const NOTIFICATION_META: Record<
  NotificationType,
  { icon: string; color: string }
> = {
  deal_advanced:        { icon: "ChevronRight",     color: "#C9A84C" },
  deal_won:             { icon: "Trophy",           color: "#34d399" },
  deal_lost:            { icon: "X",                color: "#f87171" },
  deal_added:           { icon: "Plus",             color: "#a1a1aa" },
  milestone_completed:  { icon: "CheckCircle2",     color: "#34d399" },
  project_created:      { icon: "FileText",         color: "#a78bfa" },
  team_invite_accepted: { icon: "UserCheck",        color: "#34d399" },
  team_member_added:    { icon: "UserPlus",         color: "#60a5fa" },
  daily_signal_sent:    { icon: "Mail",             color: "#C9A84C" },
  daily_signal_failed:  { icon: "AlertTriangle",    color: "#f87171" },
  system:               { icon: "Bell",             color: "#a1a1aa" },
};
