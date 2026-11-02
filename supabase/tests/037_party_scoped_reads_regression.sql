-- Regression for migration 037. Synthetic accounts; ROLLBACK at the end.
-- Chain: Rodman (contractor) bills Nikola (agency) bills James (client) bills an end party.
-- Martin is a second contractor. A client colleague is in James's party but is not the approver.
--
-- Run as postgres:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/037_party_scoped_reads_regression.sql

BEGIN;

CREATE TEMP TABLE wg_regression_037_results (
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
  ('03700000-0000-4000-8000-0000000000a1'::uuid, 'nikola-037@example.test', 'Nikola'),
  ('03700000-0000-4000-8000-0000000000b1'::uuid, 'rodman-037@example.test', 'Rodman'),
  ('03700000-0000-4000-8000-0000000000c1'::uuid, 'james-037@example.test', 'James'),
  ('03700000-0000-4000-8000-0000000000d1'::uuid, 'martin-037@example.test', 'Martin'),
  ('03700000-0000-4000-8000-0000000000e1'::uuid, 'outsider-037@example.test', 'Outsider'),
  ('03700000-0000-4000-8000-0000000000f1'::uuid, 'colleague-037@example.test', 'Client colleague')
) AS u(id, email, display_name);

INSERT INTO public.wg_projects (id, name, owner_id, graph, parties) VALUES (
  'proj_reg_037', 'Party scope', '03700000-0000-4000-8000-0000000000a1',
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'party_contractor', 'type', 'party', 'data', jsonb_build_object('name', 'Rodman Co')),
      jsonb_build_object('id', 'party_agency', 'type', 'party', 'data', jsonb_build_object('name', 'Nikola Agency', 'isCreator', true)),
      jsonb_build_object('id', 'party_client', 'type', 'party', 'data', jsonb_build_object('name', 'James Client')),
      jsonb_build_object('id', 'party_end', 'type', 'party', 'data', jsonb_build_object('name', 'End Client')),
      jsonb_build_object('id', 'party_martin', 'type', 'party', 'data', jsonb_build_object('name', 'Martin Co')),
      jsonb_build_object('id', 'person_rodman', 'type', 'person', 'data', jsonb_build_object('name', 'Rodman', 'partyId', 'party_contractor', 'canApprove', false, 'userId', '03700000-0000-4000-8000-0000000000b1')),
      jsonb_build_object('id', 'person_nikola', 'type', 'person', 'data', jsonb_build_object('name', 'Nikola', 'partyId', 'party_agency', 'canApprove', true, 'userId', '03700000-0000-4000-8000-0000000000a1')),
      jsonb_build_object('id', 'person_james', 'type', 'person', 'data', jsonb_build_object('name', 'James', 'partyId', 'party_client', 'canApprove', true, 'userId', '03700000-0000-4000-8000-0000000000c1')),
      jsonb_build_object('id', 'person_martin', 'type', 'person', 'data', jsonb_build_object('name', 'Martin', 'partyId', 'party_martin', 'canApprove', false, 'userId', '03700000-0000-4000-8000-0000000000d1'))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'e1', 'source', 'party_contractor', 'target', 'party_agency', 'type', 'billsTo', 'data', jsonb_build_object('edgeType', 'billsTo')),
      jsonb_build_object('id', 'e2', 'source', 'party_agency', 'target', 'party_client', 'type', 'billsTo', 'data', jsonb_build_object('edgeType', 'billsTo')),
      jsonb_build_object('id', 'e3', 'source', 'party_client', 'target', 'party_end', 'type', 'billsTo', 'data', jsonb_build_object('edgeType', 'billsTo')),
      jsonb_build_object('id', 'e4', 'source', 'party_martin', 'target', 'party_agency', 'type', 'billsTo', 'data', jsonb_build_object('edgeType', 'billsTo'))
    )
  ),
  '[]'::jsonb
);

INSERT INTO public.wg_project_members (
  id, project_id, user_id, user_name, user_email, role, scope, graph_node_id,
  invited_by, accepted_at, can_approve
) VALUES
  ('mem_037_nikola', 'proj_reg_037', '03700000-0000-4000-8000-0000000000a1', 'Nikola', 'nikola-037@example.test', 'Owner', 'party_agency', 'person_nikola', '03700000-0000-4000-8000-0000000000a1', NOW(), true),
  ('mem_037_rodman', 'proj_reg_037', '03700000-0000-4000-8000-0000000000b1', 'Rodman', 'rodman-037@example.test', 'Contributor', 'party_contractor', 'person_rodman', '03700000-0000-4000-8000-0000000000a1', NOW(), false),
  ('mem_037_james', 'proj_reg_037', '03700000-0000-4000-8000-0000000000c1', 'James', 'james-037@example.test', 'Commenter', 'party_client', 'person_james', '03700000-0000-4000-8000-0000000000a1', NOW(), true),
  ('mem_037_martin', 'proj_reg_037', '03700000-0000-4000-8000-0000000000d1', 'Martin', 'martin-037@example.test', 'Contributor', 'party_martin', 'person_martin', '03700000-0000-4000-8000-0000000000a1', NOW(), false),
  ('mem_037_colleague', 'proj_reg_037', '03700000-0000-4000-8000-0000000000f1', 'Client colleague', 'colleague-037@example.test', 'Viewer', 'party_client', NULL, '03700000-0000-4000-8000-0000000000a1', NOW(), false);

INSERT INTO public.wg_timesheet_weeks (id, user_id, project_id, week_start, status, data) VALUES
  ('03700000-0000-4000-8000-0000000000b1:2026-09-07', '03700000-0000-4000-8000-0000000000b1', 'proj_reg_037', DATE '2026-09-07', 'draft',
   '{"totalHours":8,"notes":"SECRET-NOTE-RODMAN","days":[{"day":"Mon","hours":8,"note":"SECRET-NOTE-RODMAN"}]}'::jsonb),
  ('03700000-0000-4000-8000-0000000000b1:2026-09-14', '03700000-0000-4000-8000-0000000000b1', 'proj_reg_037', DATE '2026-09-14', 'draft',
   '{"totalHours":4,"notes":"SECRET-DRAFT-RODMAN","days":[{"day":"Mon","hours":4}]}'::jsonb),
  ('03700000-0000-4000-8000-0000000000d1:2026-09-07', '03700000-0000-4000-8000-0000000000d1', 'proj_reg_037', DATE '2026-09-07', 'draft',
   '{"totalHours":3,"notes":"SECRET-NOTE-MARTIN","days":[{"day":"Mon","hours":3,"note":"SECRET-NOTE-MARTIN"}]}'::jsonb);

CREATE OR REPLACE FUNCTION public.wg_test_037_act_as(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  IF auth.uid() IS DISTINCT FROM p_uid THEN
    RAISE EXCEPTION 'auth.uid() did not follow fixture %', p_uid;
  END IF;
END;
$$;
-- Prove the view drops a party id that was stored on the snapshot, rather than
-- only parties the route builder happened to skip.
CREATE OR REPLACE FUNCTION public.wg_test_037_stuff_foreign_party() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
BEGIN
  UPDATE public.approval_records
  SET subject_snapshot = jsonb_set(
    COALESCE(subject_snapshot, '{}'::jsonb),
    '{approvalRoute}',
    COALESCE(subject_snapshot->'approvalRoute', '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('step', 9, 'partyId', 'party_contractor', 'partyName', 'Rodman Co'),
      jsonb_build_object('step', 10, 'partyId', 'party_end', 'partyName', 'End Client')
    ),
    true
  )
  WHERE project_id = 'proj_reg_037';
END;
$$;
REVOKE ALL ON FUNCTION public.wg_test_037_stuff_foreign_party() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wg_test_037_stuff_foreign_party() TO authenticated;
GRANT EXECUTE ON FUNCTION public.wg_test_037_act_as(uuid) TO authenticated;
GRANT INSERT ON wg_regression_037_results TO authenticated;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  denied boolean := false;
  n integer;
  blob text;
  decision jsonb;
  layer1 text;
BEGIN
  -- Raw note columns are not granted.
  PERFORM public.wg_test_037_act_as('03700000-0000-4000-8000-0000000000c1');
  BEGIN
    PERFORM data FROM public.wg_timesheet_weeks WHERE project_id = 'proj_reg_037';
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'James read wg_timesheet_weeks.data'; END IF;
  denied := false;
  BEGIN
    PERFORM subject_snapshot FROM public.approval_records WHERE project_id = 'proj_reg_037';
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'James read approval_records.subject_snapshot'; END IF;

  PERFORM public.wg_test_037_act_as('03700000-0000-4000-8000-0000000000e1');
  SELECT count(*) INTO n FROM public.wg_timesheet_weeks WHERE project_id = 'proj_reg_037';
  IF n <> 0 THEN RAISE EXCEPTION 'outsider read % timesheet rows', n; END IF;
  SELECT count(*) INTO n FROM public.approval_records WHERE project_id = 'proj_reg_037';
  IF n <> 0 THEN RAISE EXCEPTION 'outsider read % approval rows', n; END IF;

  -- Before submit, James and his colleague see no contractor drafts.
  PERFORM public.wg_test_037_act_as('03700000-0000-4000-8000-0000000000c1');
  SELECT count(*) INTO n FROM public.wg_timesheet_weeks_visible WHERE project_id = 'proj_reg_037';
  IF n <> 0 THEN RAISE EXCEPTION 'James saw % weeks before he was the approver', n; END IF;
  PERFORM public.wg_test_037_act_as('03700000-0000-4000-8000-0000000000f1');
  SELECT count(*) INTO n FROM public.wg_timesheet_weeks_visible WHERE project_id = 'proj_reg_037';
  IF n <> 0 THEN RAISE EXCEPTION 'client colleague saw % weeks', n; END IF;

  -- Nikola does not see drafts just because he owns the project.
  PERFORM public.wg_test_037_act_as('03700000-0000-4000-8000-0000000000a1');
  SELECT count(*) INTO n FROM public.wg_timesheet_weeks_visible WHERE project_id = 'proj_reg_037';
  IF n <> 0 THEN RAISE EXCEPTION 'Nikola saw % draft weeks as project owner', n; END IF;

  PERFORM public.wg_test_037_act_as('03700000-0000-4000-8000-0000000000b1');
  PERFORM public.wg_submit_timesheet(
    'proj_reg_037', DATE '2026-09-07', 'person_rodman:2026-09-07',
    '{"daySummary":[{"day":"Mon","note":"SECRET-NOTE-RODMAN"}]}'::jsonb
  );
  PERFORM public.wg_test_037_stuff_foreign_party();

  -- Rodman keeps his own note and does not see the client or the end party.
  SELECT COALESCE(string_agg(subject_snapshot::text, ' '), '') INTO blob
  FROM public.wg_approval_records_visible
  WHERE project_id = 'proj_reg_037';
  IF blob NOT LIKE '%SECRET-NOTE-RODMAN%' THEN
    RAISE EXCEPTION 'Rodman lost his own day note: %', blob;
  END IF;
  IF blob NOT LIKE '%party_contractor%' THEN
    RAISE EXCEPTION 'Rodman lost his own party on the route: %', blob;
  END IF;
  IF blob LIKE '%party_client%' OR blob LIKE '%party_end%' THEN
    RAISE EXCEPTION 'Rodman saw a party outside his hop: %', blob;
  END IF;

  -- Nikola, now the assigned approver, sees the week but not the end party.
  PERFORM public.wg_test_037_act_as('03700000-0000-4000-8000-0000000000a1');
  SELECT count(*) INTO n FROM public.wg_timesheet_weeks_visible WHERE project_id = 'proj_reg_037';
  IF n <> 1 THEN RAISE EXCEPTION 'Nikola saw % weeks after submit (expected the submitted one)', n; END IF;
  SELECT COALESCE(string_agg(subject_snapshot::text, ' '), '') INTO blob
  FROM public.wg_approval_records_visible WHERE project_id = 'proj_reg_037';
  IF blob LIKE '%party_end%' THEN RAISE EXCEPTION 'Nikola saw party_end: %', blob; END IF;
  IF blob LIKE '%SECRET-NOTE-MARTIN%' THEN RAISE EXCEPTION 'Nikola saw Martin''s note'; END IF;
  IF blob LIKE '%SECRET-NOTE-RODMAN%' THEN
    RAISE EXCEPTION 'Nikola saw Rodman''s day note from another party';
  END IF;

  SELECT id INTO layer1 FROM public.approval_records
  WHERE project_id = 'proj_reg_037' AND approval_layer = 1 AND status = 'pending';
  decision := public.wg_decide_approval(layer1, 'approved', NULL);
  IF decision->>'weekStatus' <> 'submitted' THEN
    RAISE EXCEPTION 'week % after Nikola approved', decision->>'weekStatus';
  END IF;

  -- The new layer names the client party. Rodman can read the row, not that party.
  PERFORM public.wg_test_037_act_as('03700000-0000-4000-8000-0000000000b1');
  SELECT COALESCE(string_agg(
    COALESCE(approver_node_id, '') || ' ' || COALESCE(approver_name, '') || ' ' || COALESCE(approver_user_id, ''),
    ' '
  ), '') INTO blob
  FROM public.wg_approval_records_visible
  WHERE project_id = 'proj_reg_037';
  IF blob NOT LIKE '%party_agency%' THEN
    RAISE EXCEPTION 'Rodman lost the agency approver inside his hop: %', blob;
  END IF;
  IF blob LIKE '%party_client%' OR blob LIKE '%party_end%' OR blob LIKE '%03700000-0000-4000-8000-0000000000c1%' THEN
    RAISE EXCEPTION 'Rodman saw an approver outside his hop: %', blob;
  END IF;

  -- James sees the week that is now his, not Martin's, and not the contractor party id.
  PERFORM public.wg_test_037_act_as('03700000-0000-4000-8000-0000000000c1');
  SELECT count(*) INTO n FROM public.wg_timesheet_weeks_visible WHERE project_id = 'proj_reg_037';
  IF n <> 1 THEN RAISE EXCEPTION 'James saw % weeks (expected only the assigned one)', n; END IF;
  SELECT COALESCE(string_agg(COALESCE(data::text, '') || COALESCE(subject_snapshot::text, ''), ' '), '') INTO blob
  FROM (
    SELECT data::text, NULL::text AS subject_snapshot FROM public.wg_timesheet_weeks_visible WHERE project_id = 'proj_reg_037'
    UNION ALL
    SELECT NULL::text, subject_snapshot::text FROM public.wg_approval_records_visible WHERE project_id = 'proj_reg_037'
  ) visible;
  IF blob LIKE '%SECRET-NOTE-RODMAN%' OR blob LIKE '%SECRET-NOTE-MARTIN%' OR blob LIKE '%SECRET-DRAFT-RODMAN%' THEN
    RAISE EXCEPTION 'James saw another party''s notes: %', blob;
  END IF;
  IF blob LIKE '%party_contractor%' OR blob LIKE '%party_martin%' THEN
    RAISE EXCEPTION 'James saw a party outside his hop: %', blob;
  END IF;
  IF blob NOT LIKE '%"totalHours": 8%' AND blob NOT LIKE '%"hours": 8%' THEN
    RAISE EXCEPTION 'James lost the hour total he is approving: %', blob;
  END IF;

  PERFORM public.wg_test_037_act_as('03700000-0000-4000-8000-0000000000f1');
  SELECT count(*) INTO n FROM public.wg_timesheet_weeks_visible WHERE project_id = 'proj_reg_037';
  IF n <> 0 THEN RAISE EXCEPTION 'client colleague saw % weeks after the layer was assigned to James', n; END IF;
  SELECT count(*) INTO n FROM public.wg_approval_records_visible WHERE project_id = 'proj_reg_037';
  IF n <> 0 THEN RAISE EXCEPTION 'client colleague saw % approvals', n; END IF;

  -- Martin still sees his own note and not Rodman's.
  PERFORM public.wg_test_037_act_as('03700000-0000-4000-8000-0000000000d1');
  SELECT COALESCE(string_agg(data::text, ' '), '') INTO blob
  FROM public.wg_timesheet_weeks_visible WHERE project_id = 'proj_reg_037';
  IF blob NOT LIKE '%SECRET-NOTE-MARTIN%' THEN RAISE EXCEPTION 'Martin lost his own note'; END IF;
  IF blob LIKE '%SECRET-NOTE-RODMAN%' THEN RAISE EXCEPTION 'Martin saw Rodman''s note'; END IF;

  INSERT INTO wg_regression_037_results VALUES
    ('party_scoped_reads', 'Outsider sees nothing. Drafts stay with the worker. Nikola sees a week only once he is the approver, without Rodman''s notes or party_end. James sees that week without the contractor party or day notes, and not Martin. A client colleague who is not the assigned approver sees nothing.');
END $$;

RESET ROLE;

SELECT check_name, detail FROM wg_regression_037_results ORDER BY check_name;

ROLLBACK;
