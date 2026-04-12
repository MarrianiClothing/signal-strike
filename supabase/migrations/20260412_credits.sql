-- Credit wallet for commercial Signal Strike subscribers
-- Run this in Supabase SQL editor

-- Credits table: one row per user, tracks their balance
CREATE TABLE IF NOT EXISTS credits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance      integer NOT NULL DEFAULT 0,
  total_purchased integer NOT NULL DEFAULT 0,
  total_used   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Credit transactions: audit log of every purchase and deduction
CREATE TABLE IF NOT EXISTS credit_transactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type           text NOT NULL CHECK (type IN ('purchase', 'deduction')),
  amount         integer NOT NULL,
  description    text,
  stripe_session_id text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Internal users: these accounts bypass credit checks entirely
-- Add your user ID and your teammates' IDs here
CREATE TABLE IF NOT EXISTS internal_users (
  user_id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: users can only see their own records
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credits_own" ON credits FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "transactions_own" ON credit_transactions FOR ALL USING (auth.uid() = user_id);

-- Internal users table is service-role only (no RLS needed for client)
ALTER TABLE internal_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal_service_only" ON internal_users FOR ALL USING (false);
