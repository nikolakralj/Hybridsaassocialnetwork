-- 034: Trust boundary is server truth for reads, approvals and timesheet locks.
--
-- Findings this closes (Grok review 2026-10-14, verified live by Claude):
--   * Any project member could SELECT wg_projects.graph (rates, markup, people
--     of every party), every wg_timesheet_weeks row, and every approval_record.
--   * The next approver was computed in the browser from the previous
--     approver's scoped graph, so a chain could end early.
--   * The project owner could decide a step assigned to another party.
--   * Any project member could INSERT approval_records (including "approved").
--   * Weeks could be edited or deleted after approval, and the edge function
--     (service role, auth.uid() IS NULL) bypassed the self-approval trigger.
--
-- After this migration:
--   * wg_projects.graph / parties are not readable by authenticated or anon.
--     Graph reads go through SECURITY DEFINER RPCs (wg_get_scoped_graph) or the
--     edge function. NOTE: new wg_projects columns must be added to the column
--     GRANT below or clients cannot select them.
--   * A week is readable by its worker, the project owner, an approver assigned
--     to that week, and verified admins/managers/finance of the worker's party.
--   * An approval record is readable by the project owner and by people who
--     submit or approve that subject.
--   * approval_records are written only by wg_submit_timesheet,
--     wg_decide_approval and wg_recall_timesheet. The route is computed on the
--     server from the full graph; only the assigned approver may decide a step.
--   * Weeks: new rows start as draft; status and approval metadata change only
--     through those RPCs; submitted weeks are content-locked; approved weeks are
--     immutable; submitted/approved weeks cannot be deleted. This holds for the
--     service role too.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Graph and parties are not directly readable
-- ---------------------------------------------------------------------------
REVOKE SELECT ON public.wg_projects FROM anon, authenticated;
GRANT SELECT (
  id, name, description, region, currency, start_date, end_date, work_week,
  status, supply_chain_status, owner_id, created_at, updated_at,
  require_purchase_order
) ON public.wg_projects TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wg_is_uuid_text(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', false);
$$;

CREATE OR REPLACE FUNCTION public.wg_week_start_of_subject(p_subject_id text)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_subject_id ~ ':[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN right(p_subject_id, 10)::date
  END;
$$;

CREATE OR REPLACE FUNCTION public.wg_safe_numeric(p_value text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_value ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' THEN p_value::numeric END;
$$;

-- Account behind a graph person node, only if that account is the project owner
-- or an accepted project member (a graph edit alone cannot appoint a stranger).
CREATE OR REPLACE FUNCTION public.wg_graph_node_user_id(p_project_id text, p_node jsonb)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_candidate uuid;
BEGIN
  IF wg_is_uuid_text(p_node->>'id') THEN
    v_candidate := (p_node->>'id')::uuid;
  ELSIF wg_is_uuid_text(p_node->'data'->>'userId') THEN
    v_candidate := (p_node->'data'->>'userId')::uuid;
  ELSE
    SELECT m.user_id INTO v_candidate
    FROM wg_project_members m
    WHERE m.project_id = p_project_id
      AND m.graph_node_id = p_node->>'id'
      AND m.user_id IS NOT NULL
      AND m.accepted_at IS NOT NULL
    ORDER BY m.accepted_at
    LIMIT 1;
  END IF;

  IF v_candidate IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM wg_projects p WHERE p.id = p_project_id AND p.owner_id = v_candidate)
     OR EXISTS (
       SELECT 1 FROM wg_project_members m
       WHERE m.project_id = p_project_id
         AND m.user_id = v_candidate
         AND m.accepted_at IS NOT NULL
     ) THEN
    RETURN v_candidate;
  END IF;

  RETURN NULL;
END;
$$;

-- Approval route for a submitter, computed from the FULL project graph.
-- Mirrors buildApprovalRouteSteps() in TimesheetDataContext.tsx:
--   route = submitter's own party, then every party it bills upstream (BFS over
--   billsTo / subcontracts / bills_to edges in edge order).
--   own party: first authorized person other than the submitter, else skipped.
--   upstream party: first authorized person; if none, a placeholder step that
--   waits on the party (deliberately NOT skipped: skipping would bill work the
--   counterparty never approved).
--   authorized = canApprove = true, or the project owner.
--   A person with a linked account is preferred over one without.
-- Each step: {step, partyId, partyName, approverNodeId (= partyId),
--   approverPersonNodeId, approverUserId (uuid or null), approverUserRef, approverName}
CREATE OR REPLACE FUNCTION public.wg_compute_timesheet_route(p_project_id text, p_submitter uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_graph jsonb;
  v_owner uuid;
  v_nodes jsonb;
  v_edges jsonb;
  v_sub_node text;
  v_sub_party text;
  v_route text[];
  v_visited text[];
  v_queue text[];
  v_pid text;
  v_party jsonb;
  v_person jsonb;
  v_chosen jsonb;
  v_chosen_uid uuid;
  v_uid uuid;
  v_steps jsonb := '[]'::jsonb;
  v_step integer := 0;
BEGIN
  SELECT p.graph, p.owner_id INTO v_graph, v_owner
  FROM wg_projects p
  WHERE p.id = p_project_id;

  IF v_graph IS NULL OR p_submitter IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  v_nodes := coalesce(v_graph->'nodes', '[]'::jsonb);
  v_edges := coalesce(v_graph->'edges', '[]'::jsonb);

  SELECT m.graph_node_id INTO v_sub_node
  FROM wg_project_members m
  WHERE m.project_id = p_project_id
    AND m.user_id = p_submitter
    AND m.graph_node_id IS NOT NULL
  LIMIT 1;

  IF v_sub_node IS NULL THEN
    SELECT n->>'id' INTO v_sub_node
    FROM jsonb_array_elements(v_nodes) n
    WHERE n->>'type' = 'person'
      AND (n->>'id' = p_submitter::text OR n->'data'->>'userId' = p_submitter::text)
    LIMIT 1;
  END IF;

  IF v_sub_node IS NOT NULL THEN
    SELECT coalesce(n->'data'->>'partyId', n->'data'->>'orgId') INTO v_sub_party
    FROM jsonb_array_elements(v_nodes) n
    WHERE n->>'id' = v_sub_node
    LIMIT 1;
  END IF;

  IF v_sub_party IS NULL THEN
    SELECT m.scope INTO v_sub_party
    FROM wg_project_members m
    WHERE m.project_id = p_project_id
      AND m.user_id = p_submitter
      AND m.scope IS NOT NULL
    LIMIT 1;
  END IF;

  IF v_sub_party IS NULL AND p_submitter = v_owner THEN
    SELECT n->>'id' INTO v_sub_party
    FROM jsonb_array_elements(v_nodes) n
    WHERE n->>'type' = 'party'
      AND coalesce(n->'data'->>'isCreator', 'false') = 'true'
    LIMIT 1;
  END IF;

  IF v_sub_party IS NULL OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_nodes) n
    WHERE n->>'type' = 'party' AND n->>'id' = v_sub_party
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  v_route := ARRAY[v_sub_party];
  v_visited := ARRAY[v_sub_party];
  v_queue := ARRAY(
    SELECT e->>'target'
    FROM jsonb_array_elements(v_edges) WITH ORDINALITY AS x(e, ord)
    WHERE e->>'source' = v_sub_party
      AND coalesce(e->'data'->>'edgeType', e->>'type') IN ('billsTo', 'subcontracts', 'bills_to')
    ORDER BY ord
  );

  WHILE coalesce(array_length(v_queue, 1), 0) > 0 LOOP
    v_pid := v_queue[1];
    v_queue := v_queue[2:];
    CONTINUE WHEN v_pid IS NULL OR v_pid = ANY(v_visited);
    v_visited := v_visited || v_pid;
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_nodes) n
      WHERE n->>'type' = 'party' AND n->>'id' = v_pid
    );
    v_route := v_route || v_pid;
    v_queue := v_queue || ARRAY(
      SELECT e->>'target'
      FROM jsonb_array_elements(v_edges) WITH ORDINALITY AS x(e, ord)
      WHERE e->>'source' = v_pid
        AND coalesce(e->'data'->>'edgeType', e->>'type') IN ('billsTo', 'subcontracts', 'bills_to')
      ORDER BY ord
    );
  END LOOP;

  FOREACH v_pid IN ARRAY v_route LOOP
    SELECT n INTO v_party
    FROM jsonb_array_elements(v_nodes) n
    WHERE n->>'type' = 'party' AND n->>'id' = v_pid
    LIMIT 1;

    v_chosen := NULL;
    v_chosen_uid := NULL;

    FOR v_person IN
      SELECT n
      FROM jsonb_array_elements(v_nodes) n
      WHERE n->>'type' = 'person'
        AND (n->'data'->>'partyId' = v_pid OR n->'data'->>'orgId' = v_pid)
        AND n->>'id' IS DISTINCT FROM v_sub_node
        AND n->>'id' <> p_submitter::text
        AND coalesce(n->'data'->>'userId', '') <> p_submitter::text
        AND (
          coalesce(n->'data'->>'canApprove', 'false') = 'true'
          OR n->>'id' = v_owner::text
          OR n->'data'->>'userId' = v_owner::text
        )
      ORDER BY coalesce(n->'data'->>'name', ''), n->>'id'
    LOOP
      v_uid := wg_graph_node_user_id(p_project_id, v_person);
      IF v_uid IS NOT NULL AND v_uid <> p_submitter THEN
        v_chosen := v_person;
        v_chosen_uid := v_uid;
        EXIT;
      END IF;
      IF v_chosen IS NULL THEN
        v_chosen := v_person;
      END IF;
    END LOOP;

    IF v_pid = v_sub_party AND v_chosen IS NULL THEN
      CONTINUE;
    END IF;

    v_step := v_step + 1;
    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'step', v_step,
      'partyId', v_pid,
      'partyName', coalesce(v_party->'data'->>'name', v_pid),
      'approverNodeId', v_pid,
      'approverPersonNodeId', v_chosen->>'id',
      'approverUserId', v_chosen_uid,
      'approverUserRef', coalesce(v_chosen_uid::text, v_chosen->>'id', v_pid),
      'approverName', coalesce(v_chosen->'data'->>'name', v_party->'data'->>'name', v_pid)
    ));
  END LOOP;

  RETURN v_steps;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Read policies
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wg_user_can_read_timesheet_week(
  p_project_id text,
  p_user_id uuid,
  p_week_start date
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    p_user_id = auth.uid()
    OR wg_user_owns_project(p_project_id)
    OR EXISTS (
      SELECT 1
      FROM approval_records a
      WHERE a.project_id = p_project_id
        AND a.subject_type = 'timesheet'
        AND a.submitter_user_id = p_user_id::text
        AND wg_week_start_of_subject(a.subject_id) = p_week_start
        AND a.approver_user_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1
      FROM wg_project_members m
      WHERE m.project_id = p_project_id
        AND m.user_id = p_user_id
        AND m.scope IS NOT NULL
        AND wg_user_can_access_project_party(
          p_project_id, m.scope, ARRAY['org_admin', 'org_manager', 'org_finance']
        )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.wg_user_takes_part_in_approval(
  p_project_id text,
  p_subject_type text,
  p_subject_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM approval_records a
    WHERE a.project_id = p_project_id
      AND a.subject_type = p_subject_type
      AND a.subject_id = p_subject_id
      AND (a.approver_user_id = auth.uid()::text OR a.submitter_user_id = auth.uid()::text)
  );
$$;

DROP POLICY IF EXISTS wg_weeks_project_member ON public.wg_timesheet_weeks;
DROP POLICY IF EXISTS wg_weeks_scoped_read ON public.wg_timesheet_weeks;
CREATE POLICY wg_weeks_scoped_read ON public.wg_timesheet_weeks
  FOR SELECT TO authenticated
  USING (wg_user_can_read_timesheet_week(project_id, user_id, week_start));

DROP POLICY IF EXISTS approval_records_select ON public.approval_records;
DROP POLICY IF EXISTS approval_records_insert ON public.approval_records;
DROP POLICY IF EXISTS approval_records_update ON public.approval_records;
CREATE POLICY approval_records_select ON public.approval_records
  FOR SELECT TO authenticated
  USING (
    wg_user_owns_project(project_id)
    OR approver_user_id = (auth.uid())::text
    OR submitter_user_id = (auth.uid())::text
    OR wg_user_takes_part_in_approval(project_id, subject_type, subject_id)
  );

-- Writes only through the SECURITY DEFINER RPCs below.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.approval_records FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Timesheet week guard (applies to every role, including service_role)
-- ---------------------------------------------------------------------------
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
    IF (NEW.status, NEW.data, NEW.approved_at, NEW.approved_by, NEW.submitted_at, NEW.project_id)
       IS DISTINCT FROM
       (OLD.status, OLD.data, OLD.approved_at, OLD.approved_by, OLD.submitted_at, OLD.project_id) THEN
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

-- ---------------------------------------------------------------------------
-- 5. Approval RPCs
-- ---------------------------------------------------------------------------
-- The 008/009/026 trigger approval_records_sync_timesheet_week_status marked a
-- week approved when the LAST STEP OF THE CLIENT-SUPPLIED snapshot route was
-- approved. That route came from the submitter's scoped graph and could be
-- short, so weeks could be approved before the client approved. The RPCs below
-- now own week status, using the server-computed route.
DROP TRIGGER IF EXISTS approval_records_sync_timesheet_week_status ON public.approval_records;
COMMENT ON FUNCTION public.approval_records_sync_timesheet_week_status() IS
  'Superseded by 034 (wg_submit_timesheet / wg_decide_approval / wg_recall_timesheet). Trigger dropped; kept for history.';
CREATE OR REPLACE FUNCTION public.wg_submit_timesheet(
  p_project_id text,
  p_week_start date,
  p_subject_id text,
  p_snapshot jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_week wg_timesheet_weeks%ROWTYPE;
  v_prefix text;
  v_member_node text;
  v_route jsonb;
  v_first jsonb;
  v_hours numeric;
  v_snapshot jsonb;
  v_rec approval_records%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to submit a timesheet.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_week
  FROM wg_timesheet_weeks
  WHERE user_id = v_uid AND project_id = p_project_id AND week_start = p_week_start
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Timesheet week not found. Save the week before submitting it.' USING ERRCODE = 'P0002';
  END IF;

  IF v_week.status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'This week is already %.', v_week.status USING ERRCODE = '22023';
  END IF;

  IF p_subject_id IS NULL OR right(p_subject_id, 11) <> ':' || p_week_start::text THEN
    RAISE EXCEPTION 'The approval subject does not match this week.' USING ERRCODE = '22023';
  END IF;

  v_prefix := left(p_subject_id, length(p_subject_id) - 11);
  SELECT m.graph_node_id INTO v_member_node
  FROM wg_project_members m
  WHERE m.project_id = p_project_id AND m.user_id = v_uid
  LIMIT 1;

  IF v_prefix <> v_uid::text AND v_prefix IS DISTINCT FROM v_member_node AND NOT EXISTS (
    SELECT 1
    FROM wg_projects p, jsonb_array_elements(coalesce(p.graph->'nodes', '[]'::jsonb)) n
    WHERE p.id = p_project_id
      AND n->>'id' = v_prefix
      AND n->'data'->>'userId' = v_uid::text
  ) THEN
    RAISE EXCEPTION 'You can only submit your own timesheet.' USING ERRCODE = '42501';
  END IF;

  v_route := wg_compute_timesheet_route(p_project_id, v_uid);
  IF jsonb_array_length(v_route) = 0 THEN
    RAISE EXCEPTION 'No approver could be found for you in this project. Ask the project owner to place you in an organization that bills upstream.'
      USING ERRCODE = 'P0001';
  END IF;
  v_first := v_route->0;

  v_hours := coalesce(
    v_week.total_hours,
    wg_safe_numeric(v_week.data->>'totalHours'),
    (
      SELECT sum(coalesce(wg_safe_numeric(d->>'totalHours'), wg_safe_numeric(d->>'hours'), 0))
      FROM jsonb_array_elements(coalesce(v_week.data->'days', '[]'::jsonb)) d
    ),
    0
  );

  -- Descriptive fields come from the client; routing and hours are server-owned.
  v_snapshot := coalesce(p_snapshot, '{}'::jsonb) || jsonb_build_object(
    'kind', 'timesheet',
    'periodStart', p_week_start,
    'hours', v_hours,
    'approvalLayer', 1,
    'approvalRoute', v_route,
    'currentApproverName', v_first->>'approverName',
    'currentApproverNodeId', v_first->>'approverNodeId',
    'currentApproverUserRef', v_first->>'approverUserRef'
  );

  DELETE FROM approval_records
  WHERE project_id = p_project_id
    AND subject_type = 'timesheet'
    AND subject_id = p_subject_id
    AND status = 'pending';

  INSERT INTO approval_records (
    project_id, subject_type, subject_id, subject_snapshot,
    approver_user_id, approver_name, approver_node_id,
    approval_layer, status, submitted_at, submitter_user_id
  ) VALUES (
    p_project_id, 'timesheet', p_subject_id, v_snapshot,
    -- No linked account yet: store the party/person reference (never a uuid,
    -- so nobody can decide it) until wg_refresh_pending_approvers re-points it.
    coalesce(v_first->>'approverUserId', v_first->>'approverUserRef'),
    v_first->>'approverName', v_first->>'approverNodeId',
    1, 'pending', now(), v_uid::text
  )
  RETURNING * INTO v_rec;

  PERFORM set_config('wg.approval_write', 'on', true);
  UPDATE wg_timesheet_weeks
  SET status = 'submitted',
      submitted_at = now(),
      data = (coalesce(data, '{}'::jsonb) - 'rejectedBy' - 'rejectedAt' - 'rejectionNote' - 'approvedBy' - 'approvedAt')
             || jsonb_build_object('submittedAt', now())
  WHERE id = v_week.id;
  PERFORM set_config('wg.approval_write', 'off', true);

  RETURN jsonb_build_object('approval', to_jsonb(v_rec), 'route', v_route);
END;
$$;

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

    SELECT (s->>'step')::integer INTO v_position
    FROM jsonb_array_elements(v_route) s
    WHERE s->>'partyId' = v_rec.approver_node_id
    LIMIT 1;

    IF v_position IS NOT NULL THEN
      SELECT s INTO v_next
      FROM jsonb_array_elements(v_route) s
      WHERE (s->>'step')::integer = v_position + 1;
    ELSE
      -- The graph changed since submission (or a legacy record): continue the
      -- route stored at submission.
      v_route := coalesce(v_rec.subject_snapshot->'approvalRoute', '[]'::jsonb);
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

CREATE OR REPLACE FUNCTION public.wg_recall_timesheet(p_project_id text, p_week_start date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_week wg_timesheet_weeks%ROWTYPE;
  v_removed integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to recall a timesheet.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_week
  FROM wg_timesheet_weeks
  WHERE user_id = v_uid AND project_id = p_project_id AND week_start = p_week_start
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Timesheet week not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_week.status <> 'submitted' THEN
    RAISE EXCEPTION 'Only a submitted week can be recalled (this one is %).', v_week.status USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM approval_records a
    WHERE a.project_id = p_project_id
      AND a.subject_type = 'timesheet'
      AND a.submitter_user_id = v_uid::text
      AND wg_week_start_of_subject(a.subject_id) = p_week_start
      AND a.status = 'approved'
      AND a.decided_at >= coalesce(v_week.submitted_at, '-infinity'::timestamptz)
  ) THEN
    RAISE EXCEPTION 'An approver has already approved part of this week. Ask them to reject it instead.'
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM approval_records a
  WHERE a.project_id = p_project_id
    AND a.subject_type = 'timesheet'
    AND a.submitter_user_id = v_uid::text
    AND wg_week_start_of_subject(a.subject_id) = p_week_start
    AND a.status = 'pending';
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  PERFORM set_config('wg.approval_write', 'on', true);
  UPDATE wg_timesheet_weeks
  SET status = 'draft',
      submitted_at = NULL,
      data = coalesce(data, '{}'::jsonb) - 'submittedAt'
  WHERE id = v_week.id;
  PERFORM set_config('wg.approval_write', 'off', true);

  RETURN jsonb_build_object('weekStatus', 'draft', 'removedApprovals', v_removed);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Re-point steps that wait on a party once an approver is linked
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wg_refresh_pending_approvers(p_project_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r approval_records%ROWTYPE;
  v_step jsonb;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM approval_records a
    WHERE a.project_id = p_project_id
      AND a.status = 'pending'
      AND a.subject_type = 'timesheet'
      AND NOT wg_is_uuid_text(a.approver_user_id)
      AND wg_is_uuid_text(a.submitter_user_id)
  LOOP
    SELECT s INTO v_step
    FROM jsonb_array_elements(wg_compute_timesheet_route(p_project_id, r.submitter_user_id::uuid)) s
    WHERE s->>'partyId' = r.approver_node_id
    LIMIT 1;

    IF v_step IS NOT NULL AND wg_is_uuid_text(v_step->>'approverUserId') THEN
      UPDATE approval_records
      SET approver_user_id = v_step->>'approverUserId',
          approver_name = v_step->>'approverName',
          updated_at = now()
      WHERE id = r.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.wg_refresh_pending_approvers_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_TABLE_NAME = 'wg_projects' THEN
    PERFORM wg_refresh_pending_approvers(NEW.id);
  ELSE
    PERFORM wg_refresh_pending_approvers(NEW.project_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS wg_projects_refresh_pending_approvers ON public.wg_projects;
CREATE TRIGGER wg_projects_refresh_pending_approvers
  AFTER UPDATE OF graph ON public.wg_projects
  FOR EACH ROW
  WHEN (NEW.graph IS DISTINCT FROM OLD.graph)
  EXECUTE FUNCTION public.wg_refresh_pending_approvers_trigger();

DROP TRIGGER IF EXISTS wg_members_refresh_pending_approvers ON public.wg_project_members;
CREATE TRIGGER wg_members_refresh_pending_approvers
  AFTER INSERT OR UPDATE OF user_id, graph_node_id, accepted_at ON public.wg_project_members
  FOR EACH ROW
  EXECUTE FUNCTION public.wg_refresh_pending_approvers_trigger();

-- ---------------------------------------------------------------------------
-- 7. Execute grants: RPCs for signed-in users, helpers internal only
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.wg_graph_node_user_id(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wg_compute_timesheet_route(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wg_refresh_pending_approvers(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wg_refresh_pending_approvers_trigger() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.wg_submit_timesheet(text, date, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wg_decide_approval(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wg_recall_timesheet(text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_submit_timesheet(text, date, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wg_decide_approval(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wg_recall_timesheet(text, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.wg_user_can_read_timesheet_week(text, uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wg_user_takes_part_in_approval(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_user_can_read_timesheet_week(text, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wg_user_takes_part_in_approval(text, text, text) TO authenticated;

-- Existing steps that wait on a party with a now-linked approver.
SELECT public.wg_refresh_pending_approvers(p.id) FROM public.wg_projects p;

COMMIT;
