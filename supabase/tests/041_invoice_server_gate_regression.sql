-- Regression for migration 041. Synthetic accounts; ROLLBACK at the end.
-- Nikola (agency) can invoice James (client) for Rodman's approved week.
-- The stored total comes from the bill rate, not from the numbers in the request.
-- James cannot invoice from the agency. A submitted week cannot be invoiced.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/041_invoice_server_gate_regression.sql

BEGIN;

CREATE TEMP TABLE wg_regression_041_results (
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
  ('04100000-0000-4000-8000-0000000000a1'::uuid, 'nikola-041@example.test', 'Nikola'),
  ('04100000-0000-4000-8000-0000000000b1'::uuid, 'rodman-041@example.test', 'Rodman'),
  ('04100000-0000-4000-8000-0000000000c1'::uuid, 'james-041@example.test', 'James'),
  ('04100000-0000-4000-8000-0000000000d1'::uuid, 'outsider-041@example.test', 'Outsider')
) AS u(id, email, display_name);

INSERT INTO public.wg_projects (id, name, owner_id, require_purchase_order, graph, parties) VALUES (
  'proj_reg_041', 'Invoice gate', '04100000-0000-4000-8000-0000000000a1', false,
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'party_contractor', 'type', 'party', 'data', jsonb_build_object('name', 'Rodman Co')),
      jsonb_build_object('id', 'party_agency', 'type', 'party', 'data', jsonb_build_object('name', 'Nikola Agency', 'isCreator', true)),
      jsonb_build_object('id', 'party_client', 'type', 'party', 'data', jsonb_build_object('name', 'James Client')),
      jsonb_build_object('id', 'party_end', 'type', 'party', 'data', jsonb_build_object('name', 'End')),
      jsonb_build_object('id', 'person_rodman', 'type', 'person', 'data', jsonb_build_object('name', 'Rodman', 'partyId', 'party_contractor', 'userId', '04100000-0000-4000-8000-0000000000b1'))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'e1', 'source', 'party_contractor', 'target', 'party_agency', 'type', 'billsTo'),
      jsonb_build_object('id', 'e2', 'source', 'party_agency', 'target', 'party_client', 'type', 'billsTo'),
      jsonb_build_object('id', 'e3', 'source', 'party_agency', 'target', 'party_end', 'type', 'billsTo')
    )
  ),
  '[]'::jsonb
);

INSERT INTO public.wg_project_members (
  id, project_id, user_id, user_name, role, scope, graph_node_id, invited_by, accepted_at
) VALUES
  ('mem_041_nikola', 'proj_reg_041', '04100000-0000-4000-8000-0000000000a1', 'Nikola', 'Owner', 'party_agency', 'person_nikola', '04100000-0000-4000-8000-0000000000a1', NOW()),
  ('mem_041_rodman', 'proj_reg_041', '04100000-0000-4000-8000-0000000000b1', 'Rodman', 'Contributor', 'party_contractor', 'person_rodman', '04100000-0000-4000-8000-0000000000a1', NOW()),
  ('mem_041_james', 'proj_reg_041', '04100000-0000-4000-8000-0000000000c1', 'James', 'Commenter', 'party_client', 'person_james', '04100000-0000-4000-8000-0000000000a1', NOW());

INSERT INTO public.wg_organizations (id, name, owner_user_id, created_by) VALUES
  ('org_041_client', 'James Client', '04100000-0000-4000-8000-0000000000c1', '04100000-0000-4000-8000-0000000000c1');
INSERT INTO public.wg_organization_members (id, organization_id, user_id, org_role, membership_state) VALUES
  ('orgmem_041_james', 'org_041_client', '04100000-0000-4000-8000-0000000000c1', 'org_manager', 'verified');
INSERT INTO public.wg_project_organizations (id, project_id, organization_id, graph_node_id, party_role, status) VALUES
  ('porg_041_james', 'proj_reg_041', 'org_041_client', 'party_client', 'client', 'active');

SELECT set_config('wg.approval_write', 'on', true);
INSERT INTO public.wg_timesheet_weeks (id, user_id, project_id, week_start, status, data) VALUES
  ('04100000-0000-4000-8000-0000000000b1:2026-09-07', '04100000-0000-4000-8000-0000000000b1', 'proj_reg_041', DATE '2026-09-07', 'approved', '{"totalHours":8,"days":[{"day":"Mon","hours":8}]}'::jsonb),
  ('04100000-0000-4000-8000-0000000000b1:2026-09-14', '04100000-0000-4000-8000-0000000000b1', 'proj_reg_041', DATE '2026-09-14', 'approved', '{"totalHours":4,"days":[{"day":"Mon","hours":4}]}'::jsonb),
  ('04100000-0000-4000-8000-0000000000b1:2026-09-21', '04100000-0000-4000-8000-0000000000b1', 'proj_reg_041', DATE '2026-09-21', 'submitted', '{"totalHours":8}'::jsonb);
SELECT set_config('wg.approval_write', 'off', true);

INSERT INTO public.wg_contract_rates (
  id, project_id, subject_user_id, subject_graph_node_id, rate_scope, rate_type, amount, currency, created_by
) VALUES (
  'ctrate_041', 'proj_reg_041', '04100000-0000-4000-8000-0000000000b1', 'person_rodman',
  'bill', 'hourly', 10, 'EUR', '04100000-0000-4000-8000-0000000000a1'
);

CREATE OR REPLACE FUNCTION public.wg_test_041_act_as(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.wg_test_041_create(p_invoice jsonb) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_row public.wg_invoices;
BEGIN
  v_row := public.wg_create_invoice(p_invoice);
  RETURN v_row.status || '|' || v_row.subtotal::text || '|' || v_row.tax_total::text || '|' || v_row.total::text;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE || ' ' || SQLERRM;
END;
$$;
CREATE OR REPLACE FUNCTION public.wg_test_041_require_po(p_on boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
BEGIN
  UPDATE public.wg_projects SET require_purchase_order = p_on WHERE id = 'proj_reg_041';
END;
$$;

CREATE OR REPLACE FUNCTION public.wg_test_041_sign_po() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
BEGIN
  INSERT INTO public.wg_documents (
    id, project_id, type, title, from_party, to_party, status, created_by
  ) VALUES (
    'doc_041_po', 'proj_reg_041', 'purchase_order', 'PO', 'party_client', 'party_agency', 'signed',
    '04100000-0000-4000-8000-0000000000a1'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.wg_test_041_require_po(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wg_test_041_sign_po() TO authenticated;
GRANT EXECUTE ON FUNCTION public.wg_test_041_act_as(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wg_test_041_create(jsonb) TO authenticated;
GRANT INSERT ON wg_regression_041_results TO authenticated;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  result text;
  n integer;
BEGIN
  PERFORM public.wg_test_041_act_as('04100000-0000-4000-8000-0000000000a1');
  result := public.wg_test_041_create(jsonb_build_object(
    'project_id', 'proj_reg_041',
    'invoice_number', 'INV-041-OK',
    'from_party_id', 'party_agency',
    'to_party_id', 'party_client',
    'issue_date', CURRENT_DATE,
    'due_date', CURRENT_DATE + 30,
    'currency', 'EUR',
    'tax_rate', 25,
    'line_items', '[]'::jsonb,
    'subtotal', 99999,
    'tax_total', 1,
    'total', 1,
    'status', 'issued',
    'timesheet_ids', jsonb_build_array('person_rodman:2026-09-07')
  ));
  IF result IS DISTINCT FROM 'issued|80.00|20.00|100.00' THEN
    RAISE EXCEPTION 'approved week was not repriced from the bill rate: %', result;
  END IF;

  result := public.wg_test_041_create(jsonb_build_object(
    'project_id', 'proj_reg_041', 'invoice_number', 'INV-041-SUBMITTED',
    'from_party_id', 'party_agency', 'to_party_id', 'party_client',
    'issue_date', CURRENT_DATE, 'due_date', CURRENT_DATE + 30, 'currency', 'EUR',
    'status', 'draft', 'timesheet_ids', jsonb_build_array('person_rodman:2026-09-21'),
    'subtotal', 80, 'tax_total', 0, 'total', 80
  ));
  IF result NOT LIKE '23514%not an approved week%' THEN
    RAISE EXCEPTION 'submitted week was invoiced: %', result;
  END IF;

  result := public.wg_test_041_create(jsonb_build_object(
    'project_id', 'proj_reg_041', 'invoice_number', 'INV-041-REVERSE',
    'from_party_id', 'party_client', 'to_party_id', 'party_agency',
    'issue_date', CURRENT_DATE, 'due_date', CURRENT_DATE + 30, 'currency', 'EUR',
    'status', 'issued', 'timesheet_ids', jsonb_build_array('person_rodman:2026-09-14'),
    'subtotal', 40, 'tax_total', 0, 'total', 40
  ));
  IF result NOT LIKE '42501%do not control%' AND result NOT LIKE '23514%buyer%' THEN
    RAISE EXCEPTION 'invoice from the client was accepted: %', result;
  END IF;

  PERFORM public.wg_test_041_act_as('04100000-0000-4000-8000-0000000000c1');
  result := public.wg_test_041_create(jsonb_build_object(
    'project_id', 'proj_reg_041', 'invoice_number', 'INV-041-JAMES',
    'from_party_id', 'party_agency', 'to_party_id', 'party_client',
    'issue_date', CURRENT_DATE, 'due_date', CURRENT_DATE + 30, 'currency', 'EUR',
    'status', 'draft', 'timesheet_ids', jsonb_build_array('person_rodman:2026-09-14'),
    'subtotal', 1, 'tax_total', 0, 'total', 1
  ));
  IF result NOT LIKE '42501%' THEN
    RAISE EXCEPTION 'James invoiced from the agency: %', result;
  END IF;

  PERFORM public.wg_test_041_act_as('04100000-0000-4000-8000-0000000000b1');
  result := public.wg_test_041_create(jsonb_build_object(
    'project_id', 'proj_reg_041', 'invoice_number', 'INV-041-RODMAN',
    'from_party_id', 'party_contractor', 'to_party_id', 'party_agency',
    'issue_date', CURRENT_DATE, 'due_date', CURRENT_DATE + 30, 'currency', 'EUR',
    'status', 'draft', 'timesheet_ids', jsonb_build_array('person_rodman:2026-09-14'),
    'subtotal', 1, 'tax_total', 0, 'total', 1
  ));
  IF result NOT LIKE '42501%' THEN
    RAISE EXCEPTION 'Rodman created an invoice: %', result;
  END IF;

  PERFORM public.wg_test_041_act_as('04100000-0000-4000-8000-0000000000a1');
  result := public.wg_test_041_create(jsonb_build_object(
    'project_id', 'proj_reg_041', 'invoice_number', 'INV-041-DUP',
    'from_party_id', 'party_agency', 'to_party_id', 'party_client',
    'issue_date', CURRENT_DATE, 'due_date', CURRENT_DATE + 30, 'currency', 'EUR',
    'status', 'issued', 'timesheet_ids', jsonb_build_array('04100000-0000-4000-8000-0000000000b1:2026-09-07'),
    'subtotal', 1, 'tax_total', 0, 'total', 1
  ));
  IF result NOT LIKE '23505%already billed%' THEN
    RAISE EXCEPTION 'the same week was billed twice: %', result;
  END IF;

  PERFORM public.wg_test_041_require_po(true);
  result := public.wg_test_041_create(jsonb_build_object(
    'project_id', 'proj_reg_041', 'invoice_number', 'INV-041-PO',
    'from_party_id', 'party_agency', 'to_party_id', 'party_client',
    'issue_date', CURRENT_DATE, 'due_date', CURRENT_DATE + 30, 'currency', 'EUR',
    'status', 'issued', 'timesheet_ids', jsonb_build_array('person_rodman:2026-09-14'),
    'subtotal', 1, 'tax_total', 0, 'total', 1
  ));
  IF result NOT LIKE '23514%purchase order%' THEN
    RAISE EXCEPTION 'issued without a purchase order: %', result;
  END IF;

  PERFORM public.wg_test_041_sign_po();
  result := public.wg_test_041_create(jsonb_build_object(
    'project_id', 'proj_reg_041', 'invoice_number', 'INV-041-PO-OK',
    'from_party_id', 'party_agency', 'to_party_id', 'party_client',
    'issue_date', CURRENT_DATE, 'due_date', CURRENT_DATE + 30, 'currency', 'EUR',
    'status', 'issued', 'timesheet_ids', jsonb_build_array('person_rodman:2026-09-14'),
    'subtotal', 999, 'tax_total', 999, 'total', 999
  ));
  IF result IS DISTINCT FROM 'issued|40.00|0.00|40.00' THEN
    RAISE EXCEPTION 'priced invoice after the purchase order was not 4h x 10: %', result;
  END IF;

  result := public.wg_test_041_create(jsonb_build_object(
    'project_id', 'proj_reg_041', 'invoice_number', 'INV-041-END',
    'from_party_id', 'party_agency', 'to_party_id', 'party_end',
    'issue_date', CURRENT_DATE, 'due_date', CURRENT_DATE + 30, 'currency', 'EUR',
    'status', 'draft', 'line_items', jsonb_build_array(jsonb_build_object('quantity', 1, 'unitPrice', 5, 'amount', 999)),
    'subtotal', 999, 'tax_total', 0, 'total', 999
  ));
  IF result IS DISTINCT FROM 'draft|5.00|0.00|5.00' THEN
    RAISE EXCEPTION 'fixed line did not recompute from quantity and unit price: %', result;
  END IF;

  PERFORM public.wg_test_041_act_as('04100000-0000-4000-8000-0000000000c1');
  SELECT count(*) INTO n FROM public.wg_invoices WHERE project_id = 'proj_reg_041' AND to_party_id = 'party_client';
  IF n <> 2 THEN RAISE EXCEPTION 'James saw % invoices billed to him (expected 2)', n; END IF;
  SELECT count(*) INTO n FROM public.wg_invoices WHERE project_id = 'proj_reg_041' AND to_party_id = 'party_end';
  IF n <> 0 THEN RAISE EXCEPTION 'James saw an invoice billed to another party'; END IF;

  PERFORM public.wg_test_041_act_as('04100000-0000-4000-8000-0000000000d1');
  SELECT count(*) INTO n FROM public.wg_invoices WHERE project_id = 'proj_reg_041';
  IF n <> 0 THEN RAISE EXCEPTION 'outsider saw % invoices', n; END IF;

  INSERT INTO wg_regression_041_results VALUES
    ('invoice_gate', 'Nikola''s issued total is 8 hours times the stored 10 rate, plus the tax rate, not the 99999 he sent. Submitted weeks, the wrong seller, and a second bill of the same week are refused. A required purchase order blocks issuing until one is signed. James sees invoices billed to his party and not the one billed to someone else.');
END $$;

RESET ROLE;

SELECT check_name, detail FROM wg_regression_041_results ORDER BY check_name;

ROLLBACK;
