-- 021_signatory_scoped_contracts.sql
-- Trust Core hardening.
--
-- Makes wg_contracts readable/manageable by contract owner or verified
-- signatory-party organization members, not broad project membership.

DO $$
BEGIN
  IF to_regclass('public.wg_contracts') IS NULL THEN
    RAISE EXCEPTION 'Missing dependency: public.wg_contracts must exist before migration 021.';
  END IF;

  IF to_regclass('public.wg_contract_signatories') IS NULL THEN
    RAISE EXCEPTION 'Missing dependency: public.wg_contract_signatories must exist before migration 021.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION wg_user_can_access_contract(
  p_contract_id TEXT,
  p_roles TEXT[] DEFAULT ARRAY['org_admin', 'org_finance', 'org_manager']
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM wg_contracts c
    WHERE c.id = p_contract_id
      AND c.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM wg_contract_signatories cs
    JOIN wg_organization_members om
      ON om.organization_id = cs.organization_id
    WHERE cs.contract_id = p_contract_id
      AND cs.organization_id IS NOT NULL
      AND om.user_id = auth.uid()
      AND om.membership_state = 'verified'
      AND (p_roles IS NULL OR om.org_role = ANY(p_roles))
  )
  OR EXISTS (
    SELECT 1
    FROM wg_contracts c
    JOIN wg_contract_signatories cs
      ON cs.contract_id = c.id
    JOIN wg_project_organizations po
      ON po.project_id = c.project_id
     AND po.graph_node_id = cs.party_graph_node_id
     AND po.status = 'active'
    JOIN wg_organization_members om
      ON om.organization_id = po.organization_id
    WHERE c.id = p_contract_id
      AND cs.party_graph_node_id IS NOT NULL
      AND om.user_id = auth.uid()
      AND om.membership_state = 'verified'
      AND (p_roles IS NULL OR om.org_role = ANY(p_roles))
  );
$$;

DROP POLICY IF EXISTS wg_contracts_owner ON wg_contracts;

DROP POLICY IF EXISTS wg_contracts_select_access ON wg_contracts;
CREATE POLICY wg_contracts_select_access
  ON wg_contracts
  FOR SELECT TO authenticated
  USING (wg_user_can_access_contract(id));

DROP POLICY IF EXISTS wg_contracts_insert_access ON wg_contracts;
CREATE POLICY wg_contracts_insert_access
  ON wg_contracts
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (
      project_id IS NULL
      OR wg_user_can_manage_project(project_id)
    )
  );

DROP POLICY IF EXISTS wg_contracts_update_access ON wg_contracts;
CREATE POLICY wg_contracts_update_access
  ON wg_contracts
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR wg_user_can_access_contract(id, ARRAY['org_admin', 'org_finance'])
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR wg_user_can_access_contract(id, ARRAY['org_admin', 'org_finance'])
  );

DROP POLICY IF EXISTS wg_contracts_delete_access ON wg_contracts;
CREATE POLICY wg_contracts_delete_access
  ON wg_contracts
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

COMMENT ON FUNCTION wg_user_can_access_contract(TEXT, TEXT[]) IS
  'Returns true when auth.uid() is the contract owner or a verified member of a signatory organization/party.';
