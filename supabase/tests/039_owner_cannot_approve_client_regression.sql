-- Regression for migration 039. Synthetic accounts; ROLLBACK at the end.
-- Nikola can approve the agency step. He cannot approve the client step even
-- when that row's approver_user_id has been set to him.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/039_owner_cannot_approve_client_regression.sql

BEGIN;

CREATE TEMP TABLE wg_regression_039_results (
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
  ('03900000-0000-4000-8000-0000000000a1'::uuid, 'nikola-039@example.test', 'Nikola'),
  ('03900000-0000-4000-8000-0000000000b1'::uuid, 'rodman-039@example.test', 'Rodman'),
  ('03900000-0000-4000-8000-0000000000c1'::uuid, 'james-039@example.test', 'James')
) AS u(id, email, display_name);

INSERT INTO public.wg_projects (id, name, owner_id, graph, parties) VALUES (
  'proj_reg_039', 'Approver party', '03900000-0000-4000-8000-0000000000a1',
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'party_contractor', 'type', 'party', 'data', jsonb_build_object('name', 'Rodman Co')),
      jsonb_build_object('id', 'party_agency', 'type', 'party', 'data', jsonb_build_object('name', 'Nikola Agency', 'isCreator', true)),
      jsonb_build_object('id', 'party_client', 'type', 'party', 'data', jsonb_build_object('name', 'James Client')),
      jsonb_build_object('id', 'person_rodman', 'type', 'person', 'data', jsonb_build_object('name', 'Rodman', 'partyId', 'party_contractor', 'userId', '03900000-0000-4000-8000-0000000000b1')),
      jsonb_build_object('id', 'person_nikola', 'type', 'person', 'data', jsonb_build_object('name', 'Nikola', 'partyId', 'party_agency', 'canApprove', true, 'userId', '03900000-0000-4000-8000-0000000000a1')),
      jsonb_build_object('id', 'person_james', 'type', 'person', 'data', jsonb_build_object('name', 'James', 'partyId', 'party_client', 'canApprove', true, 'userId', '03900000-0000-4000-8000-0000000000c1'))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'e1', 'source', 'party_contractor', 'target', 'party_agency', 'type', 'billsTo'),
      jsonb_build_object('id', 'e2', 'source', 'party_agency', 'target', 'party_client', 'type', 'billsTo')
    )
  ),
  '[]'::jsonb
);

INSERT INTO public.wg_project_members (
  id, project_id, user_id, user_name, role, scope, graph_node_id, invited_by, accepted_at, can_approve
) VALUES
  ('mem_039_nikola', 'proj_reg_039', '03900000-0000-4000-8000-0000000000a1', 'Nikola', 'Owner', 'party_agency', 'person_nikola', '03900000-0000-4000-8000-0000000000a1', NOW(), true),
  ('mem_039_rodman', 'proj_reg_039', '03900000-0000-4000-8000-0000000000b1', 'Rodman', 'Contributor', 'party_contractor', 'person_rodman', '03900000-0000-4000-8000-0000000000a1', NOW(), false),
  ('mem_039_james', 'proj_reg_039', '03900000-0000-4000-8000-0000000000c1', 'James', 'Commenter', 'party_client', 'person_james', '03900000-0000-4000-8000-0000000000a1', NOW(), true);

INSERT INTO public.wg_timesheet_weeks (id, user_id, project_id, week_start, status, data) VALUES
  ('03900000-0000-4000-8000-0000000000b1:2026-09-07', '03900000-0000-4000-8000-0000000000b1', 'proj_reg_039', DATE '2026-09-07', 'draft', '{"totalHours":8}'::jsonb),
  ('03900000-0000-4000-8000-0000000000b1:2026-09-14', '03900000-0000-4000-8000-0000000000b1', 'proj_reg_039', DATE '2026-09-14', 'draft', '{"totalHours":4}'::jsonb);

-- A client step forged so the assigned user is the project owner.
SELECT set_config('wg.approval_write', 'on', true);
UPDATE public.wg_timesheet_weeks
SET status = 'submitted', submitted_at = now()
WHERE id = '03900000-0000-4000-8000-0000000000b1:2026-09-07';
SELECT set_config('wg.approval_write', 'off', true);

INSERT INTO public.approval_records (
  id, project_id, subject_type, subject_id,
  approver_user_id, approver_name, approver_node_id,
  approval_layer, status, submitter_user_id
) VALUES (
  'appr_039_client', 'proj_reg_039', 'timesheet', 'person_rodman:2026-09-07',
  '03900000-0000-4000-8000-0000000000a1', 'Nikola', 'party_client',
  2, 'pending', '03900000-0000-4000-8000-0000000000b1'
);

CREATE OR REPLACE FUNCTION public.wg_test_039_act_as(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  IF auth.uid() IS DISTINCT FROM p_uid THEN
    RAISE EXCEPTION 'auth.uid() did not follow fixture %', p_uid;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.wg_test_039_act_as(uuid) TO authenticated;
GRANT INSERT ON wg_regression_039_results TO authenticated;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  denied boolean := false;
  decision jsonb;
  week_status text;
  fresh jsonb;
BEGIN
  PERFORM public.wg_test_039_act_as('03900000-0000-4000-8000-0000000000a1');
  BEGIN
    PERFORM public.wg_decide_approval('appr_039_client', 'approved', NULL);
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Nikola approved the client step';
  END IF;
  SELECT status INTO week_status FROM public.wg_timesheet_weeks
  WHERE id = '03900000-0000-4000-8000-0000000000b1:2026-09-07';
  IF week_status <> 'submitted' THEN
    RAISE EXCEPTION 'forged client approval changed the week to %', week_status;
  END IF;
  IF (SELECT status FROM public.approval_records WHERE id = 'appr_039_client') <> 'pending' THEN
    RAISE EXCEPTION 'forged client row was decided';
  END IF;

  -- The real chain still works: Rodman submits a second week, Nikola approves
  -- his own party, James approves the client.
  PERFORM public.wg_test_039_act_as('03900000-0000-4000-8000-0000000000b1');
  fresh := public.wg_submit_timesheet(
    'proj_reg_039', DATE '2026-09-14', 'person_rodman:2026-09-14', '{}'::jsonb
  );
  denied := false;
  BEGIN
    PERFORM public.wg_decide_approval(fresh->'approval'->>'id', 'approved', NULL);
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Rodman approved his own submission'; END IF;

  PERFORM public.wg_test_039_act_as('03900000-0000-4000-8000-0000000000a1');
  decision := public.wg_decide_approval(fresh->'approval'->>'id', 'approved', NULL);
  IF decision->'next'->>'approver_user_id' IS DISTINCT FROM '03900000-0000-4000-8000-0000000000c1'
     OR decision->>'weekStatus' <> 'submitted' THEN
    RAISE EXCEPTION 'Nikola could not approve his own party: %', decision;
  END IF;

  PERFORM public.wg_test_039_act_as('03900000-0000-4000-8000-0000000000c1');
  decision := public.wg_decide_approval(decision->'next'->>'id', 'approved', NULL);
  IF decision->>'weekStatus' <> 'approved' THEN
    RAISE EXCEPTION 'James could not approve his own party: %', decision->>'weekStatus';
  END IF;

  INSERT INTO wg_regression_039_results VALUES
    ('owner_cannot_decide_client_step', 'Nikola is rejected on a client step even when approver_user_id is his own user. He can still approve the agency step, and James can approve the client step. Rodman cannot approve himself.');
END $$;

RESET ROLE;

SELECT check_name, detail FROM wg_regression_039_results ORDER BY check_name;

ROLLBACK;
