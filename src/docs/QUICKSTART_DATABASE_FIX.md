# ⚡ Quick Database Fix - 30 Seconds

**Error:** `Could not find the table 'public.timesheet_periods' in the schema cache`

---

## 🚀 One-Step Fix

### 1. Open Supabase SQL Editor

https://supabase.com/dashboard/project/_/sql/new

### 2. Copy & Paste This SQL → Click RUN

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  logo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS timesheet_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES project_contracts(id),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_hours DECIMAL(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contracts_user ON project_contracts(user_id);
CREATE INDEX idx_periods_contract ON timesheet_periods(contract_id);
```

### 3. Reload the App

**Done!** ✅ Error is gone.

---

## 💡 What Just Happened?

You created 3 database tables:
- `organizations` - companies & agencies
- `project_contracts` - contractor contracts
- `timesheet_periods` - weekly timesheets

The Project Graph can now query these tables for stats.

---

## 🎯 Next: Click a Node

1. Navigate to **Project Workspace → Project Graph**
2. Click any person, party, or contract node
3. See **Stats & Activity** panel (will show zeros - tables are empty)
4. No more errors! ✅

---

**Need help?** See `/docs/DATABASE_SETUP.md` for full guide
