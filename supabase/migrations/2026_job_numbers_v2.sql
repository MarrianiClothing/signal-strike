-- =============================================================================
-- Signal Strike — Job Number System (v2)
-- =============================================================================
-- Schema-aware version. Counter lives on profiles (sequence owner).
-- Sequence owner = COALESCE(profiles.manager_id, profiles.id).
-- =============================================================================

-- 1) Ensure profiles.timezone has a sensible default (column already exists) --

ALTER TABLE public.profiles
  ALTER COLUMN timezone SET DEFAULT 'America/Chicago';

UPDATE public.profiles
   SET timezone = 'America/Chicago'
 WHERE timezone IS NULL OR timezone = '';

ALTER TABLE public.profiles
  ALTER COLUMN timezone SET NOT NULL;

-- 2) Add counter columns to profiles -----------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deal_counter_year INT NOT NULL
    DEFAULT EXTRACT(YEAR FROM NOW())::INT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deal_counter_seq INT NOT NULL DEFAULT 0;

-- 3) Add job_number + sequence_owner_id to deals -----------------------------

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS job_number TEXT;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS sequence_owner_id UUID REFERENCES public.profiles(id);

-- Unique within a sequence owner. Different sequence owners can each have
-- their own 2026-0001, 2026-0002, ...
CREATE UNIQUE INDEX IF NOT EXISTS deals_seqowner_jobnum_unique
  ON public.deals (sequence_owner_id, job_number)
  WHERE job_number IS NOT NULL;

-- 4) Helper: resolve the sequence owner for a given user ---------------------
--    Solo users own their own sequence; reps share their manager's.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sequence_owner_for_user(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(manager_id, id)
    FROM public.profiles
   WHERE id = p_user_id;
$$;

-- 5) Atomic job-number generator ---------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_job_number(p_user_id UUID)
RETURNS TABLE(out_job_number TEXT, out_sequence_owner_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id      UUID;
  v_owner_tz      TEXT;
  v_current_year  INT;
  v_stored_year   INT;
  v_next_seq      INT;
BEGIN
  -- Resolve sequence owner
  v_owner_id := public.sequence_owner_for_user(p_user_id);

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Could not resolve sequence owner for user %', p_user_id;
  END IF;

  -- Lock the owner's profile row so concurrent inserts queue up
  SELECT timezone, deal_counter_year, deal_counter_seq
    INTO v_owner_tz, v_stored_year, v_next_seq
    FROM public.profiles
   WHERE id = v_owner_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sequence owner profile % not found', v_owner_id;
  END IF;

  -- Year in the owner's timezone (handles year boundary correctly)
  v_current_year := EXTRACT(YEAR FROM (NOW() AT TIME ZONE v_owner_tz))::INT;

  IF v_current_year <> v_stored_year THEN
    v_next_seq := 1;
  ELSE
    v_next_seq := v_next_seq + 1;
  END IF;

  -- Persist
  UPDATE public.profiles
     SET deal_counter_year = v_current_year,
         deal_counter_seq  = v_next_seq
   WHERE id = v_owner_id;

  out_job_number := v_current_year::TEXT || '-' || LPAD(v_next_seq::TEXT, 4, '0');
  out_sequence_owner_id := v_owner_id;
  RETURN NEXT;
END;
$$;

-- 6) BEFORE INSERT trigger that fills both columns ---------------------------

CREATE OR REPLACE FUNCTION public.deals_set_job_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_result RECORD;
BEGIN
  IF NEW.job_number IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT * INTO v_result FROM public.generate_job_number(NEW.user_id);
    NEW.job_number := v_result.out_job_number;
    NEW.sequence_owner_id := v_result.out_sequence_owner_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_set_job_number ON public.deals;
CREATE TRIGGER trg_deals_set_job_number
  BEFORE INSERT ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.deals_set_job_number();

-- 7) Backfill existing deals -------------------------------------------------
--    Group by sequence owner, order by created_at ascending, assign year-
--    scoped numbers using the owner's timezone.
-- =============================================================================

DO $$
DECLARE
  r              RECORD;
  v_owner_id     UUID;
  v_owner_tz     TEXT;
  v_year         INT;
  v_seq          INT;
  v_last_owner   UUID := NULL;
  v_last_year    INT  := NULL;
  v_deal_year    INT;
BEGIN
  FOR r IN
    WITH deal_owners AS (
      SELECT d.id           AS deal_id,
             d.user_id,
             d.created_at,
             public.sequence_owner_for_user(d.user_id) AS owner_id
        FROM public.deals d
       WHERE d.job_number IS NULL
    )
    SELECT do.deal_id,
           do.owner_id,
           do.created_at,
           p.timezone AS owner_tz
      FROM deal_owners do
      JOIN public.profiles p ON p.id = do.owner_id
     ORDER BY do.owner_id, do.created_at ASC
  LOOP
    -- Reset when sequence owner changes
    IF r.owner_id IS DISTINCT FROM v_last_owner THEN
      v_last_owner := r.owner_id;
      v_last_year  := NULL;
      v_seq        := 0;
    END IF;

    v_deal_year := EXTRACT(YEAR FROM (r.created_at AT TIME ZONE r.owner_tz))::INT;

    IF v_last_year IS NULL OR v_deal_year <> v_last_year THEN
      v_last_year := v_deal_year;
      v_seq := 1;
    ELSE
      v_seq := v_seq + 1;
    END IF;

    UPDATE public.deals
       SET job_number = v_deal_year::TEXT || '-' || LPAD(v_seq::TEXT, 4, '0'),
           sequence_owner_id = r.owner_id
     WHERE id = r.deal_id;
  END LOOP;
END;
$$;

-- 8) Sync each profile's counter to the highest backfilled value -------------
--    so the next NEW deal continues correctly.
-- =============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      sequence_owner_id AS owner_id,
      MAX(SUBSTRING(job_number FROM 1 FOR 4)::INT) AS max_year_seen
    FROM public.deals
    WHERE job_number IS NOT NULL AND sequence_owner_id IS NOT NULL
    GROUP BY sequence_owner_id
  LOOP
    -- Find max seq within the latest year for this owner
    UPDATE public.profiles p
       SET deal_counter_year = r.max_year_seen,
           deal_counter_seq = (
             SELECT COALESCE(MAX(SUBSTRING(d.job_number FROM 6)::INT), 0)
               FROM public.deals d
              WHERE d.sequence_owner_id = r.owner_id
                AND SUBSTRING(d.job_number FROM 1 FOR 4)::INT = r.max_year_seen
           )
     WHERE p.id = r.owner_id;
  END LOOP;
END;
$$;

-- 9) Cleanup: drop unused teams.timezone if it was added by the failed v1 ----
--    (harmless if it was never created)
-- =============================================================================

ALTER TABLE public.teams DROP COLUMN IF EXISTS timezone;
