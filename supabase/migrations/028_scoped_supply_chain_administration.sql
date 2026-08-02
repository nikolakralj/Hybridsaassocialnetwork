-- Supply-chain ownership is enforced by the project API, where a caller's
-- accepted organization scope can be compared to the graph snapshot.
-- Direct client UPDATEs cannot safely enforce JSONB party-level ownership.

ALTER TABLE public.wg_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wg_projects_owner ON public.wg_projects;
DROP POLICY IF EXISTS wg_projects_owner_select ON public.wg_projects;
DROP POLICY IF EXISTS wg_projects_owner_insert ON public.wg_projects;
DROP POLICY IF EXISTS wg_projects_owner_delete ON public.wg_projects;

CREATE POLICY wg_projects_owner_select
  ON public.wg_projects FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY wg_projects_owner_insert
  ON public.wg_projects FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY wg_projects_owner_delete
  ON public.wg_projects FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- No authenticated UPDATE policy: the service-role Edge Function validates
-- the caller's organization scope before it changes graph or party JSON.
