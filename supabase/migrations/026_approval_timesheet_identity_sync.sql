-- 026_approval_timesheet_identity_sync.sql
-- Keep canonical timesheet weeks aligned with graph-based approval subjects.
--
-- Approval subjects use "{graphPersonId}:{weekStart}" while persisted weeks use
-- "{authUserId}:{weekStart}". The old trigger compared those IDs directly,
-- which left rejected/finally-approved weeks stuck in submitted state.

CREATE OR REPLACE FUNCTION public.approval_records_sync_timesheet_week_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_id TEXT;
  v_week_data JSONB;
  v_week_start_text TEXT;
  v_week_start DATE;
  v_submitter_user_id UUID;
  v_approver_user_id UUID;
  v_decision_at TIMESTAMPTZ := COALESCE(NEW.decided_at, NOW());
  v_route_last_layer INTEGER;
  v_canonical_status TEXT;
BEGIN
  IF NEW.subject_type <> 'timesheet' THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('pending', 'approved', 'rejected', 'changes_requested') THEN
    RETURN NEW;
  END IF;

  v_week_start_text := COALESCE(
    NULLIF(NEW.subject_snapshot->>'periodStart', ''),
    substring(NEW.subject_id FROM '([0-9]{4}-[0-9]{2}-[0-9]{2})$')
  );

  IF v_week_start_text IS NOT NULL
     AND v_week_start_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    BEGIN
      v_week_start := v_week_start_text::date;
    EXCEPTION WHEN datetime_field_overflow THEN
      v_week_start := NULL;
    END;
  END IF;

  IF COALESCE(NEW.submitter_user_id, '')
       ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_submitter_user_id := NEW.submitter_user_id::uuid;
  ELSIF COALESCE(NEW.subject_snapshot->>'submitterUserId', '')
       ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_submitter_user_id := (NEW.subject_snapshot->>'submitterUserId')::uuid;
  ELSE
    SELECT candidate.user_id
    INTO v_submitter_user_id
    FROM (
      SELECT members.user_id, 1 AS priority
      FROM public.wg_project_members AS members
      WHERE members.project_id = NEW.project_id
        AND members.graph_node_id = split_part(
          NEW.subject_id,
          ':' || COALESCE(v_week_start_text, ''),
          1
        )
        AND members.user_id IS NOT NULL
        AND members.accepted_at IS NOT NULL

      UNION ALL

      SELECT roster.user_id, 2 AS priority
      FROM public.wg_project_roster AS roster
      WHERE roster.project_id = NEW.project_id
        AND roster.graph_node_id = split_part(
          NEW.subject_id,
          ':' || COALESCE(v_week_start_text, ''),
          1
        )
        AND roster.user_id IS NOT NULL
        AND roster.assignment_status = 'active'
    ) AS candidate
    ORDER BY candidate.priority
    LIMIT 1;
  END IF;

  SELECT weeks.id, COALESCE(weeks.data, '{}'::jsonb)
  INTO v_week_id, v_week_data
  FROM public.wg_timesheet_weeks AS weeks
  WHERE weeks.id = NEW.subject_id
     OR (
       v_submitter_user_id IS NOT NULL
       AND v_week_start IS NOT NULL
       AND weeks.project_id = NEW.project_id
       AND weeks.user_id = v_submitter_user_id
       AND weeks.week_start = v_week_start
     )
  ORDER BY (weeks.id = NEW.subject_id) DESC
  LIMIT 1
  FOR UPDATE;

  IF v_week_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = format(
        'No canonical timesheet week for approval record %s (subject %s)',
        NEW.id,
        NEW.subject_id
      ),
      DETAIL = format(
        'project_id=%s, submitter_user_id=%s, week_start=%s',
        NEW.project_id,
        COALESCE(v_submitter_user_id::text, '<unresolved>'),
        COALESCE(v_week_start::text, '<unresolved>')
      ),
      HINT = 'Persist and identity-map the timesheet week before creating or deciding its approval.';
  END IF;

  IF NEW.status = 'approved' THEN
    IF jsonb_typeof(NEW.subject_snapshot->'approvalRoute') = 'array' THEN
      SELECT MAX((route_step->>'step')::integer)
      INTO v_route_last_layer
      FROM jsonb_array_elements(NEW.subject_snapshot->'approvalRoute') AS route_step
      WHERE COALESCE(route_step->>'step', '') ~ '^[0-9]+$';
    END IF;

    v_canonical_status := CASE
      WHEN v_route_last_layer IS NOT NULL
        AND NEW.approval_layer < v_route_last_layer
      THEN 'submitted'
      ELSE 'approved'
    END;
  ELSIF NEW.status IN ('rejected', 'changes_requested') THEN
    v_canonical_status := 'rejected';
  ELSE
    v_canonical_status := 'submitted';
  END IF;

  IF COALESCE(NEW.approver_user_id, '')
       ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_approver_user_id := NEW.approver_user_id::uuid;
  END IF;

  v_week_data := jsonb_set(v_week_data, '{status}', to_jsonb(v_canonical_status), true);

  IF v_canonical_status = 'approved' THEN
    v_week_data := v_week_data - 'rejectedBy' - 'rejectedAt' - 'rejectionNote';
    v_week_data := jsonb_set(
      v_week_data,
      '{approvedBy}',
      to_jsonb(COALESCE(NEW.approver_name, NEW.approver_user_id)),
      true
    );
    v_week_data := jsonb_set(v_week_data, '{approvedAt}', to_jsonb(v_decision_at::text), true);
  ELSIF v_canonical_status = 'rejected' THEN
    v_week_data := v_week_data - 'approvedBy' - 'approvedAt';
    v_week_data := jsonb_set(
      v_week_data,
      '{rejectedBy}',
      to_jsonb(COALESCE(NEW.approver_name, NEW.approver_user_id)),
      true
    );
    v_week_data := jsonb_set(v_week_data, '{rejectedAt}', to_jsonb(v_decision_at::text), true);
    v_week_data := jsonb_set(
      v_week_data,
      '{rejectionNote}',
      to_jsonb(COALESCE(NEW.notes, '')),
      true
    );
  ELSE
    v_week_data := v_week_data
      - 'approvedBy' - 'approvedAt'
      - 'rejectedBy' - 'rejectedAt' - 'rejectionNote';
  END IF;

  UPDATE public.wg_timesheet_weeks
  SET
    status = v_canonical_status,
    approved_at = CASE WHEN v_canonical_status = 'approved' THEN v_decision_at ELSE NULL END,
    approved_by = CASE WHEN v_canonical_status = 'approved' THEN v_approver_user_id ELSE NULL END,
    data = v_week_data
  WHERE id = v_week_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approval_records_sync_timesheet_week_status
  ON public.approval_records;
CREATE TRIGGER approval_records_sync_timesheet_week_status
  AFTER INSERT OR UPDATE OF status ON public.approval_records
  FOR EACH ROW
  EXECUTE FUNCTION public.approval_records_sync_timesheet_week_status();

-- Repair approvals that were bulk-approved before the client spawned the next
-- layer. Only the newest row for each subject is eligible, which prevents an
-- older approved cycle from advancing after the worker has resubmitted.
WITH latest_by_subject AS (
  SELECT DISTINCT ON (records.project_id, records.subject_type, records.subject_id)
    records.*
  FROM public.approval_records AS records
  WHERE records.subject_type = 'timesheet'
  ORDER BY
    records.project_id,
    records.subject_type,
    records.subject_id,
    records.created_at DESC,
    records.id DESC
), stalled AS (
  SELECT
    latest.*,
    next_route.value AS next_step,
    (next_route.value->>'step')::integer AS next_layer
  FROM latest_by_subject AS latest
  CROSS JOIN LATERAL (
    SELECT route_step.value
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(latest.subject_snapshot->'approvalRoute') = 'array'
        THEN latest.subject_snapshot->'approvalRoute'
        ELSE '[]'::jsonb
      END
    ) AS route_step(value)
    WHERE COALESCE(route_step.value->>'step', '') ~ '^[0-9]+$'
      AND (route_step.value->>'step')::integer > latest.approval_layer
    ORDER BY (route_step.value->>'step')::integer
    LIMIT 1
  ) AS next_route
  WHERE latest.status = 'approved'
    AND jsonb_typeof(latest.subject_snapshot->'approvalRoute') = 'array'
), repairable AS (
  SELECT
    stalled.*,
    mapped_approver.user_id AS mapped_approver_user_id
  FROM stalled
  LEFT JOIN LATERAL (
    SELECT members.user_id
    FROM public.wg_project_members AS members
    WHERE members.project_id = stalled.project_id
      AND members.graph_node_id = stalled.next_step->>'approverUserRef'
      AND members.user_id IS NOT NULL
      AND members.accepted_at IS NOT NULL
    ORDER BY members.accepted_at, members.id
    LIMIT 1
  ) AS mapped_approver ON TRUE
  WHERE EXISTS (
    SELECT 1
    FROM public.wg_timesheet_weeks AS weeks
    WHERE weeks.project_id = stalled.project_id
      AND weeks.user_id::text = stalled.submitter_user_id
      AND weeks.week_start::text = stalled.subject_snapshot->>'periodStart'
  )
    AND NOT EXISTS (
      SELECT 1
      FROM public.approval_records AS existing
      WHERE existing.project_id = stalled.project_id
        AND existing.subject_type = stalled.subject_type
        AND existing.subject_id = stalled.subject_id
        AND existing.approval_layer = stalled.next_layer
        AND existing.status = 'pending'
    )
)
INSERT INTO public.approval_records (
  project_id,
  subject_type,
  subject_id,
  subject_snapshot,
  approver_user_id,
  approver_name,
  approver_node_id,
  approval_layer,
  status,
  submitted_at,
  graph_version_id,
  submitter_user_id
)
SELECT
  repairable.project_id,
  repairable.subject_type,
  repairable.subject_id,
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          repairable.subject_snapshot,
          '{currentApproverName}',
          to_jsonb(repairable.next_step->>'approverName'),
          true
        ),
        '{currentApproverNodeId}',
        to_jsonb(repairable.next_step->>'approverNodeId'),
        true
      ),
      '{currentApproverUserRef}',
      to_jsonb(repairable.next_step->>'approverUserRef'),
      true
    ),
    '{approvalLayer}',
    to_jsonb(repairable.next_layer),
    true
  ),
  COALESCE(
    repairable.mapped_approver_user_id::text,
    repairable.next_step->>'approverUserRef',
    repairable.next_step->>'approverNodeId'
  ),
  COALESCE(
    repairable.next_step->>'approverName',
    repairable.next_step->>'partyName',
    'Next approver'
  ),
  repairable.next_step->>'approverNodeId',
  repairable.next_layer,
  'pending',
  COALESCE(repairable.decided_at, NOW()),
  repairable.graph_version_id,
  repairable.submitter_user_id
FROM repairable;

-- Re-run the new trigger for the latest approval in every mapped timesheet.
-- Setting status to itself is intentional; the progression guard accepts it.
WITH latest_mapped AS (
  SELECT DISTINCT ON (records.project_id, records.subject_type, records.subject_id)
    records.id
  FROM public.approval_records AS records
  JOIN public.wg_timesheet_weeks AS weeks
    ON weeks.project_id = records.project_id
   AND weeks.user_id::text = records.submitter_user_id
   AND weeks.week_start::text = records.subject_snapshot->>'periodStart'
  WHERE records.subject_type = 'timesheet'
    AND COALESCE(records.subject_snapshot->>'periodStart', '')
      ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ORDER BY
    records.project_id,
    records.subject_type,
    records.subject_id,
    records.created_at DESC,
    records.id DESC
)
UPDATE public.approval_records AS records
SET status = records.status
FROM latest_mapped
WHERE records.id = latest_mapped.id;

REVOKE EXECUTE ON FUNCTION public.approval_records_sync_timesheet_week_status()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.approval_records_sync_timesheet_week_status() IS
  'Synchronizes graph-subject approvals to canonical auth-user timesheet weeks across pending, rejection, and final approval states.';
