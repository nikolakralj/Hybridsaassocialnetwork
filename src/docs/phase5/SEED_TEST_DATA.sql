-- ============================================================================
-- Seed Test Data for Graph-Based Approval Testing
-- ============================================================================

-- 1. Create test users (if not exists)
INSERT INTO users (id, name, email, user_type, company_id, initials) VALUES
  ('user-alice', 'Alice Chen', 'alice@example.com', 'contractor', 'company-agency', 'AC'),
  ('user-bob', 'Bob Manager', 'bob@example.com', 'manager', 'company-agency', 'BM'),
  ('user-carol', 'Carol Client', 'carol@example.com', 'client', 'company-client', 'CC')
ON CONFLICT (id) DO NOTHING;

-- 2. Create test companies (if not exists)
INSERT INTO companies (id, name, company_type) VALUES
  ('company-agency', 'Agency Alpha', 'agency'),
  ('company-client', 'Client Corp', 'client')
ON CONFLICT (id) DO NOTHING;

-- 3. Create test project (if not exists)
INSERT INTO projects (id, name, company_id, status) VALUES
  ('project-acme', 'ACME Website Redesign', 'company-client', 'active')
ON CONFLICT (id) DO NOTHING;

-- 4. Create test contract
INSERT INTO project_contracts (
  id, 
  project_id, 
  user_id, 
  company_id, 
  hourly_rate, 
  contract_type,
  start_date,
  status,
  requires_client_approval,
  client_timesheet_visibility,
  allow_manager_timesheet_edits
) VALUES (
  'contract-test-001',
  'project-acme',
  'user-alice',
  'company-agency',
  75.00,
  'hourly',
  '2025-01-01',
  'active',
  true,  -- Client approval required (2-step approval)
  'after_approval',  -- Client sees after manager approves
  false  -- No manager edits (MVP)
) ON CONFLICT (id) DO NOTHING;

-- 5. Create test timesheet period (draft)
INSERT INTO timesheet_periods (
  id,
  contract_id,
  week_start_date,
  week_end_date,
  status,
  current_approval_step,
  total_approval_steps,
  version
) VALUES (
  'period-test-001',
  'contract-test-001',
  '2025-11-03',
  '2025-11-09',
  'draft',
  1,
  1,
  1
) ON CONFLICT (id) DO NOTHING;

-- 6. Create test entries (5 days of work)
INSERT INTO timesheet_entries (
  id,
  period_id,
  entry_date,
  hours,
  project_id,
  task_description,
  billable
) VALUES
  ('entry-1', 'period-test-001', '2025-11-03', 8.0, 'project-acme', 'Frontend development', true),
  ('entry-2', 'period-test-001', '2025-11-04', 8.0, 'project-acme', 'Backend API integration', true),
  ('entry-3', 'period-test-001', '2025-11-05', 8.0, 'project-acme', 'Testing and bug fixes', true),
  ('entry-4', 'period-test-001', '2025-11-06', 8.0, 'project-acme', 'Code review and refactoring', true),
  ('entry-5', 'period-test-001', '2025-11-07', 8.0, 'project-acme', 'Documentation', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check setup is correct
SELECT 
  tp.id as period_id,
  tp.status,
  tp.week_start_date,
  pc.hourly_rate,
  pc.requires_client_approval,
  u.name as contractor_name,
  p.name as project_name,
  COUNT(te.id) as entry_count,
  SUM(te.hours) as total_hours
FROM timesheet_periods tp
JOIN project_contracts pc ON tp.contract_id = pc.id
JOIN users u ON pc.user_id = u.id
JOIN projects p ON pc.project_id = p.id
LEFT JOIN timesheet_entries te ON te.period_id = tp.id
WHERE tp.id = 'period-test-001'
GROUP BY tp.id, tp.status, tp.week_start_date, pc.hourly_rate, pc.requires_client_approval, u.name, p.name;

-- Expected output:
-- period_id        | status | week_start_date | hourly_rate | requires_client_approval | contractor_name | project_name          | entry_count | total_hours
-- -----------------+--------+-----------------+-------------+--------------------------+-----------------+-----------------------+-------------+-------------
-- period-test-001  | draft  | 2025-11-03      | 75.00       | t                        | Alice Chen      | ACME Website Redesign | 5           | 40.00

-- ============================================================================
-- Ready to Test!
-- ============================================================================

-- Now you can submit this timesheet:
-- POST /make-server-f8b491be/timesheet-approvals/submit
-- {
--   "periodId": "period-test-001",
--   "userId": "user-alice"
-- }
