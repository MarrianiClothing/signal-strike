
-- Add manager_id to profiles so we can link members to their manager
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add role column to team_members if not present (owner | manager | member)
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';

-- ── RLS: Managers can see their direct reports' deals ──────────────────────
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Users always see their own deals
DROP POLICY IF EXISTS "deals_own" ON deals;
CREATE POLICY "deals_own" ON deals
  FOR ALL USING (auth.uid() = user_id);

-- Managers see deals of users where manager_id = auth.uid()
DROP POLICY IF EXISTS "deals_manager_read" ON deals;
CREATE POLICY "deals_manager_read" ON deals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = deals.user_id
        AND profiles.manager_id = auth.uid()
    )
  );

-- ── RLS: Managers can see their direct reports' expenses ──────────────────
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_own" ON expenses;
CREATE POLICY "expenses_own" ON expenses
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "expenses_manager_read" ON expenses;
CREATE POLICY "expenses_manager_read" ON expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = expenses.user_id
        AND profiles.manager_id = auth.uid()
    )
  );

-- ── RLS: Managers can see their direct reports' projects ──────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_own" ON projects;
CREATE POLICY "projects_own" ON projects
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_manager_read" ON projects;
CREATE POLICY "projects_manager_read" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = projects.user_id
        AND profiles.manager_id = auth.uid()
    )
  );
