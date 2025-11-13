-- ============================================================================
-- Phase 5B: Database Schema Updates for Graph Integration & Permissions
-- ============================================================================

-- Add graph node reference to timesheet_periods
ALTER TABLE timesheet_periods 
  ADD COLUMN IF NOT EXISTS graph_node_id TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

-- Index for active graph nodes
CREATE INDEX IF NOT EXISTS idx_timesheet_periods_graph_node 
  ON timesheet_periods(graph_node_id) 
  WHERE archived_at IS NULL;

-- Add visibility and permission settings to project_contracts
ALTER TABLE project_contracts 
  ADD COLUMN IF NOT EXISTS client_timesheet_visibility TEXT 
    CHECK (client_timesheet_visibility IN ('none', 'after_approval', 'after_submission', 'real_time'))
    DEFAULT 'after_approval',
  ADD COLUMN IF NOT EXISTS allow_manager_timesheet_edits BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_client_approval BOOLEAN DEFAULT false;

-- Add approval tracking fields to timesheet_periods
ALTER TABLE timesheet_periods
  ADD COLUMN IF NOT EXISTS current_approval_step INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_approval_steps INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Comment for clarity
COMMENT ON COLUMN timesheet_periods.graph_node_id IS 'Reference to graph node (only set when submitted)';
COMMENT ON COLUMN timesheet_periods.current_approval_step IS 'Which step in approval chain (1-based)';
COMMENT ON COLUMN timesheet_periods.total_approval_steps IS 'Total number of approval steps required';
COMMENT ON COLUMN timesheet_periods.version IS 'Resubmission counter (increments on each rejection→resubmit)';

COMMENT ON COLUMN project_contracts.client_timesheet_visibility IS 'When clients can see timesheets: none, after_approval, after_submission, real_time';
COMMENT ON COLUMN project_contracts.allow_manager_timesheet_edits IS 'Allow managers to edit submitted timesheets (with audit trail)';
COMMENT ON COLUMN project_contracts.requires_client_approval IS 'Whether timesheets require client approval step';

-- ============================================================================
-- Expense Reports (similar structure)
-- ============================================================================

-- Create expense_reports table if not exists
CREATE TABLE IF NOT EXISTS expense_reports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  
  -- Temporal
  report_month TEXT NOT NULL, -- 'YYYY-MM'
  report_start_date DATE NOT NULL,
  report_end_date DATE NOT NULL,
  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,
  reimbursed_at TIMESTAMP,
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'in_review', 'rejected', 'approved', 'reimbursed')),
  current_approval_step INTEGER DEFAULT 1,
  total_approval_steps INTEGER DEFAULT 1,
  version INTEGER DEFAULT 1,
  
  -- Financial
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  reimbursable_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  non_reimbursable_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Metadata
  contractor_notes TEXT,
  reimbursement_method TEXT CHECK (reimbursement_method IN ('bank_transfer', 'payroll', 'check')),
  
  -- Review
  reviewed_at TIMESTAMP,
  reviewed_by TEXT,
  review_notes TEXT,
  
  -- Graph
  graph_node_id TEXT,
  archived_at TIMESTAMP,
  archive_reason TEXT,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (contract_id) REFERENCES project_contracts(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Create expense_line_items table if not exists
CREATE TABLE IF NOT EXISTS expense_line_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  report_id TEXT NOT NULL,
  
  -- Expense details
  expense_date DATE NOT NULL,
  category TEXT NOT NULL, -- 'Travel', 'Meals', 'Software', etc.
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Documentation
  receipt_url TEXT,
  has_receipt BOOLEAN DEFAULT false,
  
  -- Flags
  billable_to_client BOOLEAN DEFAULT true,
  requires_justification BOOLEAN DEFAULT false,
  justification_notes TEXT,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (report_id) REFERENCES expense_reports(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expense_reports_user ON expense_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_reports_status ON expense_reports(status);
CREATE INDEX IF NOT EXISTS idx_expense_reports_month ON expense_reports(report_month);
CREATE INDEX IF NOT EXISTS idx_expense_reports_graph_node ON expense_reports(graph_node_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expense_line_items_report ON expense_line_items(report_id);
CREATE INDEX IF NOT EXISTS idx_expense_line_items_date ON expense_line_items(expense_date);

-- ============================================================================
-- Timesheet Edit Audit Log (for manager edits - Phase 6)
-- ============================================================================

CREATE TABLE IF NOT EXISTS timesheet_edit_log (
  id SERIAL PRIMARY KEY,
  timesheet_period_id TEXT NOT NULL,
  edited_by_user_id TEXT NOT NULL,
  edit_timestamp TIMESTAMP DEFAULT NOW(),
  
  -- What changed
  changed_fields JSONB, -- e.g., {"entry_123": {"old_hours": 8, "new_hours": 7.5}}
  edit_reason TEXT,
  
  -- Notifications
  contractor_notified_at TIMESTAMP,
  contractor_acknowledged_at TIMESTAMP,
  
  FOREIGN KEY (timesheet_period_id) REFERENCES timesheet_periods(id),
  FOREIGN KEY (edited_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_timesheet_edit_log_period ON timesheet_edit_log(timesheet_period_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_edit_log_timestamp ON timesheet_edit_log(edit_timestamp DESC);

-- ============================================================================
-- Update existing data (migration)
-- ============================================================================

-- Set default visibility for existing contracts
UPDATE project_contracts 
SET client_timesheet_visibility = 'after_approval'
WHERE client_timesheet_visibility IS NULL;

-- Set default approval steps for existing timesheets
UPDATE timesheet_periods
SET 
  current_approval_step = 1,
  total_approval_steps = 1,
  version = 1
WHERE current_approval_step IS NULL;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to increment timesheet version on resubmission
CREATE OR REPLACE FUNCTION increment_timesheet_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'submitted' AND OLD.status = 'rejected' THEN
    NEW.version = OLD.version + 1;
    NEW.current_approval_step = 1; -- Reset to first step
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment version
DROP TRIGGER IF EXISTS timesheet_version_increment ON timesheet_periods;
CREATE TRIGGER timesheet_version_increment
  BEFORE UPDATE ON timesheet_periods
  FOR EACH ROW
  EXECUTE FUNCTION increment_timesheet_version();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_expense_reports_updated_at ON expense_reports;
CREATE TRIGGER update_expense_reports_updated_at
  BEFORE UPDATE ON expense_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expense_line_items_updated_at ON expense_line_items;
CREATE TRIGGER update_expense_line_items_updated_at
  BEFORE UPDATE ON expense_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Validation
-- ============================================================================

-- Ensure timesheet status transitions are valid
CREATE OR REPLACE FUNCTION validate_timesheet_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Draft can go to: submitted
  IF OLD.status = 'draft' AND NEW.status NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'Invalid status transition from draft to %', NEW.status;
  END IF;
  
  -- Submitted can go to: in_review, rejected
  IF OLD.status = 'submitted' AND NEW.status NOT IN ('submitted', 'in_review', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status transition from submitted to %', NEW.status;
  END IF;
  
  -- In_review can go to: approved, rejected
  IF OLD.status = 'in_review' AND NEW.status NOT IN ('in_review', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status transition from in_review to %', NEW.status;
  END IF;
  
  -- Rejected can go to: draft, submitted
  IF OLD.status = 'rejected' AND NEW.status NOT IN ('rejected', 'draft', 'submitted') THEN
    RAISE EXCEPTION 'Invalid status transition from rejected to %', NEW.status;
  END IF;
  
  -- Approved can go to: locked (cannot go back)
  IF OLD.status = 'approved' AND NEW.status NOT IN ('approved', 'locked') THEN
    RAISE EXCEPTION 'Invalid status transition from approved to %', NEW.status;
  END IF;
  
  -- Locked cannot change (immutable)
  IF OLD.status = 'locked' AND NEW.status != 'locked' THEN
    RAISE EXCEPTION 'Cannot change status of locked timesheet';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_timesheet_status ON timesheet_periods;
CREATE TRIGGER validate_timesheet_status
  BEFORE UPDATE ON timesheet_periods
  FOR EACH ROW
  EXECUTE FUNCTION validate_timesheet_status_transition();

-- ============================================================================
-- Sample Data (for testing)
-- ============================================================================

-- Update a contract to require client approval
-- UPDATE project_contracts 
-- SET 
--   requires_client_approval = true,
--   client_timesheet_visibility = 'after_approval',
--   allow_manager_timesheet_edits = false
-- WHERE id = 'contract-msa-001';
