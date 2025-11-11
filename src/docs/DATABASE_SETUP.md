# Database Setup Guide

## Error: "Could not find the table 'public.timesheet_periods' in the schema cache"

This error means your Supabase database doesn't have the required tables yet. Follow these steps to fix it:

---

## Quick Fix (5 minutes)

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Create the Tables

Copy and paste this SQL into the editor and click **RUN**:

```sql
-- WorkGraph Database Schema
-- Creates all required tables for the Project Graph stats feature

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table (companies, agencies, freelancers)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('company', 'agency', 'freelancer')),
  logo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);

-- Project contracts table
CREATE TABLE IF NOT EXISTS project_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL CHECK (user_role IN ('individual_contributor', 'company_employee', 'agency_contractor')),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_contracts_org ON project_contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_user ON project_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_project ON project_contracts(project_id);

-- Timesheet periods table (weekly aggregates)
CREATE TABLE IF NOT EXISTS timesheet_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES project_contracts(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_hours DECIMAL(5,2) DEFAULT 0,
  total_days DECIMAL(5,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID,
  rejection_reason TEXT,
  contractor_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_periods_contract ON timesheet_periods(contract_id);
CREATE INDEX IF NOT EXISTS idx_periods_dates ON timesheet_periods(week_start_date, week_end_date);
CREATE INDEX IF NOT EXISTS idx_periods_status ON timesheet_periods(status);

-- Timesheet entries table (daily detail)
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_id UUID NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_entries_period ON timesheet_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_entries_date ON timesheet_entries(date);
```

### Step 3: Add Sample Data (Optional)

If you want to test with sample data, run this:

```sql
-- Sample organizations
INSERT INTO organizations (id, name, type, logo) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Acme Dev Studio', 'company', '🏢'),
  ('550e8400-e29b-41d4-a716-446655440002', 'BrightWorks Design', 'company', '🎨')
ON CONFLICT (id) DO NOTHING;

-- Sample contracts
INSERT INTO project_contracts (id, user_id, user_name, user_role, organization_id, project_id, contract_type, hourly_rate, start_date) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 'Sarah Johnson', 'company_employee', '550e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440001', 'hourly', 85.00, '2024-12-01'),
  ('650e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440002', 'Mike Chen', 'company_employee', '550e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440001', 'hourly', 90.00, '2024-12-01')
ON CONFLICT (id) DO NOTHING;

-- Sample timesheet periods
INSERT INTO timesheet_periods (id, contract_id, week_start_date, week_end_date, total_hours, status, submitted_at) VALUES
  ('950e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '2025-01-06', '2025-01-12', 40.0, 'pending', '2025-01-13T09:00:00Z'),
  ('950e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440002', '2025-01-06', '2025-01-12', 40.0, 'approved', '2025-01-13T09:15:00Z')
ON CONFLICT (id) DO NOTHING;
```

### Step 4: Verify

Reload the app and the error should be gone! The Project Graph will now show real stats.

---

## What These Tables Do

| Table | Purpose |
|-------|---------|
| **organizations** | Stores companies, agencies, and freelancers |
| **project_contracts** | Individual contractor contracts with rates |
| **timesheet_periods** | Weekly timesheet summaries (Mon-Sun) |
| **timesheet_entries** | Daily timesheet detail (hours, tasks) |

---

## Troubleshooting

### Error: "permission denied for schema public"

Your Supabase user needs permission to create tables. Make sure you're using the SQL Editor logged in as the project owner.

### Error: "relation already exists"

Tables already exist! The error might be from something else. Check the browser console for more details.

### Tables created but still getting errors

1. Click the **Refresh** button in the database health check
2. Check that your Supabase project ID and anon key are correct in `/utils/supabase/info.tsx`
3. Open browser DevTools → Console and look for query errors

---

## Need More Help?

Check the full migration files:
- `/supabase/migrations/001_timesheet_approval_tables.sql.tsx` - Full schema
- `/supabase/migrations/002_seed_demo_data.sql` - Complete sample data
- `/docs/project-graph/DATABASE_CONNECTION_COMPLETE.md` - Technical details

---

**After setup:** Navigate to **Project Workspace → Project Graph** and click on any node to see live database stats! 🎉
