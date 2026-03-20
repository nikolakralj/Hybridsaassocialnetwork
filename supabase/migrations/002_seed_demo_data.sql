-- ============================================================================
-- WorkGraph Timesheet Approval System - Seed Data
-- Migration: 002_seed_demo_data
-- Created: January 22, 2025
-- Description: Seeds database with demo data from approval-v2 system
-- ============================================================================

-- ============================================================================
-- CLEAR EXISTING DATA (optional - uncomment if re-seeding)
-- ============================================================================
-- TRUNCATE TABLE allocated_tasks, review_flags, attachments, approval_history, 
--   timesheet_entries, timesheet_periods, project_contracts, organizations 
--   CASCADE;

-- ============================================================================
-- SEED ORGANIZATIONS
-- ============================================================================

INSERT INTO organizations (id, name, type, logo) VALUES
  ('org-acme', 'Acme Dev Studio', 'company', '🏢'),
  ('org-brightworks', 'BrightWorks Design', 'company', '🎨'),
  ('org-alex', 'Alex Chen', 'freelancer', '👤'),
  ('org-jordan', 'Jordan Rivera', 'freelancer', '👤'),
  ('org-taylor', 'Taylor Kim', 'freelancer', '👤')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SEED PROJECT_CONTRACTS
-- ============================================================================

-- Acme Dev Studio (15 contractors)
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
  ('contract-acme-15', 'user-ashley', 'Ashley Walker', 'company_employee', 'org-acme', 'proj-delta', 'hourly', 74.00, 74.00, false, '2024-12-01')
ON CONFLICT (id) DO NOTHING;

-- BrightWorks Design (7 contractors)
INSERT INTO project_contracts (id, user_id, user_name, user_role, organization_id, project_id, contract_type, rate, daily_rate, hide_rate, start_date) VALUES
  ('contract-bright-1', 'user-sophia', 'Sophia Martinez', 'company_employee', 'org-brightworks', 'proj-epsilon', 'daily', 640.00, 640.00, false, '2024-12-01'),
  ('contract-bright-2', 'user-oliver', 'Oliver Anderson', 'company_employee', 'org-brightworks', 'proj-epsilon', 'daily', 720.00, 720.00, false, '2024-12-01'),
  ('contract-bright-3', 'user-emma', 'Emma Thomas', 'company_employee', 'org-brightworks', 'proj-epsilon', 'daily', 600.00, 600.00, false, '2024-12-01'),
  ('contract-bright-4', 'user-liam', 'Liam Jackson', 'company_employee', 'org-brightworks', 'proj-zeta', 'daily', 680.00, 680.00, false, '2024-12-01'),
  ('contract-bright-5', 'user-ava', 'Ava Wilson', 'company_employee', 'org-brightworks', 'proj-zeta', 'daily', 560.00, 560.00, false, '2024-12-01'),
  ('contract-bright-6', 'user-noah', 'Noah Moore', 'company_employee', 'org-brightworks', 'proj-zeta', 'daily', 800.00, 800.00, false, '2024-12-01'),
  ('contract-bright-7', 'user-mia', 'Mia Taylor', 'company_employee', 'org-brightworks', 'proj-zeta', 'daily', 704.00, 704.00, false, '2024-12-01')
ON CONFLICT (id) DO NOTHING;

-- Individual Freelancers
INSERT INTO project_contracts (id, user_id, user_name, user_role, organization_id, project_id, contract_type, rate, hourly_rate, hide_rate, start_date) VALUES
  ('contract-alex', 'user-alex', 'Alex Chen', 'individual_contributor', 'org-alex', 'proj-theta', 'hourly', 120.00, 120.00, false, '2024-12-01'),
  ('contract-jordan', 'user-jordan', 'Jordan Rivera', 'individual_contributor', 'org-jordan', 'proj-iota', 'hourly', 110.00, 110.00, false, '2024-12-01'),
  ('contract-taylor', 'user-taylor', 'Taylor Kim', 'individual_contributor', 'org-taylor', 'proj-kappa', 'hourly', 105.00, 105.00, false, '2024-12-01')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SEED TIMESHEET_PERIODS (WEEKLY) - January 2025
-- ============================================================================

-- Week 1: Jan 6-12, 2025 (Majority Pending)
INSERT INTO timesheet_periods (id, contract_id, week_start_date, week_end_date, total_hours, status, submitted_at, contractor_notes) VALUES
  -- Acme (15 people)
  ('period-acme-1-w1', 'contract-acme-1', '2025-01-06', '2025-01-12', 40.0, 'pending', '2025-01-13T09:00:00Z', 'Regular week, worked on authentication module'),
  ('period-acme-2-w1', 'contract-acme-2', '2025-01-06', '2025-01-12', 40.0, 'pending', '2025-01-13T09:15:00Z', NULL),
  ('period-acme-3-w1', 'contract-acme-3', '2025-01-06', '2025-01-12', 35.0, 'pending', '2025-01-13T09:30:00Z', NULL),
  ('period-acme-4-w1', 'contract-acme-4', '2025-01-06', '2025-01-12', 42.0, 'pending', '2025-01-13T10:00:00Z', NULL),
  ('period-acme-5-w1', 'contract-acme-5', '2025-01-06', '2025-01-12', 40.0, 'pending', '2025-01-13T10:30:00Z', NULL),
  ('period-acme-6-w1', 'contract-acme-6', '2025-01-06', '2025-01-12', 38.0, 'pending', '2025-01-13T11:00:00Z', NULL),
  ('period-acme-7-w1', 'contract-acme-7', '2025-01-06', '2025-01-12', 40.0, 'pending', '2025-01-13T11:30:00Z', NULL),
  ('period-acme-8-w1', 'contract-acme-8', '2025-01-06', '2025-01-12', 45.0, 'pending', '2025-01-13T12:00:00Z', '5 hours overtime for production deployment'),
  ('period-acme-9-w1', 'contract-acme-9', '2025-01-06', '2025-01-12', 40.0, 'pending', '2025-01-13T13:00:00Z', NULL),
  ('period-acme-10-w1', 'contract-acme-10', '2025-01-06', '2025-01-12', 40.0, 'pending', '2025-01-13T14:00:00Z', NULL),
  ('period-acme-11-w1', 'contract-acme-11', '2025-01-06', '2025-01-12', 36.0, 'approved', '2025-01-13T09:00:00Z', NULL),
  ('period-acme-12-w1', 'contract-acme-12', '2025-01-06', '2025-01-12', 40.0, 'approved', '2025-01-13T09:00:00Z', NULL),
  ('period-acme-13-w1', 'contract-acme-13', '2025-01-06', '2025-01-12', 40.0, 'approved', '2025-01-13T09:00:00Z', NULL),
  ('period-acme-14-w1', 'contract-acme-14', '2025-01-06', '2025-01-12', 40.0, 'rejected', '2025-01-13T09:00:00Z', NULL),
  ('period-acme-15-w1', 'contract-acme-15', '2025-01-06', '2025-01-12', 32.0, 'rejected', '2025-01-13T09:00:00Z', 'Took 1 day PTO')
ON CONFLICT (id) DO NOTHING;

-- BrightWorks (7 people) - Daily contracts
INSERT INTO timesheet_periods (id, contract_id, week_start_date, week_end_date, total_days, status, submitted_at) VALUES
  ('period-bright-1-w1', 'contract-bright-1', '2025-01-06', '2025-01-12', 5.0, 'pending', '2025-01-13T09:00:00Z'),
  ('period-bright-2-w1', 'contract-bright-2', '2025-01-06', '2025-01-12', 5.0, 'pending', '2025-01-13T09:00:00Z'),
  ('period-bright-3-w1', 'contract-bright-3', '2025-01-06', '2025-01-12', 4.5, 'pending', '2025-01-13T09:00:00Z'),
  ('period-bright-4-w1', 'contract-bright-4', '2025-01-06', '2025-01-12', 5.0, 'pending', '2025-01-13T09:00:00Z'),
  ('period-bright-5-w1', 'contract-bright-5', '2025-01-06', '2025-01-12', 5.0, 'approved', '2025-01-13T09:00:00Z'),
  ('period-bright-6-w1', 'contract-bright-6', '2025-01-06', '2025-01-12', 5.0, 'approved', '2025-01-13T09:00:00Z'),
  ('period-bright-7-w1', 'contract-bright-7', '2025-01-06', '2025-01-12', 5.0, 'approved', '2025-01-13T09:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- Freelancers (3 people)
INSERT INTO timesheet_periods (id, contract_id, week_start_date, week_end_date, total_hours, status, submitted_at, contractor_notes) VALUES
  ('period-alex-w1', 'contract-alex', '2025-01-06', '2025-01-12', 32.0, 'pending', '2025-01-13T09:00:00Z', 'Part-time week due to other client commitments'),
  ('period-jordan-w1', 'contract-jordan', '2025-01-06', '2025-01-12', 40.0, 'approved', '2025-01-13T09:00:00Z', NULL),
  ('period-taylor-w1', 'contract-taylor', '2025-01-06', '2025-01-12', 35.0, 'approved', '2025-01-13T09:00:00Z', NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SEED APPROVAL_HISTORY
-- ============================================================================

-- Approved periods
INSERT INTO approval_history (period_id, timestamp, actor, action) VALUES
  ('period-acme-11-w1', '2025-01-13T15:00:00Z', 'Mark Stevens (PM)', 'submitted'),
  ('period-acme-11-w1', '2025-01-14T10:00:00Z', 'Mark Stevens (PM)', 'approved'),
  ('period-acme-12-w1', '2025-01-13T15:00:00Z', 'Mark Stevens (PM)', 'submitted'),
  ('period-acme-12-w1', '2025-01-14T10:05:00Z', 'Mark Stevens (PM)', 'approved'),
  ('period-acme-13-w1', '2025-01-13T15:00:00Z', 'Mark Stevens (PM)', 'submitted'),
  ('period-acme-13-w1', '2025-01-14T10:10:00Z', 'Mark Stevens (PM)', 'approved'),
  
  ('period-bright-5-w1', '2025-01-13T16:00:00Z', 'Linda Chen (Creative Director)', 'submitted'),
  ('period-bright-5-w1', '2025-01-14T11:00:00Z', 'Linda Chen (Creative Director)', 'approved'),
  ('period-bright-6-w1', '2025-01-13T16:00:00Z', 'Linda Chen (Creative Director)', 'submitted'),
  ('period-bright-6-w1', '2025-01-14T11:05:00Z', 'Linda Chen (Creative Director)', 'approved'),
  ('period-bright-7-w1', '2025-01-13T16:00:00Z', 'Linda Chen (Creative Director)', 'submitted'),
  ('period-bright-7-w1', '2025-01-14T11:10:00Z', 'Linda Chen (Creative Director)', 'approved'),
  
  ('period-jordan-w1', '2025-01-13T17:00:00Z', 'Client PM', 'submitted'),
  ('period-jordan-w1', '2025-01-14T09:00:00Z', 'Client PM', 'approved'),
  ('period-taylor-w1', '2025-01-13T17:00:00Z', 'Client PM', 'submitted'),
  ('period-taylor-w1', '2025-01-14T09:30:00Z', 'Client PM', 'approved')
ON CONFLICT DO NOTHING;

-- Rejected periods
INSERT INTO approval_history (period_id, timestamp, actor, action, comment) VALUES
  ('period-acme-14-w1', '2025-01-13T15:00:00Z', 'Mark Stevens (PM)', 'submitted'),
  ('period-acme-14-w1', '2025-01-14T14:00:00Z', 'Mark Stevens (PM)', 'rejected', 'Missing task descriptions for 3 days'),
  ('period-acme-15-w1', '2025-01-13T15:00:00Z', 'Mark Stevens (PM)', 'submitted'),
  ('period-acme-15-w1', '2025-01-14T14:30:00Z', 'Mark Stevens (PM)', 'rejected', 'PTO should be tracked separately, not on timesheet')
ON CONFLICT DO NOTHING;

-- Update rejection details in periods
UPDATE timesheet_periods 
SET approved_at = '2025-01-14T10:00:00Z', approved_by = 'Mark Stevens' 
WHERE id IN ('period-acme-11-w1', 'period-acme-12-w1', 'period-acme-13-w1');

UPDATE timesheet_periods 
SET approved_at = '2025-01-14T11:00:00Z', approved_by = 'Linda Chen' 
WHERE id IN ('period-bright-5-w1', 'period-bright-6-w1', 'period-bright-7-w1');

UPDATE timesheet_periods 
SET approved_at = '2025-01-14T09:00:00Z', approved_by = 'Client PM' 
WHERE id IN ('period-jordan-w1', 'period-taylor-w1');

UPDATE timesheet_periods 
SET rejected_at = '2025-01-14T14:00:00Z', rejected_by = 'Mark Stevens', rejection_reason = 'Missing task descriptions for 3 days' 
WHERE id = 'period-acme-14-w1';

UPDATE timesheet_periods 
SET rejected_at = '2025-01-14T14:30:00Z', rejected_by = 'Mark Stevens', rejection_reason = 'PTO should be tracked separately, not on timesheet' 
WHERE id = 'period-acme-15-w1';

-- ============================================================================
-- SEED ATTACHMENTS (PDF Timesheets)
-- ============================================================================

-- Sample PDF attachments for a few periods
INSERT INTO attachments (period_id, name, type, url, size, uploaded_at) VALUES
  ('period-acme-1-w1', 'Timesheet_Week1_SarahJohnson.pdf', 'application/pdf', 'https://example.com/timesheets/sarah-week1.pdf', 245760, '2025-01-13T09:00:00Z'),
  ('period-acme-8-w1', 'Timesheet_Week1_RobertGarcia.pdf', 'application/pdf', 'https://example.com/timesheets/robert-week1.pdf', 245760, '2025-01-13T12:00:00Z'),
  ('period-bright-1-w1', 'Timesheet_Week1_SophiaMartinez.pdf', 'application/pdf', 'https://example.com/timesheets/sophia-week1.pdf', 245760, '2025-01-13T09:00:00Z'),
  ('period-alex-w1', 'Timesheet_Week1_AlexChen.pdf', 'application/pdf', 'https://example.com/timesheets/alex-week1.pdf', 245760, '2025-01-13T09:00:00Z')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SEED REVIEW_FLAGS (Anomalies)
-- ============================================================================

-- Flag overtime for Robert Garcia
INSERT INTO review_flags (period_id, type, message, severity) VALUES
  ('period-acme-8-w1', 'warning', 'Overtime detected: 45 hours (5 hours over standard 40)', 'medium')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SEED ALLOCATED_TASKS (Budget Tracking)
-- ============================================================================

-- Sample task allocations for Sarah Johnson
INSERT INTO allocated_tasks (period_id, name, allocated_hours, logged_hours, status) VALUES
  ('period-acme-1-w1', 'Authentication Module', 20.0, 18.0, 'on_track'),
  ('period-acme-1-w1', 'API Integration', 15.0, 14.5, 'on_track'),
  ('period-acme-1-w1', 'Code Review', 5.0, 7.5, 'over')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SEED TIMESHEET_ENTRIES (Daily Entries)
-- ============================================================================

-- Sample entries for Sarah Johnson (contract-acme-1, period-acme-1-w1)
INSERT INTO timesheet_entries (id, period_id, date, hours, task_description, task_category, work_type, billable, start_time, end_time, break_minutes, notes) VALUES
  ('entry-sarah-jan6-1', 'period-acme-1-w1', '2025-01-06', 4.0, 'Authentication module - Login flow implementation', 'Development', 'regular', true, '09:00', '13:00', 0, NULL),
  ('entry-sarah-jan6-2', 'period-acme-1-w1', '2025-01-06', 3.0, 'API integration - User endpoints', 'Development', 'regular', true, '14:00', '17:00', 0, NULL),
  ('entry-sarah-jan6-3', 'period-acme-1-w1', '2025-01-06', 1.0, 'Daily standup and code review', 'Code Review', 'regular', true, '17:00', '18:00', 0, NULL),
  
  ('entry-sarah-jan7-1', 'period-acme-1-w1', '2025-01-07', 5.0, 'Authentication module - Password reset flow', 'Development', 'regular', true, '09:00', '14:30', 30, NULL),
  ('entry-sarah-jan7-2', 'period-acme-1-w1', '2025-01-07', 3.0, 'Bug fixes from QA testing', 'Testing', 'regular', true, '15:00', '18:00', 0, NULL),
  
  ('entry-sarah-jan8-1', 'period-acme-1-w1', '2025-01-08', 8.0, 'Full day on authentication security hardening', 'Development', 'regular', true, '09:00', '17:30', 30, 'Implemented 2FA and rate limiting'),
  
  ('entry-sarah-jan9-1', 'period-acme-1-w1', '2025-01-09', 4.0, 'Code review for team PRs', 'Code Review', 'regular', true, '09:00', '13:00', 0, NULL),
  ('entry-sarah-jan9-2', 'period-acme-1-w1', '2025-01-09', 4.5, 'API integration - Auth middleware', 'Development', 'regular', true, '13:30', '18:00', 0, NULL),
  
  ('entry-sarah-jan10-1', 'period-acme-1-w1', '2025-01-10', 6.0, 'Authentication module - Testing and documentation', 'Testing', 'overtime', true, '09:00', '15:30', 30, 'Stayed late to finish documentation'),
  ('entry-sarah-jan10-2', 'period-acme-1-w1', '2025-01-10', 2.0, 'Sprint planning meeting', 'Meeting', 'regular', true, '16:00', '18:00', 0, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Count records
DO $$
DECLARE
  org_count INTEGER;
  contract_count INTEGER;
  period_count INTEGER;
  entry_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count FROM organizations;
  SELECT COUNT(*) INTO contract_count FROM project_contracts;
  SELECT COUNT(*) INTO period_count FROM timesheet_periods;
  SELECT COUNT(*) INTO entry_count FROM timesheet_entries;
  
  RAISE NOTICE '✅ Seed data complete!';
  RAISE NOTICE '   Organizations: %', org_count;
  RAISE NOTICE '   Contracts: %', contract_count;
  RAISE NOTICE '   Periods: %', period_count;
  RAISE NOTICE '   Entries: %', entry_count;
END $$;

-- Show distribution by status
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM timesheet_periods
GROUP BY status
ORDER BY count DESC;
