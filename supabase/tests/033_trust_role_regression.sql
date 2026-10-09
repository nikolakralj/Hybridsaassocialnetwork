-- Role regression for the trust boundary.
-- Synthetic fixtures only. No live project rows, no real people, no real rates.
-- The closing ROLLBACK drops every fixture, including the auth.users inserts.
--
-- How to run
-- ----------
-- Run the whole file as one transaction in the Supabase SQL editor or psql,
-- connected as postgres (a role that may SET ROLE authenticated):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/033_trust_role_regression.sql
--
-- Do not run this against a session that autocommits each statement.
-- Do not supabase db push. This file is a test, not a migration.
-- A clean run prints wg_regression_033_results. outcome = pass means the
-- database enforced the check. outcome = known_failure means the schema does
-- not enforce it yet; the detail says where the guard lives instead.
-- Any unexpected hole raises and aborts the script. ROLLBACK still applies
-- when the client treats a failed script as one transaction (ON_ERROR_STOP).

BEGIN;

CREATE TEMP TABLE wg_regression_033_results (
  check_name TEXT PRIMARY KEY,
  outcome TEXT NOT NULL CHECK (outcome IN ('pass', 'known_failure')),
  detail TEXT NOT NULL
) ON COMMIT DROP;

ALTER TABLE auth.users DISABLE TRIGGER USER;

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
SELECT
  (SELECT id FROM auth.instances LIMIT 1),
  users.id,
  'authenticated',
  'authenticated',
  users.email,
  '',
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('name', users.display_name),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
FROM (
  VALUES
    ('11111111-1111-4111-8111-111111111111'::uuid, 'agency-owner@example.test', 'Synthetic Agency Owner'),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'client-approver@example.test', 'Synthetic Client Approver'),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'worker@example.test', 'Synthetic Worker')
) AS users(id, email, display_name);

ALTER TABLE auth.users ENABLE TRIGGER USER;

INSERT INTO public.wg_organizations (id, name, profile_visibility, owner_user_id, created_by)
VALUES
  ('org_reg_033_agency', 'Synthetic Agency', 'private', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'),
  ('org_reg_033_client', 'Synthetic Client', 'private', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111'),
  ('org_reg_033_other', 'Synthetic Other Company', 'private', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111');

INSERT INTO public.wg_organization_members (
  id, organization_id, user_id, email, display_name, org_role,
  membership_state, default_visibility, verified_by, verified_at
) VALUES
  (
    'orgmem_reg_033_agency', 'org_reg_033_agency',
    '11111111-1111-4111-8111-111111111111', 'agency-owner@example.test',
    'Synthetic Agency Owner', 'org_admin', 'verified', 'finance',
    '11111111-1111-4111-8111-111111111111', NOW()
  ),
  (
    'orgmem_reg_033_client', 'org_reg_033_client',
    '22222222-2222-4222-8222-222222222222', 'client-approver@example.test',
    'Synthetic Client Approver', 'org_approver', 'verified', 'approver',
    '11111111-1111-4111-8111-111111111111', NOW()
  ),
  (
    'orgmem_reg_033_worker', 'org_reg_033_agency',
    '33333333-3333-4333-8333-333333333333', 'worker@example.test',
    'Synthetic Worker', 'org_worker', 'verified', 'worker',
    '11111111-1111-4111-8111-111111111111', NOW()
  );

INSERT INTO public.wg_projects (id, name, owner_id, graph, parties)
VALUES (
  'proj_reg_033',
  'Synthetic regression project',
  '11111111-1111-4111-8111-111111111111',
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'party_reg_agency', 'type', 'party', 'data', jsonb_build_object('name', 'Synthetic Agency', 'partyType', 'agency')),
      jsonb_build_object('id', 'party_reg_client', 'type', 'party', 'data', jsonb_build_object('name', 'Synthetic Client', 'partyType', 'client')),
      jsonb_build_object('id', 'party_reg_other', 'type', 'party', 'data', jsonb_build_object('name', 'Synthetic Other Company', 'partyType', 'company'))
    ),
    'edges', '[]'::jsonb
  ),
  '[]'::jsonb
);

INSERT INTO public.wg_project_organizations (
  id, project_id, organization_id, graph_node_id, party_role, status, accepted_at
) VALUES
  ('porg_reg_033_agency', 'proj_reg_033', 'org_reg_033_agency', 'party_reg_agency', 'agency', 'active', NOW()),
  ('porg_reg_033_client', 'proj_reg_033', 'org_reg_033_client', 'party_reg_client', 'client', 'active', NOW()),
  ('porg_reg_033_other', 'proj_reg_033', 'org_reg_033_other', 'party_reg_other', 'company', 'active', NOW());

INSERT INTO public.wg_project_members (
  id, project_id, user_id, user_name, user_email, role, scope,
  invited_by, accepted_at, can_approve, can_view_rates, can_edit_timesheets, visible_to_chain
) VALUES
  (
    'mem_reg_033_agency', 'proj_reg_033',
    '11111111-1111-4111-8111-111111111111', 'Synthetic Agency Owner', 'agency-owner@example.test',
    'Owner', 'party_reg_agency', '11111111-1111-4111-8111-111111111111', NOW(),
    true, true, true, true
  ),
  (
    'mem_reg_033_client', 'proj_reg_033',
    '22222222-2222-4222-8222-222222222222', 'Synthetic Client Approver', 'client-approver@example.test',
    'Commenter', 'party_reg_client', '11111111-1111-4111-8111-111111111111', NOW(),
    true, false, false, true
  ),
  (
    'mem_reg_033_worker', 'proj_reg_033',
    '33333333-3333-4333-8333-333333333333', 'Synthetic Worker', 'worker@example.test',
    'Contributor', 'party_reg_agency', '11111111-1111-4111-8111-111111111111', NOW(),
    false, false, true, true
  );

INSERT INTO public.wg_contracts (id, project_id, owner_id, title, status)
VALUES (
  'contract_reg_033_worker',
  'proj_reg_033',
  '11111111-1111-4111-8111-111111111111',
  'Synthetic worker agreement',
  'active'
);

INSERT INTO public.wg_contract_signatories (
  id, contract_id, organization_id, signatory_role
) VALUES (
  'ctrsig_reg_033_agency',
  'contract_reg_033_worker',
  'org_reg_033_agency',
  'worker_company'
);

-- Amounts are fixture markers, not anyone's commercial rate.
INSERT INTO public.wg_contract_rates (
  id, contract_id, project_id, organization_id, subject_user_id,
  subject_graph_node_id, rate_scope, rate_type, amount, currency, created_by
) VALUES
  ('ctrate_reg_033_pay', 'contract_reg_033_worker', 'proj_reg_033', 'org_reg_033_agency', '33333333-3333-4333-8333-333333333333', 'person_reg_worker', 'pay', 'hourly', 1.11, 'EUR', '11111111-1111-4111-8111-111111111111'),
  ('ctrate_reg_033_bill', 'contract_reg_033_worker', 'proj_reg_033', 'org_reg_033_agency', '33333333-3333-4333-8333-333333333333', 'person_reg_worker', 'bill', 'hourly', 2.22, 'EUR', '11111111-1111-4111-8111-111111111111'),
  ('ctrate_reg_033_markup', 'contract_reg_033_worker', 'proj_reg_033', 'org_reg_033_agency', NULL, 'person_reg_worker', 'markup', 'hourly', 0.33, 'EUR', '11111111-1111-4111-8111-111111111111'),
  ('ctrate_reg_033_cost', 'contract_reg_033_worker', 'proj_reg_033', 'org_reg_033_agency', NULL, 'person_reg_worker', 'cost', 'hourly', 0.44, 'EUR', '11111111-1111-4111-8111-111111111111');

INSERT INTO public.wg_invoices (
  id, project_id, invoice_number, from_party_id, to_party_id,
  issue_date, due_date, line_items, subtotal, tax_total, total,
  status, created_by
) VALUES (
  'inv_reg_033_foreign', 'proj_reg_033', 'REG-033-FOREIGN',
  'party_reg_agency', 'party_reg_other',
  CURRENT_DATE, CURRENT_DATE + 14, '[]'::jsonb, 1.00, 0, 1.00,
  'issued', '11111111-1111-4111-8111-111111111111'
);

INSERT INTO public.wg_timesheet_weeks (
  id, user_id, project_id, week_start, status, data
) VALUES (
  'week_reg_033',
  '33333333-3333-4333-8333-333333333333',
  'proj_reg_033',
  DATE '2026-09-28',
  'submitted',
  '{"totalHours": 8}'::jsonb
);

INSERT INTO public.wg_project_invitations (
  id, project_id, project_name, email, role, invited_by, expires_at, status
) VALUES (
  'invite_reg_033_expired', 'proj_reg_033', 'Synthetic regression project',
  'expired-invitee@example.test', 'Commenter',
  '11111111-1111-4111-8111-111111111111', NOW() - INTERVAL '1 day', 'pending'
);

INSERT INTO public.wg_project_invitations (
  id, project_id, project_name, email, role, invited_by,
  expires_at, accepted_at, accepted_by_user_id, status
) VALUES (
  'invite_reg_033_used', 'proj_reg_033', 'Synthetic regression project',
  'client-approver@example.test', 'Commenter',
  '11111111-1111-4111-8111-111111111111',
  NOW() + INTERVAL '7 days', NOW(), '22222222-2222-4222-8222-222222222222', 'accepted'
);

-- Issued invoice content is frozen, and issued cannot return to draft.
-- Runs as the table owner so RLS does not hide the row; the trigger is the guard.
DO $$
DECLARE
  content_edit_rejected BOOLEAN := false;
  draft_reversal_rejected BOOLEAN := false;
BEGIN
  INSERT INTO public.wg_invoices (
    id, project_id, invoice_number, from_party_id, to_party_id,
    issue_date, due_date, line_items, subtotal, tax_total, total,
    status, created_by
  ) VALUES (
    'inv_reg_033_lifecycle', 'proj_reg_033', 'REG-033-LIFECYCLE',
    'party_reg_agency', 'party_reg_client',
    CURRENT_DATE, CURRENT_DATE + 14, '[]'::jsonb, 1.00, 0, 1.00,
    'draft', '11111111-1111-4111-8111-111111111111'
  );

  UPDATE public.wg_invoices
  SET status = 'issued'
  WHERE id = 'inv_reg_033_lifecycle';

  BEGIN
    UPDATE public.wg_invoices
    SET notes = 'forbidden edit'
    WHERE id = 'inv_reg_033_lifecycle';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    content_edit_rejected := true;
  END;

  IF NOT content_edit_rejected THEN
    RAISE EXCEPTION 'issued invoice content edit was not rejected';
  END IF;

  BEGIN
    UPDATE public.wg_invoices
    SET status = 'draft'
    WHERE id = 'inv_reg_033_lifecycle';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    draft_reversal_rejected := true;
  END;

  IF NOT draft_reversal_rejected THEN
    RAISE EXCEPTION 'issued invoice was moved back to draft';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.wg_invoices
    WHERE id = 'inv_reg_033_lifecycle'
      AND (status <> 'issued' OR notes IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'issued invoice changed despite the lifecycle trigger';
  END IF;

  INSERT INTO wg_regression_033_results (check_name, outcome, detail)
  VALUES (
    'issued_invoice_immutable',
    'pass',
    'Notes edit and issued -> draft both raise 22023. Status stays issued.'
  );
END;
$$;

-- Invitation expiry and single-use are not database constraints. The accept
-- route in supabase/functions/server/invitations-api.tsx rejects status other
-- than pending and expires_at in the past. These probes record that gap.
DO $$
DECLARE
  updated_rows INTEGER := 0;
BEGIN
  BEGIN
    UPDATE public.wg_project_invitations
    SET status = 'accepted',
        accepted_at = NOW(),
        accepted_by_user_id = '22222222-2222-4222-8222-222222222222'
    WHERE id = 'invite_reg_033_expired'
      AND status = 'pending'
      AND expires_at < NOW();
    GET DIAGNOSTICS updated_rows = ROW_COUNT;

    IF updated_rows = 0 THEN
      INSERT INTO wg_regression_033_results (check_name, outcome, detail)
      VALUES (
        'expired_invite_rejected',
        'pass',
        'A direct update of an expired pending invite matched no rows.'
      );
    ELSE
      RAISE EXCEPTION 'expired invite update succeeded' USING ERRCODE = 'P0001';
    END IF;
  EXCEPTION
    WHEN SQLSTATE '22023' OR SQLSTATE '42501' OR SQLSTATE '23514' THEN
      INSERT INTO wg_regression_033_results (check_name, outcome, detail)
      VALUES (
        'expired_invite_rejected',
        'pass',
        'The database rejected acceptance of an expired invite.'
      );
    WHEN SQLSTATE 'P0001' THEN
      INSERT INTO wg_regression_033_results (check_name, outcome, detail)
      VALUES (
        'expired_invite_rejected',
        'known_failure',
        'Direct SQL can mark an expired pending invite accepted. wg_project_invitations has expires_at but no trigger. invitations-api.tsx returns 410 when expires_at is past.'
      );
  END;

  updated_rows := 0;
  BEGIN
    UPDATE public.wg_project_invitations
    SET status = 'pending',
        accepted_at = NULL,
        accepted_by_user_id = NULL
    WHERE id = 'invite_reg_033_used'
      AND status = 'accepted';
    GET DIAGNOSTICS updated_rows = ROW_COUNT;

    IF updated_rows = 0 THEN
      INSERT INTO wg_regression_033_results (check_name, outcome, detail)
      VALUES (
        'used_invite_rejected',
        'pass',
        'A direct replay of an accepted invite matched no rows.'
      );
    ELSE
      RAISE EXCEPTION 'used invite was reopened' USING ERRCODE = 'P0001';
    END IF;
  EXCEPTION
    WHEN SQLSTATE '22023' OR SQLSTATE '42501' OR SQLSTATE '23514' THEN
      INSERT INTO wg_regression_033_results (check_name, outcome, detail)
      VALUES (
        'used_invite_rejected',
        'pass',
        'The database rejected reopening an accepted invite.'
      );
    WHEN SQLSTATE 'P0001' THEN
      INSERT INTO wg_regression_033_results (check_name, outcome, detail)
      VALUES (
        'used_invite_rejected',
        'known_failure',
        'Direct SQL can set an accepted invite back to pending. There is no used_at column. invitations-api.tsx returns 409 when status is not pending.'
      );
  END;
END;
$$;

GRANT SELECT, UPDATE ON public.wg_projects TO authenticated;
GRANT SELECT, UPDATE ON public.wg_project_members TO authenticated;
GRANT SELECT ON public.wg_contract_rates TO authenticated;
GRANT SELECT ON public.wg_contracts TO authenticated;
GRANT SELECT ON public.wg_invoices TO authenticated;
GRANT SELECT, UPDATE ON public.wg_timesheet_weeks TO authenticated;
GRANT INSERT ON wg_regression_033_results TO authenticated;
GRANT EXECUTE ON FUNCTION public.wg_link_member_as_party_approver(TEXT, TEXT, TEXT) TO authenticated;

SET LOCAL ROLE authenticated;

-- Rightful reader can see the fixture. If this fails, later denials are meaningless.
DO $$
DECLARE
  visible_rates INTEGER;
  visible_contracts INTEGER;
  visible_invoices INTEGER;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
    true
  );
  IF auth.uid() IS DISTINCT FROM '11111111-1111-4111-8111-111111111111'::uuid THEN
    RAISE EXCEPTION 'auth.uid() did not follow the agency fixture (%)', auth.uid();
  END IF;

  SELECT count(*) INTO visible_rates
  FROM public.wg_contract_rates
  WHERE project_id = 'proj_reg_033';

  SELECT count(*) INTO visible_contracts
  FROM public.wg_contracts
  WHERE id = 'contract_reg_033_worker';

  SELECT count(*) INTO visible_invoices
  FROM public.wg_invoices
  WHERE id = 'inv_reg_033_foreign';

  IF visible_rates <> 4 OR visible_contracts <> 1 OR visible_invoices <> 1 THEN
    RAISE EXCEPTION
      'agency owner fixture unreadable under RLS (rates %, contracts %, invoices %)',
      visible_rates, visible_contracts, visible_invoices;
  END IF;

  INSERT INTO wg_regression_033_results (check_name, outcome, detail)
  VALUES (
    'agency_owner_reads_own_commercial_rows',
    'pass',
    'Synthetic agency owner sees 4 rate rows, the worker contract, and the agency-to-other invoice.'
  );
END;
$$;

-- Client approver (James-type): not in the agency, not finance for the other party.
DO $$
DECLARE
  visible_rates INTEGER;
  visible_pay INTEGER;
  visible_bill INTEGER;
  visible_margin INTEGER;
  visible_contracts INTEGER;
  visible_invoices INTEGER;
  updated_rows INTEGER := 0;
  agency_link_rejected BOOLEAN := false;
  other_link_rejected BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
    true
  );
  IF auth.uid() IS DISTINCT FROM '22222222-2222-4222-8222-222222222222'::uuid THEN
    RAISE EXCEPTION 'auth.uid() did not follow the client fixture (%)', auth.uid();
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE rate_scope = 'pay'),
    count(*) FILTER (WHERE rate_scope = 'bill'),
    count(*) FILTER (WHERE rate_scope IN ('markup', 'cost'))
  INTO visible_rates, visible_pay, visible_bill, visible_margin
  FROM public.wg_contract_rates
  WHERE project_id = 'proj_reg_033';

  IF visible_rates <> 0 OR visible_pay <> 0 OR visible_bill <> 0 OR visible_margin <> 0 THEN
    RAISE EXCEPTION
      'client read agency commercial rates (all %, pay %, bill %, margin %)',
      visible_rates, visible_pay, visible_bill, visible_margin;
  END IF;

  SELECT count(*) INTO visible_contracts
  FROM public.wg_contracts
  WHERE id = 'contract_reg_033_worker';
  IF visible_contracts <> 0 THEN
    RAISE EXCEPTION 'client read the worker contract';
  END IF;

  SELECT count(*) INTO visible_invoices
  FROM public.wg_invoices
  WHERE id = 'inv_reg_033_foreign';
  IF visible_invoices <> 0 THEN
    RAISE EXCEPTION 'client read an invoice between other parties';
  END IF;

  UPDATE public.wg_projects
  SET graph = '{"nodes":[],"edges":[]}'::jsonb
  WHERE id = 'proj_reg_033';
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 0 THEN
    RAISE EXCEPTION 'client edited the project graph';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.wg_projects
    WHERE id = 'proj_reg_033'
      AND graph->'nodes' @> '[{"id":"party_reg_agency"}]'::jsonb
  ) THEN
    RAISE EXCEPTION 'client graph update removed the agency party';
  END IF;

  updated_rows := 0;
  UPDATE public.wg_project_members
  SET can_approve = true,
      scope = 'party_reg_agency'
  WHERE id = 'mem_reg_033_client';
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 0 THEN
    RAISE EXCEPTION 'client rewrote their membership onto the agency';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.wg_project_members
    WHERE id = 'mem_reg_033_client'
      AND scope IS DISTINCT FROM 'party_reg_client'
  ) THEN
    RAISE EXCEPTION 'client scope no longer matches their own party';
  END IF;

  BEGIN
    PERFORM public.wg_link_member_as_party_approver(
      'proj_reg_033',
      'mem_reg_033_client',
      'party_reg_agency'
    );
  EXCEPTION WHEN SQLSTATE '42501' THEN
    agency_link_rejected := true;
  END;
  IF NOT agency_link_rejected THEN
    RAISE EXCEPTION 'client linked themselves as an approver of the agency';
  END IF;

  BEGIN
    PERFORM public.wg_link_member_as_party_approver(
      'proj_reg_033',
      'mem_reg_033_client',
      'party_reg_other'
    );
  EXCEPTION WHEN SQLSTATE '42501' THEN
    other_link_rejected := true;
  END;
  IF NOT other_link_rejected THEN
    RAISE EXCEPTION 'client linked themselves as an approver of a company they are not in';
  END IF;

  INSERT INTO wg_regression_033_results (check_name, outcome, detail)
  VALUES
    ('client_cannot_read_agency_rates', 'pass', 'Pay, bill, markup, and cost rows are invisible to the client approver.'),
    ('client_cannot_read_worker_contract', 'pass', 'The agency worker contract is invisible to the client approver.'),
    ('client_cannot_read_other_party_invoice', 'pass', 'The agency-to-other issued invoice is invisible to the client approver.'),
    ('client_cannot_edit_graph', 'pass', 'Project graph update matched 0 rows. The agency party is still present.'),
    ('client_cannot_self_appoint_approver', 'pass', 'Membership update matched 0 rows. Linking as approver of the agency or the other company raises 42501.');
END;
$$;

-- Worker sees their pay marker and not the bill or margin markers, and cannot approve their own week.
DO $$
DECLARE
  visible_pay INTEGER;
  visible_other INTEGER;
  pay_amount NUMERIC;
  self_approval_rejected BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
    true
  );
  IF auth.uid() IS DISTINCT FROM '33333333-3333-4333-8333-333333333333'::uuid THEN
    RAISE EXCEPTION 'auth.uid() did not follow the worker fixture (%)', auth.uid();
  END IF;

  SELECT count(*) INTO visible_pay
  FROM public.wg_contract_rates
  WHERE project_id = 'proj_reg_033'
    AND rate_scope = 'pay';

  SELECT count(*) INTO visible_other
  FROM public.wg_contract_rates
  WHERE project_id = 'proj_reg_033'
    AND rate_scope <> 'pay';

  SELECT amount INTO pay_amount
  FROM public.wg_contract_rates
  WHERE project_id = 'proj_reg_033'
    AND rate_scope = 'pay';

  IF visible_pay <> 1 OR pay_amount IS DISTINCT FROM 1.11 THEN
    RAISE EXCEPTION 'worker could not read their own pay rate (rows %, amount %)', visible_pay, pay_amount;
  END IF;

  IF visible_other <> 0 THEN
    RAISE EXCEPTION 'worker read a non-pay rate (bill, markup, or cost)';
  END IF;

  BEGIN
    UPDATE public.wg_timesheet_weeks
    SET status = 'approved'
    WHERE id = 'week_reg_033';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    self_approval_rejected := true;
  END;

  IF NOT self_approval_rejected THEN
    RAISE EXCEPTION 'worker self-approval was not rejected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.wg_timesheet_weeks
    WHERE id = 'week_reg_033'
      AND status <> 'submitted'
  ) THEN
    RAISE EXCEPTION 'worker self-approval changed the timesheet status';
  END IF;

  INSERT INTO wg_regression_033_results (check_name, outcome, detail)
  VALUES
    ('worker_sees_own_pay_not_bill', 'pass', 'Worker sees the synthetic pay amount 1.11 and no bill, markup, or cost row.'),
    ('worker_cannot_approve_own_timesheet', 'pass', 'Updating the worker''s own submitted week to approved raises 42501. Status stays submitted.');
END;
$$;

RESET ROLE;

SELECT check_name, outcome, detail
FROM wg_regression_033_results
ORDER BY check_name;

ROLLBACK;
