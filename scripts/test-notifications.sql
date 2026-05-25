-- Insert test notifications for Doug's Signal Strike account.
-- Run this in Supabase SQL Editor → New query → paste → Run.
-- Doug's user ID: 1907e6dd-230e-4f5d-a3e4-a1895612bffb (doug@scopeworx.com)

INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
  ('1907e6dd-230e-4f5d-a3e4-a1895612bffb', 'deal_won', 'Deal Won', 'Big Yymers closed for $2.51M', '/deals'),
  ('1907e6dd-230e-4f5d-a3e4-a1895612bffb', 'milestone_completed', 'Milestone completed', 'Site survey complete on KC-25-1628', '/projects'),
  ('1907e6dd-230e-4f5d-a3e4-a1895612bffb', 'team_member_added', 'New team member', 'Sarah Mitchell joined your team', '/team'),
  ('1907e6dd-230e-4f5d-a3e4-a1895612bffb', 'daily_signal_sent', 'Daily Signal delivered', 'Your morning briefing has been sent', null);

-- Verify:
-- SELECT count(*) FROM public.notifications WHERE user_id = '1907e6dd-230e-4f5d-a3e4-a1895612bffb';
-- Expected: 4 (or however many you've run this script — it's additive, not idempotent)

-- Clean up:
-- DELETE FROM public.notifications WHERE user_id = '1907e6dd-230e-4f5d-a3e4-a1895612bffb';
