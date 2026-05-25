/**
 * SERVER-SIDE notification helpers.
 *
 * Use these from API routes / server actions / cron handlers to write
 * notifications. They use the service role key and bypass RLS.
 *
 * DO NOT import this from client components. Use src/lib/notifications.client.ts.
 */

import { createClient } from "@supabase/supabase-js";
import type { NotificationType } from "@/types/notifications";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a notification for a single user.
 * Returns the created notification id on success, or null on failure (logs error).
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<string | null> {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id:  input.userId,
      type:     input.type,
      title:    input.title,
      body:     input.body ?? null,
      link:     input.link ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("[notifications] insert failed:", error.message);
    return null;
  }
  return data?.id ?? null;
}

/**
 * Create the same notification for multiple users (e.g. team-wide announcement).
 * Returns the count of successful inserts.
 */
export async function createNotificationForUsers(
  userIds: string[],
  payload: Omit<CreateNotificationInput, "userId">
): Promise<number> {
  if (!userIds.length) return 0;

  const rows = userIds.map(userId => ({
    user_id:  userId,
    type:     payload.type,
    title:    payload.title,
    body:     payload.body ?? null,
    link:     payload.link ?? null,
    metadata: payload.metadata ?? {},
  }));

  const { error, count } = await supabase
    .from("notifications")
    .insert(rows, { count: "exact" });

  if (error) {
    console.error("[notifications] bulk insert failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Manually trigger cleanup of notifications older than 30 days. */
export async function cleanupOldNotifications(): Promise<void> {
  const { error } = await supabase.rpc("cleanup_old_notifications");
  if (error) {
    console.error("[notifications] cleanup failed:", error.message);
  }
}
