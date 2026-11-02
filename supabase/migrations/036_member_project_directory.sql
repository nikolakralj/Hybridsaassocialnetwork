-- 036: Members read project metadata from a directory view.
--
-- Migration 034 revoked SELECT on wg_projects.graph and wg_projects.parties.
-- This migration re-asserts that grant (a later GRANT SELECT on the table would
-- otherwise hand the raw graph back) and adds wg_projects_directory, the only
-- member-facing projection of a project row. It has no graph and no parties.
-- The caller's nodes and edges come from wg_get_scoped_graph.

BEGIN;

REVOKE SELECT ON public.wg_projects FROM anon, authenticated;
GRANT SELECT (
  id, name, description, region, currency, start_date, end_date, work_week,
  status, supply_chain_status, owner_id, created_at, updated_at,
  require_purchase_order
) ON public.wg_projects TO authenticated;

CREATE OR REPLACE VIEW public.wg_projects_directory
WITH (security_invoker = true) AS
SELECT
  id,
  name,
  description,
  region,
  currency,
  start_date,
  end_date,
  work_week,
  status,
  supply_chain_status,
  owner_id,
  created_at,
  updated_at,
  require_purchase_order
FROM public.wg_projects;

COMMENT ON VIEW public.wg_projects_directory IS
  'Project metadata for an accepted member. graph and parties are not columns; call wg_get_scoped_graph for the caller''s nodes and edges.';

GRANT SELECT ON public.wg_projects_directory TO authenticated;

COMMIT;
