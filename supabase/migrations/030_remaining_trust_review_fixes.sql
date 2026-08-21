-- 030_remaining_trust_review_fixes.sql
-- Close trust review findings F-2, F-3, and F-4.

-- ---------------------------------------------------------------------------
-- F-3: prevent project-owner onboarding from claiming an organization that is
-- already owned by another account. Keep the installed 022 implementation as
-- a private implementation and expose a guarded wrapper under the stable API.
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.wg_assign_project_member_as_worker(TEXT, TEXT, TEXT, TEXT, TEXT)
  RENAME TO wg_assign_project_member_as_worker_unchecked;

REVOKE ALL ON FUNCTION public.wg_assign_project_member_as_worker_unchecked(TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.wg_assign_project_member_as_worker(
  p_project_id TEXT,
  p_member_id TEXT,
  p_organization_name TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_placement_title TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor                  UUID := auth.uid();
  v_project                public.wg_projects%ROWTYPE;
  v_nodes                  JSONB;
  v_owner_graph_node_id    TEXT;
  v_owner_party_id         TEXT;
  v_organization_id        TEXT;
  v_organization_owner_id  UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_project
  FROM public.wg_projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_project.owner_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Only the project owner can set up employees'
      USING ERRCODE = '42501';
  END IF;

  v_nodes := COALESCE(v_project.graph->'nodes', '[]'::jsonb);

  SELECT member.graph_node_id INTO v_owner_graph_node_id
  FROM public.wg_project_members AS member
  WHERE member.project_id = p_project_id
    AND member.user_id = v_actor
    AND member.accepted_at IS NOT NULL
  ORDER BY member.invited_at
  LIMIT 1;

  IF v_owner_graph_node_id IS NOT NULL THEN
    SELECT node->'data'->>'partyId' INTO v_owner_party_id
    FROM jsonb_array_elements(v_nodes) AS node
    WHERE node->>'type' = 'person'
      AND node->>'id' = v_owner_graph_node_id
    LIMIT 1;
  END IF;

  IF v_owner_party_id IS NULL THEN
    SELECT node->'data'->>'partyId' INTO v_owner_party_id
    FROM jsonb_array_elements(v_nodes) AS node
    WHERE node->>'type' = 'person'
      AND (
        node->>'id' = v_actor::text
        OR node->'data'->>'userId' = v_actor::text
      )
    LIMIT 1;
  END IF;

  SELECT project_org.organization_id, organization.owner_user_id
  INTO v_organization_id, v_organization_owner_id
  FROM public.wg_project_organizations AS project_org
  JOIN public.wg_organizations AS organization
    ON organization.id = project_org.organization_id
  WHERE project_org.project_id = p_project_id
    AND project_org.graph_node_id = v_owner_party_id
    AND project_org.status <> 'removed'
  ORDER BY project_org.created_at
  LIMIT 1;

  IF v_organization_id IS NOT NULL
     AND v_organization_owner_id IS NOT NULL
     AND v_organization_owner_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'The project party is already owned by another account'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.wg_assign_project_member_as_worker_unchecked(
    p_project_id,
    p_member_id,
    p_organization_name,
    p_display_name,
    p_placement_title
  );
END;
$$;

REVOKE ALL ON FUNCTION public.wg_assign_project_member_as_worker(TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_assign_project_member_as_worker(TEXT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.wg_assign_project_member_as_worker(TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Owner-only C2 worker setup with a foreign-organization ownership guard (trust review F-3).';

-- ---------------------------------------------------------------------------
-- F-2: freeze invoice content after issue and enforce forward-only lifecycle.
-- Drafts remain fully editable; issued/overdue/payment states may change only
-- status, while paid and cancelled are terminal.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.wg_enforce_invoice_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'draft' THEN
    IF NEW.status NOT IN ('draft', 'issued', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid invoice transition: draft -> %', NEW.status
        USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - 'status' - 'updated_at')
       IS DISTINCT FROM
     (to_jsonb(OLD) - 'status' - 'updated_at') THEN
    RAISE EXCEPTION 'Issued invoice content is immutable; cancel or credit it instead'
      USING ERRCODE = '22023';
  END IF;

  IF OLD.status = 'issued' AND NEW.status NOT IN (
    'issued', 'partially_paid', 'paid', 'overdue', 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Invalid invoice transition: issued -> %', NEW.status
      USING ERRCODE = '22023';
  ELSIF OLD.status = 'partially_paid' AND NEW.status NOT IN (
    'partially_paid', 'paid', 'overdue', 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Invalid invoice transition: partially_paid -> %', NEW.status
      USING ERRCODE = '22023';
  ELSIF OLD.status = 'overdue' AND NEW.status NOT IN (
    'overdue', 'partially_paid', 'paid', 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Invalid invoice transition: overdue -> %', NEW.status
      USING ERRCODE = '22023';
  ELSIF OLD.status = 'paid' AND NEW.status <> 'paid' THEN
    RAISE EXCEPTION 'Paid invoices are terminal' USING ERRCODE = '22023';
  ELSIF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled invoices are terminal' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wg_invoice_lifecycle_guard ON public.wg_invoices;
CREATE TRIGGER wg_invoice_lifecycle_guard
  BEFORE UPDATE ON public.wg_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.wg_enforce_invoice_lifecycle();

REVOKE ALL ON FUNCTION public.wg_enforce_invoice_lifecycle()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.wg_enforce_invoice_lifecycle() IS
  'Trust review F-2: forward-only invoice status and immutable content after issue.';

-- ---------------------------------------------------------------------------
-- F-4: explicit person signatory. A worker can read their own agreed contract
-- without gaining organization-wide contract access or update permission.
-- ---------------------------------------------------------------------------

ALTER TABLE public.wg_contract_signatories
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.wg_contract_signatories
  DROP CONSTRAINT IF EXISTS wg_contract_signatory_target;

ALTER TABLE public.wg_contract_signatories
  ADD CONSTRAINT wg_contract_signatory_target
  CHECK (
    organization_id IS NOT NULL
    OR NULLIF(trim(COALESCE(party_graph_node_id, '')), '') IS NOT NULL
    OR user_id IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS wg_contract_signatories_user_idx
  ON public.wg_contract_signatories(user_id)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.wg_user_can_access_contract(
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
    FROM public.wg_contracts AS contract
    WHERE contract.id = p_contract_id
      AND contract.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.wg_contract_signatories AS signatory
    JOIN public.wg_organization_members AS org_member
      ON org_member.organization_id = signatory.organization_id
    WHERE signatory.contract_id = p_contract_id
      AND signatory.organization_id IS NOT NULL
      AND org_member.user_id = auth.uid()
      AND org_member.membership_state = 'verified'
      AND (p_roles IS NULL OR org_member.org_role = ANY(p_roles))
  )
  OR EXISTS (
    SELECT 1
    FROM public.wg_contracts AS contract
    JOIN public.wg_contract_signatories AS signatory
      ON signatory.contract_id = contract.id
    JOIN public.wg_project_organizations AS project_org
      ON project_org.project_id = contract.project_id
     AND project_org.graph_node_id = signatory.party_graph_node_id
     AND project_org.status = 'active'
    JOIN public.wg_organization_members AS org_member
      ON org_member.organization_id = project_org.organization_id
    WHERE contract.id = p_contract_id
      AND signatory.party_graph_node_id IS NOT NULL
      AND org_member.user_id = auth.uid()
      AND org_member.membership_state = 'verified'
      AND (p_roles IS NULL OR org_member.org_role = ANY(p_roles))
  );
$$;

DROP POLICY IF EXISTS wg_contracts_select_access ON public.wg_contracts;
CREATE POLICY wg_contracts_select_access
  ON public.wg_contracts
  FOR SELECT TO authenticated
  USING (
    public.wg_user_can_access_contract(id)
    OR EXISTS (
      SELECT 1
      FROM public.wg_contract_signatories AS person_signatory
      WHERE person_signatory.contract_id = wg_contracts.id
        AND person_signatory.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS wg_contract_signatories_select ON public.wg_contract_signatories;
CREATE POLICY wg_contract_signatories_select
  ON public.wg_contract_signatories
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND public.wg_user_is_verified_org_member(
        organization_id,
        ARRAY['org_admin', 'org_finance', 'org_manager']
      )
    )
  );

REVOKE EXECUTE ON FUNCTION public.wg_user_can_access_contract(TEXT, TEXT[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_user_can_access_contract(TEXT, TEXT[])
  TO authenticated;

COMMENT ON FUNCTION public.wg_user_can_access_contract(TEXT, TEXT[]) IS
  'Contract owner or authorized signatory-organization member access helper. Explicit person signatories are read-only through the contracts SELECT policy (trust review F-4).';
