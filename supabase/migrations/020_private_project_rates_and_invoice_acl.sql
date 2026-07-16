-- 020_private_project_rates_and_invoice_acl.sql
-- Trust Core hardening.
--
-- Bridges the prototype graph-rate UI to private, RLS-protected project rate
-- rows. Invoice generation should read these rows instead of rates embedded in
-- wg_projects.graph JSON.

DO $$
BEGIN
  IF to_regclass('public.wg_contract_rates') IS NULL THEN
    RAISE EXCEPTION 'Missing dependency: public.wg_contract_rates must exist before migration 020.';
  END IF;

  IF to_regclass('public.wg_projects') IS NULL THEN
    RAISE EXCEPTION 'Missing dependency: public.wg_projects must exist before migration 020.';
  END IF;

  IF to_regclass('public.wg_invoices') IS NULL THEN
    RAISE EXCEPTION 'Missing dependency: public.wg_invoices must exist before migration 020.';
  END IF;
END $$;

ALTER TABLE wg_contract_rates
  ALTER COLUMN contract_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES wg_projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subject_graph_node_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'imported_contract', 'legacy_graph_migration', 'api'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wg_contract_rates_contract_or_project'
      AND conrelid = 'public.wg_contract_rates'::regclass
  ) THEN
    ALTER TABLE wg_contract_rates
      ADD CONSTRAINT wg_contract_rates_contract_or_project
      CHECK (contract_id IS NOT NULL OR project_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS wg_contract_rates_project_idx
  ON wg_contract_rates(project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS wg_contract_rates_subject_graph_node_idx
  ON wg_contract_rates(project_id, subject_graph_node_id)
  WHERE subject_graph_node_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wg_contract_rates_project_subject_scope_uniq
  ON wg_contract_rates(project_id, subject_graph_node_id, rate_scope)
  WHERE project_id IS NOT NULL
    AND subject_graph_node_id IS NOT NULL
    AND effective_to IS NULL;

DROP POLICY IF EXISTS wg_contract_rates_select ON wg_contract_rates;
CREATE POLICY wg_contract_rates_select
  ON wg_contract_rates
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR subject_user_id = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND wg_user_is_verified_org_member(
        organization_id,
        CASE
          WHEN rate_scope = 'pay' THEN ARRAY['org_admin', 'org_finance']
          ELSE ARRAY['org_admin', 'org_finance', 'org_manager']
        END
      )
    )
  );

-- Tighten project-rate writes: an arbitrary authenticated user should not be
-- able to create project-scoped rate rows unless they can see/manage that
-- project or belong to the scoped organization.
DROP POLICY IF EXISTS wg_contract_rates_insert ON wg_contract_rates;
CREATE POLICY wg_contract_rates_insert
  ON wg_contract_rates
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      (
        organization_id IS NOT NULL
        AND wg_user_is_verified_org_member(organization_id, ARRAY['org_admin', 'org_finance'])
      )
      OR (
        organization_id IS NULL
        AND (
          project_id IS NULL
          OR wg_user_can_manage_project(project_id)
        )
      )
    )
  );

DROP POLICY IF EXISTS wg_contract_rates_update ON wg_contract_rates;
CREATE POLICY wg_contract_rates_update
  ON wg_contract_rates
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND wg_user_is_verified_org_member(organization_id, ARRAY['org_admin', 'org_finance'])
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND wg_user_is_verified_org_member(organization_id, ARRAY['org_admin', 'org_finance'])
    )
  );

-- Invoice visibility moves toward signatory-scoped access. Legacy fallback:
-- creator can always see their own invoice. Parties mapped through C2
-- wg_project_organizations can see invoices involving their own party node.
DROP POLICY IF EXISTS wg_invoices_select_access ON wg_invoices;
CREATE POLICY wg_invoices_select_access
  ON wg_invoices
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR wg_user_can_access_project_party(
      project_id,
      from_party_id,
      ARRAY['org_admin', 'org_finance', 'org_manager']
    )
    OR wg_user_can_access_project_party(
      project_id,
      to_party_id,
      ARRAY['org_admin', 'org_finance', 'org_manager']
    )
  );

DROP POLICY IF EXISTS wg_invoices_insert_access ON wg_invoices;
CREATE POLICY wg_invoices_insert_access
  ON wg_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      wg_user_can_access_project_party(
        project_id,
        from_party_id,
        ARRAY['org_admin', 'org_finance']
      )
      OR wg_user_can_manage_project(project_id)
    )
  );

DROP POLICY IF EXISTS wg_invoices_update_access ON wg_invoices;
CREATE POLICY wg_invoices_update_access
  ON wg_invoices
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR wg_user_can_access_project_party(
      project_id,
      from_party_id,
      ARRAY['org_admin', 'org_finance']
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR wg_user_can_access_project_party(
      project_id,
      from_party_id,
      ARRAY['org_admin', 'org_finance']
    )
  );

DROP POLICY IF EXISTS wg_invoices_delete_access ON wg_invoices;
CREATE POLICY wg_invoices_delete_access
  ON wg_invoices
  FOR DELETE TO authenticated
  USING (
    status = 'draft'
    AND (
      created_by = auth.uid()
      OR wg_user_can_access_project_party(
        project_id,
        from_party_id,
        ARRAY['org_admin', 'org_finance']
      )
    )
  );

COMMENT ON COLUMN wg_contract_rates.subject_graph_node_id IS
  'Graph person node this rate applies to. Transitional bridge until every worker has verified organization/user mapping.';

COMMENT ON POLICY wg_invoices_select_access ON wg_invoices IS
  'Creator or mapped invoice party can read. Project owner alone is not commercial omniscience.';
