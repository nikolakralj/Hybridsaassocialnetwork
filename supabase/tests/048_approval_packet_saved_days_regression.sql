-- Regression for 048: forged daily facts never become the approval packet.
-- Run as postgres after 034 + draft 048; all synthetic fixtures roll back.
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/048_approval_packet_saved_days_regression.sql
BEGIN;

CREATE TEMP TABLE wg_regression_048_results (
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
  ('a0480000-0000-4000-8000-00000000000a'::uuid, 'owner-048@example.test', 'Agency Owner'),
  ('a0480000-0000-4000-8000-00000000000b'::uuid, 'worker-048@example.test', 'Worker'),
  ('a0480000-0000-4000-8000-00000000000c'::uuid, 'client-048@example.test', 'Client Approver'),
  ('a0480000-0000-4000-8000-00000000000d'::uuid, 'viewer-048@example.test', 'Client Viewer'),
  ('a0480000-0000-4000-8000-00000000000e'::uuid, 'end-048@example.test', 'End Approver')
) AS u(id, email, display_name);

INSERT INTO public.wg_projects (id, name, owner_id, graph, parties)
VALUES (
  'proj_reg_048', 'Synthetic 048 project', 'a0480000-0000-4000-8000-00000000000a',
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'party_a', 'type', 'party', 'data', jsonb_build_object('name', 'Agency', 'partyType', 'agency', 'isCreator', true)),
      jsonb_build_object('id', 'party_c', 'type', 'party', 'data', jsonb_build_object('name', 'Client', 'partyType', 'client')),
      jsonb_build_object('id', 'party_e', 'type', 'party', 'data', jsonb_build_object('name', 'End client', 'partyType', 'client')),
      jsonb_build_object('id', 'a0480000-0000-4000-8000-00000000000a', 'type', 'person', 'data', jsonb_build_object('name', 'Agency Owner', 'partyId', 'party_a', 'canApprove', true)),
      jsonb_build_object('id', 'person_w', 'type', 'person', 'data', jsonb_build_object('name', 'Worker', 'partyId', 'party_a', 'canApprove', false, 'userId', 'a0480000-0000-4000-8000-00000000000b', 'hourlyRate', 99.99)),
      jsonb_build_object('id', 'person_c', 'type', 'person', 'data', jsonb_build_object('name', 'Client Approver', 'partyId', 'party_c', 'canApprove', true, 'userId', 'a0480000-0000-4000-8000-00000000000c')),
      jsonb_build_object('id', 'person_x', 'type', 'person', 'data', jsonb_build_object('name', 'Client Viewer', 'partyId', 'party_c', 'canApprove', false, 'userId', 'a0480000-0000-4000-8000-00000000000d')),
      jsonb_build_object('id', 'person_e', 'type', 'person', 'data', jsonb_build_object('name', 'End Approver', 'partyId', 'party_e', 'canApprove', true))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'e1', 'source', 'party_a', 'target', 'party_c', 'type', 'billsTo', 'data', jsonb_build_object('edgeType', 'billsTo')),
      jsonb_build_object('id', 'e2', 'source', 'party_c', 'target', 'party_e', 'type', 'billsTo', 'data', jsonb_build_object('edgeType', 'billsTo'))
    )
  ),
  '[]'::jsonb
);

INSERT INTO public.wg_project_members (
  id, project_id, user_id, user_name, user_email, role, scope, graph_node_id,
  invited_by, accepted_at, can_approve, can_view_rates, can_edit_timesheets, visible_to_chain
) VALUES
  ('mem_048_a', 'proj_reg_048', 'a0480000-0000-4000-8000-00000000000a', 'Agency Owner', 'owner-048@example.test', 'Owner', 'party_a', 'a0480000-0000-4000-8000-00000000000a', 'a0480000-0000-4000-8000-00000000000a', NOW(), true, true, true, true),
  ('mem_048_w', 'proj_reg_048', 'a0480000-0000-4000-8000-00000000000b', 'Worker', 'worker-048@example.test', 'Contributor', 'party_a', 'person_w', 'a0480000-0000-4000-8000-00000000000a', NOW(), false, false, true, true),
  ('mem_048_c', 'proj_reg_048', 'a0480000-0000-4000-8000-00000000000c', 'Client Approver', 'client-048@example.test', 'Commenter', 'party_c', 'person_c', 'a0480000-0000-4000-8000-00000000000a', NOW(), true, false, false, true),
  ('mem_048_x', 'proj_reg_048', 'a0480000-0000-4000-8000-00000000000d', 'Client Viewer', 'viewer-048@example.test', 'Viewer', 'party_c', 'person_x', 'a0480000-0000-4000-8000-00000000000a', NOW(), false, false, false, true),
  ('mem_048_e', 'proj_reg_048', 'a0480000-0000-4000-8000-00000000000e', 'End Approver', 'end-048@example.test', 'Commenter', 'party_e', NULL, 'a0480000-0000-4000-8000-00000000000a', NOW(), true, false, false, true);

INSERT INTO public.wg_timesheet_weeks (id, user_id, project_id, week_start, status, data)
VALUES
  ('a0480000-0000-4000-8000-00000000000b:2026-09-07', 'a0480000-0000-4000-8000-00000000000b', 'proj_reg_048', DATE '2026-09-07', 'draft',
   '{"totalHours": 8, "days": [{"day": "Mon", "hours": 8}]}'::jsonb),
  ('a0480000-0000-4000-8000-00000000000b:2026-09-14', 'a0480000-0000-4000-8000-00000000000b', 'proj_reg_048', DATE '2026-09-14', 'draft',
   '{"totalHours": 4, "days": [{"day": "Mon", "hours": 4}]}'::jsonb);

GRANT INSERT ON wg_regression_048_results TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.wg_test_048_act_as(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  IF auth.uid() IS DISTINCT FROM p_uid THEN
    RAISE EXCEPTION 'auth.uid() did not follow fixture %', p_uid;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.wg_test_048_act_as(uuid) TO authenticated;

SET LOCAL ROLE authenticated;

DO $$
DECLARE r jsonb; s jsonb; a_id text;
BEGIN
  PERFORM public.wg_test_048_act_as('a0480000-0000-4000-8000-00000000000b');
  r := public.wg_submit_timesheet('proj_reg_048', DATE '2026-09-07', 'person_w:2026-09-07',
    '{"hours":999,"billableHours":999,"periodEnd":"2099-01-01","daySummary":[{"day":"Mon","hours":0,"notes":"forged"},{"day":"Tue","hours":8}]}'::jsonb);
  s := r->'approval'->'subject_snapshot';
  IF s->'daySummary' IS DISTINCT FROM '[{"day":"Mon","hours":8}]'::jsonb
     OR s->>'hours' IS DISTINCT FROM '8'
     OR s->>'periodStart' IS DISTINCT FROM '2026-09-07'
     OR s->>'periodEnd' IS DISTINCT FROM '2026-09-07'
     OR s ? 'billableHours' THEN
    RAISE EXCEPTION 'Caller daily facts survived submission: %', s;
  END IF;
  a_id := r->'approval'->>'id';

  -- The next layer also receives the saved daily packet and server route.
  PERFORM public.wg_test_048_act_as('a0480000-0000-4000-8000-00000000000a');
  r := public.wg_decide_approval(a_id, 'approved');
  IF r->'next'->'subject_snapshot'->'daySummary' IS DISTINCT FROM s->'daySummary'
     OR r->>'weekStatus' IS DISTINCT FROM 'submitted' THEN
    RAISE EXCEPTION 'Next-layer daily packet or routing changed: %', r;
  END IF;
END;
$$;

RESET ROLE;

-- Rebuilding a copied snapshot must take notes from the saved day too.
UPDATE public.wg_timesheet_weeks
SET data = jsonb_set(data, '{days}', '[{"day":"Mon","hours":4,"notes":"saved note"},{"day":"Sun","hours":0}]')
WHERE project_id = 'proj_reg_048' AND week_start = DATE '2026-09-14';
SET LOCAL ROLE authenticated;
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM public.wg_test_048_act_as('a0480000-0000-4000-8000-00000000000b');
  r := public.wg_submit_timesheet('proj_reg_048', DATE '2026-09-14', 'person_w:2026-09-14',
    '{"daySummary":[{"day":"Mon","hours":4,"notes":"forged note"}]}'::jsonb);
  IF r->'approval'->'subject_snapshot'->>'periodEnd' IS DISTINCT FROM '2026-09-20'
     OR r->'approval'->'subject_snapshot'->'daySummary' IS DISTINCT FROM
     '[{"day":"Mon","hours":4,"notes":"saved note"},{"day":"Sun","hours":0}]'::jsonb THEN
    RAISE EXCEPTION 'Saved notes were not used: %', r;
  END IF;
END;
$$;
RESET ROLE;
ROLLBACK;


