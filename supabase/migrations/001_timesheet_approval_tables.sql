-- ============================================================================
-- WorkGraph Timesheet Approval System - Database Schema
-- Migration: 001_timesheet_approval_tables
-- Created: January 22, 2025
-- Description: Creates all tables for the approval-v2 system
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE 1: ORGANIZATIONS
-- ============================================================================
-- Stores companies, agencies, and freelancer entities

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('company', 'agency', 'freelancer')),
  logo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for organizations
CREATE INDEX idx_organizations_type ON organizations(type);

COMMENT ON TABLE organizations IS 'Companies, agencies, and freelancer entities';
COMMENT ON COLUMN organizations.type IS 'company = staff aug, agency = representation, freelancer = individual';

-- ============================================================================
-- TABLE 2: PROJECT_CONTRACTS
-- ============================================================================
-- Stores individual contractor contracts with rates and terms

CREATE TABLE IF NOT EXISTS project_contracts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL CHECK (user_role IN ('individual_contributor', 'company_employee', 'agency_contractor')),
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  
  -- Contract terms
  contract_type TEXT NOT NULL CHECK (contract_type IN ('hourly', 'daily', 'fixed', 'custom')),
  rate DECIMAL(10,2), -- Unified rate field
  hourly_rate DECIMAL(10,2),
  daily_rate DECIMAL(10,2),
  fixed_amount DECIMAL(10,2),
  
  -- Permissions
  hide_rate BOOLEAN DEFAULT FALSE,
  
  -- Dates
  start_date DATE NOT NULL,
  end_date DATE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for contracts
CREATE INDEX idx_contracts_org ON project_contracts(organization_id);
CREATE INDEX idx_contracts_user ON project_contracts(user_id);
CREATE INDEX idx_contracts_project ON project_contracts(project_id);
CREATE INDEX idx_contracts_dates ON project_contracts(start_date, end_date);

COMMENT ON TABLE project_contracts IS 'Individual contractor contracts with rate and visibility settings';
COMMENT ON COLUMN project_contracts.user_role IS 'Determines rate visibility permissions';
COMMENT ON COLUMN project_contracts.hide_rate IS 'Role-based: hide rate from contractor view';

-- ============================================================================
-- TABLE 3: TIMESHEET_PERIODS (WEEKLY)
-- ============================================================================
-- Stores weekly timesheet periods with approval status

CREATE TABLE IF NOT EXISTS timesheet_periods (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES project_contracts(id) ON DELETE CASCADE,
  
  -- Period dates (Monday - Sunday)
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  
  -- Totals
  total_hours DECIMAL(5,2) DEFAULT 0,
  total_days DECIMAL(5,2),
  
  -- Approval status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  
  -- Submission tracking
  submitted_at TIMESTAMPTZ,
  
  -- Approval tracking
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  
  -- Rejection tracking
  rejected_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejection_reason TEXT,
  
  -- Additional context
  contractor_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_week_dates CHECK (week_end_date >= week_start_date),
  CONSTRAINT valid_hours CHECK (total_hours >= 0),
  CONSTRAINT valid_days CHECK (total_days IS NULL OR total_days >= 0)
);

-- Indexes for periods
CREATE INDEX idx_periods_contract ON timesheet_periods(contract_id);
CREATE INDEX idx_periods_dates ON timesheet_periods(week_start_date, week_end_date);
CREATE INDEX idx_periods_status ON timesheet_periods(status);
CREATE INDEX idx_periods_submitted ON timesheet_periods(submitted_at) WHERE submitted_at IS NOT NULL;

COMMENT ON TABLE timesheet_periods IS 'Weekly timesheet periods (Mon-Sun) with approval status';
COMMENT ON COLUMN timesheet_periods.week_start_date IS 'Always Monday';
COMMENT ON COLUMN timesheet_periods.week_end_date IS 'Always Sunday';

-- ============================================================================
-- TABLE 4: TIMESHEET_ENTRIES (DAILY)
-- ============================================================================
-- Stores individual daily timesheet entries

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  
  -- Entry details
  date DATE NOT NULL,
  hours DECIMAL(5,2),
  days DECIMAL(5,2),
  task_category TEXT, -- e.g., "Development", "Design", "Meeting", "Testing"
  task_description TEXT NOT NULL,
  work_type TEXT DEFAULT 'regular' CHECK (work_type IN ('regular', 'overtime', 'travel', 'oncall')),
  
  -- Billing
  billable BOOLEAN DEFAULT TRUE,
  
  -- Time tracking
  start_time TIME,
  end_time TIME,
  break_minutes INTEGER,
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_hours CHECK (hours IS NULL OR hours >= 0),
  CONSTRAINT valid_days CHECK (days IS NULL OR days >= 0),
  CONSTRAINT valid_break CHECK (break_minutes IS NULL OR break_minutes >= 0),
  CONSTRAINT has_time_value CHECK (hours IS NOT NULL OR days IS NOT NULL)
);

-- Indexes for entries
CREATE INDEX idx_entries_period ON timesheet_entries(period_id);
CREATE INDEX idx_entries_date ON timesheet_entries(date);

COMMENT ON TABLE timesheet_entries IS 'Individual daily timesheet entries with task details';
COMMENT ON COLUMN timesheet_entries.hours IS 'For hourly contracts';
COMMENT ON COLUMN timesheet_entries.days IS 'For daily contracts';

-- ============================================================================
-- TABLE 5: APPROVAL_HISTORY
-- ============================================================================
-- Audit trail for all approval actions

CREATE TABLE IF NOT EXISTS approval_history (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  
  -- Action details
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  actor TEXT NOT NULL, -- User name or ID
  action TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'changes_requested')),
  comment TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for history
CREATE INDEX idx_history_period ON approval_history(period_id);
CREATE INDEX idx_history_timestamp ON approval_history(timestamp);

COMMENT ON TABLE approval_history IS 'Complete audit trail of all approval actions';
COMMENT ON COLUMN approval_history.actor IS 'Name or ID of person who performed action';

-- ============================================================================
-- TABLE 6: ATTACHMENTS (PDF TIMESHEETS)
-- ============================================================================
-- Stores PDF signed timesheets and other attachments

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  
  -- File details
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- MIME type (e.g., 'application/pdf')
  url TEXT NOT NULL, -- Supabase Storage URL
  size INTEGER, -- File size in bytes
  
  -- Metadata
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for attachments
CREATE INDEX idx_attachments_period ON attachments(period_id);
CREATE INDEX idx_attachments_type ON attachments(type);

COMMENT ON TABLE attachments IS 'PDF signed timesheets and other supporting documents';
COMMENT ON COLUMN attachments.url IS 'Supabase Storage signed URL or public URL';

-- ============================================================================
-- TABLE 7: REVIEW_FLAGS
-- ============================================================================
-- Auto-detected anomalies and warnings

CREATE TABLE IF NOT EXISTS review_flags (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  
  -- Flag details
  type TEXT NOT NULL CHECK (type IN ('warning', 'error', 'info')),
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for flags
CREATE INDEX idx_flags_period ON review_flags(period_id);
CREATE INDEX idx_flags_severity ON review_flags(severity);

COMMENT ON TABLE review_flags IS 'Auto-detected anomalies (overtime, weekend work, etc.)';
COMMENT ON COLUMN review_flags.type IS 'Visual indicator type';
COMMENT ON COLUMN review_flags.severity IS 'Helps prioritize review items';

-- ============================================================================
-- TABLE 8: ALLOCATED_TASKS
-- ============================================================================
-- Planned vs actual task hours for budget tracking

CREATE TABLE IF NOT EXISTS allocated_tasks (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  
  -- Task details
  name TEXT NOT NULL,
  allocated_hours DECIMAL(5,2) NOT NULL,
  logged_hours DECIMAL(5,2) DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('on_track', 'over', 'under', 'not_started')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_allocated CHECK (allocated_hours >= 0),
  CONSTRAINT valid_logged CHECK (logged_hours >= 0)
);

-- Indexes for tasks
CREATE INDEX idx_tasks_period ON allocated_tasks(period_id);
CREATE INDEX idx_tasks_status ON allocated_tasks(status);

COMMENT ON TABLE allocated_tasks IS 'Planned vs actual hours per task for variance tracking';
COMMENT ON COLUMN allocated_tasks.status IS 'Auto-calculated based on logged vs allocated';

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON project_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_periods_updated_at BEFORE UPDATE ON timesheet_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entries_updated_at BEFORE UPDATE ON timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON allocated_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- NOTE: These are basic policies. Customize based on your auth system.

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocated_tasks ENABLE ROW LEVEL SECURITY;

-- Example: Allow all authenticated users to read organizations (adjust as needed)
CREATE POLICY "Allow authenticated users to read organizations"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (true);

-- Example: Users can read their own contracts
-- NOTE: Replace auth.uid() logic with your actual user ID matching
CREATE POLICY "Users can read own contracts"
  ON project_contracts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text OR true); -- TODO: Implement proper user ID check

-- Example: Users can read periods for their contracts
CREATE POLICY "Users can read own periods"
  ON timesheet_periods
  FOR SELECT
  TO authenticated
  USING (
    contract_id IN (
      SELECT id FROM project_contracts 
      WHERE user_id = auth.uid()::text OR true -- TODO: Implement proper user ID check
    )
  );

-- Example: Users can read entries for their periods
CREATE POLICY "Users can read own entries"
  ON timesheet_entries
  FOR SELECT
  TO authenticated
  USING (
    period_id IN (
      SELECT tp.id FROM timesheet_periods tp
      JOIN project_contracts pc ON tp.contract_id = pc.id
      WHERE pc.user_id = auth.uid()::text OR true -- TODO: Implement proper user ID check
    )
  );

-- Allow read access to related tables (customize based on needs)
CREATE POLICY "Allow read approval history" ON approval_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read attachments" ON attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read flags" ON review_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read tasks" ON allocated_tasks FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE policies (add as needed based on roles)
-- TODO: Add policies for:
-- - Contractors can INSERT/UPDATE their own entries
-- - Managers can UPDATE approval status
-- - Admin can INSERT/UPDATE/DELETE everything

COMMENT ON POLICY "Allow authenticated users to read organizations" ON organizations IS 'TODO: Restrict to relevant orgs only';
COMMENT ON POLICY "Users can read own contracts" ON project_contracts IS 'TODO: Add manager/admin exceptions';

-- ============================================================================
-- FUNCTIONS & HELPERS
-- ============================================================================

-- Function to calculate period totals from entries
CREATE OR REPLACE FUNCTION calculate_period_totals(p_period_id TEXT)
RETURNS TABLE(total_hours DECIMAL, total_days DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(hours), 0)::DECIMAL(5,2) as total_hours,
    COALESCE(SUM(days), 0)::DECIMAL(5,2) as total_days
  FROM timesheet_entries
  WHERE period_id = p_period_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_period_totals IS 'Calculates total hours/days for a period from entries';

-- Function to auto-update period totals when entries change
CREATE OR REPLACE FUNCTION update_period_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE timesheet_periods
  SET 
    total_hours = (SELECT SUM(hours) FROM timesheet_entries WHERE period_id = COALESCE(NEW.period_id, OLD.period_id)),
    total_days = (SELECT SUM(days) FROM timesheet_entries WHERE period_id = COALESCE(NEW.period_id, OLD.period_id))
  WHERE id = COALESCE(NEW.period_id, OLD.period_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to auto-update totals
CREATE TRIGGER trigger_update_period_totals
AFTER INSERT OR UPDATE OR DELETE ON timesheet_entries
FOR EACH ROW
EXECUTE FUNCTION update_period_totals();

COMMENT ON TRIGGER trigger_update_period_totals ON timesheet_entries IS 'Auto-updates period totals when entries change';

-- ============================================================================
-- VIEWS (OPTIONAL - FOR EASIER QUERYING)
-- ============================================================================

-- View: Contracts with organization details
CREATE OR REPLACE VIEW v_contracts_with_orgs AS
SELECT 
  pc.*,
  o.name as org_name,
  o.type as org_type,
  o.logo as org_logo
FROM project_contracts pc
JOIN organizations o ON pc.organization_id = o.id;

COMMENT ON VIEW v_contracts_with_orgs IS 'Contracts joined with organization details for easier querying';

-- View: Periods with contract and organization details
CREATE OR REPLACE VIEW v_periods_full AS
SELECT 
  tp.*,
  pc.user_name,
  pc.user_role,
  pc.contract_type,
  pc.rate,
  pc.hourly_rate,
  pc.daily_rate,
  pc.hide_rate,
  o.name as org_name,
  o.type as org_type
FROM timesheet_periods tp
JOIN project_contracts pc ON tp.contract_id = pc.id
JOIN organizations o ON pc.organization_id = o.id;

COMMENT ON VIEW v_periods_full IS 'Periods with full contract and organization context';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
-- Adjust these based on your actual roles

-- Grant usage on sequences (for UUID generation)
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant access to tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant access to sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify tables were created
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'organizations',
    'project_contracts',
    'timesheet_periods',
    'timesheet_entries',
    'approval_history',
    'attachments',
    'review_flags',
    'allocated_tasks'
  );
  
  RAISE NOTICE 'Migration complete! Created % tables.', table_count;
  
  IF table_count = 8 THEN
    RAISE NOTICE '✅ All 8 tables created successfully!';
  ELSE
    RAISE WARNING '⚠️ Expected 8 tables, but created %. Please review.', table_count;
  END IF;
END $$;