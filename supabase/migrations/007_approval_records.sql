-- ============================================================================
-- Migration 007: approval_records
-- Purpose: unblock approvals queue paths that read/write approval_records
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- project_id / subject_id / approver_* are TEXT on purpose:
-- current frontend still passes mixed IDs (UUIDs + graph node/string IDs).
CREATE TABLE IF NOT EXISTS approval_records (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id       TEXT NOT NULL,
  subject_type     TEXT NOT NULL CHECK (subject_type IN ('timesheet', 'expense', 'invoice', 'contract', 'deliverable')),
  subject_id       TEXT NOT NULL,
  approver_user_id TEXT NOT NULL,
  approver_name    TEXT NOT NULL,
  approver_node_id TEXT,
  approval_layer   INTEGER NOT NULL DEFAULT 1 CHECK (approval_layer >= 1),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  notes            TEXT,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at       TIMESTAMPTZ,
  graph_version_id TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Queue + history query indexes used by approvals-supabase.ts
CREATE INDEX IF NOT EXISTS idx_approval_records_project_status_submitted
  ON approval_records(project_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_records_approver_user_status_submitted
  ON approval_records(approver_user_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_records_approver_node_status_submitted
  ON approval_records(approver_node_id, status, submitted_at DESC)
  WHERE approver_node_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_approval_records_subject_layer
  ON approval_records(subject_type, subject_id, approval_layer);

-- Keep updated_at in sync on UPDATE
CREATE OR REPLACE FUNCTION approval_records_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approval_records_updated_at ON approval_records;
CREATE TRIGGER approval_records_updated_at
  BEFORE UPDATE ON approval_records
  FOR EACH ROW
  EXECUTE FUNCTION approval_records_set_updated_at();

-- RLS: broad authenticated read/write for current app phase
ALTER TABLE approval_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS approval_records_read_authenticated ON approval_records;
CREATE POLICY approval_records_read_authenticated
  ON approval_records
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS approval_records_insert_authenticated ON approval_records;
CREATE POLICY approval_records_insert_authenticated
  ON approval_records
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS approval_records_update_authenticated ON approval_records;
CREATE POLICY approval_records_update_authenticated
  ON approval_records
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
