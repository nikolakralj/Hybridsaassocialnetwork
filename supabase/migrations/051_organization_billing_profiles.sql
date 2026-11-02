-- 051_organization_billing_profiles.sql
-- Invoices showed "Address / Tax ID / IBAN not set" placeholders because
-- there was nowhere to keep a company's billing details: every invoice had
-- to be typed by hand. 051 adds one billing profile per organization and
-- copies it onto that organization's invoices (seller side: name, address,
-- tax ID, IBAN; buyer side: name, address, tax ID) while they are drafts.
--
-- Security:
--   * Only the organization itself can write its profile: its owner, or a
--     verified org_admin / org_approver member. NOT created_by -- a project
--     owner who bootstrapped a partner's organization must never be able to
--     set that partner's IBAN (payment redirection).
--   * Only the organization's own verified members (and owner) can read the
--     profile. Other parties only see what ends up on an invoice they can
--     already read (RLS on wg_invoices is unchanged).
--   * The copy happens in a trigger, only into blank fields, only on insert
--     or while the invoice is still a draft. Issued invoices are never
--     touched (035 keeps them immutable anyway); typed values win.
-- NOT APPLIED. Needs no code deploy to be safe; the Settings card that edits
-- profiles ships with claude/graph-visibility.

BEGIN;

CREATE TABLE IF NOT EXISTS public.wg_organization_billing_profiles (
  organization_id TEXT PRIMARY KEY REFERENCES public.wg_organizations(id) ON DELETE CASCADE,
  legal_name TEXT,
  address TEXT,
  tax_id TEXT,
  iban TEXT,
  updated_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.wg_organization_billing_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.wg_user_can_manage_org_billing(p_organization_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.wg_organizations o
      WHERE o.id = p_organization_id AND o.owner_user_id = auth.uid()
    )
    OR public.wg_user_is_verified_org_member(p_organization_id, ARRAY['org_admin', 'org_approver'])
  );
$$;

REVOKE ALL ON FUNCTION public.wg_user_can_manage_org_billing(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_user_can_manage_org_billing(TEXT) TO authenticated;

DROP POLICY IF EXISTS wg_org_billing_select ON public.wg_organization_billing_profiles;
CREATE POLICY wg_org_billing_select ON public.wg_organization_billing_profiles
  FOR SELECT TO authenticated
  USING (
    public.wg_user_can_manage_org_billing(organization_id)
    OR public.wg_user_is_verified_org_member(organization_id)
  );

DROP POLICY IF EXISTS wg_org_billing_insert ON public.wg_organization_billing_profiles;
CREATE POLICY wg_org_billing_insert ON public.wg_organization_billing_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.wg_user_can_manage_org_billing(organization_id));

DROP POLICY IF EXISTS wg_org_billing_update ON public.wg_organization_billing_profiles;
CREATE POLICY wg_org_billing_update ON public.wg_organization_billing_profiles
  FOR UPDATE TO authenticated
  USING (public.wg_user_can_manage_org_billing(organization_id))
  WITH CHECK (public.wg_user_can_manage_org_billing(organization_id));

REVOKE ALL ON public.wg_organization_billing_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.wg_organization_billing_profiles TO authenticated;

DROP TRIGGER IF EXISTS wg_org_billing_updated_at ON public.wg_organization_billing_profiles;
CREATE TRIGGER wg_org_billing_updated_at
  BEFORE UPDATE ON public.wg_organization_billing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.wg_set_updated_at();

-- Organizations the caller may keep billing details for, with the profile.
CREATE OR REPLACE FUNCTION public.wg_list_my_billing_organizations()
RETURNS TABLE (
  organization_id TEXT,
  organization_name TEXT,
  legal_name TEXT,
  address TEXT,
  tax_id TEXT,
  iban TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, p.legal_name, p.address, p.tax_id, p.iban, p.updated_at
  FROM public.wg_organizations o
  LEFT JOIN public.wg_organization_billing_profiles p ON p.organization_id = o.id
  WHERE public.wg_user_can_manage_org_billing(o.id)
  ORDER BY o.name;
$$;

REVOKE ALL ON FUNCTION public.wg_list_my_billing_organizations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_list_my_billing_organizations() TO authenticated;

-- Copy profiles onto draft invoices (blank fields only).
CREATE OR REPLACE FUNCTION public.wg_invoice_fill_party_details()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller RECORD;
  v_buyer RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'draft' THEN
    RETURN NEW;
  END IF;

  IF NEW.from_party_id IS NOT NULL THEN
    SELECT o.name, p.legal_name, p.address, p.tax_id, p.iban
    INTO v_seller
    FROM public.wg_project_organizations po
    JOIN public.wg_organizations o ON o.id = po.organization_id
    LEFT JOIN public.wg_organization_billing_profiles p ON p.organization_id = o.id
    WHERE po.project_id = NEW.project_id
      AND po.graph_node_id = NEW.from_party_id
      AND po.status = 'active'
    ORDER BY po.created_at
    LIMIT 1;

    IF FOUND THEN
      NEW.from_party_name := COALESCE(NULLIF(btrim(NEW.from_party_name), ''), NULLIF(btrim(v_seller.legal_name), ''), v_seller.name);
      NEW.from_address := COALESCE(NULLIF(btrim(NEW.from_address), ''), NULLIF(btrim(v_seller.address), ''));
      NEW.from_tax_id := COALESCE(NULLIF(btrim(NEW.from_tax_id), ''), NULLIF(btrim(v_seller.tax_id), ''));
      NEW.from_iban := COALESCE(NULLIF(btrim(NEW.from_iban), ''), NULLIF(btrim(v_seller.iban), ''));
    END IF;
  END IF;

  IF NEW.to_party_id IS NOT NULL THEN
    SELECT o.name, p.legal_name, p.address, p.tax_id
    INTO v_buyer
    FROM public.wg_project_organizations po
    JOIN public.wg_organizations o ON o.id = po.organization_id
    LEFT JOIN public.wg_organization_billing_profiles p ON p.organization_id = o.id
    WHERE po.project_id = NEW.project_id
      AND po.graph_node_id = NEW.to_party_id
      AND po.status = 'active'
    ORDER BY po.created_at
    LIMIT 1;

    IF FOUND THEN
      NEW.to_party_name := COALESCE(NULLIF(btrim(NEW.to_party_name), ''), NULLIF(btrim(v_buyer.legal_name), ''), v_buyer.name);
      NEW.to_address := COALESCE(NULLIF(btrim(NEW.to_address), ''), NULLIF(btrim(v_buyer.address), ''));
      NEW.to_tax_id := COALESCE(NULLIF(btrim(NEW.to_tax_id), ''), NULLIF(btrim(v_buyer.tax_id), ''));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.wg_invoice_fill_party_details() FROM PUBLIC, anon, authenticated;

-- Name sorts before wg_invoice_issue_checks / wg_invoice_lifecycle_guard so
-- the filled values are what those triggers see on the draft -> issued update.
DROP TRIGGER IF EXISTS wg_invoice_fill_party_details ON public.wg_invoices;
CREATE TRIGGER wg_invoice_fill_party_details
  BEFORE INSERT OR UPDATE ON public.wg_invoices
  FOR EACH ROW EXECUTE FUNCTION public.wg_invoice_fill_party_details();

COMMIT;
