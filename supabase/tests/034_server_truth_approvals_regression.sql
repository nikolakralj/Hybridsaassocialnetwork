-- Regression for migration 034: read lockdown, server-side approval route,
-- assigned-approver-only decisions, and timesheet locks.
-- Synthetic fixtures only; the closing ROLLBACK removes everything.
--
-- Chain:  Agency (owner A, worker W)  --billsTo-->  Client (approver C, viewer X)
--                                     --billsTo-->  End client (approver E, linked late)
--
-- Run as postgres in one transaction:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/034_server_truth_approvals_regression.sql
-- Any unexpected hole raises and aborts. A clean run prints wg_regression_034_results.

BEGIN;

CREATE TEMP TABLE wg_regression_034_results (
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
  ('a0340000-0000-4000-8000-00000000000a'::uuid, 'owner-034@example.test', 'Agency Owner'),
  ('a0340000-0000-4000-8000-00000000000b'::uuid, 'worker-034@example.test', 'Worker'),
  ('a0340000-0000-4000-8000-00000000000c'::uuid, 'client-034@example.test', 'Client Approver'),
  ('a0340000-0000-4000-8000-00000000000d'::uuid, 'viewer-034@example.test', 'Client Viewer'),
  ('a0340000-0000-4000-8000-00000000000e'::uuid, 'end-034@example.test', 'End Approver')
) AS u(id, email, display_name);

INSERT INTO public.wg_projects (id, name, owner_id, graph, parties)
VALUES (
  'proj_reg_034', 'Synthetic 034 project', 'a0340000-0000-4000-8000-00000000000a',
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'party_a', 'type', 'party', 'data', jsonb_build_object('name', 'Agency', 'partyType', 'agency', 'isCreator', true)),
      jsonb_build_object('id', 'party_c', 'type', 'party', 'data', jsonb_build_object('name', 'Client', 'partyType', 'client')),
      jsonb_build_object('id', 'party_e', 'type', 'party', 'data', jsonb_build_object('name', 'End client', 'partyType', 'client')),
      jsonb_build_object('id', 'a0340000-0000-4000-8000-00000000000a', 'type', 'person', 'data', jsonb_build_object('name', 'Agency Owner', 'partyId', 'party_a', 'canApprove', true)),
      jsonb_build_object('id', 'person_w', 'type', 'person', 'data', jsonb_build_object('name', 'Worker', 'partyId', 'party_a', 'canApprove', false, 'userId', 'a0340000-0000-4000-8000-00000000000b', 'hourlyRate', 99.99)),
      jsonb_build_object('id', 'person_c', 'type', 'person', 'data', jsonb_build_object('name', 'Client Approver', 'partyId', 'party_c', 'canApprove', true, 'userId', 'a0340000-0000-4000-8000-00000000000c')),
      jsonb_build_object('id', 'person_x', 'type', 'person', 'data', jsonb_build_object('name', 'Client Viewer', 'partyId', 'party_c', 'canApprove', false, 'userId', 'a0340000-0000-4000-8000-00000000000d')),
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
  ('mem_034_a', 'proj_reg_034', 'a0340000-0000-4000-8000-00000000000a', 'Agency Owner', 'owner-034@example.test', 'Owner', 'party_a', 'a0340000-0000-4000-8000-00000000000a', 'a0340000-0000-4000-8000-00000000000a', NOW(), true, true, true, true),
  ('mem_034_w', 'proj_reg_034', 'a0340000-0000-4000-8000-00000000000b', 'Worker', 'worker-034@example.test', 'Contributor', 'party_a', 'person_w', 'a0340000-0000-4000-8000-00000000000a', NOW(), false, false, true, true),
  ('mem_034_c', 'proj_reg_034', 'a0340000-0000-4000-8000-00000000000c', 'Client Approver', 'client-034@example.test', 'Commenter', 'party_c', 'person_c', 'a0340000-0000-4000-8000-00000000000a', NOW(), true, false, false, true),
  ('mem_034_x', 'proj_reg_034', 'a0340000-0000-4000-8000-00000000000d', 'Client Viewer', 'viewer-034@example.test', 'Viewer', 'party_c', 'person_x', 'a0340000-0000-4000-8000-00000000000a', NOW(), false, false, false, true),
  ('mem_034_e', 'proj_reg_034', 'a0340000-0000-4000-8000-00000000000e', 'End Approver', 'end-034@example.test', 'Commenter', 'party_e', NULL, 'a0340000-0000-4000-8000-00000000000a', NOW(), true, false, false, true);

INSERT INTO public.wg_timesheet_weeks (id, user_id, project_id, week_start, status, data)
VALUES
  ('a0340000-0000-4000-8000-00000000000b:2026-09-07', 'a0340000-0000-4000-8000-00000000000b', 'proj_reg_034', DATE '2026-09-07', 'draft',
   '{"totalHours": 8, "days": [{"day": "Mon", "hours": 8}]}'::jsonb),
  ('a0340000-0000-4000-8000-00000000000b:2026-09-14', 'a0340000-0000-4000-8000-00000000000b', 'proj_reg_034', DATE '2026-09-14', 'draft',
   '{"totalHours": 4, "days": [{"day": "Mon", "hours": 4}]}'::jsonb);

GRANT INSERT ON wg_regression_034_results TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.wg_test_034_act_as(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  IF auth.uid() IS DISTINCT FROM p_uid THEN
    RAISE EXCEPTION 'auth.uid() did not follow fixture %', p_uid;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.wg_test_034_act_as(uuid) TO authenticated;

SET LOCAL ROLE authenticated;

-- 1. Members cannot read the graph (rates) directly, but can read metadata.
DO $$
DECLARE denied boolean := false; v_name text;
BEGIN
  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000c');
  BEGIN
    PERFORM graph FROM public.wg_projects WHERE id = 'proj_reg_034';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'client read wg_projects.graph'; END IF;
  denied := false;
  BEGIN
    PERFORM parties FROM public.wg_projects WHERE id = 'proj_reg_034';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'client read wg_projects.parties'; END IF;
  SELECT name INTO v_name FROM public.wg_projects WHERE id = 'proj_reg_034';
  IF v_name IS DISTINCT FROM 'Synthetic 034 project' THEN RAISE EXCEPTION 'client lost project metadata (%)', v_name; END IF;

  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000a');
  denied := false;
  BEGIN
    PERFORM graph FROM public.wg_projects WHERE id = 'proj_reg_034';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'owner read graph directly (expected RPC-only)'; END IF;

  INSERT INTO wg_regression_034_results VALUES
    ('graph_not_directly_readable', 'graph and parties raise 42501 for client and owner; name stays readable.');
END $$;

-- 2. Nobody writes approval_records directly; a worker cannot self-submit by UPDATE.
DO $$
DECLARE denied boolean := false;
BEGIN
  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000b');
  BEGIN
    INSERT INTO public.approval_records (project_id, subject_type, subject_id, approver_user_id, approval_layer, status, submitter_user_id)
    VALUES ('proj_reg_034', 'timesheet', 'person_w:2026-09-07', 'a0340000-0000-4000-8000-00000000000b', 1, 'approved', 'a0340000-0000-4000-8000-00000000000b');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'worker inserted an approval record'; END IF;

  denied := false;
  BEGIN
    UPDATE public.wg_timesheet_weeks SET status = 'submitted' WHERE id = 'a0340000-0000-4000-8000-00000000000b:2026-09-07';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'worker changed week status without the workflow'; END IF;

  denied := false;
  BEGIN
    PERFORM public.wg_submit_timesheet('proj_reg_034', DATE '2026-09-07', 'person_c:2026-09-07', '{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'worker submitted under another person''s subject'; END IF;

  INSERT INTO wg_regression_034_results VALUES
    ('no_direct_approval_writes', 'Direct approval insert, direct status change, and foreign subject all raise 42501.');
END $$;

-- 3. Submit computes the route on the server; layer 1 = the agency owner.
DO $$
DECLARE r jsonb; v_status text;
BEGIN
  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000b');
  r := public.wg_submit_timesheet('proj_reg_034', DATE '2026-09-07', 'person_w:2026-09-07',
        '{"title": "Worker · Sep 7", "hours": 999}'::jsonb);
  IF r->'approval'->>'approver_user_id' IS DISTINCT FROM 'a0340000-0000-4000-8000-00000000000a' THEN
    RAISE EXCEPTION 'layer 1 approver was % (expected agency owner)', r->'approval'->>'approver_user_id';
  END IF;
  IF jsonb_array_length(r->'route') <> 3 THEN
    RAISE EXCEPTION 'route length % (expected agency, client, end client)', jsonb_array_length(r->'route');
  END IF;
  IF (r->'approval'->'subject_snapshot'->>'hours')::numeric <> 8 THEN
    RAISE EXCEPTION 'snapshot hours % came from the client, not the week', r->'approval'->'subject_snapshot'->>'hours';
  END IF;
  SELECT status INTO v_status FROM public.wg_timesheet_weeks WHERE id = 'a0340000-0000-4000-8000-00000000000b:2026-09-07';
  IF v_status <> 'submitted' THEN RAISE EXCEPTION 'week status % after submit', v_status; END IF;

  INSERT INTO wg_regression_034_results VALUES
    ('server_route_on_submit', 'Route agency -> client -> end client; layer 1 = owner; hours taken from the week (8), not the client (999).');
END $$;

-- 4. Submitted weeks are content-locked.
DO $$
DECLARE denied boolean := false;
BEGIN
  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000b');
  BEGIN
    UPDATE public.wg_timesheet_weeks
    SET data = jsonb_set(data, '{days}', '[{"day": "Mon", "hours": 12}]'::jsonb)
    WHERE id = 'a0340000-0000-4000-8000-00000000000b:2026-09-07';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'worker edited hours of a submitted week'; END IF;
  INSERT INTO wg_regression_034_results VALUES
    ('submitted_week_locked', 'Editing days of a submitted week raises 42501.');
END $$;

-- 5. Only the assigned approver decides; the owner approves layer 1 and the
--    server creates layer 2 for the client.
DO $$
DECLARE denied boolean := false; v_id text; r jsonb;
BEGIN
  SELECT id INTO v_id FROM public.approval_records
  WHERE project_id = 'proj_reg_034' AND subject_id = 'person_w:2026-09-07' AND approval_layer = 1;

  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000c');
  BEGIN
    PERFORM public.wg_decide_approval(v_id, 'approved', NULL);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'client decided the agency layer'; END IF;

  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000a');
  r := public.wg_decide_approval(v_id, 'approved', 'ok internally');
  IF r->'next'->>'approver_user_id' IS DISTINCT FROM 'a0340000-0000-4000-8000-00000000000c' THEN
    RAISE EXCEPTION 'layer 2 approver % (expected client approver)', r->'next'->>'approver_user_id';
  END IF;
  IF r->>'weekStatus' <> 'submitted' THEN RAISE EXCEPTION 'week % after layer 1', r->>'weekStatus'; END IF;

  INSERT INTO wg_regression_034_results VALUES
    ('assigned_approver_only_and_server_next_layer', 'Client cannot decide layer 1; owner approves; server creates layer 2 for the client; week stays submitted.');
END $$;

-- 6. Reads are scoped: the client approver sees the week, the client viewer does not.
DO $$
DECLARE n_week integer; n_appr integer;
BEGIN
  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000d');
  SELECT count(*) INTO n_week FROM public.wg_timesheet_weeks WHERE project_id = 'proj_reg_034';
  SELECT count(*) INTO n_appr FROM public.approval_records WHERE project_id = 'proj_reg_034';
  IF n_week <> 0 OR n_appr <> 0 THEN
    RAISE EXCEPTION 'client viewer read % weeks and % approvals', n_week, n_appr;
  END IF;

  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000c');
  SELECT count(*) INTO n_week FROM public.wg_timesheet_weeks WHERE project_id = 'proj_reg_034';
  SELECT count(*) INTO n_appr FROM public.approval_records WHERE project_id = 'proj_reg_034';
  IF n_week <> 1 THEN RAISE EXCEPTION 'client approver read % weeks (expected only the assigned one)', n_week; END IF;
  IF n_appr <> 2 THEN RAISE EXCEPTION 'client approver read % approval records (expected 2 for that subject)', n_appr; END IF;

  INSERT INTO wg_regression_034_results VALUES
    ('scoped_reads', 'Client viewer: 0 weeks, 0 approvals. Client approver: only the assigned week (1 of 2) and its 2 approval layers.');
END $$;

-- 7. The owner cannot decide the client's layer.
DO $$
DECLARE denied boolean := false; v_id text;
BEGIN
  SELECT id INTO v_id FROM public.approval_records
  WHERE project_id = 'proj_reg_034' AND subject_id = 'person_w:2026-09-07' AND approval_layer = 2;
  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000a');
  BEGIN
    PERFORM public.wg_decide_approval(v_id, 'approved', NULL);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'owner decided the client layer'; END IF;
  INSERT INTO wg_regression_034_results VALUES
    ('owner_cannot_decide_other_party', 'Owner deciding the client layer raises 42501.');
END $$;

-- 8. The client approves; the server routes to the end client even though the
--    end client has no linked account yet (placeholder, not skipped).
DO $$
DECLARE v_id text; r jsonb;
BEGIN
  SELECT id INTO v_id FROM public.approval_records
  WHERE project_id = 'proj_reg_034' AND subject_id = 'person_w:2026-09-07' AND approval_layer = 2;
  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000c');
  r := public.wg_decide_approval(v_id, 'approved', NULL);
  IF r->'next' IS NULL OR (r->'next'->>'approval_layer')::integer <> 3 THEN
    RAISE EXCEPTION 'no layer 3 after the client approved: %', r;
  END IF;
  IF r->'next'->>'approver_node_id' <> 'party_e' OR public.wg_is_uuid_text(r->'next'->>'approver_user_id') THEN
    RAISE EXCEPTION 'layer 3 should wait on party_e with no account: %', r->'next';
  END IF;
  IF r->>'weekStatus' <> 'submitted' THEN RAISE EXCEPTION 'week approved before the end client: %', r->>'weekStatus'; END IF;
  INSERT INTO wg_regression_034_results VALUES
    ('full_route_not_truncated', 'After the client approves, layer 3 waits on the end client; the week is still submitted.');
END $$;

RESET ROLE;

-- 9. Linking the end client approver re-points the waiting step automatically.
UPDATE public.wg_projects
SET graph = jsonb_set(
  graph, '{nodes}',
  (SELECT jsonb_agg(CASE WHEN n->>'id' = 'person_e'
                         THEN jsonb_set(n, '{data,userId}', '"a0340000-0000-4000-8000-00000000000e"')
                         ELSE n END)
   FROM jsonb_array_elements(graph->'nodes') n)
)
WHERE id = 'proj_reg_034';

DO $$
DECLARE v_uid text;
BEGIN
  SELECT approver_user_id INTO v_uid FROM public.approval_records
  WHERE project_id = 'proj_reg_034' AND subject_id = 'person_w:2026-09-07' AND approval_layer = 3;
  IF v_uid IS DISTINCT FROM 'a0340000-0000-4000-8000-00000000000e' THEN
    RAISE EXCEPTION 'waiting step not re-pointed after linking (%)', v_uid;
  END IF;
  INSERT INTO wg_regression_034_results VALUES
    ('late_linked_approver_repointed', 'Linking person_e to an account re-points the pending layer 3 to that account.');
END $$;

SET LOCAL ROLE authenticated;

-- 10. The end client approves; only now is the week approved.
DO $$
DECLARE v_id text; r jsonb; v_status text;
BEGIN
  SELECT id INTO v_id FROM public.approval_records
  WHERE project_id = 'proj_reg_034' AND subject_id = 'person_w:2026-09-07' AND approval_layer = 3;
  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000e');
  r := public.wg_decide_approval(v_id, 'approved', NULL);
  IF r->'next' IS NOT NULL AND r->'next' <> 'null'::jsonb THEN RAISE EXCEPTION 'unexpected layer 4: %', r->'next'; END IF;
  IF r->>'weekStatus' <> 'approved' THEN RAISE EXCEPTION 'week % after final approval', r->>'weekStatus'; END IF;
  INSERT INTO wg_regression_034_results VALUES
    ('approved_only_after_last_layer', 'The week becomes approved only when the end client approves layer 3.');
END $$;

-- 11. Approved weeks are immutable and cannot be deleted, by the worker or the service role.
DO $$
DECLARE denied boolean := false;
BEGIN
  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000b');
  BEGIN
    UPDATE public.wg_timesheet_weeks SET data = jsonb_set(data, '{days}', '[{"day":"Mon","hours":10}]'::jsonb)
    WHERE id = 'a0340000-0000-4000-8000-00000000000b:2026-09-07';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'worker edited an approved week'; END IF;

  denied := false;
  BEGIN
    DELETE FROM public.wg_timesheet_weeks WHERE id = 'a0340000-0000-4000-8000-00000000000b:2026-09-07';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'worker deleted an approved week'; END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE service_role;

DO $$
DECLARE denied boolean := false;
BEGIN
  -- The edge function calls the database as service_role with no end user.
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  PERFORM set_config('wg.approval_write', 'on', true);
  BEGIN
    UPDATE public.wg_timesheet_weeks SET data = jsonb_set(data, '{totalHours}', '1'::jsonb) WHERE id = 'a0340000-0000-4000-8000-00000000000b:2026-09-07';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  PERFORM set_config('wg.approval_write', 'off', true);
  IF NOT denied THEN RAISE EXCEPTION 'service role (with the flag) edited an approved week'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.wg_timesheet_weeks (id, user_id, project_id, week_start, status, data)
    VALUES ('a0340000-0000-4000-8000-00000000000b:2026-09-21', 'a0340000-0000-4000-8000-00000000000b', 'proj_reg_034', DATE '2026-09-21', 'approved', '{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'service role inserted an already-approved week (edge PUT bypass)'; END IF;

  INSERT INTO wg_regression_034_results VALUES
    ('approved_week_immutable', 'Worker edit/delete and service-role edit (even with the flag) or approved insert all raise 42501.');
END $$;

RESET ROLE;
SET LOCAL ROLE authenticated;

-- 12. Recall: allowed before any approval, blocked after one.
DO $$
DECLARE r jsonb; v_status text; v_pending integer; denied boolean := false; v_id text;
BEGIN
  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000b');
  PERFORM public.wg_submit_timesheet('proj_reg_034', DATE '2026-09-14', 'person_w:2026-09-14', '{}'::jsonb);
  r := public.wg_recall_timesheet('proj_reg_034', DATE '2026-09-14');
  SELECT status INTO v_status FROM public.wg_timesheet_weeks WHERE id = 'a0340000-0000-4000-8000-00000000000b:2026-09-14';
  SELECT count(*) INTO v_pending FROM public.approval_records WHERE subject_id = 'person_w:2026-09-14' AND status = 'pending';
  IF v_status <> 'draft' OR v_pending <> 0 THEN
    RAISE EXCEPTION 'recall left status % and % pending records', v_status, v_pending;
  END IF;

  PERFORM public.wg_submit_timesheet('proj_reg_034', DATE '2026-09-14', 'person_w:2026-09-14', '{}'::jsonb);
  SELECT id INTO v_id FROM public.approval_records WHERE subject_id = 'person_w:2026-09-14' AND status = 'pending';
  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000a');
  PERFORM public.wg_decide_approval(v_id, 'approved', NULL);
  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000b');
  BEGIN
    PERFORM public.wg_recall_timesheet('proj_reg_034', DATE '2026-09-14');
  EXCEPTION WHEN invalid_parameter_value THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'worker recalled a week after layer 1 approved it'; END IF;

  INSERT INTO wg_regression_034_results VALUES
    ('recall_rules', 'Recall before any approval returns the week to draft and removes the pending step; recall after an approval is refused.');
END $$;

-- 13. Rejection returns the week to the worker, who can then edit and resubmit.
DO $$
DECLARE v_id text; r jsonb; v_status text;
BEGIN
  SELECT id INTO v_id FROM public.approval_records WHERE subject_id = 'person_w:2026-09-14' AND status = 'pending';
  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000c');
  r := public.wg_decide_approval(v_id, 'rejected', 'Wrong project code');
  IF r->>'weekStatus' <> 'rejected' THEN RAISE EXCEPTION 'week % after rejection', r->>'weekStatus'; END IF;

  PERFORM public.wg_test_034_act_as('a0340000-0000-4000-8000-00000000000b');
  UPDATE public.wg_timesheet_weeks SET status = 'draft', data = jsonb_set(data, '{days}', '[{"day":"Mon","hours":5}]'::jsonb)
  WHERE id = 'a0340000-0000-4000-8000-00000000000b:2026-09-14';
  r := public.wg_submit_timesheet('proj_reg_034', DATE '2026-09-14', 'person_w:2026-09-14', '{}'::jsonb);
  IF r->'approval'->>'approver_user_id' <> 'a0340000-0000-4000-8000-00000000000a' THEN
    RAISE EXCEPTION 'resubmission did not restart at layer 1';
  END IF;
  INSERT INTO wg_regression_034_results VALUES
    ('reject_edit_resubmit', 'Client rejection sets the week rejected; the worker edits it as draft and resubmits from layer 1.');
END $$;

RESET ROLE;

SELECT check_name, detail FROM wg_regression_034_results ORDER BY check_name;

ROLLBACK;
