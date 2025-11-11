-- ============================================================================
-- WorkGraph Database - Complete Setup Script
-- ============================================================================
-- This script safely sets up all tables, views, and demo data
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
-- ============================================================================

-- Step 1: Clean up existing tables (if they exist)
-- ============================================================================
DROP VIEW IF EXISTS v_periods_full CASCADE;
DROP VIEW IF EXISTS v_contracts_with_orgs CASCADE;

DROP TABLE IF EXISTS allocated_tasks CASCADE;
DROP TABLE IF EXISTS review_flags CASCADE;
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS approval_history CASCADE;
DROP TABLE IF EXISTS timesheet_entries CASCADE;
DROP TABLE IF EXISTS timesheet_periods CASCADE;
DROP TABLE IF EXISTS project_contracts CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

DROP FUNCTION IF EXISTS calculate_period_totals(TEXT);
DROP FUNCTION IF EXISTS update_period_totals();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- ============================================================================
-- Step 2: Create Tables with TEXT IDs (not UUIDs)
-- ============================================================================

-- TABLE 1: Organizations
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('company', 'agency', 'freelancer')),
  logo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizations_type ON organizations(type);

-- TABLE 2: Project Contracts
CREATE TABLE project_contracts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL CHECK (user_role IN ('individual_contributor', 'company_employee', 'agency_contractor')),
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('hourly', 'daily', 'fixed', 'custom')),
  rate DECIMAL(10,2),
  hourly_rate DECIMAL(10,2),
  daily_rate DECIMAL(10,2),
  fixed_amount DECIMAL(10,2),
  hide_rate BOOLEAN DEFAULT FALSE,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contracts_org ON project_contracts(organization_id);
CREATE INDEX idx_contracts_user ON project_contracts(user_id);
CREATE INDEX idx_contracts_project ON project_contracts(project_id);

-- TABLE 3: Timesheet Periods (Weekly)
CREATE TABLE timesheet_periods (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES project_contracts(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_hours DECIMAL(5,2) DEFAULT 0,
  total_days DECIMAL(5,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejection_reason TEXT,
  contractor_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_week_dates CHECK (week_end_date >= week_start_date),
  CONSTRAINT valid_hours CHECK (total_hours >= 0)
);

CREATE INDEX idx_periods_contract ON timesheet_periods(contract_id);
CREATE INDEX idx_periods_dates ON timesheet_periods(week_start_date, week_end_date);
CREATE INDEX idx_periods_status ON timesheet_periods(status);

-- TABLE 4: Timesheet Entries (Daily)
CREATE TABLE timesheet_entries (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours DECIMAL(5,2),
  days DECIMAL(5,2),
  task_category TEXT,
  task_description TEXT NOT NULL,
  work_type TEXT DEFAULT 'regular' CHECK (work_type IN ('regular', 'overtime', 'travel', 'oncall')),
  billable BOOLEAN DEFAULT TRUE,
  start_time TIME,
  end_time TIME,
  break_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_hours CHECK (hours IS NULL OR hours >= 0),
  CONSTRAINT has_time_value CHECK (hours IS NOT NULL OR days IS NOT NULL)
);

CREATE INDEX idx_entries_period ON timesheet_entries(period_id);
CREATE INDEX idx_entries_date ON timesheet_entries(date);

-- TABLE 5: Approval History
CREATE TABLE approval_history (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'changes_requested')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_history_period ON approval_history(period_id);

-- TABLE 6: Attachments
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  size INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attachments_period ON attachments(period_id);

-- TABLE 7: Review Flags
CREATE TABLE review_flags (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('warning', 'error', 'info')),
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flags_period ON review_flags(period_id);

-- TABLE 8: Allocated Tasks
CREATE TABLE allocated_tasks (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  allocated_hours DECIMAL(5,2) NOT NULL,
  logged_hours DECIMAL(5,2) DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('on_track', 'over', 'under', 'not_started')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_period ON allocated_tasks(period_id);

-- ============================================================================
-- Step 3: Create Functions and Triggers
-- ============================================================================

-- Auto-update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON project_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_periods_updated_at BEFORE UPDATE ON timesheet_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entries_updated_at BEFORE UPDATE ON timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update period totals
CREATE OR REPLACE FUNCTION update_period_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE timesheet_periods
  SET 
    total_hours = (SELECT COALESCE(SUM(hours), 0) FROM timesheet_entries WHERE period_id = COALESCE(NEW.period_id, OLD.period_id)),
    total_days = (SELECT COALESCE(SUM(days), 0) FROM timesheet_entries WHERE period_id = COALESCE(NEW.period_id, OLD.period_id))
  WHERE id = COALESCE(NEW.period_id, OLD.period_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_period_totals
AFTER INSERT OR UPDATE OR DELETE ON timesheet_entries
FOR EACH ROW
EXECUTE FUNCTION update_period_totals();

-- ============================================================================
-- Step 4: Create Views
-- ============================================================================

CREATE VIEW v_contracts_with_orgs AS
SELECT 
  pc.*,
  o.name as org_name,
  o.type as org_type,
  o.logo as org_logo
FROM project_contracts pc
LEFT JOIN organizations o ON pc.organization_id = o.id;

CREATE VIEW v_periods_full AS
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
LEFT JOIN organizations o ON pc.organization_id = o.id;

-- ============================================================================
-- Step 5: Enable RLS (but allow all access for now)
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocated_tasks ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to access everything (customize later)
CREATE POLICY "Allow all access" ON organizations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON project_contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON timesheet_periods FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON timesheet_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON approval_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON review_flags FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON allocated_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- Step 6: Seed Demo Data
-- ============================================================================

-- Organizations
INSERT INTO organizations (id, name, type, logo) VALUES
  ('org-acme', 'Acme Dev Studio', 'company', '🏢'),
  ('org-brightworks', 'BrightWorks Design', 'company', '🎨'),
  ('org-alex', 'Alex Chen', 'freelancer', '👤'),
  ('org-jordan', 'Jordan Rivera', 'freelancer', '👤'),
  ('org-taylor', 'Taylor Kim', 'freelancer', '👤');

-- Acme Dev Studio Contracts (15 people)
INSERT INTO project_contracts (id, user_id, user_name, user_role, organization_id, project_id, contract_type, rate, hourly_rate, hide_rate, start_date) VALUES
  ('contract-acme-1', 'user-sarah', 'Sarah Johnson', 'company_employee', 'org-acme', 'proj-alpha', 'hourly', 85.00, 85.00, false, '2024-12-01'),
  ('contract-acme-2', 'user-mike', 'Mike Chen', 'company_employee', 'org-acme', 'proj-alpha', 'hourly', 90.00, 90.00, false, '2024-12-01'),
  ('contract-acme-3', 'user-emily', 'Emily Davis', 'company_employee', 'org-acme', 'proj-alpha', 'hourly', 75.00, 75.00, false, '2024-12-01'),
  ('contract-acme-4', 'user-james', 'James Wilson', 'company_employee', 'org-acme', 'proj-alpha', 'hourly', 95.00, 95.00, false, '2024-12-01'),
  ('contract-acme-5', 'user-lisa', 'Lisa Anderson', 'company_employee', 'org-acme', 'proj-alpha', 'hourly', 80.00, 80.00, false, '2024-12-01'),
  ('contract-acme-6', 'user-david', 'David Martinez', 'company_employee', 'org-acme', 'proj-beta', 'hourly', 85.00, 85.00, false, '2024-12-01'),
  ('contract-acme-7', 'user-amy', 'Amy Thompson', 'company_employee', 'org-acme', 'proj-beta', 'hourly', 70.00, 70.00, false, '2024-12-01'),
  ('contract-acme-8', 'user-robert', 'Robert Garcia', 'company_employee', 'org-acme', 'proj-beta', 'hourly', 100.00, 100.00, false, '2024-12-01'),
  ('contract-acme-9', 'user-jessica', 'Jessica Lee', 'company_employee', 'org-acme', 'proj-beta', 'hourly', 88.00, 88.00, false, '2024-12-01'),
  ('contract-acme-10', 'user-chris', 'Chris Brown', 'company_employee', 'org-acme', 'proj-gamma', 'hourly', 92.00, 92.00, false, '2024-12-01'),
  ('contract-acme-11', 'user-nicole', 'Nicole White', 'company_employee', 'org-acme', 'proj-gamma', 'hourly', 78.00, 78.00, false, '2024-12-01'),
  ('contract-acme-12', 'user-daniel', 'Daniel Harris', 'company_employee', 'org-acme', 'proj-gamma', 'hourly', 96.00, 96.00, false, '2024-12-01'),
  ('contract-acme-13', 'user-rachel', 'Rachel Clark', 'company_employee', 'org-acme', 'proj-gamma', 'hourly', 82.00, 82.00, false, '2024-12-01'),
  ('contract-acme-14', 'user-kevin', 'Kevin Lewis', 'company_employee', 'org-acme', 'proj-delta', 'hourly', 87.00, 87.00, false, '2024-12-01'),
  ('contract-acme-15', 'user-ashley', 'Ashley Walker', 'company_employee', 'org-acme', 'proj-delta', 'hourly', 74.00, 74.00, false, '2024-12-01');

-- BrightWorks Design Contracts (7 people - daily rate)
INSERT INTO project_contracts (id, user_id, user_name, user_role, organization_id, project_id, contract_type, rate, daily_rate, hide_rate, start_date) VALUES
  ('contract-bright-1', 'user-sophia', 'Sophia Martinez', 'company_employee', 'org-brightworks', 'proj-epsilon', 'daily', 640.00, 640.00, false, '2024-12-01'),
  ('contract-bright-2', 'user-oliver', 'Oliver Anderson', 'company_employee', 'org-brightworks', 'proj-epsilon', 'daily', 720.00, 720.00, false, '2024-12-01'),
  ('contract-bright-3', 'user-emma', 'Emma Thomas', 'company_employee', 'org-brightworks', 'proj-epsilon', 'daily', 600.00, 600.00, false, '2024-12-01'),
  ('contract-bright-4', 'user-liam', 'Liam Jackson', 'company_employee', 'org-brightworks', 'proj-zeta', 'daily', 680.00, 680.00, false, '2024-12-01'),
  ('contract-bright-5', 'user-ava', 'Ava Wilson', 'company_employee', 'org-brightworks', 'proj-zeta', 'daily', 560.00, 560.00, false, '2024-12-01'),
  ('contract-bright-6', 'user-noah', 'Noah Moore', 'company_employee', 'org-brightworks', 'proj-zeta', 'daily', 800.00, 800.00, false, '2024-12-01'),
  ('contract-bright-7', 'user-mia', 'Mia Taylor', 'company_employee', 'org-brightworks', 'proj-zeta', 'daily', 704.00, 704.00, false, '2024-12-01');

-- Freelancers (3 people)
INSERT INTO project_contracts (id, user_id, user_name, user_role, organization_id, project_id, contract_type, rate, hourly_rate, hide_rate, start_date) VALUES
  ('contract-alex', 'user-alex', 'Alex Chen', 'individual_contributor', 'org-alex', 'proj-theta', 'hourly', 120.00, 120.00, false, '2024-12-01'),
  ('contract-jordan', 'user-jordan', 'Jordan Rivera', 'individual_contributor', 'org-jordan', 'proj-iota', 'hourly', 110.00, 110.00, false, '2024-12-01'),
  ('contract-taylor', 'user-taylor', 'Taylor Kim', 'individual_contributor', 'org-taylor', 'proj-kappa', 'hourly', 105.00, 105.00, false, '2024-12-01');

-- Timesheet Periods - Week of Oct 7-13, 2024 (for October view)
INSERT INTO timesheet_periods (id, contract_id, week_start_date, week_end_date, total_hours, status, submitted_at, contractor_notes) VALUES
  -- Acme people (pending)
  ('period-acme-1-oct', 'contract-acme-1', '2024-10-07', '2024-10-13', 40.0, 'pending', '2024-10-14T09:00:00Z', 'Regular week'),
  ('period-acme-2-oct', 'contract-acme-2', '2024-10-07', '2024-10-13', 38.0, 'pending', '2024-10-14T09:15:00Z', NULL),
  ('period-acme-3-oct', 'contract-acme-3', '2024-10-07', '2024-10-13', 35.0, 'pending', '2024-10-14T09:30:00Z', NULL),
  ('period-acme-8-oct', 'contract-acme-8', '2024-10-07', '2024-10-13', 42.0, 'approved', '2024-10-14T10:00:00Z', '2 hours overtime');

-- BrightWorks people (daily contracts)
INSERT INTO timesheet_periods (id, contract_id, week_start_date, week_end_date, total_days, status, submitted_at) VALUES
  ('period-bright-1-oct', 'contract-bright-1', '2024-10-07', '2024-10-13', 5.0, 'pending', '2024-10-14T09:00:00Z'),
  ('period-bright-2-oct', 'contract-bright-2', '2024-10-07', '2024-10-13', 5.0, 'approved', '2024-10-14T09:00:00Z');

-- Timesheet Entries (sample data for Sarah Johnson in October)
INSERT INTO timesheet_entries (id, period_id, date, hours, task_description, task_category, work_type, billable) VALUES
  ('entry-sarah-oct7-1', 'period-acme-1-oct', '2024-10-07', 8.0, 'Frontend development - Dashboard', 'Development', 'regular', true),
  ('entry-sarah-oct8-1', 'period-acme-1-oct', '2024-10-08', 8.0, 'API integration', 'Development', 'regular', true),
  ('entry-sarah-oct9-1', 'period-acme-1-oct', '2024-10-09', 8.0, 'Bug fixes', 'Development', 'regular', true),
  ('entry-sarah-oct10-1', 'period-acme-1-oct', '2024-10-10', 8.0, 'Code review', 'Code Review', 'regular', true),
  ('entry-sarah-oct11-1', 'period-acme-1-oct', '2024-10-11', 8.0, 'Testing', 'Testing', 'regular', true);

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  org_count INTEGER;
  contract_count INTEGER;
  period_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count FROM organizations;
  SELECT COUNT(*) INTO contract_count FROM project_contracts;
  SELECT COUNT(*) INTO period_count FROM timesheet_periods;
  
  RAISE NOTICE '✅ Database setup complete!';
  RAISE NOTICE '   Organizations: %', org_count;
  RAISE NOTICE '   Contracts: %', contract_count;
  RAISE NOTICE '   Periods: %', period_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Ready to use! Refresh your app.';
END $$;
