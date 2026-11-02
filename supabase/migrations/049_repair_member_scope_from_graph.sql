-- 049_repair_member_scope_from_graph.sql
-- One-off data repair. Before #20 (31b927a), accepting a plain invite could
-- overwrite a wizard placeholder's party scope with the project owner's party
-- ('your-org'). The code path is fixed, but rows written before the fix keep
-- the wrong scope, and every party ACL (044 wg_user_is_party_commercial,
-- 046/047/048 invoices, link rates, scoped graph) trusts wg_project_members.scope.
--
-- Repairs: a member row linked to a person node in its project's graph whose
-- company (data.partyId / data.orgId) is a party node of that graph, when the
-- row's scope differs. The scope becomes that company.
--
-- Read-only check on live (2026-11-02 17:20 Europe/Zagreb): exactly one row,
-- the test user hanna.triangle+vis-subworker (Will) on proj_1793627895115_8piqgy3,
-- scope 'your-org' instead of party-1793627888381-3rsp (Vis Sub Ltd).
--
-- NOT APPLIED. Independent of 043-048; apply after #20's server code is deployed
-- so no new wrong rows are written.

BEGIN;

WITH graph_people AS (
  SELECT p.id AS project_id,
         n->>'id' AS node_id,
         COALESCE(n->'data'->>'partyId', n->'data'->>'orgId') AS party_id
  FROM wg_projects p
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.graph->'nodes', '[]'::jsonb)) n
  WHERE n->>'type' = 'person'
), graph_parties AS (
  SELECT p.id AS project_id, n->>'id' AS party_id
  FROM wg_projects p
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.graph->'nodes', '[]'::jsonb)) n
  WHERE n->>'type' IN ('party', 'organization', 'company')
), fixes AS (
  SELECT m.id, gp.party_id
  FROM wg_project_members m
  JOIN graph_people gp ON gp.project_id = m.project_id AND gp.node_id = m.graph_node_id
  JOIN graph_parties pt ON pt.project_id = m.project_id AND pt.party_id = gp.party_id
  WHERE gp.party_id IS NOT NULL
    AND m.scope IS DISTINCT FROM gp.party_id
)
UPDATE wg_project_members m
   SET scope = fixes.party_id
  FROM fixes
 WHERE m.id = fixes.id;

COMMIT;
