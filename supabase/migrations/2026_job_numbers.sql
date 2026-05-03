-- =============================================================================
-- Signal Strike — Job Number System
-- =============================================================================
-- Adds auto-generated job numbers to deals.
-- Format: YYYY-NNNN (e.g., 2026-0001), scoped per team, resets each year.
-- =============================================================================

-- 1) Add timezone columns ----------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Chicago';

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Chicago';

-- 2) Add job_number column to deals ------------------------------------------

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS job_number TEXT;

-- Unique within a team (different teams can both have 2026-0001 — that's fine)
CREATE UNIQUE INDEX IF NOT EXISTS deals_team_job_number_unique
  ON public.deals (team_id, job_number)
  WHERE job_number IS NOT NULL;

-- 3) Per-team counter columns ------------------------------------------------

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS deal_counter_year  INT NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INT,
  ADD COLUMN IF NOT EXISTS deal_counter_seq   INT NOT NULL DEFAULT 0;

-- 4) The atomic job-number generator -----------------------------------------
--
-- This function is called by the BEFORE INSERT trigger. It locks the team
-- row (FOR UPDATE), checks whether the year has rolled over, increments the
-- counter, and returns the formatted job number. Because the row lock is
-- held until the transaction commits, two simultaneous deal inserts can
-- never get the same number.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_job_number(p_team_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_tz       TEXT;
  v_current_year  INT;
  v_stored_year   INT;
  v_next_seq      INT;
BEGIN
  -- Lock the team row so concurrent inserts serialize on this team
  SELECT timezone, deal_counter_year, deal_counter_seq
    INTO v_team_tz, v_stored_year, v_next_seq
  FROM public.teams
  WHERE id = p_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team % not found when generating job number', p_team_id;
  END IF;

  -- Compute current year in the team's local timezone
  v_current_year := EXTRACT(YEAR FROM (NOW() AT TIME ZONE v_team_tz))::INT;

  -- Year boundary: reset sequence on the first deal of a new year
  IF v_current_year <> v_stored_year THEN
    v_next_seq := 1;
  ELSE
    v_next_seq := v_next_seq + 1;
  END IF;

  -- Persist the new counter state
  UPDATE public.teams
     SET deal_counter_year = v_current_year,
         deal_counter_seq  = v_next_seq
   WHERE id = p_team_id;

  -- Return formatted: 2026-0001
  RETURN v_current_year::TEXT || '-' || LPAD(v_next_seq::TEXT, 4, '0');
END;
$$;

-- 5) Trigger that auto-fills job_number on INSERT ----------------------------

CREATE OR REPLACE FUNCTION public.deals_set_job_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only generate if not already set (allows manual override / backfill)
  IF NEW.job_number IS NULL AND NEW.team_id IS NOT NULL THEN
    NEW.job_number := public.generate_job_number(NEW.team_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_set_job_number ON public.deals;
CREATE TRIGGER trg_deals_set_job_number
  BEFORE INSERT ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.deals_set_job_number();

-- 6) Backfill existing deals -------------------------------------------------
--
-- For any existing deals without a job_number, assign sequential numbers
-- per team based on created_at order, using the team's timezone for year.
-- =============================================================================

DO $$
DECLARE
  r              RECORD;
  v_team_id      UUID;
  v_team_tz      TEXT;
  v_year         INT;
  v_seq          INT;
  v_last_team    UUID := NULL;
BEGIN
  FOR r IN
    SELECT d.id, d.team_id, d.created_at, t.timezone AS team_tz
      FROM public.deals d
      JOIN public.teams t ON t.id = d.team_id
     WHERE d.job_number IS NULL
     ORDER BY d.team_id, d.created_at ASC
  LOOP
    -- Reset counters when we move to a new team
    IF r.team_id IS DISTINCT FROM v_last_team THEN
      v_last_team := r.team_id;
      v_year := NULL;
      v_seq := 0;
    END IF;

    -- Compute year for this deal in its team's timezone
    DECLARE
      deal_year INT := EXTRACT(YEAR FROM (r.created_at AT TIME ZONE r.team_tz))::INT;
    BEGIN
      IF v_year IS NULL OR deal_year <> v_year THEN
        v_year := deal_year;
        v_seq := 1;
      ELSE
        v_seq := v_seq + 1;
      END IF;

      UPDATE public.deals
         SET job_number = v_year::TEXT || '-' || LPAD(v_seq::TEXT, 4, '0')
       WHERE id = r.id;
    END;
  END LOOP;
END;
$$;

-- 7) Update teams.deal_counter_year/seq to match the highest backfilled value
--    so the next NEW deal continues the sequence correctly.
-- =============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT team_id,
           MAX(SUBSTRING(job_number FROM 1 FOR 4)::INT) AS max_year,
           MAX(CASE
                 WHEN SUBSTRING(job_number FROM 1 FOR 4)::INT =
                      (SELECT MAX(SUBSTRING(job_number FROM 1 FOR 4)::INT)
                         FROM public.deals d2
                        WHERE d2.team_id = d.team_id)
                 THEN SUBSTRING(job_number FROM 6)::INT
                 ELSE 0
               END) AS max_seq
      FROM public.deals d
     WHERE job_number IS NOT NULL
     GROUP BY team_id
  LOOP
    UPDATE public.teams
       SET deal_counter_year = r.max_year,
           deal_counter_seq  = r.max_seq
     WHERE id = r.team_id;
  END LOOP;
END;
$$;
