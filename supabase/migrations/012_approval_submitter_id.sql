-- ============================================================================
-- Migration 012: add submitter_user_id to approval_records
-- Purpose:
--   1) Add the submitter_user_id column the frontend code already references.
--   2) Backfill existing rows from subject_snapshot.submitterUserId / submitterId.
--   3) Enforce at DB level that the submitter cannot be the approver.
-- ============================================================================

-- 1) Add column (nullable so backfill + legacy rows survive)
ALTER TABLE approval_records
  ADD COLUMN IF NOT EXISTS submitter_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_approval_records_submitter_user
  ON approval_records(submitter_user_id);

-- 2) Backfill from subject_snapshot JSON when present
UPDATE approval_records
SET submitter_user_id = COALESCE(
  subject_snapshot->>'submitterUserId',
  subject_snapshot->>'submitterId'
)
WHERE submitter_user_id IS NULL
  AND subject_snapshot IS NOT NULL;

-- 3) DB-level self-approval guard: block UPDATE to approved/rejected
--    when submitter_user_id = approver_user_id.
CREATE OR REPLACE FUNCTION approval_records_block_self_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('approved', 'rejected')
     AND NEW.submitter_user_id IS NOT NULL
     AND NEW.submitter_user_id = NEW.approver_user_id
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format(
        'Self-approval blocked on approval_records id=%s: submitter_user_id = approver_user_id',
        NEW.id
      ),
      HINT = 'An approver cannot decide on their own submission.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approval_records_block_self_approval ON approval_records;
CREATE TRIGGER approval_records_block_self_approval
  BEFORE INSERT OR UPDATE OF status ON approval_records
  FOR EACH ROW
  EXECUTE FUNCTION approval_records_block_self_approval();

COMMENT ON FUNCTION approval_records_block_self_approval() IS
  'Rejects terminal decisions where submitter_user_id = approver_user_id.';
