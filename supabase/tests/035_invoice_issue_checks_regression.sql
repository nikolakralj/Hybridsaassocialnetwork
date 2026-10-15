-- Regression for migration 035 (requires 034). Synthetic fixtures; ROLLBACK at the end.
-- Agency (party_a) bills Client (party_c). Worker W has an approved week that
-- crosses months (2026-09-28), an approved week inside September (2026-09-14),
-- and a submitted week (2026-09-21).

BEGIN;

CREATE TEMP TABLE wg_regression_035_results (check_name TEXT PRIMARY KEY, detail TEXT NOT NULL) ON COMMIT DROP;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
  ((SELECT id FROM auth.instances LIMIT 1), 'a0350000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'owner-035@example.test', '', NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Owner"}'::jsonb, NOW(), NOW(), '', '', '', ''),
  ((SELECT id FROM auth.instances LIMIT 1), 'a0350000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'worker-035@example.test', '', NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Worker"}'::jsonb, NOW(), NOW(), '', '', '', '');

INSERT INTO public.wg_projects (id, name, owner_id, graph, parties) VALUES (
  'proj_reg_035', 'Synthetic 035 project', 'a0350000-0000-4000-8000-00000000000a',
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'party_a', 'type', 'party', 'data', jsonb_build_object('name', 'Agency', 'isCreator', true)),
      jsonb_build_object('id', 'party_c', 'type', 'party', 'data', jsonb_build_object('name', 'Client')),
      jsonb_build_object('id', 'person_w', 'type', 'person', 'data', jsonb_build_object('name', 'Worker', 'partyId', 'party_a', 'userId', 'a0350000-0000-4000-8000-00000000000b'))
    ),
    'edges', jsonb_build_array(jsonb_build_object('id', 'e1', 'source', 'party_a', 'target', 'party_c', 'type', 'billsTo'))
  ),
  '[]'::jsonb
);

INSERT INTO public.wg_project_members (id, project_id, user_id, user_name, role, scope, graph_node_id, invited_by, accepted_at)
VALUES ('mem_035_w', 'proj_reg_035', 'a0350000-0000-4000-8000-00000000000b', 'Worker', 'Contributor', 'party_a', 'person_w', 'a0350000-0000-4000-8000-00000000000a', NOW());

SELECT set_config('wg.approval_write', 'on', true);
INSERT INTO public.wg_timesheet_weeks (id, user_id, project_id, week_start, status, data) VALUES
  ('a0350000-0000-4000-8000-00000000000b:2026-09-14', 'a0350000-0000-4000-8000-00000000000b', 'proj_reg_035', DATE '2026-09-14', 'approved', '{"totalHours": 8}'::jsonb),
  ('a0350000-0000-4000-8000-00000000000b:2026-09-21', 'a0350000-0000-4000-8000-00000000000b', 'proj_reg_035', DATE '2026-09-21', 'submitted', '{"totalHours": 8}'::jsonb),
  ('a0350000-0000-4000-8000-00000000000b:2026-09-28', 'a0350000-0000-4000-8000-00000000000b', 'proj_reg_035', DATE '2026-09-28', 'approved', '{"totalHours": 32}'::jsonb);
SELECT set_config('wg.approval_write', 'off', true);

CREATE OR REPLACE FUNCTION public.wg_test_035_issue(p_id text, p_from text, p_to text, p_keys text[])
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.wg_invoices (id, project_id, invoice_number, from_party_id, to_party_id, issue_date, due_date,
                                  line_items, subtotal, tax_total, total, status, timesheet_ids, created_by)
  VALUES (p_id, 'proj_reg_035', p_id, p_from, p_to, CURRENT_DATE, CURRENT_DATE + 30,
          '[]'::jsonb, 1, 0, 1, 'issued', p_keys, 'a0350000-0000-4000-8000-00000000000a');
  RETURN 'issued';
EXCEPTION WHEN check_violation OR unique_violation THEN
  RETURN 'refused: ' || SQLERRM;
END;
$$;

DO $$
DECLARE r text;
BEGIN
  -- approved week, right buyer, by graph node id and by auth uid
  r := public.wg_test_035_issue('INV-035-OK', 'party_a', 'party_c', ARRAY['person_w:2026-09-14']);
  IF r <> 'issued' THEN RAISE EXCEPTION 'approved week refused: %', r; END IF;

  r := public.wg_test_035_issue('INV-035-SUBMITTED', 'party_a', 'party_c', ARRAY['a0350000-0000-4000-8000-00000000000b:2026-09-21']);
  IF r NOT LIKE 'refused%not an approved week%' THEN RAISE EXCEPTION 'submitted week issued: %', r; END IF;

  r := public.wg_test_035_issue('INV-035-MISSING', 'party_a', 'party_c', ARRAY['person_w:2026-10-05']);
  IF r NOT LIKE 'refused%not an approved week%' THEN RAISE EXCEPTION 'missing week issued: %', r; END IF;

  r := public.wg_test_035_issue('INV-035-WRONG-BUYER', 'party_c', 'party_a', ARRAY['person_w:2026-09-28@2026-09']);
  IF r NOT LIKE 'refused%buyer%' THEN RAISE EXCEPTION 'reverse direction issued: %', r; END IF;

  r := public.wg_test_035_issue('INV-035-SELF', 'proj_reg_035', 'proj_reg_035', ARRAY['person_w:2026-09-28@2026-09']);
  IF r NOT LIKE 'refused%buyer%' THEN RAISE EXCEPTION 'project-as-both-parties issued: %', r; END IF;

  INSERT INTO wg_regression_035_results VALUES
    ('only_approved_weeks_and_right_buyer', 'Approved week issues; submitted or unknown week, reversed parties, or project-as-both-parties are refused.');

  -- duplicates: same week again; month parts
  r := public.wg_test_035_issue('INV-035-DUP', 'party_a', 'party_c', ARRAY['a0350000-0000-4000-8000-00000000000b:2026-09-14']);
  IF r NOT LIKE 'refused%already billed on invoice INV-035-OK%' THEN RAISE EXCEPTION 'same week billed twice: %', r; END IF;

  r := public.wg_test_035_issue('INV-035-SEP', 'party_a', 'party_c', ARRAY['person_w:2026-09-28@2026-09']);
  IF r <> 'issued' THEN RAISE EXCEPTION 'September part refused: %', r; END IF;
  r := public.wg_test_035_issue('INV-035-OCT', 'party_a', 'party_c', ARRAY['person_w:2026-09-28@2026-10']);
  IF r <> 'issued' THEN RAISE EXCEPTION 'October part refused: %', r; END IF;
  r := public.wg_test_035_issue('INV-035-SEP-AGAIN', 'party_a', 'party_c', ARRAY['person_w:2026-09-28@2026-09']);
  IF r NOT LIKE 'refused%already billed%' THEN RAISE EXCEPTION 'September part billed twice: %', r; END IF;
  r := public.wg_test_035_issue('INV-035-WHOLE', 'party_a', 'party_c', ARRAY['person_w:2026-09-28']);
  IF r NOT LIKE 'refused%already billed%' THEN RAISE EXCEPTION 'whole week billed over its parts: %', r; END IF;

  INSERT INTO wg_regression_035_results VALUES
    ('no_double_billing', 'A week is billed once; September and October parts each bill once; a whole-week key conflicts with its parts.');
END $$;

-- Drafts are not checked, and a cancelled invoice frees its weeks.
DO $$
DECLARE r text;
BEGIN
  INSERT INTO public.wg_invoices (id, project_id, invoice_number, from_party_id, to_party_id, issue_date, due_date,
                                  line_items, subtotal, tax_total, total, status, timesheet_ids, created_by)
  VALUES ('INV-035-DRAFT', 'proj_reg_035', 'INV-035-DRAFT', 'party_c', 'party_a', CURRENT_DATE, CURRENT_DATE + 30,
          '[]'::jsonb, 1, 0, 1, 'draft', ARRAY['person_w:2026-09-21'], 'a0350000-0000-4000-8000-00000000000a');

  UPDATE public.wg_invoices SET status = 'cancelled' WHERE id = 'INV-035-OK';
  r := public.wg_test_035_issue('INV-035-REISSUE', 'party_a', 'party_c', ARRAY['person_w:2026-09-14']);
  IF r <> 'issued' THEN RAISE EXCEPTION 'week not freed by cancellation: %', r; END IF;

  INSERT INTO wg_regression_035_results VALUES
    ('drafts_free_cancel_frees', 'A draft with a submitted week and reversed parties saves; after cancelling, the week can be issued again.');
END $$;

SELECT check_name, detail FROM wg_regression_035_results ORDER BY check_name;

ROLLBACK;
