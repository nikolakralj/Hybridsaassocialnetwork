-- Transactional live-schema regression for migrations 029/030.
-- The final ROLLBACK guarantees that no fixture data survives.

BEGIN;

CREATE TEMP TABLE wg_regression_fixture ON COMMIT DROP AS
SELECT
  project.id AS project_id,
  project.owner_id,
  member.id AS member_id,
  member.user_id AS member_user_id,
  COALESCE(
    CASE WHEN EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(project.graph->'nodes', '[]'::jsonb)) AS scoped_party
      WHERE scoped_party->>'type' = 'party'
        AND scoped_party->>'id' = member.scope
    ) THEN member.scope END,
    (
      SELECT party->>'id'
      FROM jsonb_array_elements(COALESCE(project.graph->'nodes', '[]'::jsonb)) AS party
      WHERE party->>'type' = 'party'
      LIMIT 1
    )
  ) AS party_graph_node_id,
  owner_project_org.organization_id AS owner_organization_id
FROM public.wg_projects AS project
JOIN public.wg_project_members AS member
  ON member.project_id = project.id
 AND member.user_id IS NOT NULL
 AND member.user_id <> project.owner_id
 AND member.accepted_at IS NOT NULL
LEFT JOIN LATERAL (
  SELECT owner_member.scope
  FROM public.wg_project_members AS owner_member
  WHERE owner_member.project_id = project.id
    AND owner_member.user_id = project.owner_id
    AND owner_member.accepted_at IS NOT NULL
  ORDER BY owner_member.invited_at
  LIMIT 1
) AS owner_identity ON true
LEFT JOIN public.wg_project_organizations AS owner_project_org
  ON owner_project_org.project_id = project.id
 AND owner_project_org.graph_node_id = owner_identity.scope
 AND owner_project_org.status <> 'removed'
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE(project.graph->'nodes', '[]'::jsonb)) AS party
  WHERE party->>'type' = 'party'
)
ORDER BY project.created_at
LIMIT 1;

DO $$
DECLARE
  fixture RECORD;
  link_result JSONB;
  unauthorized_rejected BOOLEAN := false;
  foreign_org_rejected BOOLEAN := false;
  content_edit_rejected BOOLEAN := false;
  terminal_reversal_rejected BOOLEAN := false;
  unauthorized_actor UUID := gen_random_uuid();
BEGIN
  SELECT * INTO fixture FROM wg_regression_fixture;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Regression fixture requires one accepted non-owner project member';
  END IF;

  -- C3 positive owner bootstrap/link.
  PERFORM set_config('request.jwt.claim.sub', fixture.owner_id::text, true);
  link_result := public.wg_link_member_as_party_approver(
    fixture.project_id,
    fixture.member_id,
    fixture.party_graph_node_id
  );

  IF link_result->>'userId' IS DISTINCT FROM fixture.member_user_id::text THEN
    RAISE EXCEPTION 'C3 link did not preserve the real member uid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.wg_project_members AS linked_member
    WHERE linked_member.id = fixture.member_id
      AND linked_member.scope = fixture.party_graph_node_id
      AND linked_member.graph_node_id = link_result->>'graphNodeId'
      AND linked_member.can_approve = true
      AND linked_member.can_view_rates = false
      AND linked_member.can_edit_timesheets = false
  ) THEN
    RAISE EXCEPTION 'C3 member permissions or graph identity were not linked';
  END IF;

  -- C3 adversarial caller cannot administer another party.
  PERFORM set_config('request.jwt.claim.sub', unauthorized_actor::text, true);
  BEGIN
    PERFORM public.wg_link_member_as_party_approver(
      fixture.project_id,
      fixture.member_id,
      fixture.party_graph_node_id
    );
  EXCEPTION WHEN SQLSTATE '42501' THEN
    unauthorized_rejected := true;
  END;
  IF NOT unauthorized_rejected THEN
    RAISE EXCEPTION 'Unauthorized C3 party link was not rejected';
  END IF;

  -- F-3: the worker-onboarding wrapper must reject a project owner when their
  -- graph party is mapped to an organization owned by a different account.
  IF fixture.owner_organization_id IS NOT NULL THEN
    UPDATE public.wg_organizations
    SET owner_user_id = fixture.member_user_id
    WHERE id = fixture.owner_organization_id;

    PERFORM set_config('request.jwt.claim.sub', fixture.owner_id::text, true);
    BEGIN
      PERFORM public.wg_assign_project_member_as_worker(
        fixture.project_id,
        fixture.member_id,
        'Forbidden takeover',
        NULL,
        NULL
      );
    EXCEPTION WHEN SQLSTATE '42501' THEN
      foreign_org_rejected := true;
    END;
    IF NOT foreign_org_rejected THEN
      RAISE EXCEPTION 'Foreign organization takeover was not rejected';
    END IF;
  END IF;

  -- F-2: draft content can be issued, then content freezes and paid is terminal.
  INSERT INTO public.wg_invoices (
    id, project_id, invoice_number, from_party_id, to_party_id,
    issue_date, due_date, line_items, subtotal, tax_total, total,
    status, created_by
  ) VALUES (
    'inv_regression_030', fixture.project_id, 'REGRESSION-030',
    fixture.party_graph_node_id, fixture.party_graph_node_id,
    CURRENT_DATE, CURRENT_DATE + 14, '[]'::jsonb, 0, 0, 0,
    'draft', fixture.owner_id
  );

  UPDATE public.wg_invoices SET status = 'issued' WHERE id = 'inv_regression_030';
  BEGIN
    UPDATE public.wg_invoices SET notes = 'forbidden edit' WHERE id = 'inv_regression_030';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    content_edit_rejected := true;
  END;
  IF NOT content_edit_rejected THEN
    RAISE EXCEPTION 'Issued invoice content edit was not rejected';
  END IF;

  UPDATE public.wg_invoices SET status = 'paid' WHERE id = 'inv_regression_030';
  BEGIN
    UPDATE public.wg_invoices SET status = 'issued' WHERE id = 'inv_regression_030';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    terminal_reversal_rejected := true;
  END;
  IF NOT terminal_reversal_rejected THEN
    RAISE EXCEPTION 'Paid invoice was not terminal';
  END IF;

  -- F-4 fixture: a person signatory should receive SELECT only.
  INSERT INTO public.wg_contracts (
    id, project_id, owner_id, title, status
  ) VALUES (
    'contract_regression_030', fixture.project_id, fixture.owner_id,
    'Regression contract', 'draft'
  );

  INSERT INTO public.wg_contract_signatories (
    id, contract_id, user_id, signatory_role
  ) VALUES (
    'ctrsig_regression_030', 'contract_regression_030',
    fixture.member_user_id, 'signatory'
  );
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT member_user_id::text FROM wg_regression_fixture),
  true
);

GRANT SELECT ON wg_regression_fixture TO authenticated;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  visible_contracts INTEGER;
  updated_contracts INTEGER;
  scoped_graph JSONB;
BEGIN
  SELECT public.wg_get_scoped_graph(project_id)
  INTO scoped_graph
  FROM wg_regression_fixture;

  IF scoped_graph#>>'{meta,viewerOrgRole}' IS DISTINCT FROM 'org_approver' THEN
    RAISE EXCEPTION 'C3 scoped graph did not report the party approver role';
  END IF;

  SELECT count(*) INTO visible_contracts
  FROM public.wg_contracts
  WHERE id = 'contract_regression_030';

  IF visible_contracts <> 1 THEN
    RAISE EXCEPTION 'Person signatory cannot read their own contract';
  END IF;

  UPDATE public.wg_contracts
  SET title = 'forbidden worker edit'
  WHERE id = 'contract_regression_030';
  GET DIAGNOSTICS updated_contracts = ROW_COUNT;

  IF updated_contracts <> 0 THEN
    RAISE EXCEPTION 'Person signatory gained contract update permission';
  END IF;
END;
$$;

RESET ROLE;

ROLLBACK;
