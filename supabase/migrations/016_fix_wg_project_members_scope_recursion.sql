-- 016_fix_wg_project_members_scope_recursion.sql
-- Fix infinite recursion in wg_project_members SELECT policy introduced by 013.
--
-- The old wg_members_scope_contributor policy queried wg_project_members from
-- inside a policy on wg_project_members. Postgres evaluates RLS for that inner
-- read too, so authenticated reads can fail with:
--   infinite recursion detected in policy for relation "wg_project_members"

CREATE OR REPLACE FUNCTION public.wg_user_can_read_project_member(
  target_project_id TEXT,
  target_member_id TEXT,
  target_scope TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    public.wg_user_owns_project(target_project_id)
    OR EXISTS (
      SELECT 1
      FROM wg_project_members AS viewer_member
      WHERE viewer_member.project_id = target_project_id
        AND viewer_member.user_id = auth.uid()
        AND viewer_member.accepted_at IS NOT NULL
        AND (
          viewer_member.role IN ('Owner', 'Editor')
          OR viewer_member.id = target_member_id
          OR viewer_member.scope = 'all'
          OR (
            viewer_member.scope IS NOT NULL
            AND viewer_member.scope = target_scope
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.wg_user_can_read_project_member(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wg_user_can_read_project_member(TEXT, TEXT, TEXT) TO authenticated;

DROP POLICY IF EXISTS wg_members_scope_contributor ON wg_project_members;

CREATE POLICY wg_members_scope_contributor ON wg_project_members
  FOR SELECT TO authenticated
  USING (
    public.wg_user_can_read_project_member(project_id, id, scope)
  );
