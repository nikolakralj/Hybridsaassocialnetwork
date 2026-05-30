-- ============================================================================
-- Migration 015: Purge Dead Legacy Tables
-- Purpose:
--   Removes the legacy prefix-less tables from the database to clean up the
--   database schema and resolve RLS / security audit alerts in Supabase.
-- ============================================================================

-- 1) Drop legacy tables (order matches dependency hierarchy)
DROP TABLE IF EXISTS allocated_tasks CASCADE;
DROP TABLE IF EXISTS review_flags CASCADE;
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS timesheet_entries CASCADE;
DROP TABLE IF EXISTS timesheet_periods CASCADE;
DROP TABLE IF EXISTS project_contracts CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- 2) Drop legacy projects and members (before the wg_ prefix)
DROP TABLE IF EXISTS workgraph_edges CASCADE;
DROP TABLE IF EXISTS workgraph_nodes CASCADE;
DROP TABLE IF EXISTS graph_versions CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- 3) Drop legacy views
DROP VIEW IF EXISTS approval_history CASCADE;
DROP VIEW IF EXISTS approval_queue CASCADE;
DROP VIEW IF EXISTS v_contracts_with_orgs CASCADE;
DROP VIEW IF EXISTS v_periods_full CASCADE;
