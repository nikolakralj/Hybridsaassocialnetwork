-- 027_party_approver_delegation.sql
-- C3b foundation: add an approver to ANY party on a project.
--
-- Authorized to: the project owner (bootstrap/testing) OR a verified org_admin
-- /org_manager of the organization mapped to that party. This is the atomic
-- operation behind "G2's admin (James) adds 2-3 G2 agents as approvers".
--
-- Multiple calls add multiple approvers; the approval route resolver already
-- routes to a party's canApprove people. UI + invitation-to-real-account +
-- verifying James as G2's admin are the follow-up layers (see
-- IDENTITY_AUTHORITY_MODEL.md). Node-deletion protection (C3a) is still open.

CREATE OR REPLACE FUNCTION public.wg_assign_party_approver(
  p_project_id TEXT,
  p_party_graph_node_id TEXT,
  p_email TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_can_view_rates BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor      UUID := auth.uid();
  v_project    public.wg_projects%ROWTYPE;
  v_graph      JSONB;
  v_nodes      JSONB;
  v_party      JSONB;
  v_node_id    TEXT;
  v_name       TEXT;
  v_email      TEXT := lower(NULLIF(trim(COALESCE(p_email, '')), ''));
  v_authorized BOOLEAN := false;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF v_email IS NULL OR v_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'A valid email is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_project FROM public.wg_projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  -- Authorization: project owner, or a verified admin/manager of the org that
  -- is mapped to this party node (the counterparty self-managing its people).
  IF v_project.owner_id = v_actor THEN
    v_authorized := true;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.wg_project_organizations po
      JOIN public.wg_organization_members om ON om.organization_id = po.organization_id
      WHERE po.project_id = p_project_id
        AND po.graph_node_id = p_party_graph_node_id
        AND po.status = 'active'
        AND om.user_id = v_actor
        AND om.membership_state = 'verified'
        AND om.org_role IN ('org_admin', 'org_manager')
    ) INTO v_authorized;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Only the project owner or a verified admin of this organization can add its approvers'
      USING ERRCODE = '42501';
  END IF;

  v_graph := COALESCE(v_project.graph, '{"nodes":[],"edges":[]}'::jsonb);
  v_nodes := COALESCE(v_graph->'nodes', '[]'::jsonb);

  SELECT node INTO v_party
  FROM jsonb_array_elements(v_nodes) AS node
  WHERE node->>'id' = p_party_graph_node_id AND node->>'type' = 'party'
  LIMIT 1;
  IF v_party IS NULL THEN
    RAISE EXCEPTION 'Party node % not found on this project', p_party_graph_node_id USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency: if this email is already an approver on this party, no-op.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_nodes) AS node
    WHERE node->>'type' = 'person'
      AND node->'data'->>'partyId' = p_party_graph_node_id
      AND lower(COALESCE(node->'data'->>'email','')) = v_email
  ) THEN
    RAISE EXCEPTION 'A person with that email is already on this organization' USING ERRCODE = '23505';
  END IF;

  v_name := COALESCE(NULLIF(trim(COALESCE(p_display_name, '')), ''), split_part(v_email, '@', 1));
  v_node_id := 'person-' || replace(gen_random_uuid()::text, '-', '');

  v_nodes := v_nodes || jsonb_build_array(jsonb_build_object(
    'id', v_node_id,
    'type', 'person',
    'position', jsonb_build_object('x', 0, 'y', 0),
    'data', jsonb_build_object(
      'name', v_name,
      'email', v_email,
      'role', 'Approver',
      'partyId', p_party_graph_node_id,
      'canApprove', true,
      'canViewRates', COALESCE(p_can_view_rates, false),
      'canEditTimesheets', false,
      'visibleToChain', true
    )
  ));

  UPDATE public.wg_projects
  SET graph = jsonb_set(v_graph, '{nodes}', v_nodes, true), updated_at = NOW()
  WHERE id = p_project_id;

  RETURN jsonb_build_object(
    'nodeId', v_node_id,
    'partyGraphNodeId', p_party_graph_node_id,
    'name', v_name,
    'email', v_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.wg_assign_party_approver(TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_assign_party_approver(TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.wg_assign_party_approver(TEXT, TEXT, TEXT, TEXT, BOOLEAN) IS
  'Adds an approver person node to a party. Authorized to the project owner or a verified admin/manager of the party org. Foundation for multi-agent counterparty approval (C3b).';
