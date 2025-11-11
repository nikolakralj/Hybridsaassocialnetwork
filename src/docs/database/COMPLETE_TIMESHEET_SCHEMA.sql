-- ============================================================================
-- COMPLETE TIMESHEET SCHEMA with Task-Level Tracking
-- ============================================================================
-- This is the production-ready schema that supports:
-- - Weekly period summaries (for approval workflow)
-- - Daily task entries (with start/end times, work type, notes)
-- - Temporal graph versioning
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Organizations table (companies, agencies, freelancers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('company', 'agency', 'freelancer')),
  logo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Project contracts
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  project_id UUID NOT NULL,
  contract_type TEXT NOT NULL,
  hourly_rate DECIMAL(10,2),
  start_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Graph versions table (temporal versioning)
-- ============================================================================
CREATE TABLE IF NOT EXISTS graph_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  effective_from_date DATE NOT NULL,
  effective_to_date DATE, -- NULL = currently active
  graph_data JSONB NOT NULL,
  change_summary TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, version_number)
);

-- ============================================================================
-- Timesheet periods (weekly summaries for approval)
-- ============================================================================
CREATE TABLE IF NOT EXISTS timesheet_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES project_contracts(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_hours DECIMAL(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  graph_version_id UUID REFERENCES graph_versions(id), -- Links to active graph version
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Timesheet entries (daily task details)
-- ============================================================================
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_id UUID NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES project_contracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Date and time tracking
  date DATE NOT NULL,
  start_time TIME, -- Optional: actual start time (e.g., 09:00)
  end_time TIME,   -- Optional: actual end time (e.g., 17:00)
  hours DECIMAL(4,2) NOT NULL, -- Total hours for this entry
  
  -- Work classification
  work_type TEXT NOT NULL DEFAULT 'regular' CHECK (work_type IN ('regular', 'overtime', 'travel', 'oncall')),
  
  -- Task details
  task_name TEXT NOT NULL,
  task_description TEXT,
  notes TEXT,
  
  -- Location (for hybrid work)
  location TEXT CHECK (location IN ('office', 'remote', 'client_site', 'travel')),
  
  -- Billing
  billable BOOLEAN DEFAULT true,
  hourly_rate DECIMAL(10,2), -- Can override contract rate
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================

-- Organizations
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);

-- Contracts
CREATE INDEX IF NOT EXISTS idx_contracts_user ON project_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_project ON project_contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_organization ON project_contracts(organization_id);

-- Graph versions
CREATE INDEX IF NOT EXISTS idx_graph_versions_project ON graph_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_versions_active ON graph_versions(project_id, effective_to_date) WHERE effective_to_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_graph_versions_date_range ON graph_versions(project_id, effective_from_date, effective_to_date);

-- Timesheet periods
CREATE INDEX IF NOT EXISTS idx_periods_contract ON timesheet_periods(contract_id);
CREATE INDEX IF NOT EXISTS idx_periods_status ON timesheet_periods(status);
CREATE INDEX IF NOT EXISTS idx_periods_graph_version ON timesheet_periods(graph_version_id);
CREATE INDEX IF NOT EXISTS idx_periods_date_range ON timesheet_periods(week_start_date, week_end_date);
CREATE INDEX IF NOT EXISTS idx_periods_submitted ON timesheet_periods(submitted_at) WHERE submitted_at IS NOT NULL;

-- Timesheet entries (daily tasks)
CREATE INDEX IF NOT EXISTS idx_entries_period ON timesheet_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_entries_contract ON timesheet_entries(contract_id);
CREATE INDEX IF NOT EXISTS idx_entries_user ON timesheet_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_date ON timesheet_entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_work_type ON timesheet_entries(work_type);
CREATE INDEX IF NOT EXISTS idx_entries_status ON timesheet_entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_user_date_range ON timesheet_entries(user_id, date);

-- ============================================================================
-- TRIGGERS for auto-updating timestamps
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to timesheet_periods
DROP TRIGGER IF EXISTS update_timesheet_periods_updated_at ON timesheet_periods;
CREATE TRIGGER update_timesheet_periods_updated_at
  BEFORE UPDATE ON timesheet_periods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to timesheet_entries
DROP TRIGGER IF EXISTS update_timesheet_entries_updated_at ON timesheet_entries;
CREATE TRIGGER update_timesheet_entries_updated_at
  BEFORE UPDATE ON timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TRIGGER to auto-calculate period total_hours from entries
-- ============================================================================

CREATE OR REPLACE FUNCTION update_period_total_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate total hours for the affected period
  UPDATE timesheet_periods
  SET total_hours = (
    SELECT COALESCE(SUM(hours), 0)
    FROM timesheet_entries
    WHERE period_id = COALESCE(NEW.period_id, OLD.period_id)
  )
  WHERE id = COALESCE(NEW.period_id, OLD.period_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger on INSERT/UPDATE/DELETE of entries
DROP TRIGGER IF EXISTS update_period_hours_on_entry_change ON timesheet_entries;
CREATE TRIGGER update_period_hours_on_entry_change
  AFTER INSERT OR UPDATE OR DELETE ON timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_period_total_hours();

-- ============================================================================
-- EXAMPLE DATA STRUCTURE
-- ============================================================================

-- Example: A contractor's week
-- 
-- timesheet_periods:
--   id: abc-123
--   contract_id: contract-456
--   week_start_date: 2025-10-06
--   week_end_date: 2025-10-12
--   total_hours: 42.5 (auto-calculated from entries)
--   status: submitted
--   graph_version_id: version-1
--
-- timesheet_entries (breakdown of that week):
--   Monday Oct 6:
--     - Regular work, 09:00-17:00, 8 hours, "API Development"
--   Tuesday Oct 7:
--     - Regular work, 09:00-17:00, 8 hours, "Frontend Components"
--   Wednesday Oct 8:
--     - Regular work, 09:00-12:00, 3 hours, "Code Review"
--     - Travel, 13:00-17:00, 4 hours, "Client Meeting in SF"
--   Thursday Oct 9:
--     - Regular work, 09:00-18:00, 8.5 hours, "Database Migration"
--     - Overtime, 20:00-21:00, 1 hour, "Production Hotfix"
--   Friday Oct 10:
--     - Regular work, 09:00-17:00, 8 hours, "Testing & QA"
--   Saturday Oct 11:
--     - Oncall, null-null, 2 hours, "Weekend support"

-- Success message
SELECT 'Complete timesheet schema with task-level tracking created! ✅' as message;
