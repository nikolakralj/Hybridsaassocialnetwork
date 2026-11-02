-- 043 — Fixes from the 5-account visibility battle test (2026-11-02).
-- DRAFT: not applied to live Supabase. Apply in the SQL editor only after
-- Nikola's OK, after 036–042. Idempotent.
--
-- 1) wg_project_invitations: the "invitee can read own invitation" policy
--    subqueries auth.users, which the authenticated role cannot read. Because
--    Postgres evaluates every permissive SELECT policy, ANY select on the
--    table (even by the project owner) fails with
--    "permission denied for table users" (HTTP 403). The app therefore can
--    never show "Invited" for a pending invite (Team shows "Not invited yet"
--    after Send Invite). Use the JWT email claim instead.
--
-- 2) wg_project_organizations / wg_organizations: every accepted member
--    (client approver, workers) can list every organization in the project,
--    so the end client learns the agency's subcontractor (name + org id)
--    even though the scoped graph hides it (Privity Rule). Limit party rows
--    to: project managers, verified members of that org, members whose
--    roster scope IS that party, and the direct billing counterparties of the
--    caller's party.

BEGIN;

-- 1) invitations -----------------------------------------------------------
DROP POLICY IF EXISTS wg_invitations_email ON public.wg_project_invitations;
CREATE POLICY wg_invitations_email ON public.wg_project_invitations
  FOR SELECT TO authenticated
  USING (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- 2) party privity -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wg_user_can_see_project_party(
  p_project_id TEXT,
  p_party_graph_node_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wg_user_can_manage_project(p_project_id)
    OR EXISTS (
      SELECT 1
      FROM wg_project_members m
      WHERE m.project_id = p_project_id
        AND m.user_id = auth.uid()
        AND m.accepted_at IS NOT NULL
        AND (
          m.scope = p_party_graph_node_id
          OR EXISTS (
            -- direct billing counterparty of the caller's own party
            SELECT 1
            FROM wg_projects p,
                 jsonb_array_elements(COALESCE(p.graph -> 'edges', '[]'::jsonb)) e
            WHERE p.id = p_project_id
              AND COALESCE(e -> 'data' ->> 'edgeType', e ->> 'type') IN ('billsTo', 'subcontracts', 'bills_to')
              AND (
                (e ->> 'source' = m.scope AND e ->> 'target' = p_party_graph_node_id)
                OR (e ->> 'target' = m.scope AND e ->> 'source' = p_party_graph_node_id)
              )
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.wg_user_can_see_project_party(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_user_can_see_project_party(TEXT, TEXT) TO authenticated;

DROP POLICY IF EXISTS wg_project_orgs_select ON public.wg_project_organizations;
CREATE POLICY wg_project_orgs_select ON public.wg_project_organizations
  FOR SELECT TO authenticated
  USING (
    wg_user_is_verified_org_member(organization_id)
    OR wg_user_can_see_project_party(project_id, graph_node_id)
  );

DROP POLICY IF EXISTS wg_organizations_select ON public.wg_organizations;
CREATE POLICY wg_organizations_select ON public.wg_organizations
  FOR SELECT TO authenticated
  USING (
    profile_visibility = 'public'
    OR created_by = auth.uid()
    OR owner_user_id = auth.uid()
    OR wg_user_is_verified_org_member(id)
    OR EXISTS (
      SELECT 1
      FROM wg_project_organizations po
      WHERE po.organization_id = wg_organizations.id
        AND po.status = 'active'
        AND wg_user_can_see_project_party(po.project_id, po.graph_node_id)
    )
  );

COMMIT;

-- Verification (run as each test user via the REST API, not as postgres):
--   client approver:  select graph_node_id from wg_project_organizations
--                     -> only its own party (and the agency once the agency
--                        has an organization row), never the subcontractor
--   owner:            select * from wg_project_invitations -> 200, rows
--   invitee:          select * from wg_project_invitations -> own invite only
