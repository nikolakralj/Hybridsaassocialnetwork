-- 022_project_worker_onboarding_rpc.sql
-- C2 first usable slice: atomically turn an accepted project collaborator into
-- a verified worker in the project owner's organization and project roster.

CREATE OR REPLACE FUNCTION public.wg_assign_project_member_as_worker(
  p_project_id TEXT,
  p_member_id TEXT,
  p_organization_name TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_placement_title TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_project public.wg_projects%ROWTYPE;
  v_member public.wg_project_members%ROWTYPE;
  v_owner_member public.wg_project_members%ROWTYPE;
  v_graph JSONB;
  v_nodes JSONB;
  v_edges JSONB;
  v_owner_party_id TEXT;
  v_owner_party_name TEXT;
  v_organization_name TEXT := NULLIF(trim(COALESCE(p_organization_name, '')), '');
  v_display_name TEXT;
  v_placement_title TEXT := COALESCE(NULLIF(trim(COALESCE(p_placement_title, '')), ''), 'Employee');
  v_person_node_id TEXT;
  v_organization_id TEXT;
  v_owner_org_member_id TEXT;
  v_worker_org_member_id TEXT;
  v_roster_id TEXT;
  v_party_role TEXT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_project
  FROM public.wg_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  -- This bridge bootstraps the owner's company. Editors must not be able to
  -- claim a project party as their organization.
  IF v_project.owner_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Only the project owner can set up employees'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_member
  FROM public.wg_project_members
  WHERE id = p_member_id
    AND project_id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project member not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_member.accepted_at IS NULL OR v_member.user_id IS NULL THEN
    RAISE EXCEPTION 'The member must accept the invitation before worker setup'
      USING ERRCODE = '22023';
  END IF;

  IF v_member.user_id = v_actor THEN
    RAISE EXCEPTION 'Use company settings to manage your own organization profile'
      USING ERRCODE = '22023';
  END IF;

  IF v_member.role IN ('Owner', 'Editor') THEN
    RAISE EXCEPTION 'Owners and Editors cannot be converted into workers'
      USING ERRCODE = '22023';
  END IF;

  IF v_member.graph_node_id IS NOT NULL THEN
    RAISE EXCEPTION 'This member already has a graph identity'
      USING ERRCODE = '23505';
  END IF;

  IF v_organization_name IS NULL THEN
    RAISE EXCEPTION 'Company name is required' USING ERRCODE = '22023';
  END IF;

  v_graph := COALESCE(v_project.graph, '{"nodes":[],"edges":[]}'::jsonb);
  v_nodes := COALESCE(v_graph->'nodes', '[]'::jsonb);
  v_edges := COALESCE(v_graph->'edges', '[]'::jsonb);

  SELECT * INTO v_owner_member
  FROM public.wg_project_members
  WHERE project_id = p_project_id
    AND user_id = v_actor
    AND accepted_at IS NOT NULL
  ORDER BY invited_at
  LIMIT 1;

  IF v_owner_member.graph_node_id IS NOT NULL THEN
    SELECT node->'data'->>'partyId'
    INTO v_owner_party_id
    FROM jsonb_array_elements(v_nodes) AS node
    WHERE node->>'type' = 'person'
      AND node->>'id' = v_owner_member.graph_node_id
    LIMIT 1;
  END IF;

  IF v_owner_party_id IS NULL THEN
    SELECT node->'data'->>'partyId'
    INTO v_owner_party_id
    FROM jsonb_array_elements(v_nodes) AS node
    WHERE node->>'type' = 'person'
      AND (
        node->>'id' = v_actor::text
        OR node->'data'->>'userId' = v_actor::text
      )
    LIMIT 1;
  END IF;

  IF v_owner_party_id IS NULL THEN
    RAISE EXCEPTION 'Project owner graph identity is not mapped to a company'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    node->'data'->>'name',
    COALESCE(node->'data'->>'partyType', 'company')
  INTO v_owner_party_name, v_party_role
  FROM jsonb_array_elements(v_nodes) AS node
  WHERE node->>'type' = 'party'
    AND node->>'id' = v_owner_party_id
  LIMIT 1;

  IF v_owner_party_name IS NULL THEN
    RAISE EXCEPTION 'Project owner company node was not found'
      USING ERRCODE = '22023';
  END IF;

  IF v_party_role NOT IN ('agency', 'client', 'company', 'supplier', 'subcontractor', 'freelancer', 'other') THEN
    v_party_role := 'company';
  END IF;

  v_display_name := COALESCE(
    NULLIF(trim(COALESCE(p_display_name, '')), ''),
    NULLIF(trim(COALESCE(v_member.user_name, '')), ''),
    split_part(COALESCE(v_member.user_email, 'Worker'), '@', 1)
  );
  v_person_node_id := 'person-' || replace(gen_random_uuid()::text, '-', '');

  -- Rename the legacy "Your Organization" party while adding the worker node.
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN node->>'id' = v_owner_party_id THEN
        jsonb_set(node, '{data,name}', to_jsonb(v_organization_name), true)
      ELSE node
    END
  ), '[]'::jsonb)
  INTO v_nodes
  FROM jsonb_array_elements(v_nodes) AS node;

  v_nodes := v_nodes || jsonb_build_array(jsonb_build_object(
    'id', v_person_node_id,
    'type', 'person',
    'position', jsonb_build_object('x', 0, 'y', 0),
    'data', jsonb_build_object(
      'name', v_display_name,
      'email', v_member.user_email,
      'role', v_placement_title,
      'company', v_organization_name,
      'partyId', v_owner_party_id,
      'userId', v_member.user_id::text,
      'canApprove', false,
      'canViewRates', false,
      'canEditTimesheets', true,
      'visibleToChain', true
    )
  ));

  v_edges := v_edges || jsonb_build_array(jsonb_build_object(
    'id', 'edge-approves-' || v_person_node_id || '-' || v_owner_party_id || '-step1',
    'source', v_person_node_id,
    'target', v_owner_party_id,
    'type', 'approves',
    'data', jsonb_build_object(
      'edgeType', 'approves',
      'label', 'approves',
      'approverPartyId', v_owner_party_id,
      'mode', 'same-company',
      'order', 1,
      'required', true
    )
  ));

  v_graph := jsonb_set(v_graph, '{nodes}', v_nodes, true);
  v_graph := jsonb_set(v_graph, '{edges}', v_edges, true);

  SELECT organization_id INTO v_organization_id
  FROM public.wg_project_organizations
  WHERE project_id = p_project_id
    AND graph_node_id = v_owner_party_id
    AND status <> 'removed'
  LIMIT 1;

  IF v_organization_id IS NULL THEN
    INSERT INTO public.wg_organizations (
      name, profile_visibility, owner_user_id, created_by, data
    ) VALUES (
      v_organization_name,
      'private',
      v_actor,
      v_actor,
      jsonb_build_object('legacyGraphPartyId', v_owner_party_id)
    )
    RETURNING id INTO v_organization_id;

    INSERT INTO public.wg_project_organizations (
      project_id, organization_id, graph_node_id, party_role, status,
      invited_by, accepted_by, accepted_at
    ) VALUES (
      p_project_id, v_organization_id, v_owner_party_id, v_party_role, 'active',
      v_actor, v_actor, NOW()
    );
  ELSE
    UPDATE public.wg_organizations
    SET name = v_organization_name,
        owner_user_id = COALESCE(owner_user_id, v_actor)
    WHERE id = v_organization_id;

    UPDATE public.wg_project_organizations
    SET status = 'active',
        accepted_by = COALESCE(accepted_by, v_actor),
        accepted_at = COALESCE(accepted_at, NOW())
    WHERE project_id = p_project_id
      AND organization_id = v_organization_id
      AND status <> 'removed';
  END IF;

  SELECT id INTO v_owner_org_member_id
  FROM public.wg_organization_members
  WHERE organization_id = v_organization_id
    AND user_id = v_actor
    AND membership_state IN ('claimed', 'invited', 'verified')
  LIMIT 1
  FOR UPDATE;

  IF v_owner_org_member_id IS NULL THEN
    INSERT INTO public.wg_organization_members (
      organization_id, user_id, display_name, org_role, membership_state,
      default_visibility, verified_by, verified_at
    ) VALUES (
      v_organization_id, v_actor, 'Owner', 'org_admin', 'verified',
      'contact', v_actor, NOW()
    )
    RETURNING id INTO v_owner_org_member_id;
  ELSE
    UPDATE public.wg_organization_members
    SET org_role = 'org_admin',
        membership_state = 'verified',
        default_visibility = 'contact',
        verified_by = v_actor,
        verified_at = COALESCE(verified_at, NOW()),
        removed_at = NULL
    WHERE id = v_owner_org_member_id;
  END IF;

  SELECT id INTO v_worker_org_member_id
  FROM public.wg_organization_members
  WHERE organization_id = v_organization_id
    AND membership_state IN ('claimed', 'invited', 'verified')
    AND (
      user_id = v_member.user_id
      OR (email IS NOT NULL AND lower(email) = lower(v_member.user_email))
    )
  ORDER BY (user_id = v_member.user_id) DESC
  LIMIT 1
  FOR UPDATE;

  IF v_worker_org_member_id IS NULL THEN
    INSERT INTO public.wg_organization_members (
      organization_id, user_id, email, display_name, org_role,
      membership_state, default_visibility, invited_by, invited_at,
      verified_by, verified_at
    ) VALUES (
      v_organization_id, v_member.user_id, lower(v_member.user_email),
      v_display_name, 'org_worker', 'verified', 'worker', v_actor,
      COALESCE(v_member.invited_at, NOW()), v_actor, NOW()
    )
    RETURNING id INTO v_worker_org_member_id;
  ELSE
    UPDATE public.wg_organization_members
    SET user_id = v_member.user_id,
        email = lower(v_member.user_email),
        display_name = v_display_name,
        org_role = CASE
          WHEN org_role IN ('org_admin', 'org_finance', 'org_manager') THEN org_role
          ELSE 'org_worker'
        END,
        membership_state = 'verified',
        default_visibility = 'worker',
        verified_by = v_actor,
        verified_at = COALESCE(verified_at, NOW()),
        removed_at = NULL
    WHERE id = v_worker_org_member_id;
  END IF;

  SELECT id INTO v_roster_id
  FROM public.wg_project_roster
  WHERE project_id = p_project_id
    AND user_id = v_member.user_id
    AND assignment_status <> 'removed'
  LIMIT 1
  FOR UPDATE;

  IF v_roster_id IS NULL THEN
    INSERT INTO public.wg_project_roster (
      project_id, organization_id, organization_member_id, user_id,
      graph_node_id, display_name, visibility_mode, roster_role,
      assignment_status, placement_title, added_by
    ) VALUES (
      p_project_id, v_organization_id, v_worker_org_member_id, v_member.user_id,
      v_person_node_id, v_display_name, 'worker', 'worker', 'active',
      v_placement_title, v_actor
    )
    RETURNING id INTO v_roster_id;
  ELSE
    UPDATE public.wg_project_roster
    SET organization_id = v_organization_id,
        organization_member_id = v_worker_org_member_id,
        graph_node_id = v_person_node_id,
        display_name = v_display_name,
        visibility_mode = 'worker',
        roster_role = 'worker',
        assignment_status = 'active',
        placement_title = v_placement_title,
        added_by = v_actor
    WHERE id = v_roster_id;
  END IF;

  UPDATE public.wg_project_members
  SET user_name = v_display_name,
      role = 'Contributor',
      scope = v_owner_party_id,
      graph_node_id = v_person_node_id,
      can_approve = false,
      can_view_rates = false,
      can_edit_timesheets = true,
      visible_to_chain = true
  WHERE id = v_member.id;

  UPDATE public.wg_projects
  SET graph = v_graph,
      updated_at = NOW()
  WHERE id = p_project_id;

  RETURN jsonb_build_object(
    'projectId', p_project_id,
    'memberId', v_member.id,
    'userId', v_member.user_id,
    'organizationId', v_organization_id,
    'organizationMemberId', v_worker_org_member_id,
    'rosterId', v_roster_id,
    'graphNodeId', v_person_node_id,
    'partyGraphNodeId', v_owner_party_id,
    'organizationName', v_organization_name,
    'displayName', v_display_name,
    'placementTitle', v_placement_title
  );
END;
$$;

REVOKE ALL ON FUNCTION public.wg_assign_project_member_as_worker(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wg_assign_project_member_as_worker(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.wg_assign_project_member_as_worker(TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Owner-only C2 bridge: atomically verifies an accepted member as an org worker, activates the project roster, creates a graph identity, and grants timesheet-only permissions.';
