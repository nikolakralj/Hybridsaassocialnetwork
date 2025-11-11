# ✅ Database Error Fixed

**Error:** `Could not find the table 'public.timesheet_periods' in the schema cache`

**Cause:** The Supabase database tables haven't been created yet.

---

## Quick Fix (Copy & Paste)

### Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** → **New Query**

### Paste This SQL and Click RUN

```sql
-- WorkGraph Database Tables
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('company', 'agency', 'freelancer')),
  logo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS timesheet_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES project_contracts(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_hours DECIMAL(5,2) DEFAULT 0,
  total_days DECIMAL(5,2),
  status TEXT NOT NULL DEFAULT 'pending',
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

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_id UUID NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours DECIMAL(5,2),
  days DECIMAL(5,2),
  task_category TEXT,
  task_description TEXT NOT NULL,
  work_type TEXT DEFAULT 'regular',
  billable BOOLEAN DEFAULT TRUE,
  start_time TIME,
  end_time TIME,
  break_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contracts_user ON project_contracts(user_id);
CREATE INDEX idx_contracts_org ON project_contracts(organization_id);
CREATE INDEX idx_periods_contract ON timesheet_periods(contract_id);
CREATE INDEX idx_periods_dates ON timesheet_periods(week_start_date, week_end_date);
CREATE INDEX idx_entries_period ON timesheet_entries(period_id);
```

### That's It!

Reload the app. The error should be gone and the Project Graph will show real database stats.

---

## What Happened?

The `useNodeStats` hook tries to query these tables:
- `organizations` - companies and agencies  
- `project_contracts` - contractor contracts with rates  
- `timesheet_periods` - weekly timesheet summaries  
- `timesheet_entries` - daily timesheet details  

When the tables don't exist, Supabase returns error code **PGRST205**.

Now that you've created the tables, the queries will work!

---

## See Also

- `/docs/DATABASE_SETUP.md` - Full setup guide with sample data
- `/supabase/migrations/001_timesheet_approval_tables.sql.tsx` - Complete schema
- `/docs/project-graph/DATABASE_CONNECTION_COMPLETE.md` - Technical details
