-- 040: An approved timesheet stays approved.
--
-- Migration 034 rejects hour edits and a return to draft. created_at was not
-- in that comparison, so a session could still rewrite it. The same lock
-- applies to authenticated, anon, and service_role. Only the approval RPCs,
-- which set wg.approval_write and do not run as those roles, may move a week
-- into approved.

BEGIN;

CREATE OR REPLACE FUNCTION public.wg_guard_timesheet_week()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  -- Trusted only inside the approval RPCs: they set the flag and run as the
  -- function owner. A client role cannot set the flag and pass as trusted.
  v_trusted boolean := coalesce(current_setting('wg.approval_write', true), '') = 'on'
    AND current_user NOT IN ('authenticated', 'anon', 'service_role');
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('submitted', 'approved') AND NOT v_trusted THEN
      RAISE EXCEPTION 'A % timesheet cannot be deleted.', OLD.status USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF v_trusted THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- INSERT ... ON CONFLICT on an existing row: the UPDATE branch decides.
    IF EXISTS (SELECT 1 FROM wg_timesheet_weeks w WHERE w.id = NEW.id) THEN
      RETURN NEW;
    END IF;
    IF NEW.status <> 'draft'
       OR NEW.approved_at IS NOT NULL
       OR NEW.approved_by IS NOT NULL
       OR NEW.submitted_at IS NOT NULL THEN
      RAISE EXCEPTION 'New timesheets start as drafts. Submit them through the approval workflow.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.week_start IS DISTINCT FROM OLD.week_start THEN
    RAISE EXCEPTION 'The owner and week of a timesheet cannot change.' USING ERRCODE = '42501';
  END IF;

  IF OLD.status = 'approved' THEN
    -- total_hours is a generated column (not yet computed in a BEFORE trigger);
    -- it derives from data, which is compared here.
    IF (NEW.status, NEW.data, NEW.approved_at, NEW.approved_by, NEW.submitted_at, NEW.project_id, NEW.created_at)
       IS DISTINCT FROM
       (OLD.status, OLD.data, OLD.approved_at, OLD.approved_by, OLD.submitted_at, OLD.project_id, OLD.created_at) THEN
      RAISE EXCEPTION 'Approved timesheets are locked.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'rejected' AND NEW.status = 'draft') THEN
    RAISE EXCEPTION 'Timesheet status changes go through the approval workflow.' USING ERRCODE = '42501';
  END IF;

  IF (NEW.approved_at IS DISTINCT FROM OLD.approved_at AND NEW.approved_at IS NOT NULL)
     OR (NEW.approved_by IS DISTINCT FROM OLD.approved_by AND NEW.approved_by IS NOT NULL)
     OR (NEW.submitted_at IS DISTINCT FROM OLD.submitted_at AND NEW.submitted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Approval dates are set by the approval workflow.' USING ERRCODE = '42501';
  END IF;

  IF OLD.status = 'submitted' AND (
       (NEW.data->'days') IS DISTINCT FROM (OLD.data->'days')
       OR (NEW.data->'totalHours') IS DISTINCT FROM (OLD.data->'totalHours')
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
     ) THEN
    RAISE EXCEPTION 'Submitted timesheets are locked while they are being approved. Recall the week to edit it.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS wg_guard_timesheet_week ON public.wg_timesheet_weeks;
CREATE TRIGGER wg_guard_timesheet_week
  BEFORE INSERT OR UPDATE OR DELETE ON public.wg_timesheet_weeks
  FOR EACH ROW EXECUTE FUNCTION public.wg_guard_timesheet_week();

COMMIT;
