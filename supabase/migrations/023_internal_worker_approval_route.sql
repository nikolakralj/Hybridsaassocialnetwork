-- 023_internal_worker_approval_route.sql
-- Repairs the C2 worker approval boundary:
--   1. normalize legacy authenticated person names such as "Me"
--   2. move pending worker timesheets back to their verified company approver
--   3. preserve and shift the existing upstream agency/client route

-- A real account must not remain represented by a viewer-relative label in the
-- shared graph. Prefer profile metadata and fall back to the email local-part.
WITH resolved_users AS (
  SELECT
    users.id::text AS user_id,
    COALESCE(
      NULLIF(trim(users.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(users.raw_user_meta_data->>'name'), ''),
      NULLIF(split_part(users.email, '@', 1), '')
    ) AS display_name
  FROM auth.users AS users
), normalized_projects AS (
  SELECT
    projects.id,
    jsonb_set(
      projects.graph,
      '{nodes}',
      COALESCE(jsonb_agg(
        CASE
          WHEN nodes.node->>'type' = 'person'
            AND lower(trim(COALESCE(nodes.node->'data'->>'name', ''))) IN ('me', 'you')
            AND resolved.display_name IS NOT NULL
          THEN jsonb_set(nodes.node, '{data,name}', to_jsonb(resolved.display_name), true)
          ELSE nodes.node
        END
        ORDER BY nodes.ordinality
      ), '[]'::jsonb),
      true
    ) AS normalized_graph
  FROM public.wg_projects AS projects
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(projects.graph->'nodes', '[]'::jsonb))
    WITH ORDINALITY AS nodes(node, ordinality)
  LEFT JOIN resolved_users AS resolved
    ON resolved.user_id = COALESCE(
      nodes.node->'data'->>'userId',
      CASE
        WHEN nodes.node->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN nodes.node->>'id'
        ELSE NULL
      END
    )
  GROUP BY projects.id, projects.graph
)
UPDATE public.wg_projects AS projects
SET graph = normalized.normalized_graph
FROM normalized_projects AS normalized
WHERE projects.id = normalized.id
  AND projects.graph IS DISTINCT FROM normalized.normalized_graph;

UPDATE public.wg_project_members AS members
SET user_name = COALESCE(
  NULLIF(trim(users.raw_user_meta_data->>'full_name'), ''),
  NULLIF(trim(users.raw_user_meta_data->>'name'), ''),
  NULLIF(split_part(users.email, '@', 1), ''),
  members.user_name
)
FROM auth.users AS users
WHERE members.user_id = users.id
  AND lower(trim(COALESCE(members.user_name, ''))) IN ('', 'me', 'you');

-- Pick one verified admin/manager from the worker's own project organization.
-- Project ownership wins, then org_admin, then org_manager.
WITH ranked_company_approvers AS (
  SELECT
    approvals.id AS approval_id,
    project_org.graph_node_id AS party_node_id,
    organizations.name AS party_name,
    org_members.user_id AS approver_user_id,
    project_members.graph_node_id AS approver_graph_node_id,
    COALESCE(
      NULLIF(trim(users.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(users.raw_user_meta_data->>'name'), ''),
      NULLIF(trim(org_members.display_name), ''),
      NULLIF(trim(project_members.user_name), ''),
      NULLIF(split_part(users.email, '@', 1), ''),
      'Company approver'
    ) AS approver_name,
    row_number() OVER (
      PARTITION BY approvals.id
      ORDER BY
        (org_members.user_id = projects.owner_id) DESC,
        CASE org_members.org_role WHEN 'org_admin' THEN 0 ELSE 1 END,
        org_members.created_at,
        org_members.id
    ) AS approver_rank
  FROM public.approval_records AS approvals
  JOIN public.wg_projects AS projects
    ON projects.id = approvals.project_id
  JOIN public.wg_project_roster AS worker_roster
    ON worker_roster.project_id = approvals.project_id
    AND worker_roster.user_id::text = approvals.submitter_user_id
    AND worker_roster.roster_role = 'worker'
    AND worker_roster.assignment_status = 'active'
  JOIN public.wg_project_organizations AS project_org
    ON project_org.project_id = worker_roster.project_id
    AND project_org.organization_id = worker_roster.organization_id
    AND project_org.status = 'active'
    AND project_org.graph_node_id IS NOT NULL
  JOIN public.wg_organizations AS organizations
    ON organizations.id = worker_roster.organization_id
  JOIN public.wg_organization_members AS org_members
    ON org_members.organization_id = worker_roster.organization_id
    AND org_members.membership_state = 'verified'
    AND org_members.org_role IN ('org_admin', 'org_manager')
    AND org_members.user_id IS NOT NULL
    AND org_members.user_id::text <> approvals.submitter_user_id
  JOIN auth.users AS users
    ON users.id = org_members.user_id
  JOIN public.wg_project_members AS project_members
    ON project_members.project_id = approvals.project_id
    AND project_members.user_id = org_members.user_id
    AND project_members.graph_node_id IS NOT NULL
  WHERE approvals.subject_type = 'timesheet'
    AND approvals.status = 'pending'
    AND approvals.approval_layer = 1
    AND approvals.submitter_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND jsonb_typeof(approvals.subject_snapshot->'approvalRoute') = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(approvals.subject_snapshot->'approvalRoute') AS route_step
      WHERE route_step->>'partyId' = project_org.graph_node_id
    )
), selected_approvers AS (
  SELECT *
  FROM ranked_company_approvers
  WHERE approver_rank = 1
), repaired_routes AS (
  SELECT
    selected.approval_id,
    selected.party_node_id,
    selected.party_name,
    selected.approver_user_id,
    selected.approver_graph_node_id,
    selected.approver_name,
    jsonb_build_array(jsonb_build_object(
      'step', 1,
      'partyId', selected.party_node_id,
      'partyName', selected.party_name,
      'approverNodeId', selected.party_node_id,
      'approverUserRef', selected.approver_graph_node_id,
      'approverName', selected.approver_name
    )) || COALESCE((
      SELECT jsonb_agg(
        jsonb_set(
          route_step.value,
          '{step}',
          to_jsonb(COALESCE((route_step.value->>'step')::integer, route_step.ordinality::integer) + 1),
          true
        )
        ORDER BY route_step.ordinality
      )
      FROM jsonb_array_elements(approvals.subject_snapshot->'approvalRoute')
        WITH ORDINALITY AS route_step(value, ordinality)
    ), '[]'::jsonb) AS approval_route
  FROM selected_approvers AS selected
  JOIN public.approval_records AS approvals
    ON approvals.id = selected.approval_id
)
UPDATE public.approval_records AS approvals
SET
  approver_user_id = repaired.approver_user_id::text,
  approver_name = repaired.approver_name,
  approver_node_id = repaired.party_node_id,
  approval_layer = 1,
  subject_snapshot = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            approvals.subject_snapshot,
            '{approvalRoute}', repaired.approval_route, true
          ),
          '{currentApproverName}', to_jsonb(repaired.approver_name), true
        ),
        '{currentApproverNodeId}', to_jsonb(repaired.party_node_id), true
      ),
      '{currentApproverUserRef}', to_jsonb(repaired.approver_graph_node_id), true
    ),
    '{approvalLayer}', '1'::jsonb, true
  ),
  updated_at = NOW()
FROM repaired_routes AS repaired
WHERE approvals.id = repaired.approval_id;
