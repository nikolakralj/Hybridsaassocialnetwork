-- 024_trust_core_review_fixes.sql
-- Fixes from Claude's trust-core review of migrations 018-023 (2026-07-15).
-- All fixes are surgical: zero behavior change for existing app flows
-- (0 rate rows, 0 signatory rows, views unreferenced at time of review).

-- ---------------------------------------------------------------------------
-- F-6 (HIGH, live): legacy SECURITY DEFINER views resurrected after 015.
-- They run with the creator's privileges, bypassing every RLS policy for any
-- authenticated reader via PostgREST. Migration 015 already intended to drop
-- them; nothing in src/ or server/ references them.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_contracts_with_orgs CASCADE;
DROP VIEW IF EXISTS v_periods_full CASCADE;

-- ---------------------------------------------------------------------------
-- F-1 (MEDIUM, latent): the subject of a rate row could read rows of ANY
-- scope. If a bill-scope row ever carries subject_user_id (e.g. per-worker
-- bill rate), the worker would read the company↔agency bill rate — a margin
-- leak. Subject self-read is legitimate ONLY for their own pay terms.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS wg_contract_rates_select ON wg_contract_rates;
CREATE POLICY wg_contract_rates_select
  ON wg_contract_rates
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR (subject_user_id = auth.uid() AND rate_scope = 'pay')
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

-- ---------------------------------------------------------------------------
-- F-5 (HIGH, latent): privilege escalation. The old WITH CHECK allowed ANY
-- authenticated user to insert a signatory row with organization_id NULL and
-- an arbitrary party_graph_node_id onto ANY contract. Via the party branch of
-- wg_user_can_access_contract, an attacker mapped to that party in the same
-- project would grant their own org read access to a private contract.
-- New rule: only someone who can already access the contract as admin/finance
-- (owner included) may add signatories.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS wg_contract_signatories_insert ON wg_contract_signatories;
CREATE POLICY wg_contract_signatories_insert
  ON wg_contract_signatories
  FOR INSERT TO authenticated
  WITH CHECK (
    wg_user_can_access_contract(contract_id, ARRAY['org_admin', 'org_finance'])
  );

-- ---------------------------------------------------------------------------
-- Hygiene (advisor 0028/0029): SECURITY DEFINER functions were executable by
-- anon (and PUBLIC) through /rest/v1/rpc/. All are internally guarded by
-- auth.uid() checks, but the exposed surface should not exist at all.
-- authenticated keeps EXECUTE on helpers — RLS policies evaluate them as the
-- querying user. The trigger function needs no caller EXECUTE at all.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.wg_user_is_verified_org_member(TEXT, TEXT[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wg_user_can_manage_project(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wg_user_can_see_project(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wg_user_can_access_project_party(TEXT, TEXT, TEXT[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wg_user_can_access_contract(TEXT, TEXT[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wg_user_can_read_project_member(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wg_user_is_project_member(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wg_user_owns_project(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wg_assign_project_member_as_worker(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approval_records_sync_timesheet_week_status() FROM PUBLIC, anon, authenticated;
