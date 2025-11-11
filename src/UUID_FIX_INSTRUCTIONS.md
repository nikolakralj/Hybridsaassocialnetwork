# UUID Error Fix - Database Schema Update

## Problem
You're seeing these errors:
```
Error fetching contracts: {
  "code": "22P02",
  "message": "invalid input syntax for type uuid: \"user-sophia\""
}
```

## Root Cause
The database schema was configured to use UUID types for ID columns, but the application code uses string identifiers like `"user-sophia"`, `"org-acme"`, etc.

## Solution
The migration files have been updated to use TEXT instead of UUID for all ID columns, which allows the existing string IDs to work properly.

## What You Need to Do

### Option 1: Fresh Database Setup (RECOMMENDED)

If you haven't put important data in your database yet:

1. **Drop existing tables** in Supabase SQL Editor:
   ```sql
   DROP TABLE IF EXISTS allocated_tasks CASCADE;
   DROP TABLE IF EXISTS review_flags CASCADE;
   DROP TABLE IF EXISTS attachments CASCADE;
   DROP TABLE IF EXISTS approval_history CASCADE;
   DROP TABLE IF EXISTS timesheet_entries CASCADE;
   DROP TABLE IF EXISTS timesheet_periods CASCADE;
   DROP TABLE IF EXISTS project_contracts CASCADE;
   DROP TABLE IF EXISTS organizations CASCADE;
   DROP VIEW IF EXISTS v_contracts_with_orgs CASCADE;
   DROP VIEW IF EXISTS v_periods_full CASCADE;
   ```

2. **Run the updated migration** - Copy the contents of `/supabase/migrations/001_timesheet_approval_tables.sql.tsx` and paste into Supabase SQL Editor, then click RUN.

3. **Seed demo data** - Copy the contents of `/supabase/migrations/002_seed_demo_data.sql` and paste into Supabase SQL Editor, then click RUN.

4. **Refresh the app** - The errors should now be gone!

### Option 2: Alter Existing Tables (If you have data to preserve)

If you have existing data you want to keep:

```sql
-- Disable RLS temporarily
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_periods DISABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE approval_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE review_flags DISABLE ROW LEVEL SECURITY;
ALTER TABLE allocated_tasks DISABLE ROW LEVEL SECURITY;

-- Drop views that depend on tables
DROP VIEW IF EXISTS v_contracts_with_orgs CASCADE;
DROP VIEW IF EXISTS v_periods_full CASCADE;

-- Alter ID columns to TEXT type
-- Note: This will fail if you have UUID data. You'll need to clear the tables first.

ALTER TABLE organizations ALTER COLUMN id TYPE TEXT;

ALTER TABLE project_contracts ALTER COLUMN id TYPE TEXT;
ALTER TABLE project_contracts ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE project_contracts ALTER COLUMN organization_id TYPE TEXT;
ALTER TABLE project_contracts ALTER COLUMN project_id TYPE TEXT;

ALTER TABLE timesheet_periods ALTER COLUMN id TYPE TEXT;
ALTER TABLE timesheet_periods ALTER COLUMN contract_id TYPE TEXT;
ALTER TABLE timesheet_periods ALTER COLUMN approved_by TYPE TEXT;
ALTER TABLE timesheet_periods ALTER COLUMN rejected_by TYPE TEXT;

ALTER TABLE timesheet_entries ALTER COLUMN id TYPE TEXT;
ALTER TABLE timesheet_entries ALTER COLUMN period_id TYPE TEXT;

ALTER TABLE approval_history ALTER COLUMN id TYPE TEXT;
ALTER TABLE approval_history ALTER COLUMN period_id TYPE TEXT;

ALTER TABLE attachments ALTER COLUMN id TYPE TEXT;
ALTER TABLE attachments ALTER COLUMN period_id TYPE TEXT;
ALTER TABLE attachments ALTER COLUMN uploaded_by TYPE TEXT;

ALTER TABLE review_flags ALTER COLUMN id TYPE TEXT;
ALTER TABLE review_flags ALTER COLUMN period_id TYPE TEXT;

ALTER TABLE allocated_tasks ALTER COLUMN id TYPE TEXT;
ALTER TABLE allocated_tasks ALTER COLUMN period_id TYPE TEXT;

-- Recreate views
CREATE OR REPLACE VIEW v_contracts_with_orgs AS
SELECT 
  pc.*,
  o.name as org_name,
  o.type as org_type,
  o.logo as org_logo
FROM project_contracts pc
JOIN organizations o ON pc.organization_id = o.id;

CREATE OR REPLACE VIEW v_periods_full AS
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
JOIN organizations o ON pc.organization_id = o.id;

-- Re-enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocated_tasks ENABLE ROW LEVEL SECURITY;

-- Update function parameter type
CREATE OR REPLACE FUNCTION calculate_period_totals(p_period_id TEXT)
RETURNS TABLE(total_hours DECIMAL, total_days DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(hours), 0)::DECIMAL(5,2) as total_hours,
    COALESCE(SUM(days), 0)::DECIMAL(5,2) as total_days
  FROM timesheet_entries
  WHERE period_id = p_period_id;
END;
$$ LANGUAGE plpgsql;
```

## Verification

After running the fix, you should see:
- ✅ No more UUID errors in the console
- ✅ Project Graph loads with person nodes showing stats
- ✅ Timesheet data displays correctly
- ✅ Month selector works properly

## Need Help?

If you encounter issues:
1. Check the browser console for any remaining errors
2. Make sure you ran ALL the migration steps
3. Try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
4. If all else fails, go with Option 1 (fresh setup)
