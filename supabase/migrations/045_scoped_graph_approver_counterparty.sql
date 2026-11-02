-- 045_scoped_graph_approver_counterparty.sql
-- Party approvers (org_approver, C3) see their direct counterparty in the
-- scoped graph, like org_admin/finance/manager already do. Before, the Sub
-- approver saw only Sub, and the Client approver saw only Client, not the
-- Agency they work with. Commercial stripping is unchanged.
--
-- NOT APPLIED. Same wrapper pattern as 031 and 042: the current public
-- function is renamed to wg_get_scoped_graph_pre045 and a new outer
-- wg_get_scoped_graph widens its result for org_approver viewers (one-hop
-- party nodes + their canApprove people without email/pay fields + edges
-- among visible nodes, billing-edge commercial keys stripped unless the
-- viewer sells on that edge). If 042 runs later it wraps this function the
-- same way, so the order of 042 and 045 does not matter.

BEGIN;

ALTER FUNCTION public.wg_get_scoped_graph(TEXT) RENAME TO wg_get_scoped_graph_pre045;
REVOKE ALL ON FUNCTION public.wg_get_scoped_graph_pre045(TEXT) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.wg_get_scoped_graph(p_project_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result     JSONB;
  v_graph      JSONB;
  v_own        TEXT[];
  v_hop        TEXT[];
  v_add_nodes  JSONB;
  v_ids        TEXT[];
  v_edges      JSONB;
  v_is_approver BOOLEAN;
BEGIN
  v_result := public.wg_get_scoped_graph_pre045(p_project_id);

  v_is_approver := EXISTS (
    SELECT 1
    FROM public.wg_project_organizations AS project_org
    JOIN public.wg_organization_members AS org_member
      ON org_member.organization_id = project_org.organization_id
    WHERE project_org.project_id = p_project_id
      AND project_org.status = 'active'
      AND org_member.user_id = auth.uid()
      AND org_member.membership_state = 'verified'
      AND org_member.org_role = 'org_approver'
  );

  -- Managers already see the full topology; only approvers widen here.
  IF NOT v_is_approver OR COALESCE((v_result#>>'{meta,isProjectManager}')::boolean, false) THEN
    RETURN v_result;
  END IF;

  SELECT ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_result#>'{meta,viewerPartyIds}', '[]'::jsonb)))
  INTO v_own;
  IF COALESCE(array_length(v_own, 1), 0) = 0 THEN
    RETURN v_result;
  END IF;

  SELECT graph INTO v_graph FROM public.wg_projects WHERE id = p_project_id;

  SELECT COALESCE(array_agg(DISTINCT pid), '{}') INTO v_hop
  FROM (
    SELECT CASE WHEN e->>'source' = ANY(v_own) THEN e->>'target' ELSE e->>'source' END AS pid
    FROM jsonb_array_elements(COALESCE(v_graph->'edges', '[]'::jsonb)) AS e
    WHERE COALESCE(e->'data'->>'edgeType', e->>'type') IN ('billsTo', 'bills_to', 'subcontracts')
      AND (e->>'source' = ANY(v_own) OR e->>'target' = ANY(v_own))
  ) s
  WHERE NOT (pid = ANY(v_own));

  -- Counterparty party nodes, and their approvers (name/role only).
  SELECT COALESCE(jsonb_agg(
           CASE WHEN n->>'type' = 'person'
                THEN jsonb_set(n, '{data}', (n->'data') - 'email' - 'hourlyRate' - 'dailyRate'
                                         - 'fixedAmount' - 'weeklyHourLimit' - 'monthlyHourLimit', true)
                ELSE n END), '[]'::jsonb)
  INTO v_add_nodes
  FROM jsonb_array_elements(COALESCE(v_graph->'nodes', '[]'::jsonb)) AS n
  WHERE NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_result->'nodes') AS have WHERE have->>'id' = n->>'id')
    AND (
      (n->>'type' = 'party' AND n->>'id' = ANY(v_hop))
      OR (n->>'type' = 'person'
          AND COALESCE(n->'data'->>'partyId', n->'data'->>'orgId') = ANY(v_hop)
          AND COALESCE((n->'data'->>'canApprove')::boolean, false))
    );

  v_result := jsonb_set(v_result, '{nodes}', (v_result->'nodes') || v_add_nodes, true);

  SELECT COALESCE(array_agg(n->>'id'), '{}') INTO v_ids
  FROM jsonb_array_elements(v_result->'nodes') AS n;

  -- Edges among visible nodes; billing-edge commercial keys stripped unless
  -- the viewer is the seller (source) of that edge.
  SELECT COALESCE(jsonb_agg(
           CASE WHEN COALESCE(e->'data'->>'edgeType', e->>'type') IN ('billsTo', 'bills_to', 'subcontracts')
                     AND NOT (e->>'source' = ANY(v_own))
                THEN jsonb_set(e - 'markup' - 'margin' - 'rate' - 'amount' - 'buyRate' - 'sellRate' - 'hourlyRate',
                               '{data}',
                               COALESCE(e->'data', '{}'::jsonb) - 'markup' - 'margin' - 'marginPercent'
                                 - 'markupPercent' - 'rate' - 'amount' - 'cost' - 'fee' - 'buyRate'
                                 - 'sellRate' - 'hourlyRate' - 'dailyRate' - 'fixedAmount', true)
                ELSE e END), '[]'::jsonb)
  INTO v_edges
  FROM jsonb_array_elements(COALESCE(v_graph->'edges', '[]'::jsonb)) AS e
  WHERE e->>'source' = ANY(v_ids) AND e->>'target' = ANY(v_ids);

  v_result := jsonb_set(v_result, '{edges}', v_edges, true);
  v_result := jsonb_set(v_result, '{meta,externalStages}',
    to_jsonb(GREATEST(COALESCE((v_result#>>'{meta,externalStages}')::int, 0) - COALESCE(array_length(v_hop, 1), 0), 0)), true);
  v_result := jsonb_set(v_result, '{meta,visibilityScope}', to_jsonb('counterparty'::TEXT), true);
  v_result := jsonb_set(v_result, '{meta,hiddenNodeCount}',
    to_jsonb(GREATEST(COALESCE((v_result#>>'{meta,hiddenNodeCount}')::int, 0) - jsonb_array_length(v_add_nodes), 0)), true);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.wg_get_scoped_graph(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_get_scoped_graph(TEXT) TO authenticated;

COMMENT ON FUNCTION public.wg_get_scoped_graph(TEXT) IS
  'Privity projection + org_approver meta (031) + one-hop counterparty sight for org_approver viewers (045).';

COMMIT;
