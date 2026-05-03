-- Trial-ending reminder email idempotency
-- Tracks whether the day-12 reminder email has been sent to a user.
-- The cron at /api/emails/trial-reminder filters profiles where this is NULL
-- and sets it to now() after a successful Resend send.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_reminder_sent_at TIMESTAMPTZ;

-- Partial index: only the unsent rows are interesting to the cron.
CREATE INDEX IF NOT EXISTS idx_profiles_trial_reminder_unsent
  ON public.profiles (id)
  WHERE trial_reminder_sent_at IS NULL;

COMMENT ON COLUMN public.profiles.trial_reminder_sent_at IS
  'Timestamp when day-12-of-14 trial-ending reminder email was sent. NULL = not sent.';
