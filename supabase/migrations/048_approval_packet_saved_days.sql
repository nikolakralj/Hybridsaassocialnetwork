-- Draft: normalize the daily decision packet from the saved week, not p_snapshot.
-- Separate trigger so this does not replace the RPC/redaction work in 037/038.
BEGIN;

CREATE OR REPLACE FUNCTION public.wg_approval_packet_saved_days()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_week public.wg_timesheet_weeks%ROWTYPE;
  v_days jsonb;
  v_summary jsonb;
BEGIN
  IF NEW.subject_type <> 'timesheet' THEN
    RETURN NEW;
  END IF;
  IF NOT public.wg_is_uuid_text(NEW.submitter_user_id) THEN
    RAISE EXCEPTION 'A timesheet decision packet requires a linked submitter.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_week FROM public.wg_timesheet_weeks
  WHERE project_id = NEW.project_id
    AND user_id = NEW.submitter_user_id::uuid
    AND week_start = public.wg_week_start_of_subject(NEW.subject_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The saved week for this timesheet decision packet is missing.' USING ERRCODE = '23514';
  END IF;

  v_days := CASE WHEN jsonb_typeof(v_week.data->'days') = 'array'
    THEN v_week.data->'days' ELSE '[]'::jsonb END;
  SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'day', d->>'day',
    'hours', coalesce(public.wg_safe_numeric(d->>'totalHours'), public.wg_safe_numeric(d->>'hours'), 0),
    'notes', d->>'notes'
  )) ORDER BY ord), '[]'::jsonb) INTO v_summary
  FROM jsonb_array_elements(v_days) WITH ORDINALITY AS day_rows(d, ord);

  -- Billable hours have no authoritative stored aggregate yet. Leave them
  -- unknown instead of retaining a second caller-supplied hours claim.
  NEW.subject_snapshot := (
    CASE WHEN jsonb_typeof(NEW.subject_snapshot) = 'object'
      THEN NEW.subject_snapshot ELSE '{}'::jsonb END
    - 'billableHours'
  ) || jsonb_build_object(
    'hours', v_week.total_hours,
    'periodStart', v_week.week_start,
    'periodEnd', v_week.week_start + 6,
    'daySummary', v_summary
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.wg_approval_packet_saved_days() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS wg_approval_packet_saved_days ON public.approval_records;
CREATE TRIGGER wg_approval_packet_saved_days
  BEFORE INSERT ON public.approval_records
  FOR EACH ROW EXECUTE FUNCTION public.wg_approval_packet_saved_days();

COMMIT;
