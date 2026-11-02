-- Regression for migration 042. Synthetic accounts; ROLLBACK at the end.
-- Nikola sells to James (markup 22) and buys from Rodman (markup 17.25).
-- James, as a client manager, can see the edge he is billed on and not its markup.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/042_strip_edge_markup_regression.sql

BEGIN;

CREATE TEMP TABLE wg_regression_042_results (
  check_name TEXT PRIMARY KEY,
  detail TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
SELECT
  (SELECT id FROM auth.instances LIMIT 1), u.id, 'authenticated', 'authenticated', u.email, '', NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', u.display_name),
  NOW(), NOW(), '', '', '', ''
FROM (VALUES
  ('04200000-0000-4000-8000-0000000000a1'::uuid, 'nikola-042@example.test', 'Nikola'),
  ('04200000-0000-4000-8000-0000000000b1'::uuid, 'rodman-042@example.test', 'Rodman'),
  ('04200000-0000-4000-8000-0000000000c1'::uuid, 'james-042@example.test', 'James')
) AS u(id, email, display_name);

INSERT INTO public.wg_projects (id, name, owner_id, graph, parties) VALUES (
  'proj_reg_042', 'Markup', '04200000-0000-4000-8000-0000000000a1',
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'party_contractor', 'type', 'party', 'data', jsonb_build_object('name', 'Rodman Co')),
      jsonb_build_object('id', 'party_agency', 'type', 'party', 'data', jsonb_build_object('name', 'Nikola Agency', 'isCreator', true)),
      jsonb_build_object('id', 'party_client', 'type', 'party', 'data', jsonb_build_object('name', 'James Client')),
      jsonb_build_object('id', 'person_rodman', 'type', 'person', 'data', jsonb_build_object('name', 'Rodman', 'partyId', 'party_contractor', 'userId', '04200000-0000-4000-8000-0000000000b1')),
      jsonb_build_object('id', 'person_nikola', 'type', 'person', 'data', jsonb_build_object('name', 'Nikola', 'partyId', 'party_agency', 'canApprove', true, 'userId', '04200000-0000-4000-8000-0000000000a1')),
      jsonb_build_object('id', 'person_james', 'type', 'person', 'data', jsonb_build_object('name', 'James', 'partyId', 'party_client', 'canApprove', true, 'userId', '04200000-0000-4000-8000-0000000000c1'))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'e_buy', 'source', 'party_contractor', 'target', 'party_agency', 'type', 'billsTo', 'data', jsonb_build_object('edgeType', 'billsTo', 'markup', 17.25)),
      jsonb_build_object('id', 'e_sell', 'source', 'party_agency', 'target', 'party_client', 'type', 'billsTo', 'data', jsonb_build_object('edgeType', 'billsTo', 'markup', 22))
    )
  ),
  '[]'::jsonb
);

INSERT INTO public.wg_project_members (
  id, project_id, user_id, user_name, role, scope, graph_node_id, invited_by, accepted_at
) VALUES
  ('mem_042_nikola', 'proj_reg_042', '04200000-0000-4000-8000-0000000000a1', 'Nikola', 'Owner', 'party_agency', 'person_nikola', '04200000-0000-4000-8000-0000000000a1', NOW()),
  ('mem_042_rodman', 'proj_reg_042', '04200000-0000-4000-8000-0000000000b1', 'Rodman', 'Contributor', 'party_contractor', 'person_rodman', '04200000-0000-4000-8000-0000000000a1', NOW()),
  ('mem_042_james', 'proj_reg_042', '04200000-0000-4000-8000-0000000000c1', 'James', 'Commenter', 'party_client', 'person_james', '04200000-0000-4000-8000-0000000000a1', NOW());

INSERT INTO public.wg_organizations (id, name, owner_user_id, created_by) VALUES
  ('org_042_client', 'James Client', '04200000-0000-4000-8000-0000000000c1', '04200000-0000-4000-8000-0000000000c1');
INSERT INTO public.wg_organization_members (id, organization_id, user_id, org_role, membership_state) VALUES
  ('orgmem_042_james', 'org_042_client', '04200000-0000-4000-8000-0000000000c1', 'org_manager', 'verified');
INSERT INTO public.wg_project_organizations (id, project_id, organization_id, graph_node_id, party_role, status) VALUES
  ('porg_042_james', 'proj_reg_042', 'org_042_client', 'party_client', 'client', 'active');

CREATE OR REPLACE FUNCTION public.wg_test_042_act_as(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  IF auth.uid() IS DISTINCT FROM p_uid THEN
    RAISE EXCEPTION 'auth.uid() did not follow fixture %', p_uid;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.wg_test_042_act_as(uuid) TO authenticated;
GRANT INSERT ON wg_regression_042_results TO authenticated;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  scoped jsonb;
  sell_markup text;
  buy_markup text;
BEGIN
  PERFORM public.wg_test_042_act_as('04200000-0000-4000-8000-0000000000a1');
  scoped := public.wg_get_scoped_graph('proj_reg_042');
  SELECT e->'data'->>'markup' INTO sell_markup FROM jsonb_array_elements(scoped->'edges') e WHERE e->>'id' = 'e_sell';
  SELECT e->'data'->>'markup' INTO buy_markup FROM jsonb_array_elements(scoped->'edges') e WHERE e->>'id' = 'e_buy';
  IF sell_markup IS DISTINCT FROM '22' THEN
    RAISE EXCEPTION 'Nikola lost the markup on the edge he sells (%)', sell_markup;
  END IF;
  IF buy_markup IS NOT NULL OR scoped::text LIKE '%17.25%' THEN
    RAISE EXCEPTION 'Nikola saw the contractor markup he buys (%)', buy_markup;
  END IF;

  PERFORM public.wg_test_042_act_as('04200000-0000-4000-8000-0000000000c1');
  scoped := public.wg_get_scoped_graph('proj_reg_042');
  SELECT e->'data'->>'markup' INTO sell_markup FROM jsonb_array_elements(scoped->'edges') e WHERE e->>'id' = 'e_sell';
  IF sell_markup IS NOT NULL THEN
    RAISE EXCEPTION 'James saw the agency markup (%)', sell_markup;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(scoped->'edges') e WHERE e->>'id' = 'e_sell') THEN
    RAISE EXCEPTION 'James could not see the edge he is billed on';
  END IF;
  IF scoped::text LIKE '%17.25%' OR scoped::text LIKE '%22%' THEN
    RAISE EXCEPTION 'James saw a markup figure: %', scoped->'edges';
  END IF;

  PERFORM public.wg_test_042_act_as('04200000-0000-4000-8000-0000000000b1');
  scoped := public.wg_get_scoped_graph('proj_reg_042');
  IF scoped::text LIKE '%17.25%' OR scoped::text LIKE '%22%' THEN
    RAISE EXCEPTION 'Rodman saw an upstream markup';
  END IF;

  INSERT INTO wg_regression_042_results VALUES
    ('markup_only_for_seller', 'Nikola keeps markup 22 on the edge his agency sells and does not see 17.25 on the edge he buys. James sees that sell edge without the markup. Rodman sees neither figure.');
END $$;

RESET ROLE;

SELECT check_name, detail FROM wg_regression_042_results ORDER BY check_name;

ROLLBACK;
