-- 039: The project owner cannot decide another party's approval step.
--
-- wg_decide_approval already requires approver_user_id = auth.uid(). That is
-- not enough when a row names the owner as the user on a step whose party is
-- the client: the owner is then "the assigned approver" of someone else's
-- layer. This trigger runs for every status change, including the one inside
-- that function. The caller's party has to be the step's party, and a step
-- whose node resolves to the submitter is self-approval.

BEGIN;

CREATE OR REPLACE FUNCTION public.wg_approval_step_party(p_project_id text, p_node_id text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_party text;
BEGIN
  IF p_node_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT n->>'id' INTO v_party
  FROM wg_projects p
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.graph->'nodes', '[]'::jsonb)) n
  WHERE p.id = p_project_id
    AND n->>'type' = 'party'
    AND n->>'id' = p_node_id
  LIMIT 1;
  IF v_party IS NOT NULL THEN
    RETURN v_party;
  END IF;

  SELECT COALESCE(n->'data'->>'partyId', n->'data'->>'orgId') INTO v_party
  FROM wg_projects p
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.graph->'nodes', '[]'::jsonb)) n
  WHERE p.id = p_project_id
    AND n->>'type' = 'person'
    AND n->>'id' = p_node_id
  LIMIT 1;
  IF v_party IS NOT NULL THEN
    RETURN v_party;
  END IF;

  IF public.wg_is_uuid_text(p_node_id) THEN
    SELECT m.scope INTO v_party
    FROM wg_project_members m
    WHERE m.project_id = p_project_id
      AND m.user_id = p_node_id::uuid
      AND m.scope IS NOT NULL
      AND m.accepted_at IS NOT NULL
    ORDER BY m.accepted_at
    LIMIT 1;
  END IF;
  RETURN v_party;
END;
$$;

CREATE OR REPLACE FUNCTION public.wg_approval_step_user(p_project_id text, p_node_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.wg_graph_node_user_id(p_project_id, n)
  FROM wg_projects p
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.graph->'nodes', '[]'::jsonb)) n
  WHERE p.id = p_project_id
    AND n->>'id' = p_node_id
    AND n->>'type' = 'person'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.wg_caller_belongs_to_party(p_project_id text, p_party_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p_party_id IS NOT NULL AND auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM wg_project_members m
      WHERE m.project_id = p_project_id
        AND m.user_id = auth.uid()
        AND m.accepted_at IS NOT NULL
        AND (
          m.scope = p_party_id
          OR m.graph_node_id IN (
            SELECT n->>'id'
            FROM wg_projects p
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.graph->'nodes', '[]'::jsonb)) n
            WHERE p.id = p_project_id
              AND n->>'type' = 'person'
              AND COALESCE(n->'data'->>'partyId', n->'data'->>'orgId') = p_party_id
          )
        )
    )
    OR public.wg_user_can_access_project_party(p_project_id, p_party_id, NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.wg_guard_approval_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_party text;
  v_node_user uuid;
BEGIN
  IF OLD.status IS DISTINCT FROM 'pending'
     OR NEW.status IS NOT DISTINCT FROM OLD.status
     OR NEW.status NOT IN ('approved', 'rejected', 'changes_requested') THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to decide an approval.' USING ERRCODE = '42501';
  END IF;
  IF NEW.submitter_user_id = auth.uid()::text THEN
    RAISE EXCEPTION 'You cannot approve your own submission.' USING ERRCODE = '42501';
  END IF;

  v_node_user := public.wg_approval_step_user(NEW.project_id, NEW.approver_node_id);
  IF v_node_user IS NOT NULL AND v_node_user::text = NEW.submitter_user_id THEN
    RAISE EXCEPTION 'You cannot approve your own submission.' USING ERRCODE = '42501';
  END IF;

  v_party := public.wg_approval_step_party(NEW.project_id, NEW.approver_node_id);
  IF v_party IS NULL OR NOT public.wg_caller_belongs_to_party(NEW.project_id, v_party) THEN
    RAISE EXCEPTION 'You cannot decide another party''s approval.' USING ERRCODE = '42501';
  END IF;

  IF public.wg_is_uuid_text(NEW.approver_user_id)
     AND NEW.approver_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Only the assigned approver can decide this step.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wg_guard_approval_decision ON public.approval_records;
CREATE TRIGGER wg_guard_approval_decision
  BEFORE UPDATE OF status ON public.approval_records
  FOR EACH ROW
  EXECUTE FUNCTION public.wg_guard_approval_decision();

REVOKE EXECUTE ON FUNCTION public.wg_approval_step_party(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wg_approval_step_user(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wg_caller_belongs_to_party(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wg_guard_approval_decision() FROM PUBLIC, anon, authenticated;

COMMIT;
