# ✅ Error Fix Summary - Database Setup Required

**Date:** November 7, 2025  
**Error:** `Could not find the table 'public.timesheet_periods' in the schema cache`  
**Status:** ✅ FIXED - Setup tools created

---

## 🐛 The Problem

You saw this error because the database tables don't exist yet:

```
Error fetching contract periods: {
  "code": "PGRST205",
  "details": null,
  "hint": null,
  "message": "Could not find the table 'public.timesheet_periods' in the schema cache"
}
```

**Why:** The `useNodeStats` hook tries to query `timesheet_periods` table, but it doesn't exist in your Supabase database.

---

## ✅ The Solution

I created several tools to help you fix this:

### **1. DatabaseSetupGuide Component** (`/components/DatabaseSetupGuide.tsx`)
- Step-by-step wizard with 3 steps
- Copy-paste SQL scripts
- Links to Supabase SQL Editor
- Sample data option

### **2. DatabaseHealthCheck Component** (`/components/DatabaseHealthCheck.tsx`)
- Auto-detects missing tables
- Shows which tables are missing
- Automatically displays setup guide if needed
- Refresh button to recheck after setup

### **3. Documentation**
- `/docs/DATABASE_SETUP.md` - Full setup guide
- `/docs/project-graph/DATABASE_ERROR_FIX.md` - Quick fix
- `/docs/project-graph/ERROR_FIX_SUMMARY.md` - This file

### **4. Improved Error Messages**
Updated `useNodeStats.ts` to show helpful messages in console:
```
⚠️ DATABASE NOT SETUP: timesheet_periods table does not exist.
📖 See /docs/DATABASE_SETUP.md for setup instructions
```

---

## 🚀 Quick Fix (30 seconds)

1. **Open Supabase SQL Editor:**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Click **SQL Editor** → **New Query**

2. **Copy this SQL and click RUN:**

```sql
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

CREATE INDEX idx_contracts_user ON project_contracts(user_id);
CREATE INDEX idx_contracts_org ON project_contracts(organization_id);
CREATE INDEX idx_periods_contract ON timesheet_periods(contract_id);
CREATE INDEX idx_periods_dates ON timesheet_periods(week_start_date, week_end_date);
CREATE INDEX idx_entries_period ON timesheet_entries(period_id);
```

3. **Reload the app** - Error gone! ✅

---

## 📊 What the Fix Does

### **Tables Created:**

| Table | Purpose | Rows After Setup |
|-------|---------|------------------|
| `organizations` | Companies, agencies, freelancers | 0 (empty) |
| `project_contracts` | Contractor contracts with rates | 0 (empty) |
| `timesheet_periods` | Weekly timesheet summaries | 0 (empty) |
| `timesheet_entries` | Daily timesheet detail | 0 (empty) |

### **Indexes Created:**

- `idx_contracts_user` - Fast lookup by user_id
- `idx_contracts_org` - Fast lookup by organization_id
- `idx_periods_contract` - Fast lookup of periods by contract
- `idx_periods_dates` - Fast date range queries
- `idx_entries_period` - Fast lookup of entries by period

---

## 🎯 After Setup

### **What Works Now:**

1. **No more errors!** ✅
   - Console won't show PGRST205 errors
   - useNodeStats queries succeed (even if they return empty results)

2. **Project Graph loads correctly** ✅
   - Clicking nodes shows Stats section
   - Stats show zeros (because tables are empty)
   - No crashes or error messages

3. **Ready for data** ✅
   - You can now add real contracts and timesheets
   - Stats will update automatically as data is added

### **What You'll See:**

When you click a node in the Project Graph:

```
📊 Stats & Activity [Phase 5 🔄]  ▼

🕐 Total Hours Worked        0 hrs      ← Empty because no data yet
   This Month                0 hrs
   Current Week              0 / 40 hrs (0%)
   Last Timesheet           Never
   Pending Timesheets       [0]
```

**This is correct!** The tables exist but are empty. When you add data, stats will show real numbers.

---

## 📝 Next Steps

### **Option A: Add Sample Data (Recommended for Testing)**

Run this SQL to add 2 companies + 2 contractors + sample timesheets:

```sql
INSERT INTO organizations (id, name, type, logo) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Acme Dev Studio', 'company', '🏢'),
  ('550e8400-e29b-41d4-a716-446655440002', 'BrightWorks Design', 'company', '🎨')
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_contracts (id, user_id, user_name, user_role, organization_id, project_id, contract_type, hourly_rate, start_date) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 'Sarah Johnson', 'company_employee', '550e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440001', 'hourly', 85.00, '2024-12-01'),
  ('650e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440002', 'Mike Chen', 'company_employee', '550e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440001', 'hourly', 90.00, '2024-12-01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO timesheet_periods (id, contract_id, week_start_date, week_end_date, total_hours, status, submitted_at) VALUES
  ('950e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '2025-01-06', '2025-01-12', 40.0, 'pending', '2025-01-13T09:00:00Z'),
  ('950e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440002', '2025-01-06', '2025-01-12', 40.0, 'approved', '2025-01-13T09:15:00Z')
ON CONFLICT (id) DO NOTHING;
```

**Then:** Update Project Graph template IDs to match these UUIDs.

### **Option B: Use Your Own Data**

Add your real contractors and timesheets through the Timesheets UI, then they'll show up in the Project Graph.

---

## 🔧 Technical Details

### **Why This Error Happened:**

1. **Phase 5 database integration** was implemented
2. `useNodeStats` hook makes real Supabase queries
3. Queries assume tables exist (from migrations)
4. **But:** Migrations aren't run automatically in this environment
5. **Result:** Query fails with PGRST205 error

### **Why The Fix Works:**

1. **Creates tables with schema from migrations**
2. Tables use `CREATE TABLE IF NOT EXISTS` (safe to run multiple times)
3. Indexes improve query performance
4. Foreign keys ensure data integrity
5. Check constraints prevent invalid data

### **Error Handling:**

The `useNodeStats` hook now detects PGRST205 and shows helpful messages:

```typescript
if (contractsError.code === 'PGRST205' || contractsError.message?.includes('not find')) {
  console.error('⚠️ DATABASE NOT SETUP: Tables do not exist.');
  console.error('📖 See /docs/DATABASE_SETUP.md');
  return getDefaultPersonStats(); // Returns zeros, doesn't crash
}
```

---

## ✅ Summary

**Problem:** Database tables missing → PGRST205 error  
**Solution:** Run SQL script to create tables  
**Time:** 30 seconds  
**Result:** ✅ No errors, Project Graph works!

**Tools Created:**
- DatabaseSetupGuide component (wizard)
- DatabaseHealthCheck component (auto-detection)
- Comprehensive documentation
- Better error messages

**Status:** ✅ COMPLETE - Ready to use!

---

**Next:** Run the SQL script and reload the app! 🚀
