-- 048_invoice_buyer_sees_issued_only.sql
-- A draft invoice is the seller's working copy. Until 048 the buyer's
-- decision-makers (046) read every invoice addressed to them, drafts included,
-- so the end client saw a draft the agency had never issued.
--
-- Now:
--   * wg_invoices.issued_at records the first time an invoice left draft
--     (issued / paid / partially_paid / overdue). It is set by trigger, never
--     cleared, and cannot be forged by the writer.
--   * The seller side (creator, the selling party's decision-makers and org
--     admin/finance/manager) reads its invoices in any status, as before.
--   * The buyer side reads an invoice only once it has been issued
--     (issued_at IS NOT NULL). An invoice cancelled after issue stays visible
--     to the buyer; one cancelled while still a draft never becomes visible.
--
-- REQUIRES 046 (wg_user_is_party_commercial is from 044). NOT APPLIED.
-- Backfill: invoices already in issued/paid/partially_paid/overdue get
-- issued_at = updated_at. Existing CANCELLED invoices get no issued_at (we
-- cannot tell whether they were ever issued), so a buyer stops seeing them.

BEGIN;

DO $guard$
BEGIN
  IF to_regprocedure('public.wg_user_is_party_commercial(text,text)') IS NULL THEN
    RAISE EXCEPTION '048 requires 044/046 (wg_user_is_party_commercial is missing)';
  END IF;
END
$guard$;

ALTER TABLE public.wg_invoices
  ADD COLUMN IF NOT EXISTS issued_at timestamptz;

UPDATE public.wg_invoices
   SET issued_at = COALESCE(updated_at, created_at)
 WHERE issued_at IS NULL
   AND status IN ('issued', 'paid', 'partially_paid', 'overdue');

CREATE OR REPLACE FUNCTION public.wg_invoice_set_issued_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.issued_at IS NOT NULL THEN
    NEW.issued_at := OLD.issued_at;
  ELSIF NEW.status IN ('issued', 'paid', 'partially_paid', 'overdue') THEN
    NEW.issued_at := now();
  ELSE
    NEW.issued_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wg_invoice_set_issued_at ON public.wg_invoices;
CREATE TRIGGER wg_invoice_set_issued_at
  BEFORE INSERT OR UPDATE ON public.wg_invoices
  FOR EACH ROW EXECUTE FUNCTION public.wg_invoice_set_issued_at();

DROP POLICY IF EXISTS wg_invoices_select_access ON public.wg_invoices;
CREATE POLICY wg_invoices_select_access
  ON public.wg_invoices
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR wg_user_can_access_project_party(project_id, from_party_id, ARRAY['org_admin', 'org_finance', 'org_manager'])
    OR wg_user_is_party_commercial(project_id, from_party_id)
    OR (
      issued_at IS NOT NULL
      AND (
        wg_user_can_access_project_party(project_id, to_party_id, ARRAY['org_admin', 'org_finance', 'org_manager'])
        OR wg_user_is_party_commercial(project_id, to_party_id)
      )
    )
  );

COMMENT ON POLICY wg_invoices_select_access ON public.wg_invoices IS
  'Seller side (creator, selling party decision-makers) reads all its invoices; the buyer side reads an invoice only after it was issued (048). A third party in the chain never reads it.';

COMMENT ON COLUMN public.wg_invoices.issued_at IS
  'First time the invoice left draft. Set by trigger wg_invoice_set_issued_at; buyers can read the invoice only when it is set (048).';

COMMIT;
