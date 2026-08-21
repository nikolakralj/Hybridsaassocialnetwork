-- Preserve the privity-v1 implementation while teaching its public surface
-- about the C3 org_approver role introduced in migration 029.

ALTER FUNCTION public.wg_get_scoped_graph(TEXT)
  RENAME TO wg_get_scoped_graph_privity_v1;

REVOKE ALL ON FUNCTION public.wg_get_scoped_graph_privity_v1(TEXT)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.wg_get_scoped_graph(p_project_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := public.wg_get_scoped_graph_privity_v1(p_project_id);

  IF COALESCE(v_result#>>'{meta,viewerOrgRole}', '') = ''
     AND EXISTS (
       SELECT 1
       FROM public.wg_project_organizations AS project_org
       JOIN public.wg_organization_members AS org_member
         ON org_member.organization_id = project_org.organization_id
       WHERE project_org.project_id = p_project_id
         AND project_org.status = 'active'
         AND org_member.user_id = auth.uid()
         AND org_member.membership_state = 'verified'
         AND org_member.org_role = 'org_approver'
     )
  THEN
    v_result := jsonb_set(
      v_result,
      '{meta,viewerOrgRole}',
      to_jsonb('org_approver'::TEXT),
      true
    );
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.wg_get_scoped_graph(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_get_scoped_graph(TEXT) TO authenticated;

COMMENT ON FUNCTION public.wg_get_scoped_graph(TEXT) IS
  'Privity Rule projection with C3 party-approver role metadata.';
