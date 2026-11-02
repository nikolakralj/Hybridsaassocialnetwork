-- 038: The next approver is resolved from the full project graph.
--
-- wg_decide_approval used to fall back to subject_snapshot.approvalRoute when
-- the current approver node was not a party id on the server route. A short
-- snapshot, built from the submitter's or the previous approver's scoped
-- graph, then marked the week approved while an upstream party still existed.
-- The snapshot is no longer consulted. An empty server route refuses to
-- approve rather than treating the chain as finished.

BEGIN;

CREATE OR REPLACE FUNCTION public.wg_decide_approval(
  p_approval_id text,
  p_decision text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rec approval_records%ROWTYPE;
  v_new approval_records%ROWTYPE;
  v_has_new boolean := false;
  v_route jsonb := '[]'::jsonb;
  v_next jsonb;
  v_position integer;
  v_week_start date;
  v_week_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to decide an approval.' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected', 'changes_requested') THEN
    RAISE EXCEPTION 'Unknown decision %.', p_decision USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_rec FROM approval_records WHERE id = p_approval_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_rec.status <> 'pending' THEN
    RAISE EXCEPTION 'This approval is already %.', v_rec.status USING ERRCODE = '22023';
  END IF;
  IF v_rec.submitter_user_id = v_uid::text THEN
    RAISE EXCEPTION 'You cannot approve your own submission.' USING ERRCODE = '42501';
  END IF;
  IF v_rec.approver_user_id IS DISTINCT FROM v_uid::text THEN
    RAISE EXCEPTION 'Only the assigned approver can decide this step.' USING ERRCODE = '42501';
  END IF;

  UPDATE approval_records
  SET status = p_decision, decided_at = now(), notes = p_notes, updated_at = now()
  WHERE id = v_rec.id
  RETURNING * INTO v_rec;

  IF v_rec.subject_type <> 'timesheet' THEN
    RETURN jsonb_build_object('approval', to_jsonb(v_rec), 'next', NULL, 'weekStatus', NULL);
  END IF;

  v_week_start := wg_week_start_of_subject(v_rec.subject_id);

  IF p_decision = 'approved' THEN
    IF wg_is_uuid_text(v_rec.submitter_user_id) THEN
      v_route := wg_compute_timesheet_route(v_rec.project_id, v_rec.submitter_user_id::uuid);
    END IF;

    IF jsonb_array_length(COALESCE(v_route, '[]'::jsonb)) = 0 THEN
      RAISE EXCEPTION 'The approval route could not be resolved from the project graph, so this week was not marked approved.'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT (s->>'step')::integer INTO v_position
    FROM jsonb_array_elements(v_route) s
    WHERE s->>'partyId' = v_rec.approver_node_id
    LIMIT 1;

    IF v_position IS NOT NULL THEN
      SELECT s INTO v_next
      FROM jsonb_array_elements(v_route) s
      WHERE (s->>'step')::integer = v_position + 1;
    ELSE
      -- The stored snapshot may be short because it was built from whatever
      -- the previous caller could see. Never finish the chain from that
      -- snapshot. The next step is the next step of the full server route.
      SELECT s INTO v_next
      FROM jsonb_array_elements(v_route) s
      WHERE (s->>'step')::integer > v_rec.approval_layer
      ORDER BY (s->>'step')::integer
      LIMIT 1;
    END IF;

    IF v_next IS NOT NULL THEN
      INSERT INTO approval_records (
        project_id, subject_type, subject_id, subject_snapshot,
        approver_user_id, approver_name, approver_node_id,
        approval_layer, status, submitted_at, graph_version_id, submitter_user_id
      ) VALUES (
        v_rec.project_id, v_rec.subject_type, v_rec.subject_id,
        coalesce(v_rec.subject_snapshot, '{}'::jsonb) || jsonb_build_object(
          'approvalLayer', v_rec.approval_layer + 1,
          'approvalRoute', v_route,
          'currentApproverName', v_next->>'approverName',
          'currentApproverNodeId', v_next->>'approverNodeId',
          'currentApproverUserRef', v_next->>'approverUserRef'
        ),
        CASE WHEN wg_is_uuid_text(v_next->>'approverUserId') THEN v_next->>'approverUserId'
             ELSE coalesce(v_next->>'approverUserRef', v_next->>'approverNodeId') END,
        v_next->>'approverName',
        v_next->>'approverNodeId',
        v_rec.approval_layer + 1, 'pending', now(), v_rec.graph_version_id, v_rec.submitter_user_id
      )
      RETURNING * INTO v_new;
      v_has_new := true;
      v_week_status := 'submitted';
    ELSE
      PERFORM set_config('wg.approval_write', 'on', true);
      UPDATE wg_timesheet_weeks
      SET status = 'approved',
          approved_at = now(),
          approved_by = v_uid,
          data = coalesce(data, '{}'::jsonb) || jsonb_build_object(
            'approvedAt', now(),
            'approvedBy', coalesce(v_rec.approver_name, v_uid::text)
          )
      WHERE project_id = v_rec.project_id
        AND wg_is_uuid_text(v_rec.submitter_user_id)
        AND user_id = v_rec.submitter_user_id::uuid
        AND week_start = v_week_start
        AND status = 'submitted';
      PERFORM set_config('wg.approval_write', 'off', true);
      v_week_status := 'approved';
    END IF;
  ELSE
    PERFORM set_config('wg.approval_write', 'on', true);
    UPDATE wg_timesheet_weeks
    SET status = 'rejected',
        data = coalesce(data, '{}'::jsonb) || jsonb_build_object(
          'rejectedAt', now(),
          'rejectedBy', coalesce(v_rec.approver_name, v_uid::text),
          'rejectionNote', coalesce(p_notes, '')
        )
    WHERE project_id = v_rec.project_id
      AND wg_is_uuid_text(v_rec.submitter_user_id)
      AND user_id = v_rec.submitter_user_id::uuid
      AND week_start = v_week_start
      AND status = 'submitted';
    PERFORM set_config('wg.approval_write', 'off', true);
    v_week_status := 'rejected';
  END IF;

  RETURN jsonb_build_object(
    'approval', to_jsonb(v_rec),
    'next', CASE WHEN v_has_new THEN to_jsonb(v_new) END,
    'weekStatus', v_week_status
  );
END;
$$;


COMMIT;
