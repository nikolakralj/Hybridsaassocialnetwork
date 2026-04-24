-- Migration 014: Fix approval_records RLS — CRITICAL SECURITY
--
-- Bug: 007_approval_records.sql set USING (true) on SELECT, INSERT, UPDATE.
-- Any authenticated user could read/modify approval records across ALL tenants.
--
-- Fix: Scope every policy to project membership.
-- Uses the SECURITY DEFINER helpers established in 011_fix_rls_recursion.sql:
--   wg_user_owns_project(project_id TEXT) → BOOLEAN
--   wg_user_is_project_member(project_id TEXT) → BOOLEAN

-- Drop the wide-open policies from 007
DROP POLICY IF EXISTS approval_records_read_authenticated  ON approval_records;
DROP POLICY IF EXISTS approval_records_insert_authenticated ON approval_records;
DROP POLICY IF EXISTS approval_records_update_authenticated ON approval_records;

-- ── SELECT ────────────────────────────────────────────────────────────────────
-- Readable by: project owner, accepted project members, the designated approver,
-- or the submitter. All four share project membership for the common case;
-- the approver_user_id / submitter_user_id checks catch people whose
-- wg_project_members row may not yet be accepted (e.g. pending invitees).
CREATE POLICY approval_records_select
  ON approval_records
  FOR SELECT TO authenticated
  USING (
    public.wg_user_owns_project(project_id)
    OR public.wg_user_is_project_member(project_id)
    OR approver_user_id = auth.uid()::text
    OR submitter_user_id = auth.uid()::text
  );

-- ── INSERT ────────────────────────────────────────────────────────────────────
-- Only project owners and accepted members may create approval records.
-- The self-approval trigger in 012 enforces submitter ≠ approver server-side.
CREATE POLICY approval_records_insert
  ON approval_records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.wg_user_owns_project(project_id)
    OR public.wg_user_is_project_member(project_id)
  );

-- ── UPDATE ───────────────────────────────────────────────────────────────────
-- Only the designated approver or the project owner may change status.
-- Prevents any authenticated user from approving/rejecting records
-- belonging to a project they are not part of.
CREATE POLICY approval_records_update
  ON approval_records
  FOR UPDATE TO authenticated
  USING (
    public.wg_user_owns_project(project_id)
    OR approver_user_id = auth.uid()::text
  )
  WITH CHECK (
    public.wg_user_owns_project(project_id)
    OR approver_user_id = auth.uid()::text
  );

-- ── Verify after applying ─────────────────────────────────────────────────────
-- Run this to confirm the old open policies are gone:
--   SELECT polname, cmd FROM pg_policies
--   WHERE tablename = 'approval_records'
--   ORDER BY polname;
--
-- Expected rows: approval_records_select, approval_records_insert,
--                approval_records_update, approval_records_block_self_approval (trigger from 012)
