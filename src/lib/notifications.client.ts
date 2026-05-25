/**
 * CLIENT-SIDE notification helpers.
 *
 * Use these in React components. Uses the anon key + RLS — users can only
 * read/update their own notifications.
 *
 * For writing notifications (insert), use src/lib/notifications.server.ts
 * from server-side code only. Client-side inserts are blocked by RLS.
 */

import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/types/notifications";

/** Fetch the user's recent notifications, newest first. */
export async function listNotifications(limit = 30): Promise<Notification[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[notifications] list failed:", error.message);
    return [];
  }
  return (data ?? []) as Notification[];
}

/** Return the number of unread notifications for the current user. */
export async function getUnreadCount(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("read", false);

  if (error) {
    console.error("[notifications] count failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Mark a single notification as read. */
export async function markRead(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[notifications] markRead failed:", error.message);
    return false;
  }
  return true;
}

/** Mark ALL of the current user's unread notifications as read. */
export async function markAllRead(): Promise<number> {
  const supabase = createClient();
  const nowIso = new Date().toISOString();
  const { count, error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: nowIso }, { count: "exact" })
    .eq("read", false);

  if (error) {
    console.error("[notifications] markAllRead failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Permanently delete a notification. */
export async function deleteNotification(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[notifications] delete failed:", error.message);
    return false;
  }
  return true;
}
