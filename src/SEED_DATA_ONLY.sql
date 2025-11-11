-- ============================================================================
-- Seed Demo Data Only
-- ============================================================================
-- Run this AFTER creating the tables
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
-- ============================================================================

-- First, temporarily disable RLS to allow inserts
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_periods DISABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE approval_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE review_flags DISABLE ROW LEVEL SECURITY;
ALTER TABLE allocated_tasks DISABLE ROW LEVEL SECURITY;

-- Clear any existing data
DELETE FROM timesheet_entries;
DELETE FROM timesheet_periods;
DELETE FROM project_contracts;
DELETE FROM organizations;

-- ============================================================================
-- SEED ORGANIZATIONS
-- ============================================================================

INSERT INTO organizations (id, name, type, logo) VALUES
  ('org-acme', 'Acme Dev Studio', 'company', '🏢'),
  ('org-brightworks', 'BrightWorks Design', 'company', '🎨'),
  ('org-alex', 'Alex Chen', 'freelancer', '👤'),
  ('org-jordan', 'Jordan Rivera', 'freelancer', '👤'),
  ('org-taylor', 'Taylor Kim', 'freelancer', '👤');

-- ============================================================================
-- SEED CONTRACTS
-- ============================================================================

-- Acme Dev Studio (15 people)
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

-- BrightWorks Design (7 people - daily contracts)
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

-- ============================================================================
-- SEED TIMESHEET PERIODS (October 2024)
-- ============================================================================

-- Week of Oct 7-13, 2024
INSERT INTO timesheet_periods (id, contract_id, week_start_date, week_end_date, total_hours, status, submitted_at, contractor_notes) VALUES
  ('period-acme-1-oct', 'contract-acme-1', '2024-10-07', '2024-10-13', 40.0, 'pending', '2024-10-14T09:00:00Z', 'Regular week'),
  ('period-acme-2-oct', 'contract-acme-2', '2024-10-07', '2024-10-13', 38.0, 'pending', '2024-10-14T09:15:00Z', NULL),
  ('period-acme-3-oct', 'contract-acme-3', '2024-10-07', '2024-10-13', 35.0, 'pending', '2024-10-14T09:30:00Z', NULL),
  ('period-acme-8-oct', 'contract-acme-8', '2024-10-07', '2024-10-13', 42.0, 'approved', '2024-10-14T10:00:00Z', '2 hours overtime'),
  ('period-acme-5-oct', 'contract-acme-5', '2024-10-07', '2024-10-13', 40.0, 'approved', '2024-10-14T11:00:00Z', NULL);

-- Daily contracts for BrightWorks
INSERT INTO timesheet_periods (id, contract_id, week_start_date, week_end_date, total_days, status, submitted_at) VALUES
  ('period-bright-1-oct', 'contract-bright-1', '2024-10-07', '2024-10-13', 5.0, 'pending', '2024-10-14T09:00:00Z'),
  ('period-bright-2-oct', 'contract-bright-2', '2024-10-07', '2024-10-13', 5.0, 'approved', '2024-10-14T09:00:00Z');

-- ============================================================================
-- SEED TIMESHEET ENTRIES (October - sample for Sarah Johnson)
-- ============================================================================

INSERT INTO timesheet_entries (id, period_id, date, hours, task_description, task_category, work_type, billable) VALUES
  ('entry-sarah-oct7', 'period-acme-1-oct', '2024-10-07', 8.0, 'Frontend development - Dashboard UI', 'Development', 'regular', true),
  ('entry-sarah-oct8', 'period-acme-1-oct', '2024-10-08', 8.0, 'API integration with backend', 'Development', 'regular', true),
  ('entry-sarah-oct9', 'period-acme-1-oct', '2024-10-09', 8.0, 'Bug fixes from QA testing', 'Development', 'regular', true),
  ('entry-sarah-oct10', 'period-acme-1-oct', '2024-10-10', 8.0, 'Code review and team sync', 'Code Review', 'regular', true),
  ('entry-sarah-oct11', 'period-acme-1-oct', '2024-10-11', 8.0, 'Unit testing and documentation', 'Testing', 'regular', true);

-- Re-enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocated_tasks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
  'organizations' as table_name, 
  COUNT(*)::text || ' records' as status
FROM organizations
UNION ALL
SELECT 'project_contracts', COUNT(*)::text || ' records' FROM project_contracts
UNION ALL
SELECT 'timesheet_periods', COUNT(*)::text || ' records' FROM timesheet_periods
UNION ALL
SELECT 'timesheet_entries', COUNT(*)::text || ' records' FROM timesheet_entries;

-- Show success message
DO $$
BEGIN
  RAISE NOTICE '✅ Demo data seeded successfully!';
  RAISE NOTICE '   - 5 organizations';
  RAISE NOTICE '   - 25 contracts';
  RAISE NOTICE '   - 7 timesheet periods (October 2024)';
  RAISE NOTICE '   - 5 timesheet entries';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Refresh your app now!';
END $$;
