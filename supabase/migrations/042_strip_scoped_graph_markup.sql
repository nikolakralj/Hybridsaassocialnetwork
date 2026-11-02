-- 042: wg_get_scoped_graph strips commercial edge fields unless the caller
-- is the seller. The seller is the party on the source side of the edge.
-- A project owner sees the topology and their own sell markup, not the
-- markup on an edge they buy.

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
  v_edges jsonb := '[]'::jsonb;
  v_edge jsonb;
BEGIN
  v_result := public.wg_get_scoped_graph_with_role_meta(p_project_id);

  SELECT COALESCE(array_agg(value), '{}')
  INTO v_parties
  FROM jsonb_array_elements_text(COALESCE(v_result #> '{meta,viewerPartyIds}', '[]'::jsonb));

  FOR v_edge IN
    SELECT value FROM jsonb_array_elements(COALESCE(v_result->'edges', '[]'::jsonb))
  LOOP
    IF v_edge->>'source' = ANY(v_parties) THEN
      v_edges := v_edges || jsonb_build_array(v_edge);
    ELSE
      v_edges := v_edges || jsonb_build_array(public.wg_strip_commercial_edge(v_edge));
    END IF;
  END LOOP;

  RETURN jsonb_set(v_result, '{edges}', v_edges, true);
END;
$$;

REVOKE ALL ON FUNCTION public.wg_strip_commercial_edge(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wg_get_scoped_graph(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_get_scoped_graph(TEXT) TO authenticated;

COMMENT ON FUNCTION public.wg_get_scoped_graph(TEXT) IS
  'Privity projection. Commercial edge fields (markup, margin, rates) stay only on edges the caller sells.';

COMMIT;
