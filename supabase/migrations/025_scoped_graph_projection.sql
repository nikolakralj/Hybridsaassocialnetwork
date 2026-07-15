-- 025_scoped_graph_projection.sql
-- M2 core: the Privity Rule as SERVER TRUTH.
--
-- wg_get_scoped_graph(project_id) returns only the nodes/edges the caller may
-- see, with commercial fields stripped (not masked — absent). Unauthorized
-- parties never reach the browser payload. Implements GRAPH_CONFIDENTIALITY_SPEC
-- "DECIDED 2026-07-15 — The Privity Rule":
--
--   * org sight = own org + direct counterparties (one hop); beyond = counted,
--     anonymous external stages
--   * person sight = org sight ∩ org role ∩ per-assignment visibility_scope
--   * project managers (owner/editor) see full TOPOLOGY but rates only for
--     their own org — ownership is not commercial omniscience
--   * person-node pay fields visible only to: the person themself, and
--     org_admin/org_finance of their own org
--
-- Client adoption note: src/utils/api/scoped-graph-api.ts wraps this RPC.
-- WorkGraphContext/Builder switch to it in M2-WIRE (after current UI work).

-- Per-assignment worker sight (the spec's three modes). Independent axis from
-- visibility_mode (which controls who may see the WORKER).
ALTER TABLE wg_project_roster
  ADD COLUMN IF NOT EXISTS visibility_scope TEXT NOT NULL DEFAULT 'company_only'
    CHECK (visibility_scope IN ('company_only', 'counterparty', 'named_chain')),
  ADD COLUMN IF NOT EXISTS visible_org_node_ids TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN wg_project_roster.visibility_scope IS
  'What the assigned person may SEE: own company only (default), plus immediate counterparty, or an explicitly named chain.';

CREATE OR REPLACE FUNCTION public.wg_get_scoped_graph(p_project_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid              UUID := auth.uid();
  v_graph            JSONB;
  v_nodes            JSONB;
  v_edges            JSONB;
  v_is_manager       BOOLEAN;
  v_own_party_ids    TEXT[] := '{}';
  v_best_role        TEXT;
  v_person_node_id   TEXT;
  v_scope            TEXT;
  v_named            TEXT[] := '{}';
  v_all_party_ids    TEXT[] := '{}';
  v_visible_parties  TEXT[] := '{}';
  v_visible_nodes    JSONB;
  v_visible_ids      TEXT[];
  v_visible_edges    JSONB;
  v_hidden_parties   INT;
  v_hidden_nodes     INT;
  v_total_nodes      INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT wg_user_can_see_project(p_project_id) THEN
    RAISE EXCEPTION 'Not a member of this project' USING ERRCODE = '42501';
  END IF;

  SELECT graph INTO v_graph FROM wg_projects WHERE id = p_project_id;
  IF v_graph IS NULL THEN
    RETURN jsonb_build_object('nodes', '[]'::jsonb, 'edges', '[]'::jsonb,
      'meta', jsonb_build_object('empty', true));
  END IF;

  v_nodes := COALESCE(v_graph->'nodes', '[]'::jsonb);
  v_edges := COALESCE(v_graph->'edges', '[]'::jsonb);
  v_is_manager := wg_user_can_manage_project(p_project_id);

  -- Caller's org party nodes on this project + best org role across them.
  SELECT COALESCE(array_agg(DISTINCT po.graph_node_id), '{}'),
         MIN(CASE om.org_role
               WHEN 'org_admin'   THEN 1
               WHEN 'org_finance' THEN 2
               WHEN 'org_manager' THEN 3
               WHEN 'org_worker'  THEN 4
               ELSE 5 END)
  INTO v_own_party_ids, v_best_role
  FROM wg_project_organizations po
  JOIN wg_organization_members om ON om.organization_id = po.organization_id
  WHERE po.project_id = p_project_id
    AND po.status = 'active'
    AND po.graph_node_id IS NOT NULL
    AND om.user_id = v_uid
    AND om.membership_state = 'verified';

  v_best_role := CASE v_best_role::TEXT
    WHEN '1' THEN 'org_admin' WHEN '2' THEN 'org_finance'
    WHEN '3' THEN 'org_manager' WHEN '4' THEN 'org_worker' ELSE NULL END;

  -- Caller's person node + per-assignment sight.
  SELECT r.graph_node_id, r.visibility_scope, COALESCE(r.visible_org_node_ids, '{}')
  INTO v_person_node_id, v_scope, v_named
  FROM wg_project_roster r
  WHERE r.project_id = p_project_id
    AND r.user_id = v_uid
    AND r.assignment_status = 'active'
  LIMIT 1;

  IF v_person_node_id IS NULL THEN
    SELECT m.graph_node_id INTO v_person_node_id
    FROM wg_project_members m
    WHERE m.project_id = p_project_id
      AND m.user_id = v_uid
      AND m.accepted_at IS NOT NULL
      AND m.graph_node_id IS NOT NULL
    LIMIT 1;
  END IF;

  -- Legacy fallback: derive own party from the caller's person node.
  IF COALESCE(array_length(v_own_party_ids, 1), 0) = 0 AND v_person_node_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(node->'data'->>'partyId'), '{}')
    INTO v_own_party_ids
    FROM jsonb_array_elements(v_nodes) AS node
    WHERE node->>'type' = 'person'
      AND node->>'id' = v_person_node_id
      AND node->'data'->>'partyId' IS NOT NULL;
  END IF;

  SELECT COALESCE(array_agg(node->>'id'), '{}'), COUNT(*)::INT
  INTO v_all_party_ids, v_hidden_parties  -- reuse var; real hidden computed later
  FROM jsonb_array_elements(v_nodes) AS node
  WHERE node->>'type' = 'party';

  -- ------------------------------------------------------------------
  -- Visible party set
  -- ------------------------------------------------------------------
  IF v_is_manager THEN
    v_visible_parties := v_all_party_ids; -- full topology; commerce masked below
  ELSE
    v_visible_parties := v_own_party_ids;
    IF v_best_role IN ('org_admin', 'org_finance', 'org_manager')
       OR COALESCE(v_scope, 'company_only') = 'counterparty' THEN
      -- one hop: parties connected to own parties by a billing-ish edge
      v_visible_parties := (
        SELECT COALESCE(array_agg(DISTINCT pid), '{}')
        FROM (
          SELECT unnest(v_visible_parties) AS pid
          UNION
          SELECT CASE WHEN edge->>'source' = ANY(v_own_party_ids)
                      THEN edge->>'target' ELSE edge->>'source' END
          FROM jsonb_array_elements(v_edges) AS edge
          WHERE COALESCE(edge->'data'->>'edgeType', edge->>'type')
                  IN ('billsTo', 'bills_to', 'subcontracts')
            AND (edge->>'source' = ANY(v_own_party_ids)
                 OR edge->>'target' = ANY(v_own_party_ids))
        ) s
        WHERE s.pid = ANY(v_all_party_ids)
      );
    ELSIF COALESCE(v_scope, 'company_only') = 'named_chain' THEN
      v_visible_parties := (
        SELECT COALESCE(array_agg(DISTINCT pid), '{}')
        FROM unnest(v_visible_parties || v_named) AS pid
        WHERE pid = ANY(v_all_party_ids)
      );
    END IF;
  END IF;

  -- ------------------------------------------------------------------
  -- Visible nodes, with commercial stripping.
  -- Pay fields survive ONLY for: self, or own-org person viewed by
  -- org_admin/org_finance (managers of the project included only when the
  -- person is in the manager's own org).
  -- ------------------------------------------------------------------
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN node->>'type' = 'person'
           AND NOT (
             node->>'id' = COALESCE(v_person_node_id, '')
             OR (
               COALESCE(node->'data'->>'partyId', node->'data'->>'orgId') = ANY(v_own_party_ids)
               AND COALESCE(v_best_role, CASE WHEN v_is_manager THEN 'org_admin' ELSE '' END)
                     IN ('org_admin', 'org_finance')
             )
           )
      THEN jsonb_set(node, '{data}',
             (node->'data') - 'hourlyRate' - 'dailyRate' - 'fixedAmount'
                            - 'weeklyHourLimit' - 'monthlyHourLimit'
                            - CASE WHEN COALESCE(node->'data'->>'partyId', node->'data'->>'orgId')
                                        = ANY(v_own_party_ids)
                                   THEN 'x_keep_email' ELSE 'email' END,
             true)
      ELSE node
    END
  ), '[]'::jsonb)
  INTO v_visible_nodes
  FROM jsonb_array_elements(v_nodes) AS node
  WHERE
    CASE
      WHEN v_is_manager THEN TRUE
      WHEN node->>'type' = 'party' THEN node->>'id' = ANY(v_visible_parties)
      WHEN node->>'type' = 'person' THEN
        node->>'id' = COALESCE(v_person_node_id, '')
        OR COALESCE(node->'data'->>'partyId', node->'data'->>'orgId') = ANY(v_own_party_ids)
        OR (
          COALESCE(node->'data'->>'partyId', node->'data'->>'orgId') = ANY(v_visible_parties)
          AND COALESCE((node->'data'->>'canApprove')::boolean, false)
        )
      ELSE FALSE -- contract/other nodes: managers only in v1
    END;

  SELECT COALESCE(array_agg(node->>'id'), '{}')
  INTO v_visible_ids
  FROM jsonb_array_elements(v_visible_nodes) AS node;

  SELECT COALESCE(jsonb_agg(edge), '[]'::jsonb)
  INTO v_visible_edges
  FROM jsonb_array_elements(v_edges) AS edge
  WHERE edge->>'source' = ANY(v_visible_ids)
    AND edge->>'target' = ANY(v_visible_ids);

  SELECT COUNT(*)::INT INTO v_total_nodes FROM jsonb_array_elements(v_nodes);
  v_hidden_parties := (
    SELECT COUNT(*)::INT FROM unnest(v_all_party_ids) AS pid
    WHERE NOT (pid = ANY(v_visible_parties))
  );
  v_hidden_nodes := v_total_nodes - COALESCE(jsonb_array_length(v_visible_nodes), 0);

  RETURN jsonb_build_object(
    'nodes', v_visible_nodes,
    'edges', v_visible_edges,
    'meta', jsonb_build_object(
      'projection', 'privity_v1',
      'viewerPersonNodeId', v_person_node_id,
      'viewerPartyIds', to_jsonb(v_own_party_ids),
      'viewerOrgRole', v_best_role,
      'isProjectManager', v_is_manager,
      'visibilityScope', COALESCE(v_scope,
        CASE WHEN v_best_role IN ('org_admin','org_finance','org_manager')
             THEN 'counterparty' ELSE 'company_only' END),
      'externalStages', v_hidden_parties,
      'hiddenNodeCount', v_hidden_nodes
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.wg_get_scoped_graph(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_get_scoped_graph(TEXT) TO authenticated;

COMMENT ON FUNCTION public.wg_get_scoped_graph(TEXT) IS
  'Privity Rule projection: returns only the graph nodes/edges the caller may see, with commercial fields removed. Unauthorized parties are never serialized.';
