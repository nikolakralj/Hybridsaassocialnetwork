-- ============================================================================
-- Migration 009: approval_records -> wg_timesheet_weeks metadata sync
-- Purpose:
--   Extend the state-integrity trigger so terminal approval decisions update
--   canonical week metadata as well as status.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.approval_records') IS NULL THEN
    RAISE EXCEPTION 'Missing dependency: public.approval_records must exist before migration 009.';
  END IF;

  IF to_regclass('public.wg_timesheet_weeks') IS NULL THEN
    RAISE EXCEPTION 'Missing dependency: public.wg_timesheet_weeks must exist before migration 009.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION approval_records_sync_timesheet_week_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  week_exists BOOLEAN;
  decision_at TIMESTAMPTZ := COALESCE(NEW.decided_at, NOW());
  approver_uuid UUID;
  next_data JSONB;
BEGIN
  IF NEW.subject_type <> 'timesheet' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

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

  approver_uuid := CASE
    WHEN NEW.approver_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN NEW.approver_user_id::uuid
    ELSE NULL
  END;

  SELECT COALESCE(data, '{}'::jsonb)
  INTO next_data
  FROM wg_timesheet_weeks
  WHERE id = NEW.subject_id
  FOR UPDATE;

  next_data := jsonb_set(next_data, '{status}', to_jsonb(NEW.status), true);

  IF NEW.status = 'approved' THEN
    next_data := next_data - 'rejectedBy' - 'rejectedAt' - 'rejectionNote';
    next_data := jsonb_set(next_data, '{approvedBy}', to_jsonb(COALESCE(NEW.approver_name, NEW.approver_user_id)), true);
    next_data := jsonb_set(next_data, '{approvedAt}', to_jsonb(decision_at::text), true);
  ELSE
    next_data := next_data - 'approvedBy' - 'approvedAt';
    next_data := jsonb_set(next_data, '{rejectedBy}', to_jsonb(COALESCE(NEW.approver_name, NEW.approver_user_id)), true);
    next_data := jsonb_set(next_data, '{rejectedAt}', to_jsonb(decision_at::text), true);
    next_data := jsonb_set(next_data, '{rejectionNote}', to_jsonb(COALESCE(NEW.notes, '')), true);
  END IF;

  UPDATE wg_timesheet_weeks
  SET
    status = NEW.status,
    approved_at = CASE
      WHEN NEW.status = 'approved' THEN decision_at
      ELSE NULL
    END,
    approved_by = CASE
      WHEN NEW.status = 'approved' THEN approver_uuid
      ELSE NULL
    END,
    data = next_data
  WHERE id = NEW.subject_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approval_records_sync_timesheet_week_status ON approval_records;
CREATE TRIGGER approval_records_sync_timesheet_week_status
  AFTER INSERT OR UPDATE OF status ON approval_records
  FOR EACH ROW
  EXECUTE FUNCTION approval_records_sync_timesheet_week_status();
