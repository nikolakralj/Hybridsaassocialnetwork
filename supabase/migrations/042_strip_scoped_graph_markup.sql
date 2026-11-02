-- 042: wg_get_scoped_graph strips commercial fields on billing edges unless
-- the caller is org_admin or org_finance of the selling party (the source).
-- Funding edges are not treated as sales: their amount stays for whoever
-- the privity projection already allowed to see the edge.

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

CREATE FUNCTION public.wg_get_scoped_graph(p_project_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_parties text[];
  v_role text;
  v_finance boolean;
  v_edges jsonb := '[]'::jsonb;
  v_edge jsonb;
  v_kind text;
BEGIN
  v_result := public.wg_get_scoped_graph_with_role_meta(p_project_id);

  SELECT COALESCE(array_agg(value), '{}')
  INTO v_parties
  FROM jsonb_array_elements_text(COALESCE(v_result #> '{meta,viewerPartyIds}', '[]'::jsonb));
  v_role := COALESCE(v_result #>> '{meta,viewerOrgRole}', '');
  v_finance := v_role IN ('org_admin', 'org_finance');

  FOR v_edge IN
    SELECT value FROM jsonb_array_elements(COALESCE(v_result->'edges', '[]'::jsonb))
  LOOP
    v_kind := COALESCE(v_edge->'data'->>'edgeType', v_edge->>'type', '');
    IF v_kind IN ('billsTo', 'subcontracts', 'bills_to')
       AND NOT (v_finance AND v_edge->>'source' = ANY(v_parties)) THEN
      v_edges := v_edges || jsonb_build_array(public.wg_strip_commercial_edge(v_edge));
    ELSE
      v_edges := v_edges || jsonb_build_array(v_edge);
    END IF;
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
