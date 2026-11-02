-- 037: Timesheet weeks and approval records are readable by party, not by
-- any project member and not by the project owner as such.
--
-- A row is visible to:
--   * the worker who owns it (timesheet) or who submitted it (approval)
--   * an Owner/Editor, or verified org admin/manager/finance, of the worker's party
--   * the user id named as approver on that approval row
-- The project owner does not get a second path. A colleague in the approver's
-- company who is not the assigned approver does not either.
--
-- subject_snapshot and timesheet data are not granted as raw columns.
-- The views below attach a redacted copy: day notes stay with the worker's
-- party, and approval routes drop party ids outside the caller's one-hop sight.

BEGIN;

CREATE OR REPLACE FUNCTION public.wg_caller_operates_party(p_project_id text, p_party_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p_party_id IS NOT NULL AND auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM wg_project_members me
      WHERE me.project_id = p_project_id
        AND me.user_id = auth.uid()
        AND me.accepted_at IS NOT NULL
        AND me.scope = p_party_id
        AND me.role IN ('Owner', 'Editor')
    )
    OR public.wg_user_can_access_project_party(
      p_project_id, p_party_id, ARRAY['org_admin', 'org_manager', 'org_finance']
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.wg_worker_party(p_project_id text, p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT m.scope
  FROM wg_project_members m
  WHERE m.project_id = p_project_id
    AND m.user_id = p_user_id
    AND m.scope IS NOT NULL
    AND m.accepted_at IS NOT NULL
  ORDER BY m.accepted_at
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.wg_caller_own_party_ids(p_project_id text)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(DISTINCT party_id), '{}')
  FROM (
    SELECT m.scope AS party_id
    FROM wg_project_members m
    WHERE m.project_id = p_project_id
      AND m.user_id = auth.uid()
      AND m.accepted_at IS NOT NULL
      AND m.scope IS NOT NULL
    UNION
    SELECT COALESCE(n->'data'->>'partyId', n->'data'->>'orgId')
    FROM wg_projects p
    JOIN wg_project_members m
      ON m.project_id = p.id
     AND m.user_id = auth.uid()
     AND m.accepted_at IS NOT NULL
     AND m.graph_node_id IS NOT NULL
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.graph->'nodes', '[]'::jsonb)) n
    WHERE p.id = p_project_id
      AND n->>'id' = m.graph_node_id
    UNION
    SELECT po.graph_node_id
    FROM wg_project_organizations po
    JOIN wg_organization_members om ON om.organization_id = po.organization_id
    WHERE po.project_id = p_project_id
      AND po.status = 'active'
      AND po.graph_node_id IS NOT NULL
      AND om.user_id = auth.uid()
      AND om.membership_state = 'verified'
  ) parties
  WHERE party_id IS NOT NULL;
$$;

-- Own parties plus parties one billsTo hop away, in either direction.
CREATE OR REPLACE FUNCTION public.wg_caller_visible_party_ids(p_project_id text)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_own text[] := public.wg_caller_own_party_ids(p_project_id);
  v_graph jsonb;
BEGIN
  SELECT graph INTO v_graph FROM wg_projects WHERE id = p_project_id;
  RETURN COALESCE((
    SELECT array_agg(DISTINCT pid)
    FROM (
      SELECT unnest(v_own) AS pid
      UNION
      SELECT CASE
        WHEN e->>'source' = ANY(v_own) THEN e->>'target'
        ELSE e->>'source'
      END
      FROM jsonb_array_elements(COALESCE(v_graph->'edges', '[]'::jsonb)) e
      WHERE COALESCE(e->'data'->>'edgeType', e->>'type') IN ('billsTo', 'subcontracts', 'bills_to')
        AND (e->>'source' = ANY(v_own) OR e->>'target' = ANY(v_own))
    ) hops
    WHERE pid IS NOT NULL
  ), '{}');
END;
$$;

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
    OR public.wg_caller_operates_party(p_project_id, public.wg_worker_party(p_project_id, p_user_id))
    OR EXISTS (
      SELECT 1
      FROM approval_records a
      WHERE a.project_id = p_project_id
        AND a.subject_type = 'timesheet'
        AND a.submitter_user_id = p_user_id::text
        AND public.wg_week_start_of_subject(a.subject_id) = p_week_start
        AND a.approver_user_id = auth.uid()::text
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.wg_user_can_read_approval_record(p_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM approval_records a
    WHERE a.id = p_id
      AND (
        a.submitter_user_id = auth.uid()::text
        OR a.approver_user_id = auth.uid()::text
        OR public.wg_caller_operates_party(
          a.project_id,
          public.wg_worker_party(a.project_id, CASE WHEN public.wg_is_uuid_text(a.submitter_user_id) THEN a.submitter_user_id::uuid END)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.wg_redact_timesheet_data(p_data jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'totalHours', p_data->'totalHours',
    'days', (
      SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'day', d->'day',
        'hours', d->'hours',
        'totalHours', COALESCE(d->'totalHours', d->'hours')
      ))), '[]'::jsonb)
      FROM jsonb_array_elements(COALESCE(p_data->'days', '[]'::jsonb)) d
    )
  ));
$$;

CREATE OR REPLACE FUNCTION public.wg_timesheet_data_for_caller(p_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_week wg_timesheet_weeks%ROWTYPE;
  v_party text;
BEGIN
  SELECT * INTO v_week FROM wg_timesheet_weeks WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF NOT public.wg_user_can_read_timesheet_week(v_week.project_id, v_week.user_id, v_week.week_start) THEN
    RETURN NULL;
  END IF;

  v_party := public.wg_worker_party(v_week.project_id, v_week.user_id);
  IF v_week.user_id = auth.uid() OR public.wg_caller_operates_party(v_week.project_id, v_party) THEN
    RETURN v_week.data;
  END IF;
  RETURN public.wg_redact_timesheet_data(v_week.data);
END;
$$;

CREATE OR REPLACE FUNCTION public.wg_redacted_approval_snapshot(p_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row approval_records%ROWTYPE;
  v_snap jsonb;
  v_visible text[];
  v_own text[];
  v_submitter_party text;
  v_keep_notes boolean;
  v_route jsonb := '[]'::jsonb;
  v_step jsonb;
BEGIN
  IF NOT public.wg_user_can_read_approval_record(p_id) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row FROM approval_records WHERE id = p_id;
  v_snap := COALESCE(v_row.subject_snapshot, '{}'::jsonb);
  v_visible := public.wg_caller_visible_party_ids(v_row.project_id);
  v_own := public.wg_caller_own_party_ids(v_row.project_id);
  v_submitter_party := CASE
    WHEN public.wg_is_uuid_text(v_row.submitter_user_id)
      THEN public.wg_worker_party(v_row.project_id, v_row.submitter_user_id::uuid)
  END;
  v_keep_notes := v_row.submitter_user_id = auth.uid()::text
    OR (v_submitter_party IS NOT NULL AND v_submitter_party = ANY(v_own));

  IF NOT v_keep_notes THEN
    v_snap := v_snap
      - 'daySummary' - 'days' - 'notes' - 'dayNotes' - 'note' - 'tasks'
      - 'hourlyRate' - 'dailyRate' - 'fixedAmount' - 'markup' - 'margin';
  END IF;

  FOR v_step IN
    SELECT s
    FROM jsonb_array_elements(COALESCE(v_snap->'approvalRoute', '[]'::jsonb)) s
  LOOP
    IF v_step->>'partyId' IS NULL OR v_step->>'partyId' = ANY(v_visible) THEN
      v_route := v_route || jsonb_build_array(v_step);
    END IF;
  END LOOP;

  v_snap := jsonb_set(v_snap, '{approvalRoute}', v_route, true);
  RETURN v_snap;
END;
$$;

DROP POLICY IF EXISTS wg_weeks_project_member ON public.wg_timesheet_weeks;
DROP POLICY IF EXISTS wg_weeks_scoped_read ON public.wg_timesheet_weeks;
CREATE POLICY wg_weeks_scoped_read ON public.wg_timesheet_weeks
  FOR SELECT TO authenticated
  USING (public.wg_user_can_read_timesheet_week(project_id, user_id, week_start));

DROP POLICY IF EXISTS approval_records_select ON public.approval_records;
CREATE POLICY approval_records_select ON public.approval_records
  FOR SELECT TO authenticated
  USING (public.wg_user_can_read_approval_record(id));

-- A table-level SELECT grant is not reduced by REVOKE SELECT (column).
-- Take the table grant away, then grant every column except the raw notes
-- and the raw snapshot. Those come back only through the views below.
REVOKE SELECT ON public.wg_timesheet_weeks FROM anon, authenticated;
GRANT SELECT (
  id, user_id, project_id, week_start, status, total_hours,
  submitted_at, approved_at, approved_by, created_at, updated_at
) ON public.wg_timesheet_weeks TO authenticated;

REVOKE SELECT ON public.approval_records FROM anon, authenticated;
GRANT SELECT (
  id, project_id, subject_type, subject_id,
  approver_user_id, approver_name, approver_node_id,
  approval_layer, status, notes, submitted_at, decided_at,
  graph_version_id, created_at, updated_at, submitter_user_id
) ON public.approval_records TO authenticated;

CREATE OR REPLACE VIEW public.wg_timesheet_weeks_visible
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  project_id,
  week_start,
  status,
  total_hours,
  public.wg_timesheet_data_for_caller(id) AS data,
  submitted_at,
  approved_at,
  approved_by,
  created_at,
  updated_at
FROM public.wg_timesheet_weeks;

CREATE OR REPLACE VIEW public.wg_approval_records_visible
WITH (security_invoker = true) AS
SELECT
  id,
  project_id,
  subject_type,
  subject_id,
  approver_user_id,
  approver_name,
  approver_node_id,
  approval_layer,
  status,
  notes,
  submitted_at,
  decided_at,
  graph_version_id,
  created_at,
  updated_at,
  submitter_user_id,
  public.wg_redacted_approval_snapshot(id) AS subject_snapshot
FROM public.approval_records;

GRANT SELECT ON public.wg_timesheet_weeks_visible TO authenticated;
GRANT SELECT ON public.wg_approval_records_visible TO authenticated;

REVOKE EXECUTE ON FUNCTION public.wg_caller_operates_party(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wg_worker_party(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wg_caller_own_party_ids(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wg_caller_visible_party_ids(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wg_user_can_read_approval_record(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wg_redact_timesheet_data(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wg_timesheet_data_for_caller(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wg_redacted_approval_snapshot(text) TO authenticated;

COMMENT ON VIEW public.wg_timesheet_weeks_visible IS
  'Timesheet weeks the caller may see. data is full for the worker and their party operators, and hours-only for an assigned approver from another party.';
COMMENT ON VIEW public.wg_approval_records_visible IS
  'Approval rows the caller may see. subject_snapshot drops day notes for other parties and drops route steps outside the caller''s one-hop sight.';

COMMIT;
