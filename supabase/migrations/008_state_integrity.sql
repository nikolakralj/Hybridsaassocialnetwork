-- ============================================================================
-- Migration 008: approval/state integrity hardening
-- Purpose:
--   1) Keep approval_records -> wg_timesheet_weeks terminal status in sync.
--   2) Prevent approval_records status from moving backward.
--   3) Prevent duplicate pending approvals per subject/layer.
--
-- Assumptions:
--   - Migration 005 already created wg_timesheet_weeks.
--   - Migration 007 already created approval_records.
--   - For subject_type='timesheet', approval_records.subject_id maps to
--     wg_timesheet_weeks.id (both TEXT IDs).
-- ============================================================================

-- Guardrail: fail early with a clear error if dependencies are missing.
DO $$
BEGIN
  IF to_regclass('public.approval_records') IS NULL THEN
    RAISE EXCEPTION 'Missing dependency: public.approval_records must exist before migration 008.';
  END IF;

  IF to_regclass('public.wg_timesheet_weeks') IS NULL THEN
    RAISE EXCEPTION 'Missing dependency: public.wg_timesheet_weeks must exist before migration 008.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1) Enforce monotonic status progression on approval_records
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION approval_records_enforce_status_progression()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_rank INTEGER;
  new_rank INTEGER;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Progression model:
  -- pending (10) -> changes_requested (20) -> approved/rejected (30).
  -- approved/rejected are terminal and cannot transition again.
  old_rank := CASE OLD.status
    WHEN 'pending' THEN 10
    WHEN 'changes_requested' THEN 20
    WHEN 'approved' THEN 30
    WHEN 'rejected' THEN 30
    ELSE 0
  END;

  new_rank := CASE NEW.status
    WHEN 'pending' THEN 10
    WHEN 'changes_requested' THEN 20
    WHEN 'approved' THEN 30
    WHEN 'rejected' THEN 30
    ELSE 0
  END;

  IF OLD.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format(
        'Invalid approval_records status transition for id=%s: %s -> %s',
        OLD.id, OLD.status, NEW.status
      ),
      HINT = 'approved/rejected are terminal; create a new approval_records row for a new review cycle.';
  END IF;

  IF new_rank < old_rank THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format(
        'Backward approval_records status transition for id=%s: %s -> %s',
        OLD.id, OLD.status, NEW.status
      ),
      HINT = 'Status progression must be monotonic.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approval_records_status_progression_guard ON approval_records;
CREATE TRIGGER approval_records_status_progression_guard
  BEFORE UPDATE OF status ON approval_records
  FOR EACH ROW
  EXECUTE FUNCTION approval_records_enforce_status_progression();

COMMENT ON FUNCTION approval_records_enforce_status_progression() IS
  'Prevents backward or terminal-to-anything status transitions on approval_records.';

-- ----------------------------------------------------------------------------
-- 2) Canonical week status sync: approval_records -> wg_timesheet_weeks
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION approval_records_sync_timesheet_week_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  week_exists BOOLEAN;
BEGIN
  -- Scope this sync to timesheet subjects only.
  IF NEW.subject_type <> 'timesheet' THEN
    RETURN NEW;
  END IF;

  -- UPDATE trigger optimization: ignore updates that do not change status.
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Only terminal decisions map to wg_timesheet_weeks canonical status.
  IF NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  -- Important integrity assumption: subject_id must resolve to a week row.
  -- If missing, raise and rollback the whole transaction so states cannot diverge.
  --
  -- SECURITY DEFINER is intentional: this trigger must be able to update
  -- wg_timesheet_weeks even when the caller's RLS policy on that table is read-only.
  SELECT EXISTS (
    SELECT 1
    FROM wg_timesheet_weeks
    WHERE id = NEW.subject_id
  ) INTO week_exists;

  IF NOT week_exists THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = format(
        'No wg_timesheet_weeks row for approval_records subject_id=%s',
        NEW.subject_id
      ),
      DETAIL = format(
        'approval_records.id=%s, subject_type=%s, status=%s',
        NEW.id, NEW.subject_type, NEW.status
      ),
      HINT = 'Create/fix wg_timesheet_weeks row before setting approval_records to approved/rejected.';
  END IF;

  UPDATE wg_timesheet_weeks
  SET
    status = NEW.status,
    approved_at = CASE
      WHEN NEW.status = 'approved' THEN COALESCE(approved_at, NEW.decided_at, NOW())
      ELSE NULL
    END
  WHERE id = NEW.subject_id
    AND (
      status IS DISTINCT FROM NEW.status
      OR (NEW.status = 'approved' AND approved_at IS NULL)
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approval_records_sync_timesheet_week_status ON approval_records;
CREATE TRIGGER approval_records_sync_timesheet_week_status
  AFTER INSERT OR UPDATE OF status ON approval_records
  FOR EACH ROW
  EXECUTE FUNCTION approval_records_sync_timesheet_week_status();

COMMENT ON FUNCTION approval_records_sync_timesheet_week_status() IS
  'Atomically syncs timesheet approval terminal statuses into wg_timesheet_weeks.';

-- ----------------------------------------------------------------------------
-- 3) Prevent duplicate pending approvals per (subject_type, subject_id, layer)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.ux_approval_records_pending_subject_layer') IS NULL THEN
    -- Safety-first: do not mutate historical rows automatically.
    -- If duplicates exist, stop here so cleanup can be explicit.
    IF EXISTS (
      SELECT 1
      FROM approval_records
      WHERE status = 'pending'
      GROUP BY subject_type, subject_id, approval_layer
      HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'Cannot create pending-uniqueness index: duplicate pending approval_records already exist.',
        HINT = 'Deduplicate pending rows per (subject_type, subject_id, approval_layer), then rerun migration 008.';
    END IF;

    CREATE UNIQUE INDEX ux_approval_records_pending_subject_layer
      ON approval_records(subject_type, subject_id, approval_layer)
      WHERE status = 'pending';
  END IF;
END $$;
