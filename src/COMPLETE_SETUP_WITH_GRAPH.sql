-- ============================================================================
-- WorkGraph Complete Database Setup
-- ============================================================================
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
-- This creates tables AND stores the WorkGraph state
-- ============================================================================

-- Drop everything first
DROP POLICY IF EXISTS "Allow all access" ON allocated_tasks;
DROP POLICY IF EXISTS "Allow all access" ON review_flags;
DROP POLICY IF EXISTS "Allow all access" ON attachments;
DROP POLICY IF EXISTS "Allow all access" ON approval_history;
DROP POLICY IF EXISTS "Allow all access" ON timesheet_entries;
DROP POLICY IF EXISTS "Allow all access" ON timesheet_periods;
DROP POLICY IF EXISTS "Allow all access" ON project_contracts;
DROP POLICY IF EXISTS "Allow all access" ON organizations;
DROP POLICY IF EXISTS "Allow all access" ON graph_versions;

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
DROP TABLE IF EXISTS graph_versions CASCADE;

DROP FUNCTION IF EXISTS calculate_period_totals(TEXT);
DROP FUNCTION IF EXISTS update_period_totals();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- ============================================================================
-- CREATE TABLES
-- ============================================================================

-- Organizations
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('company', 'agency', 'freelancer')),
  logo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Contracts
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

-- Timesheet Periods
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timesheet Entries
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval History
CREATE TABLE approval_history (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'changes_requested')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attachments
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

-- Review Flags
CREATE TABLE review_flags (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('warning', 'error', 'info')),
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allocated Tasks
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

-- ============================================================================
-- GRAPH_VERSIONS TABLE - Stores WorkGraph State (nodes, edges, positions)
-- ============================================================================
CREATE TABLE graph_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  effective_from_date DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to_date DATE, -- NULL = currently active version
  graph_data JSONB NOT NULL, -- Stores: { nodes: [], edges: [], metadata: {} }
  change_summary TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, version_number)
);

CREATE INDEX idx_graph_versions_project ON graph_versions(project_id);
CREATE INDEX idx_graph_versions_active ON graph_versions(project_id, effective_to_date) WHERE effective_to_date IS NULL;
CREATE INDEX idx_graph_versions_date_range ON graph_versions(project_id, effective_from_date, effective_to_date);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Organizations
INSERT INTO organizations (id, name, type, logo) VALUES
  ('org-acme', 'Acme Dev Studio', 'company', '🏢'),
  ('org-brightworks', 'BrightWorks Design', 'company', '🎨'),
  ('org-alex', 'Alex Chen', 'freelancer', '👤'),
  ('org-jordan', 'Jordan Rivera', 'freelancer', '👤'),
  ('org-taylor', 'Taylor Kim', 'freelancer', '👤');

-- Contracts (25 total)
INSERT INTO project_contracts (id, user_id, user_name, user_role, organization_id, project_id, contract_type, rate, hourly_rate, hide_rate, start_date) VALUES
  ('contract-acme-1', 'user-sarah', 'Sarah Johnson', 'company_employee', 'org-acme', 'proj-alpha', 'hourly', 85.00, 85.00, false, '2025-10-01'),
  ('contract-acme-2', 'user-mike', 'Mike Chen', 'company_employee', 'org-acme', 'proj-alpha', 'hourly', 90.00, 90.00, false, '2025-10-01'),
  ('contract-acme-3', 'user-emily', 'Emily Davis', 'company_employee', 'org-acme', 'proj-alpha', 'hourly', 75.00, 75.00, false, '2025-10-01'),
  ('contract-acme-8', 'user-robert', 'Robert Garcia', 'company_employee', 'org-acme', 'proj-beta', 'hourly', 100.00, 100.00, false, '2025-10-01'),
  ('contract-acme-5', 'user-lisa', 'Lisa Anderson', 'company_employee', 'org-acme', 'proj-alpha', 'hourly', 80.00, 80.00, false, '2025-10-01');

INSERT INTO project_contracts (id, user_id, user_name, user_role, organization_id, project_id, contract_type, rate, daily_rate, hide_rate, start_date) VALUES
  ('contract-bright-1', 'user-sophia', 'Sophia Martinez', 'company_employee', 'org-brightworks', 'proj-epsilon', 'daily', 640.00, 640.00, false, '2025-10-01'),
  ('contract-bright-2', 'user-oliver', 'Oliver Anderson', 'company_employee', 'org-brightworks', 'proj-epsilon', 'daily', 720.00, 720.00, false, '2025-10-01');

INSERT INTO project_contracts (id, user_id, user_name, user_role, organization_id, project_id, contract_type, rate, hourly_rate, hide_rate, start_date) VALUES
  ('contract-alex', 'user-alex', 'Alex Chen', 'individual_contributor', 'org-alex', 'proj-theta', 'hourly', 120.00, 120.00, false, '2025-10-01');

-- Timesheet Periods (October 2025 - Week 1: Oct 6-12)
INSERT INTO timesheet_periods (id, contract_id, week_start_date, week_end_date, total_hours, status, submitted_at) VALUES
  ('period-acme-1-oct-w1', 'contract-acme-1', '2025-10-06', '2025-10-12', 40.0, 'pending', '2025-10-13T09:00:00Z'),
  ('period-acme-2-oct-w1', 'contract-acme-2', '2025-10-06', '2025-10-12', 38.0, 'pending', '2025-10-13T09:15:00Z'),
  ('period-acme-3-oct-w1', 'contract-acme-3', '2025-10-06', '2025-10-12', 35.0, 'approved', '2025-10-13T09:30:00Z'),
  ('period-acme-8-oct-w1', 'contract-acme-8', '2025-10-06', '2025-10-12', 42.0, 'approved', '2025-10-13T10:00:00Z'),
  ('period-acme-5-oct-w1', 'contract-acme-5', '2025-10-06', '2025-10-12', 40.0, 'approved', '2025-10-13T11:00:00Z');

INSERT INTO timesheet_periods (id, contract_id, week_start_date, week_end_date, total_days, status, submitted_at) VALUES
  ('period-bright-1-oct-w1', 'contract-bright-1', '2025-10-06', '2025-10-12', 5.0, 'pending', '2025-10-13T09:00:00Z'),
  ('period-bright-2-oct-w1', 'contract-bright-2', '2025-10-06', '2025-10-12', 5.0, 'approved', '2025-10-13T09:00:00Z');

INSERT INTO timesheet_periods (id, contract_id, week_start_date, week_end_date, total_hours, status, submitted_at) VALUES
  ('period-alex-oct-w1', 'contract-alex', '2025-10-06', '2025-10-12', 32.0, 'pending', '2025-10-13T14:00:00Z');

-- Timesheet Periods (October 2025 - Week 2: Oct 13-19)
INSERT INTO timesheet_periods (id, contract_id, week_start_date, week_end_date, total_hours, status, submitted_at) VALUES
  ('period-acme-1-oct-w2', 'contract-acme-1', '2025-10-13', '2025-10-19', 40.0, 'pending', '2025-10-20T09:00:00Z'),
  ('period-acme-2-oct-w2', 'contract-acme-2', '2025-10-13', '2025-10-19', 40.0, 'pending', '2025-10-20T09:15:00Z'),
  ('period-acme-3-oct-w2', 'contract-acme-3', '2025-10-13', '2025-10-19', 38.0, 'pending', '2025-10-20T09:30:00Z');

INSERT INTO timesheet_periods (id, contract_id, week_start_date, week_end_date, total_days, status, submitted_at) VALUES
  ('period-bright-1-oct-w2', 'contract-bright-1', '2025-10-13', '2025-10-19', 5.0, 'pending', '2025-10-20T09:00:00Z');

-- Timesheet Entries (Week 1: Sarah Johnson - 5 days)
INSERT INTO timesheet_entries (id, period_id, date, hours, task_description, task_category, work_type) VALUES
  ('entry-sarah-oct6', 'period-acme-1-oct-w1', '2025-10-06', 8.0, 'Frontend component development', 'Development', 'regular'),
  ('entry-sarah-oct7', 'period-acme-1-oct-w1', '2025-10-07', 8.0, 'API integration work', 'Development', 'regular'),
  ('entry-sarah-oct8', 'period-acme-1-oct-w1', '2025-10-08', 8.0, 'Bug fixes and testing', 'Development', 'regular'),
  ('entry-sarah-oct9', 'period-acme-1-oct-w1', '2025-10-09', 8.0, 'Code review session', 'Code Review', 'regular'),
  ('entry-sarah-oct10', 'period-acme-1-oct-w1', '2025-10-10', 8.0, 'Unit test writing', 'Testing', 'regular');

-- Timesheet Entries (Week 1: Mike Chen - 4.75 days)
INSERT INTO timesheet_entries (id, period_id, date, hours, task_description, task_category, work_type) VALUES
  ('entry-mike-oct6', 'period-acme-2-oct-w1', '2025-10-06', 8.0, 'Database schema updates', 'Development', 'regular'),
  ('entry-mike-oct7', 'period-acme-2-oct-w1', '2025-10-07', 8.0, 'Backend API development', 'Development', 'regular'),
  ('entry-mike-oct8', 'period-acme-2-oct-w1', '2025-10-08', 8.0, 'GraphQL resolver implementation', 'Development', 'regular'),
  ('entry-mike-oct9', 'period-acme-2-oct-w1', '2025-10-09', 8.0, 'Performance optimization', 'Development', 'regular'),
  ('entry-mike-oct10', 'period-acme-2-oct-w1', '2025-10-10', 6.0, 'Team standup and planning', 'Meetings', 'regular');

-- Timesheet Entries (Week 1: Emily Davis - 4.375 days)
INSERT INTO timesheet_entries (id, period_id, date, hours, task_description, task_category, work_type) VALUES
  ('entry-emily-oct6', 'period-acme-3-oct-w1', '2025-10-06', 7.0, 'UI/UX design review', 'Design', 'regular'),
  ('entry-emily-oct7', 'period-acme-3-oct-w1', '2025-10-07', 8.0, 'Component library updates', 'Development', 'regular'),
  ('entry-emily-oct8', 'period-acme-3-oct-w1', '2025-10-08', 8.0, 'Responsive design implementation', 'Development', 'regular'),
  ('entry-emily-oct9', 'period-acme-3-oct-w1', '2025-10-09', 6.0, 'Design system documentation', 'Documentation', 'regular'),
  ('entry-emily-oct10', 'period-acme-3-oct-w1', '2025-10-10', 6.0, 'Accessibility improvements', 'Development', 'regular');

-- Timesheet Entries (Week 1: Robert Garcia - 5.25 days)
INSERT INTO timesheet_entries (id, period_id, date, hours, task_description, task_category, work_type) VALUES
  ('entry-robert-oct6', 'period-acme-8-oct-w1', '2025-10-06', 8.0, 'Architecture planning', 'Planning', 'regular'),
  ('entry-robert-oct7', 'period-acme-8-oct-w1', '2025-10-07', 9.0, 'System design and documentation', 'Development', 'regular'),
  ('entry-robert-oct8', 'period-acme-8-oct-w1', '2025-10-08', 8.0, 'Infrastructure setup', 'DevOps', 'regular'),
  ('entry-robert-oct9', 'period-acme-8-oct-w1', '2025-10-09', 8.0, 'CI/CD pipeline configuration', 'DevOps', 'regular'),
  ('entry-robert-oct10', 'period-acme-8-oct-w1', '2025-10-10', 9.0, 'Security audit and fixes', 'Security', 'regular');

-- Timesheet Entries (Week 1: Lisa Anderson - 5 days)
INSERT INTO timesheet_entries (id, period_id, date, hours, task_description, task_category, work_type) VALUES
  ('entry-lisa-oct6', 'period-acme-5-oct-w1', '2025-10-06', 8.0, 'QA test planning', 'Testing', 'regular'),
  ('entry-lisa-oct7', 'period-acme-5-oct-w1', '2025-10-07', 8.0, 'Manual testing execution', 'Testing', 'regular'),
  ('entry-lisa-oct8', 'period-acme-5-oct-w1', '2025-10-08', 8.0, 'Automated test development', 'Testing', 'regular'),
  ('entry-lisa-oct9', 'period-acme-5-oct-w1', '2025-10-09', 8.0, 'Bug reporting and verification', 'Testing', 'regular'),
  ('entry-lisa-oct10', 'period-acme-5-oct-w1', '2025-10-10', 8.0, 'Regression testing', 'Testing', 'regular');

-- Timesheet Entries (Week 1: Alex Chen - 4 days, freelancer)
INSERT INTO timesheet_entries (id, period_id, date, hours, task_description, task_category, work_type) VALUES
  ('entry-alex-oct6', 'period-alex-oct-w1', '2025-10-06', 8.0, 'Mobile app development', 'Development', 'regular'),
  ('entry-alex-oct7', 'period-alex-oct-w1', '2025-10-07', 8.0, 'React Native components', 'Development', 'regular'),
  ('entry-alex-oct8', 'period-alex-oct-w1', '2025-10-08', 8.0, 'API integration', 'Development', 'regular'),
  ('entry-alex-oct9', 'period-alex-oct-w1', '2025-10-09', 8.0, 'Testing and debugging', 'Testing', 'regular');

-- Timesheet Entries (Week 2: Sarah Johnson - 5 days)
INSERT INTO timesheet_entries (id, period_id, date, hours, task_description, task_category, work_type) VALUES
  ('entry-sarah-oct13', 'period-acme-1-oct-w2', '2025-10-13', 8.0, 'New feature development', 'Development', 'regular'),
  ('entry-sarah-oct14', 'period-acme-1-oct-w2', '2025-10-14', 8.0, 'State management refactor', 'Development', 'regular'),
  ('entry-sarah-oct15', 'period-acme-1-oct-w2', '2025-10-15', 8.0, 'Performance optimization', 'Development', 'regular'),
  ('entry-sarah-oct16', 'period-acme-1-oct-w2', '2025-10-16', 8.0, 'Integration testing', 'Testing', 'regular'),
  ('entry-sarah-oct17', 'period-acme-1-oct-w2', '2025-10-17', 8.0, 'Documentation updates', 'Documentation', 'regular');

-- ============================================================================
-- SEED WORKGRAPH STATE
-- ============================================================================
-- This stores the visual graph (nodes, edges, positions)

INSERT INTO graph_versions (
  id, 
  project_id, 
  version_number,
  effective_from_date,
  effective_to_date,
  graph_data,
  change_summary,
  created_by
) VALUES (
  'graph-v1',
  'proj-alpha',
  1,
  '2025-10-01',
  NULL,
  '{"nodes":[{"id":"user-sarah","type":"person","position":{"x":100,"y":100},"data":{"name":"Sarah Johnson","userId":"user-sarah","role":"company_employee","company":"Acme Dev Studio"}},{"id":"user-mike","type":"person","position":{"x":100,"y":200},"data":{"name":"Mike Chen","userId":"user-mike","role":"company_employee","company":"Acme Dev Studio"}},{"id":"user-sophia","type":"person","position":{"x":100,"y":300},"data":{"name":"Sophia Martinez","userId":"user-sophia","role":"agency_contractor","company":"BrightWorks Design"}},{"id":"org-acme","type":"party","position":{"x":400,"y":150},"data":{"name":"Acme Dev Studio","organizationId":"org-acme","type":"company"}},{"id":"org-brightworks","type":"party","position":{"x":400,"y":350},"data":{"name":"BrightWorks Design","organizationId":"org-brightworks","type":"company"}}],"edges":[{"id":"employs-sarah","source":"org-acme","target":"user-sarah","type":"employs","data":{"edgeType":"employs"}},{"id":"employs-mike","source":"org-acme","target":"user-mike","type":"employs","data":{"edgeType":"employs"}},{"id":"employs-sophia","source":"org-brightworks","target":"user-sophia","type":"employs","data":{"edgeType":"employs"}}]}'::jsonb,
  'Initial October 2025 graph setup',
  'system'
);

-- ============================================================================
-- ENABLE RLS WITH PERMISSIVE POLICIES
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocated_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_versions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous and authenticated users full access (for demo/prototyping)
CREATE POLICY "Public read access" ON organizations FOR SELECT USING (true);
CREATE POLICY "Public write access" ON organizations FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read access" ON project_contracts FOR SELECT USING (true);
CREATE POLICY "Public write access" ON project_contracts FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read access" ON timesheet_periods FOR SELECT USING (true);
CREATE POLICY "Public write access" ON timesheet_periods FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read access" ON timesheet_entries FOR SELECT USING (true);
CREATE POLICY "Public write access" ON timesheet_entries FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read access" ON approval_history FOR SELECT USING (true);
CREATE POLICY "Public write access" ON approval_history FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read access" ON attachments FOR SELECT USING (true);
CREATE POLICY "Public write access" ON attachments FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read access" ON review_flags FOR SELECT USING (true);
CREATE POLICY "Public write access" ON review_flags FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read access" ON allocated_tasks FOR SELECT USING (true);
CREATE POLICY "Public write access" ON allocated_tasks FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read access" ON graph_versions FOR SELECT USING (true);
CREATE POLICY "Public write access" ON graph_versions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
  'organizations' as table_name, 
  COUNT(*)::text as records
FROM organizations
UNION ALL
SELECT 'project_contracts', COUNT(*)::text FROM project_contracts
UNION ALL
SELECT 'timesheet_periods', COUNT(*)::text FROM timesheet_periods
UNION ALL
SELECT 'timesheet_entries', COUNT(*)::text FROM timesheet_entries
UNION ALL
SELECT 'graph_versions', COUNT(*)::text FROM graph_versions
ORDER BY table_name;