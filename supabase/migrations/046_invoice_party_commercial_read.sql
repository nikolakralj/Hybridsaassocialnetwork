-- 046_invoice_party_commercial_read.sql
-- Buyer and seller decision-makers can read the invoices where their party
-- is from_party or to_party. Before, only creator or org admin/finance/
-- manager could, so the Client approver and the Sub owner (both org_approver
-- / Commenter+can_approve) saw no invoices at all. Requires 044.
--
-- NOT APPLIED.

BEGIN;

DROP POLICY IF EXISTS wg_invoices_select_access ON public.wg_invoices;
CREATE POLICY wg_invoices_select_access
  ON public.wg_invoices
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR wg_user_can_access_project_party(project_id, from_party_id, ARRAY['org_admin', 'org_finance', 'org_manager'])
    OR wg_user_can_access_project_party(project_id, to_party_id, ARRAY['org_admin', 'org_finance', 'org_manager'])
    OR wg_user_is_party_commercial(project_id, from_party_id)
    OR wg_user_is_party_commercial(project_id, to_party_id)
  );

COMMENT ON POLICY wg_invoices_select_access ON public.wg_invoices IS
  'Creator, or a decision-maker of the selling or buying party (046). A third party in the chain never reads it.';

COMMIT;
