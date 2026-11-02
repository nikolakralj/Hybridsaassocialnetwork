-- 042: wg_get_scoped_graph strips commercial fields on billing edges.
-- Margins stay with finance/admin of the selling party. Bill rates and
-- amounts stay with finance/admin of either signatory. Funding edges are
-- not treated as sales: their amount stays for whoever may already see the edge.

BEGIN;

ALTER FUNCTION public.wg_get_scoped_graph(TEXT)
  RENAME TO wg_get_scoped_graph_with_role_meta;

REVOKE ALL ON FUNCTION public.wg_get_scoped_graph_with_role_meta(TEXT)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wg_strip_commercial_edge(p_edge jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_edge jsonb := p_edge;
  v_data jsonb := COALESCE(p_edge->'data', '{}'::jsonb);
  v_key text;
BEGIN
  FOREACH v_key IN ARRAY ARRAY[
    'markup', 'margin', 'marginPercent', 'markupPercent',
    'sellRate', 'buyRate', 'hourlyRate', 'dailyRate', 'fixedAmount',
    'rate', 'amount', 'cost', 'fee'
  ] LOOP
    v_edge := v_edge - v_key;
    v_data := v_data - v_key;
  END LOOP;
  RETURN jsonb_set(v_edge, '{data}', v_data, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.wg_strip_named_edge_keys(p_edge jsonb, p_keys text[])
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_edge jsonb := p_edge;
  v_data jsonb := COALESCE(p_edge->'data', '{}'::jsonb);
  v_key text;
BEGIN
  FOREACH v_key IN ARRAY p_keys LOOP
    v_edge := v_edge - v_key;
    v_data := v_data - v_key;
  END LOOP;
  RETURN jsonb_set(v_edge, '{data}', v_data, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.wg_get_scoped_graph(p_project_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_finance_parties text[];
  v_edges jsonb := '[]'::jsonb;
  v_edge jsonb;
  v_kind text;
  v_source_finance boolean;
  v_target_finance boolean;
  v_keys text[];
BEGIN
  v_result := public.wg_get_scoped_graph_with_role_meta(p_project_id);

  -- Finance of party A must not keep commercial fields on an edge sold by party B.
  SELECT COALESCE(array_agg(DISTINCT project_org.graph_node_id), ARRAY[]::text[])
  INTO v_finance_parties
  FROM public.wg_project_organizations AS project_org
  JOIN public.wg_organization_members AS org_member
    ON org_member.organization_id = project_org.organization_id
  WHERE project_org.project_id = p_project_id
    AND project_org.status = 'active'
    AND org_member.user_id = auth.uid()
    AND org_member.membership_state = 'verified'
    AND org_member.org_role IN ('org_admin', 'org_finance');

  v_result := jsonb_set(
    v_result,
    '{meta,viewerFinancePartyIds}',
    to_jsonb(v_finance_parties),
    true
  );

  FOR v_edge IN
    SELECT value FROM jsonb_array_elements(COALESCE(v_result->'edges', '[]'::jsonb))
  LOOP
    v_kind := COALESCE(v_edge->'data'->>'edgeType', v_edge->>'type', '');
    IF v_kind IN ('billsTo', 'subcontracts', 'bills_to') THEN
      v_source_finance := v_edge->>'source' = ANY(v_finance_parties);
      v_target_finance := v_edge->>'target' = ANY(v_finance_parties);
      -- Margins are the seller's. Bill rates are shared by both signatories' finance.
      v_keys := CASE
        WHEN v_source_finance THEN ARRAY[]::text[]
        WHEN v_target_finance THEN ARRAY['markup', 'margin', 'marginPercent', 'markupPercent', 'cost']
        ELSE ARRAY[
          'markup', 'margin', 'marginPercent', 'markupPercent', 'cost',
          'sellRate', 'buyRate', 'hourlyRate', 'dailyRate', 'fixedAmount',
          'rate', 'amount', 'fee'
        ]
      END;
      IF cardinality(v_keys) > 0 THEN
        v_edge := public.wg_strip_named_edge_keys(v_edge, v_keys);
      END IF;
    END IF;
    v_edges := v_edges || jsonb_build_array(v_edge);
  END LOOP;

  RETURN jsonb_set(v_result, '{edges}', v_edges, true);
END;
$$;

REVOKE ALL ON FUNCTION public.wg_strip_commercial_edge(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wg_get_scoped_graph(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_get_scoped_graph(TEXT) TO authenticated;

COMMENT ON FUNCTION public.wg_get_scoped_graph(TEXT) IS
  'Privity projection. Billing-edge markup and rates stay only for org_admin or org_finance of the selling party. Funding amounts are left as the privity projection returned them.';

COMMIT;
