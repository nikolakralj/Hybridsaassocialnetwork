-- 029_real_party_approver_link.sql
-- C3: connect an accepted real account to a party approver identity.

ALTER TABLE public.wg_project_invitations
  ADD COLUMN IF NOT EXISTS party_graph_node_id TEXT,
  ADD COLUMN IF NOT EXISTS party_name TEXT;

CREATE INDEX IF NOT EXISTS wg_invitations_party_idx
  ON public.wg_project_invitations(project_id, party_graph_node_id)
  WHERE party_graph_node_id IS NOT NULL;

ALTER TABLE public.wg_organization_members
  DROP CONSTRAINT IF EXISTS wg_organization_members_org_role_check;

ALTER TABLE public.wg_organization_members
  ADD CONSTRAINT wg_organization_members_org_role_check
  CHECK (org_role IN (
    'org_admin',
    'org_finance',
    'org_manager',
    'org_approver',
    'org_worker',
    'org_viewer'
  ));

CREATE OR REPLACE FUNCTION public.wg_link_member_as_party_approver(
  p_project_id TEXT,
  p_member_id TEXT,
  p_party_graph_node_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor                 UUID := auth.uid();
  v_project               public.wg_projects%ROWTYPE;
  v_member                public.wg_project_members%ROWTYPE;
  v_invitation            public.wg_project_invitations%ROWTYPE;
  v_graph                 JSONB;
  v_nodes                 JSONB;
  v_party                 JSONB;
  v_party_id              TEXT := NULLIF(trim(COALESCE(p_party_graph_node_id, '')), '');
  v_party_name            TEXT;
  v_party_role            TEXT;
  v_person_node_id        TEXT;
  v_display_name          TEXT;
  v_email                 TEXT;
  v_organization_id       TEXT;
  v_org_member_id         TEXT;
  v_existing_org_user_id  UUID;
  v_authorized            BOOLEAN := false;
  v_self_accept           BOOLEAN := false;
  v_verifier              UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_party_id IS NULL THEN
    RAISE EXCEPTION 'Party graph node is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_project
  FROM public.wg_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_member
  FROM public.wg_project_members
  WHERE id = p_member_id
    AND project_id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project member not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_member.user_id IS NULL THEN
    RAISE EXCEPTION 'The member must be linked to a real account'
      USING ERRCODE = '22023';
  END IF;

  v_graph := COALESCE(v_project.graph, '{"nodes":[],"edges":[]}'::jsonb);
  v_nodes := COALESCE(v_graph->'nodes', '[]'::jsonb);

  SELECT node INTO v_party
  FROM jsonb_array_elements(v_nodes) AS node
  WHERE node->>'id' = v_party_id
    AND node->>'type' = 'party'
  LIMIT 1;

  IF v_party IS NULL THEN
    RAISE EXCEPTION 'Party node % not found on this project', v_party_id
      USING ERRCODE = 'P0002';
  END IF;

  v_party_name := COALESCE(
    NULLIF(trim(v_party->'data'->>'name'), ''),
    NULLIF(trim(v_party->'data'->>'label'), ''),
    'Project organization'
  );
  v_party_role := COALESCE(NULLIF(v_party->'data'->>'partyType', ''), 'company');
  IF v_party_role NOT IN (
    'agency', 'client', 'company', 'supplier',
    'subcontractor', 'freelancer', 'other'
  ) THEN
    v_party_role := 'company';
  END IF;

  SELECT organization_id INTO v_organization_id
  FROM public.wg_project_organizations
  WHERE project_id = p_project_id
    AND graph_node_id = v_party_id
    AND status <> 'removed'
  ORDER BY created_at
  LIMIT 1;

  -- Direct administration path: project owner (bootstrap) or the target
  -- organization's existing verified admin.
  IF v_project.owner_id = v_actor THEN
    v_authorized := true;
    v_verifier := v_actor;
  ELSIF v_organization_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.wg_organization_members AS org_member
      WHERE org_member.organization_id = v_organization_id
        AND org_member.user_id = v_actor
        AND org_member.membership_state = 'verified'
        AND org_member.org_role = 'org_admin'
    ) INTO v_authorized;

    IF v_authorized THEN
      v_verifier := v_actor;
    END IF;
  END IF;

  -- Invitation acceptance path: the invitee may complete their own link only
  -- when the stored party-tagged invitation was issued by an actor who still
  -- has the authority above. This is what makes the Edge Function call safe
  -- under the invitee's JWT instead of service-role trust.
  IF NOT v_authorized
     AND v_member.user_id = v_actor
     AND v_member.invitation_id IS NOT NULL THEN
    SELECT * INTO v_invitation
    FROM public.wg_project_invitations
    WHERE id = v_member.invitation_id
      AND project_id = p_project_id
      AND party_graph_node_id = v_party_id
      AND status IN ('pending', 'accepted')
    FOR UPDATE;

    IF FOUND
       AND lower(COALESCE(v_invitation.email, '')) = lower(COALESCE(v_member.user_email, ''))
       AND (v_invitation.accepted_by_user_id IS NULL
            OR v_invitation.accepted_by_user_id = v_actor) THEN
      IF v_invitation.invited_by = v_project.owner_id THEN
        v_authorized := true;
        v_self_accept := true;
        v_verifier := v_invitation.invited_by;
      ELSIF v_organization_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.wg_organization_members AS inviter_membership
        WHERE inviter_membership.organization_id = v_organization_id
          AND inviter_membership.user_id = v_invitation.invited_by
          AND inviter_membership.membership_state = 'verified'
          AND inviter_membership.org_role = 'org_admin'
      ) THEN
        v_authorized := true;
        v_self_accept := true;
        v_verifier := v_invitation.invited_by;
      END IF;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Only the project owner or a verified admin of this organization can link its approvers'
      USING ERRCODE = '42501';
  END IF;

  IF NOT v_self_accept AND v_member.accepted_at IS NULL THEN
    RAISE EXCEPTION 'The member must accept the invitation before approver setup'
      USING ERRCODE = '22023';
  END IF;

  -- The project owner may bootstrap the first durable organization record for
  -- a graph party. Later representation changes still require its org admin.
  IF v_organization_id IS NULL THEN
    INSERT INTO public.wg_organizations (
      name, profile_visibility, owner_user_id, created_by, data
    ) VALUES (
      v_party_name,
      'private',
      NULL,
      v_project.owner_id,
      jsonb_build_object('legacyGraphPartyId', v_party_id, 'bootstrappedByProjectOwner', true)
    )
    RETURNING id INTO v_organization_id;

    INSERT INTO public.wg_project_organizations (
      project_id, organization_id, graph_node_id, party_role, status,
      invited_by, accepted_by, accepted_at
    ) VALUES (
      p_project_id, v_organization_id, v_party_id, v_party_role, 'active',
      v_verifier, v_actor, NOW()
    );
  ELSE
    UPDATE public.wg_project_organizations
    SET status = 'active',
        accepted_by = COALESCE(accepted_by, v_actor),
        accepted_at = COALESCE(accepted_at, NOW())
    WHERE project_id = p_project_id
      AND organization_id = v_organization_id
      AND status <> 'removed';
  END IF;

  v_email := lower(NULLIF(trim(COALESCE(v_member.user_email, '')), ''));
  IF v_email IS NULL OR v_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'The project member needs a valid email'
      USING ERRCODE = '22023';
  END IF;

  v_display_name := COALESCE(
    NULLIF(trim(COALESCE(v_member.user_name, '')), ''),
    split_part(v_email, '@', 1),
    'Approver'
  );

  SELECT
    node->>'id'
  INTO v_person_node_id
  FROM jsonb_array_elements(v_nodes) AS node
  WHERE node->>'type' = 'person'
    AND node->'data'->>'partyId' = v_party_id
    AND (
      node->'data'->>'userId' = v_member.user_id::text
      OR lower(COALESCE(node->'data'->>'email', '')) = v_email
    )
  ORDER BY (node->'data'->>'userId' = v_member.user_id::text) DESC
  LIMIT 1;

  IF v_person_node_id IS NULL THEN
    v_person_node_id := 'person-' || replace(gen_random_uuid()::text, '-', '');
    v_nodes := v_nodes || jsonb_build_array(jsonb_build_object(
      'id', v_person_node_id,
      'type', 'person',
      'position', jsonb_build_object('x', 0, 'y', 0),
      'data', jsonb_build_object(
        'name', v_display_name,
        'email', v_email,
        'role', 'Approver',
        'partyId', v_party_id,
        'userId', v_member.user_id::text,
        'canApprove', true,
        'canViewRates', false,
        'canEditTimesheets', false,
        'visibleToChain', true
      )
    ));
  ELSE
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN node->>'id' = v_person_node_id THEN
          jsonb_set(
            node,
            '{data}',
            COALESCE(node->'data', '{}'::jsonb) || jsonb_build_object(
              'name', v_display_name,
              'email', v_email,
              'partyId', v_party_id,
              'userId', v_member.user_id::text,
              'canApprove', true,
              'canEditTimesheets', false,
              'visibleToChain', true
            ),
            true
          )
        ELSE node
      END
      ORDER BY ordinality
    ), '[]'::jsonb)
    INTO v_nodes
    FROM jsonb_array_elements(v_nodes) WITH ORDINALITY AS graph_node(node, ordinality);
  END IF;

  SELECT id, user_id INTO v_org_member_id, v_existing_org_user_id
  FROM public.wg_organization_members
  WHERE organization_id = v_organization_id
    AND membership_state IN ('claimed', 'invited', 'verified')
    AND (
      user_id = v_member.user_id
      OR (email IS NOT NULL AND lower(email) = v_email)
    )
  ORDER BY (user_id = v_member.user_id) DESC
  LIMIT 1
  FOR UPDATE;

  IF v_org_member_id IS NULL THEN
    INSERT INTO public.wg_organization_members (
      organization_id, user_id, email, display_name, org_role,
      membership_state, default_visibility, invited_by, invited_at,
      verified_by, verified_at
    ) VALUES (
      v_organization_id, v_member.user_id, v_email, v_display_name,
      'org_approver', 'verified', 'approver', v_verifier,
      COALESCE(v_member.invited_at, NOW()), v_verifier, NOW()
    )
    RETURNING id INTO v_org_member_id;
  ELSE
    IF v_existing_org_user_id IS NOT NULL
       AND v_existing_org_user_id IS DISTINCT FROM v_member.user_id THEN
      RAISE EXCEPTION 'That organization email is already linked to a different account'
        USING ERRCODE = '23505';
    END IF;

    UPDATE public.wg_organization_members
    SET user_id = v_member.user_id,
        email = v_email,
        display_name = v_display_name,
        org_role = CASE
          WHEN org_role IN ('org_admin', 'org_finance', 'org_manager') THEN org_role
          ELSE 'org_approver'
        END,
        membership_state = 'verified',
        default_visibility = 'approver',
        verified_by = v_verifier,
        verified_at = COALESCE(verified_at, NOW()),
        removed_at = NULL
    WHERE id = v_org_member_id;
  END IF;

  UPDATE public.wg_project_members
  SET user_name = v_display_name,
      scope = v_party_id,
      graph_node_id = v_person_node_id,
      can_approve = true,
      can_view_rates = false,
      can_edit_timesheets = false,
      visible_to_chain = true,
      accepted_at = COALESCE(accepted_at, NOW())
  WHERE id = v_member.id;

  UPDATE public.wg_projects
  SET graph = jsonb_set(v_graph, '{nodes}', v_nodes, true),
      updated_at = NOW()
  WHERE id = p_project_id;

  IF v_self_accept THEN
    UPDATE public.wg_project_invitations
    SET status = 'accepted',
        accepted_at = COALESCE(accepted_at, NOW()),
        accepted_by_user_id = v_actor
    WHERE id = v_invitation.id;
  END IF;

  RETURN jsonb_build_object(
    'projectId', p_project_id,
    'memberId', v_member.id,
    'userId', v_member.user_id,
    'organizationId', v_organization_id,
    'organizationMemberId', v_org_member_id,
    'graphNodeId', v_person_node_id,
    'partyGraphNodeId', v_party_id,
    'partyName', v_party_name,
    'displayName', v_display_name,
    'selfAccepted', v_self_accept
  );
END;
$$;

REVOKE ALL ON FUNCTION public.wg_link_member_as_party_approver(TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_link_member_as_party_approver(TEXT, TEXT, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.wg_link_member_as_party_approver(TEXT, TEXT, TEXT) IS
  'C3: atomically links a real project member to a party approver node and verified organization membership. Owner/admin managed; invitees may complete only an authorized stored party invite.';
