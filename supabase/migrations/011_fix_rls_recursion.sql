-- Migration 011: Fix infinite RLS recursion between wg_projects and wg_project_members
--
-- Problem (from 005_workgraph_core.sql):
--   wg_projects_member policy on wg_projects queries wg_project_members
--   wg_members_owner  policy on wg_project_members queries wg_projects
--   → Postgres evaluator loops forever, returns 500 for every INSERT/SELECT
--
-- Fix: wrap the cross-table lookups in SECURITY DEFINER functions so the
-- inner SELECT runs as the function owner with RLS bypassed. The outer
-- policy becomes a pure function call — no cross-policy reference.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.wg_user_owns_project(pid TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM wg_projects
    WHERE id = pid AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.wg_user_is_project_member(pid TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM wg_project_members
    WHERE project_id = pid
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
  );
$$;

-- Lock down helper execution to authenticated users only (auth.uid() is null for anon anyway).
REVOKE ALL ON FUNCTION public.wg_user_owns_project(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wg_user_is_project_member(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wg_user_owns_project(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wg_user_is_project_member(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Replace recursive policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS wg_projects_member     ON wg_projects;
DROP POLICY IF EXISTS wg_members_owner       ON wg_project_members;
DROP POLICY IF EXISTS wg_invitations_owner   ON wg_project_invitations;
DROP POLICY IF EXISTS wg_weeks_project_member ON wg_timesheet_weeks;

-- wg_projects: members can SELECT their projects (owner path stays as-is in 005)
CREATE POLICY wg_projects_member ON wg_projects
  FOR SELECT TO authenticated
  USING (public.wg_user_is_project_member(id));

-- wg_project_members: project owner can manage rows
CREATE POLICY wg_members_owner ON wg_project_members
  FOR ALL TO authenticated
  USING (public.wg_user_owns_project(project_id))
  WITH CHECK (public.wg_user_owns_project(project_id));

-- wg_project_invitations: project owner can manage rows
CREATE POLICY wg_invitations_owner ON wg_project_invitations
  FOR ALL TO authenticated
  USING (public.wg_user_owns_project(project_id))
  WITH CHECK (public.wg_user_owns_project(project_id));

-- wg_timesheet_weeks: project members can SELECT
CREATE POLICY wg_weeks_project_member ON wg_timesheet_weeks
  FOR SELECT TO authenticated
  USING (public.wg_user_is_project_member(project_id));

-- ---------------------------------------------------------------------------
-- Sanity: confirm helpers are stable + no more recursive policy chains
-- ---------------------------------------------------------------------------
-- Run this after to verify:
--   SELECT polname, tablename FROM pg_policies WHERE schemaname='public'
--     AND tablename IN ('wg_projects','wg_project_members','wg_project_invitations','wg_timesheet_weeks')
--     ORDER BY tablename, polname;
