-- Regression for migration 038. Synthetic accounts; ROLLBACK at the end.
-- Rodman submits. Nikola approves. James approves.
-- A one-step snapshot must not mark the week approved while James is still upstream.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/038_server_next_approval_regression.sql

BEGIN;

CREATE TEMP TABLE wg_regression_038_results (
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
  ('03800000-0000-4000-8000-0000000000a1'::uuid, 'nikola-038@example.test', 'Nikola'),
  ('03800000-0000-4000-8000-0000000000b1'::uuid, 'rodman-038@example.test', 'Rodman'),
  ('03800000-0000-4000-8000-0000000000c1'::uuid, 'james-038@example.test', 'James')
) AS u(id, email, display_name);

INSERT INTO public.wg_projects (id, name, owner_id, graph, parties) VALUES (
  'proj_reg_038', 'Server route', '03800000-0000-4000-8000-0000000000a1',
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'party_contractor', 'type', 'party', 'data', jsonb_build_object('name', 'Rodman Co')),
      jsonb_build_object('id', 'party_agency', 'type', 'party', 'data', jsonb_build_object('name', 'Nikola Agency', 'isCreator', true)),
      jsonb_build_object('id', 'party_client', 'type', 'party', 'data', jsonb_build_object('name', 'James Client')),
      jsonb_build_object('id', 'person_rodman', 'type', 'person', 'data', jsonb_build_object('name', 'Rodman', 'partyId', 'party_contractor', 'userId', '03800000-0000-4000-8000-0000000000b1')),
      jsonb_build_object('id', 'person_nikola', 'type', 'person', 'data', jsonb_build_object('name', 'Nikola', 'partyId', 'party_agency', 'canApprove', true, 'userId', '03800000-0000-4000-8000-0000000000a1')),
      jsonb_build_object('id', 'person_james', 'type', 'person', 'data', jsonb_build_object('name', 'James', 'partyId', 'party_client', 'canApprove', true, 'userId', '03800000-0000-4000-8000-0000000000c1'))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'e1', 'source', 'party_contractor', 'target', 'party_agency', 'type', 'billsTo', 'data', jsonb_build_object('edgeType', 'billsTo')),
      jsonb_build_object('id', 'e2', 'source', 'party_agency', 'target', 'party_client', 'type', 'billsTo', 'data', jsonb_build_object('edgeType', 'billsTo'))
    )
  ),
  '[]'::jsonb
);

INSERT INTO public.wg_project_members (
  id, project_id, user_id, user_name, role, scope, graph_node_id, invited_by, accepted_at, can_approve
) VALUES
  ('mem_038_nikola', 'proj_reg_038', '03800000-0000-4000-8000-0000000000a1', 'Nikola', 'Owner', 'party_agency', 'person_nikola', '03800000-0000-4000-8000-0000000000a1', NOW(), true),
  ('mem_038_rodman', 'proj_reg_038', '03800000-0000-4000-8000-0000000000b1', 'Rodman', 'Contributor', 'party_contractor', 'person_rodman', '03800000-0000-4000-8000-0000000000a1', NOW(), false),
  ('mem_038_james', 'proj_reg_038', '03800000-0000-4000-8000-0000000000c1', 'James', 'Commenter', 'party_client', 'person_james', '03800000-0000-4000-8000-0000000000a1', NOW(), true);

INSERT INTO public.wg_timesheet_weeks (id, user_id, project_id, week_start, status, data) VALUES
  ('03800000-0000-4000-8000-0000000000b1:2026-09-07', '03800000-0000-4000-8000-0000000000b1', 'proj_reg_038', DATE '2026-09-07', 'draft', '{"totalHours":8}'::jsonb),
  ('03800000-0000-4000-8000-0000000000b1:2026-09-14', '03800000-0000-4000-8000-0000000000b1', 'proj_reg_038', DATE '2026-09-14', 'draft', '{"totalHours":4}'::jsonb);

-- Legacy pending row: the approver id is Nikola's user id, not the party id,
-- and the stored route has only the agency step.
SELECT set_config('wg.approval_write', 'on', true);
UPDATE public.wg_timesheet_weeks
SET status = 'submitted', submitted_at = now()
WHERE id = '03800000-0000-4000-8000-0000000000b1:2026-09-14';
SELECT set_config('wg.approval_write', 'off', true);

INSERT INTO public.approval_records (
  id, project_id, subject_type, subject_id, subject_snapshot,
  approver_user_id, approver_name, approver_node_id,
  approval_layer, status, submitter_user_id
) VALUES (
  'appr_038_short', 'proj_reg_038', 'timesheet', 'person_rodman:2026-09-14',
  jsonb_build_object(
    'hours', 4,
    'approvalRoute', jsonb_build_array(
      jsonb_build_object('step', 1, 'partyId', 'party_agency', 'partyName', 'Nikola Agency', 'approverUserId', '03800000-0000-4000-8000-0000000000a1')
    )
  ),
  '03800000-0000-4000-8000-0000000000a1', 'Nikola', '03800000-0000-4000-8000-0000000000a1',
  1, 'pending', '03800000-0000-4000-8000-0000000000b1'
);

CREATE OR REPLACE FUNCTION public.wg_test_038_act_as(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  IF auth.uid() IS DISTINCT FROM p_uid THEN
    RAISE EXCEPTION 'auth.uid() did not follow fixture %', p_uid;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.wg_test_038_act_as(uuid) TO authenticated;
GRANT INSERT ON wg_regression_038_results TO authenticated;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  submitted jsonb;
  decision jsonb;
  denied boolean := false;
  week_status text;
  layers integer;
BEGIN
  -- Short snapshot. Nikola's user id is not a party id on the route, so the
  -- old code followed the one-step snapshot and approved the week.
  PERFORM public.wg_test_038_act_as('03800000-0000-4000-8000-0000000000a1');
  decision := public.wg_decide_approval('appr_038_short', 'approved', NULL);
  IF decision->'next'->>'approver_user_id' IS DISTINCT FROM '03800000-0000-4000-8000-0000000000c1' THEN
    RAISE EXCEPTION 'short snapshot did not spawn James: %', decision->'next';
  END IF;
  IF decision->>'weekStatus' <> 'submitted' THEN
    RAISE EXCEPTION 'short snapshot marked the week %', decision->>'weekStatus';
  END IF;
  SELECT status INTO week_status FROM public.wg_timesheet_weeks
  WHERE id = '03800000-0000-4000-8000-0000000000b1:2026-09-14';
  IF week_status <> 'submitted' THEN
    RAISE EXCEPTION 'week status % after the short snapshot', week_status;
  END IF;

  -- James approves the spawned layer. That is the last server step.
  PERFORM public.wg_test_038_act_as('03800000-0000-4000-8000-0000000000c1');
  decision := public.wg_decide_approval(decision->'next'->>'id', 'approved', NULL);
  IF decision->'next' IS NOT NULL AND decision->'next' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'James''s approval spawned another layer: %', decision->'next';
  END IF;
  IF decision->>'weekStatus' <> 'approved' THEN
    RAISE EXCEPTION 'week % after James approved', decision->>'weekStatus';
  END IF;
  denied := false;
  BEGIN
    PERFORM public.wg_decide_approval(decision->'approval'->>'id', 'approved', NULL);
  EXCEPTION WHEN invalid_parameter_value THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'a second approval of James''s layer was accepted'; END IF;

  -- Fresh submit ignores a one-step route supplied by the caller.
  PERFORM public.wg_test_038_act_as('03800000-0000-4000-8000-0000000000b1');
  submitted := public.wg_submit_timesheet(
    'proj_reg_038', DATE '2026-09-07', 'person_rodman:2026-09-07',
    '{"approvalRoute":[{"step":1,"partyId":"party_agency"}]}'::jsonb
  );
  IF jsonb_array_length(submitted->'route') <> 2 THEN
    RAISE EXCEPTION 'submit route length % (expected Nikola then James)', jsonb_array_length(submitted->'route');
  END IF;
  IF submitted->'approval'->>'approver_user_id' IS DISTINCT FROM '03800000-0000-4000-8000-0000000000a1' THEN
    RAISE EXCEPTION 'layer 1 was %', submitted->'approval'->>'approver_user_id';
  END IF;
  SELECT count(*) INTO layers FROM public.approval_records
  WHERE subject_id = 'person_rodman:2026-09-07';
  IF layers <> 1 THEN RAISE EXCEPTION 'submit created % layers', layers; END IF;

  denied := false;
  BEGIN
    PERFORM public.wg_decide_approval(submitted->'approval'->>'id', 'approved', NULL);
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Rodman approved his own submission'; END IF;

  PERFORM public.wg_test_038_act_as('03800000-0000-4000-8000-0000000000a1');
  decision := public.wg_decide_approval(submitted->'approval'->>'id', 'approved', NULL);
  IF decision->'next'->>'approver_user_id' IS DISTINCT FROM '03800000-0000-4000-8000-0000000000c1'
     OR decision->>'weekStatus' <> 'submitted' THEN
    RAISE EXCEPTION 'Nikola''s approval did not leave the week with James: %', decision;
  END IF;

  PERFORM public.wg_test_038_act_as('03800000-0000-4000-8000-0000000000c1');
  decision := public.wg_decide_approval(decision->'next'->>'id', 'approved', NULL);
  IF decision->>'weekStatus' <> 'approved' THEN
    RAISE EXCEPTION 'James did not finish the fresh week: %', decision->>'weekStatus';
  END IF;

  INSERT INTO wg_regression_038_results VALUES
    ('server_route_not_snapshot', 'A one-step snapshot still spawns James and leaves the week submitted. Submit ignores a caller-supplied route. Rodman cannot approve himself. Nikola then James finishes the week, and a second decision does not spawn a layer.');
END $$;

RESET ROLE;

SELECT check_name, detail FROM wg_regression_038_results ORDER BY check_name;

ROLLBACK;
