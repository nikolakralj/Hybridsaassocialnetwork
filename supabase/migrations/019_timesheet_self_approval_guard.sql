-- 019_timesheet_self_approval_guard.sql
-- Trust Core hardening.
--
-- Browser clients own their draft/submission rows, but they must not be able to
-- approve/reject their own timesheets or spoof approval metadata through direct
-- Supabase writes. Server-side approval sync runs with service credentials and
-- is allowed because auth.uid() is not the submitting user in that context.

DO $$
BEGIN
  IF to_regclass('public.wg_timesheet_weeks') IS NULL THEN
    RAISE EXCEPTION 'Missing dependency: public.wg_timesheet_weeks must exist before migration 019.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION wg_prevent_timesheet_self_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
BEGIN
  IF v_actor_id IS NULL OR NEW.user_id IS DISTINCT FROM v_actor_id THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Users cannot approve or reject their own timesheets.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.approved_at IS NOT NULL OR NEW.approved_by IS NOT NULL THEN
      RAISE EXCEPTION 'Users cannot modify approval metadata on their own timesheets.'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
      RAISE EXCEPTION 'Users cannot modify approval metadata on their own timesheets.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wg_timesheet_self_approval_guard ON wg_timesheet_weeks;
CREATE TRIGGER wg_timesheet_self_approval_guard
  BEFORE INSERT OR UPDATE ON wg_timesheet_weeks
  FOR EACH ROW
  EXECUTE FUNCTION wg_prevent_timesheet_self_approval();

COMMENT ON FUNCTION wg_prevent_timesheet_self_approval() IS
  'Blocks user-session attempts to self-approve/self-reject timesheet rows or spoof approval metadata.';
