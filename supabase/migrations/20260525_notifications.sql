-- ============================================================================
-- 20260525_notifications.sql
-- Notifications system for Signal Strike
-- ============================================================================

-- Type enum
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'deal_advanced',
    'deal_won',
    'deal_lost',
    'deal_added',
    'milestone_completed',
    'project_created',
    'team_invite_accepted',
    'team_member_added',
    'daily_signal_sent',
    'daily_signal_failed',
    'system'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,                       -- optional deep-link, e.g. "/deals/abc-123"
  metadata    JSONB DEFAULT '{}'::jsonb,  -- structured data for future use
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at     TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only update their own notifications (e.g. marking read)
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own notifications
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- INSERTs come from server-side code using the service role key (bypasses RLS).
-- No INSERT policy is needed — client-side inserts are intentionally blocked.

-- Cleanup function: remove notifications older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Realtime: enable on this table so clients can subscribe to changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================================================
-- Verification queries (run these manually to confirm setup):
--   SELECT * FROM public.notifications LIMIT 1;
--   SELECT typname FROM pg_type WHERE typname = 'notification_type';
--   SELECT * FROM pg_policies WHERE tablename = 'notifications';
-- ============================================================================
