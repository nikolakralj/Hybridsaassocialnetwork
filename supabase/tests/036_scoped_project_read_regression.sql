-- Regression for migration 036. Synthetic accounts; ROLLBACK at the end.
-- Rodman (contractor) and James (client) are members. Nikola owns the agency.
-- An outsider, and a member of a different project, see nothing.
--
-- Run as postgres:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/036_scoped_project_read_regression.sql

BEGIN;

CREATE TEMP TABLE wg_regression_036_results (
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
  ('03600000-0000-4000-8000-0000000000a1'::uuid, 'nikola-036@example.test', 'Nikola'),
  ('03600000-0000-4000-8000-0000000000b1'::uuid, 'rodman-036@example.test', 'Rodman'),
  ('03600000-0000-4000-8000-0000000000c1'::uuid, 'james-036@example.test', 'James'),
  ('03600000-0000-4000-8000-0000000000d1'::uuid, 'outsider-036@example.test', 'Outsider'),
  ('03600000-0000-4000-8000-0000000000e1'::uuid, 'other-036@example.test', 'Other project')
) AS u(id, email, display_name);

INSERT INTO public.wg_projects (id, name, owner_id, graph, parties)
VALUES (
  'proj_reg_036', 'Agency pilot', '03600000-0000-4000-8000-0000000000a1',
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'party_contractor', 'type', 'party', 'data', jsonb_build_object('name', 'Rodman Co')),
      jsonb_build_object('id', 'party_agency', 'type', 'party', 'data', jsonb_build_object('name', 'Nikola Agency', 'isCreator', true)),
      jsonb_build_object('id', 'party_client', 'type', 'party', 'data', jsonb_build_object('name', 'James Client')),
      jsonb_build_object('id', 'person_rodman', 'type', 'person', 'data', jsonb_build_object('name', 'Rodman', 'partyId', 'party_contractor', 'hourlyRate', 80.55, 'userId', '03600000-0000-4000-8000-0000000000b1')),
      jsonb_build_object('id', 'person_nikola', 'type', 'person', 'data', jsonb_build_object('name', 'Nikola', 'partyId', 'party_agency', 'canApprove', true, 'hourlyRate', 120)),
      jsonb_build_object('id', 'person_james', 'type', 'person', 'data', jsonb_build_object('name', 'James', 'partyId', 'party_client', 'canApprove', true, 'userId', '03600000-0000-4000-8000-0000000000c1'))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'e_contractor_agency', 'source', 'party_contractor', 'target', 'party_agency', 'type', 'billsTo', 'data', jsonb_build_object('edgeType', 'billsTo', 'markup', 17.25)),
      jsonb_build_object('id', 'e_agency_client', 'source', 'party_agency', 'target', 'party_client', 'type', 'billsTo', 'data', jsonb_build_object('edgeType', 'billsTo', 'markup', 22))
    )
  ),
  jsonb_build_array(jsonb_build_object('id', 'party_agency', 'hourlyRate', 120))
),
(
  'proj_reg_036_other', 'Someone else', '03600000-0000-4000-8000-0000000000e1',
  '{"nodes":[],"edges":[]}'::jsonb, '[]'::jsonb
);

INSERT INTO public.wg_project_members (
  id, project_id, user_id, user_name, user_email, role, scope, graph_node_id,
  invited_by, accepted_at, can_approve, can_view_rates, can_edit_timesheets, visible_to_chain
) VALUES
  ('mem_036_nikola', 'proj_reg_036', '03600000-0000-4000-8000-0000000000a1', 'Nikola', 'nikola-036@example.test', 'Owner', 'party_agency', 'person_nikola', '03600000-0000-4000-8000-0000000000a1', NOW(), true, true, true, true),
  ('mem_036_rodman', 'proj_reg_036', '03600000-0000-4000-8000-0000000000b1', 'Rodman', 'rodman-036@example.test', 'Contributor', 'party_contractor', 'person_rodman', '03600000-0000-4000-8000-0000000000a1', NOW(), false, false, true, true),
  ('mem_036_james', 'proj_reg_036', '03600000-0000-4000-8000-0000000000c1', 'James', 'james-036@example.test', 'Commenter', 'party_client', 'person_james', '03600000-0000-4000-8000-0000000000a1', NOW(), true, false, false, true),
  ('mem_036_other', 'proj_reg_036_other', '03600000-0000-4000-8000-0000000000e1', 'Other project', 'other-036@example.test', 'Owner', NULL, NULL, '03600000-0000-4000-8000-0000000000e1', NOW(), false, false, false, true);

CREATE OR REPLACE FUNCTION public.wg_test_036_act_as(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  IF auth.uid() IS DISTINCT FROM p_uid THEN
    RAISE EXCEPTION 'auth.uid() did not follow fixture %', p_uid;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.wg_test_036_act_as(uuid) TO authenticated;
GRANT INSERT ON wg_regression_036_results TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'wg_projects_directory'
      AND column_name IN ('graph', 'parties')
  ) THEN
    RAISE EXCEPTION 'wg_projects_directory still exposes graph or parties';
  END IF;
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  actor uuid;
  denied boolean;
  visible_name text;
  scoped jsonb;
BEGIN
  FOREACH actor IN ARRAY ARRAY[
    '03600000-0000-4000-8000-0000000000a1'::uuid,
    '03600000-0000-4000-8000-0000000000b1'::uuid,
    '03600000-0000-4000-8000-0000000000c1'::uuid
  ] LOOP
    PERFORM public.wg_test_036_act_as(actor);
    denied := false;
    BEGIN
      PERFORM graph FROM public.wg_projects WHERE id = 'proj_reg_036';
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;
    IF NOT denied THEN
      RAISE EXCEPTION '% read wg_projects.graph', actor;
    END IF;
    denied := false;
    BEGIN
      PERFORM parties FROM public.wg_projects WHERE id = 'proj_reg_036';
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;
    IF NOT denied THEN
      RAISE EXCEPTION '% read wg_projects.parties', actor;
    END IF;

    SELECT name INTO visible_name FROM public.wg_projects_directory WHERE id = 'proj_reg_036';
    IF visible_name IS DISTINCT FROM 'Agency pilot' THEN
      RAISE EXCEPTION '% lost the directory view (%)', actor, visible_name;
    END IF;
  END LOOP;

  PERFORM public.wg_test_036_act_as('03600000-0000-4000-8000-0000000000d1');
  IF (SELECT count(*) FROM public.wg_projects_directory WHERE id = 'proj_reg_036') <> 0 THEN
    RAISE EXCEPTION 'outsider read the project directory';
  END IF;
  IF (SELECT count(*) FROM public.wg_projects WHERE id = 'proj_reg_036') <> 0 THEN
    RAISE EXCEPTION 'outsider read wg_projects';
  END IF;

  PERFORM public.wg_test_036_act_as('03600000-0000-4000-8000-0000000000e1');
  IF (SELECT count(*) FROM public.wg_projects_directory WHERE id = 'proj_reg_036') <> 0 THEN
    RAISE EXCEPTION 'a member of another project read this project';
  END IF;

  -- Rodman sees his own rate. Nikola and James do not see 80.55.
  PERFORM public.wg_test_036_act_as('03600000-0000-4000-8000-0000000000b1');
  scoped := public.wg_get_scoped_graph('proj_reg_036');
  IF scoped::text NOT LIKE '%80.55%' THEN
    RAISE EXCEPTION 'Rodman lost his own rate in the scoped graph';
  END IF;

  PERFORM public.wg_test_036_act_as('03600000-0000-4000-8000-0000000000a1');
  scoped := public.wg_get_scoped_graph('proj_reg_036');
  IF scoped::text LIKE '%80.55%' THEN
    RAISE EXCEPTION 'Nikola saw Rodman''s rate through the scoped graph';
  END IF;

  PERFORM public.wg_test_036_act_as('03600000-0000-4000-8000-0000000000c1');
  scoped := public.wg_get_scoped_graph('proj_reg_036');
  IF scoped::text LIKE '%80.55%' THEN
    RAISE EXCEPTION 'James saw Rodman''s rate through the scoped graph';
  END IF;

  INSERT INTO wg_regression_036_results VALUES
    ('directory_hides_graph', 'Nikola, Rodman and James read the directory and cannot select graph or parties. Outsider and another project see zero rows. Rodman''s rate stays on his own scoped graph and off Nikola''s and James''s.');
END $$;

RESET ROLE;

SELECT check_name, detail FROM wg_regression_036_results ORDER BY check_name;

ROLLBACK;
