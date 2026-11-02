-- Regression for migration 040. Synthetic accounts; ROLLBACK at the end.
-- After James approves the last layer, nobody can edit the hours or move the
-- week back to draft. That includes Nikola and the service role.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/040_lock_approved_timesheets_regression.sql

BEGIN;

CREATE TEMP TABLE wg_regression_040_results (
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
  ('04000000-0000-4000-8000-0000000000a1'::uuid, 'nikola-040@example.test', 'Nikola'),
  ('04000000-0000-4000-8000-0000000000b1'::uuid, 'rodman-040@example.test', 'Rodman'),
  ('04000000-0000-4000-8000-0000000000c1'::uuid, 'james-040@example.test', 'James')
) AS u(id, email, display_name);

INSERT INTO public.wg_projects (id, name, owner_id, graph, parties) VALUES (
  'proj_reg_040', 'Locked week', '04000000-0000-4000-8000-0000000000a1',
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'party_contractor', 'type', 'party', 'data', jsonb_build_object('name', 'Rodman Co')),
      jsonb_build_object('id', 'party_agency', 'type', 'party', 'data', jsonb_build_object('name', 'Nikola Agency', 'isCreator', true)),
      jsonb_build_object('id', 'party_client', 'type', 'party', 'data', jsonb_build_object('name', 'James Client')),
      jsonb_build_object('id', 'person_rodman', 'type', 'person', 'data', jsonb_build_object('name', 'Rodman', 'partyId', 'party_contractor', 'userId', '04000000-0000-4000-8000-0000000000b1')),
      jsonb_build_object('id', 'person_nikola', 'type', 'person', 'data', jsonb_build_object('name', 'Nikola', 'partyId', 'party_agency', 'canApprove', true, 'userId', '04000000-0000-4000-8000-0000000000a1')),
      jsonb_build_object('id', 'person_james', 'type', 'person', 'data', jsonb_build_object('name', 'James', 'partyId', 'party_client', 'canApprove', true, 'userId', '04000000-0000-4000-8000-0000000000c1'))
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
  ('mem_040_nikola', 'proj_reg_040', '04000000-0000-4000-8000-0000000000a1', 'Nikola', 'Owner', 'party_agency', 'person_nikola', '04000000-0000-4000-8000-0000000000a1', NOW(), true),
  ('mem_040_rodman', 'proj_reg_040', '04000000-0000-4000-8000-0000000000b1', 'Rodman', 'Contributor', 'party_contractor', 'person_rodman', '04000000-0000-4000-8000-0000000000a1', NOW(), false),
  ('mem_040_james', 'proj_reg_040', '04000000-0000-4000-8000-0000000000c1', 'James', 'Commenter', 'party_client', 'person_james', '04000000-0000-4000-8000-0000000000a1', NOW(), true);

INSERT INTO public.wg_timesheet_weeks (id, user_id, project_id, week_start, status, data) VALUES
  ('04000000-0000-4000-8000-0000000000b1:2026-09-07', '04000000-0000-4000-8000-0000000000b1', 'proj_reg_040', DATE '2026-09-07', 'draft', '{"totalHours":8,"days":[{"day":"Mon","hours":8}]}'::jsonb);

CREATE OR REPLACE FUNCTION public.wg_test_040_act_as(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  IF auth.uid() IS DISTINCT FROM p_uid THEN
    RAISE EXCEPTION 'auth.uid() did not follow fixture %', p_uid;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.wg_test_040_act_as(uuid) TO authenticated;
GRANT INSERT ON wg_regression_040_results TO authenticated;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  submitted jsonb;
  decision jsonb;
BEGIN
  PERFORM public.wg_test_040_act_as('04000000-0000-4000-8000-0000000000b1');
  submitted := public.wg_submit_timesheet('proj_reg_040', DATE '2026-09-07', 'person_rodman:2026-09-07', '{}'::jsonb);
  PERFORM public.wg_test_040_act_as('04000000-0000-4000-8000-0000000000a1');
  decision := public.wg_decide_approval(submitted->'approval'->>'id', 'approved', NULL);
  PERFORM public.wg_test_040_act_as('04000000-0000-4000-8000-0000000000c1');
  decision := public.wg_decide_approval(decision->'next'->>'id', 'approved', NULL);
  IF decision->>'weekStatus' <> 'approved' THEN
    RAISE EXCEPTION 'week % after James approved', decision->>'weekStatus';
  END IF;
END $$;

RESET ROLE;

CREATE OR REPLACE FUNCTION public.wg_test_040_change(p_status text, p_hours text, p_touch_created boolean)
RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE
  denied boolean := false;
BEGIN
  BEGIN
    IF p_status IS NOT NULL AND p_touch_created THEN
      UPDATE public.wg_timesheet_weeks
      SET status = p_status, data = jsonb_build_object('totalHours', p_hours), created_at = now()
      WHERE id = '04000000-0000-4000-8000-0000000000b1:2026-09-07';
    ELSIF p_status IS NOT NULL THEN
      UPDATE public.wg_timesheet_weeks
      SET status = p_status
      WHERE id = '04000000-0000-4000-8000-0000000000b1:2026-09-07';
    ELSIF p_touch_created THEN
      UPDATE public.wg_timesheet_weeks
      SET data = jsonb_build_object('totalHours', p_hours), created_at = now()
      WHERE id = '04000000-0000-4000-8000-0000000000b1:2026-09-07';
    ELSE
      UPDATE public.wg_timesheet_weeks
      SET data = jsonb_build_object('totalHours', p_hours)
      WHERE id = '04000000-0000-4000-8000-0000000000b1:2026-09-07';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  RETURN denied;
END;
$$;
GRANT EXECUTE ON FUNCTION public.wg_test_040_change(text, text, boolean) TO authenticated, service_role;

SET LOCAL ROLE authenticated;
SELECT public.wg_test_040_act_as('04000000-0000-4000-8000-0000000000b1');
DO $$
BEGIN
  IF NOT public.wg_test_040_change(NULL, '1', false) THEN
    RAISE EXCEPTION 'Rodman edited approved hours';
  END IF;
  IF NOT public.wg_test_040_change('draft', NULL, false) THEN
    RAISE EXCEPTION 'Rodman moved an approved week back to draft';
  END IF;
END $$;

SELECT public.wg_test_040_act_as('04000000-0000-4000-8000-0000000000a1');
DO $$
BEGIN
  IF NOT public.wg_test_040_change(NULL, '3', false) THEN
    RAISE EXCEPTION 'Nikola edited approved hours';
  END IF;
  IF NOT public.wg_test_040_change('draft', NULL, false) THEN
    RAISE EXCEPTION 'Nikola moved an approved week back to draft';
  END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT set_config('wg.approval_write', 'on', true);
DO $$
BEGIN
  IF NOT public.wg_test_040_change(NULL, '2', true) THEN
    RAISE EXCEPTION 'service role edited an approved week';
  END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT data->>'totalHours' FROM public.wg_timesheet_weeks WHERE id = '04000000-0000-4000-8000-0000000000b1:2026-09-07') <> '8' THEN
    RAISE EXCEPTION 'approved hours changed';
  END IF;
  IF (SELECT status FROM public.wg_timesheet_weeks WHERE id = '04000000-0000-4000-8000-0000000000b1:2026-09-07') <> 'approved' THEN
    RAISE EXCEPTION 'approved status changed';
  END IF;
  INSERT INTO wg_regression_040_results VALUES
    ('approved_week_locked', 'After James approves, Rodman and Nikola cannot change hours or return the week to draft. The service role cannot either, even with the approval-write flag set.');
END $$;

SELECT check_name, detail FROM wg_regression_040_results ORDER BY check_name;

ROLLBACK;
