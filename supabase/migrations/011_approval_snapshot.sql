-- ============================================================================
-- Migration 011: approval subject snapshots
-- Purpose: store a durable, generic approval packet for queue/history UI
-- ============================================================================

ALTER TABLE approval_records
  ADD COLUMN IF NOT EXISTS subject_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN approval_records.subject_snapshot IS
  'Generic approval packet snapshot captured at submission time for queue/history UI and future approval types.';
