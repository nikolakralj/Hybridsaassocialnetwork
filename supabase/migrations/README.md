# Supabase Migrations - Timesheet Approval System

**Created:** January 22, 2025  
**Purpose:** Database schema and seed data for WorkGraph approval-v2 system

---

## Overview

This directory contains SQL migrations to set up the complete database for the timesheet approval system.

### Migration Files

1. **`001_timesheet_approval_tables.sql`** - Core schema
   - Creates 8 tables (organizations, contracts, periods, entries, etc.)
   - Sets up indexes for performance
   - Configures Row Level Security (RLS)
   - Creates helper functions and triggers
   - Creates views for easier querying

2. **`002_seed_demo_data.sql`** - Demo data
   - Seeds 5 organizations (2 companies + 3 freelancers)
   - Seeds 25 contracts
   - Seeds 25 timesheet periods for Jan 2025, Week 1
   - Seeds sample entries, attachments, flags, tasks
   - Mimics data from `/components/timesheets/approval-v2/demo-data-multi-party.ts`

---

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended for First Time)

1. **Go to your Supabase project**
   - Navigate to https://supabase.com/dashboard
   - Select your WorkGraph project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "+ New query"

3. **Run Migration 001 (Schema)**
   - Copy the entire contents of `001_timesheet_approval_tables.sql`
   - Paste into the SQL editor
   - Click "Run" (or Ctrl/Cmd + Enter)
   - Wait for "Success" message (should take 5-10 seconds)
   - Check output: Should see "✅ All 8 tables created successfully!"

4. **Run Migration 002 (Seed Data)**
   - Copy the entire contents of `002_seed_demo_data.sql`
   - Paste into the SQL editor
   - Click "Run"
   - Wait for "Success" message
   - Check output: Should see count of seeded records

5. **Verify Tables Created**
   - Click "Table Editor" in left sidebar
   - You should see 8 new tables:
     - `organizations`
     - `project_contracts`
     - `timesheet_periods`
     - `timesheet_entries`
     - `approval_history`
     - `attachments`
     - `review_flags`
     - `allocated_tasks`

### Option 2: Supabase CLI (For Advanced Users)

```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push

# Or run individually
supabase db execute --file supabase/migrations/001_timesheet_approval_tables.sql
supabase db execute --file supabase/migrations/002_seed_demo_data.sql
```

### Option 3: Direct PostgreSQL Connection

```bash
# Connect to Supabase Postgres
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run migrations
\i supabase/migrations/001_timesheet_approval_tables.sql
\i supabase/migrations/002_seed_demo_data.sql
```

---

## Verification Queries

After running migrations, verify data was seeded correctly:

### Check Table Counts
```sql
SELECT 'organizations' as table_name, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'project_contracts', COUNT(*) FROM project_contracts
UNION ALL
SELECT 'timesheet_periods', COUNT(*) FROM timesheet_periods
UNION ALL
SELECT 'timesheet_entries', COUNT(*) FROM timesheet_entries
UNION ALL
SELECT 'approval_history', COUNT(*) FROM approval_history
UNION ALL
SELECT 'attachments', COUNT(*) FROM attachments
UNION ALL
SELECT 'review_flags', COUNT(*) FROM review_flags
UNION ALL
SELECT 'allocated_tasks', COUNT(*) FROM allocated_tasks;
```

**Expected Results:**
- organizations: 5
- project_contracts: 25
- timesheet_periods: 25
- timesheet_entries: 10 (sample entries for 1 contractor)
- approval_history: 16+
- attachments: 4
- review_flags: 1
- allocated_tasks: 3

### Check Status Distribution
```sql
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM timesheet_periods
GROUP BY status
ORDER BY count DESC;
```

**Expected Distribution:**
- Pending: ~60%
- Approved: ~30%
- Rejected: ~10%

### Sample Data Query
```sql
-- View periods with full context
SELECT 
  tp.id,
  o.name as org_name,
  pc.user_name,
  tp.week_start_date,
  tp.total_hours,
  tp.status
FROM timesheet_periods tp
JOIN project_contracts pc ON tp.contract_id = pc.id
JOIN organizations o ON pc.organization_id = o.id
ORDER BY o.name, pc.user_name
LIMIT 10;
```

---

## Row Level Security (RLS)

### Current RLS Policies

The migration includes **basic RLS policies** that allow authenticated users to read data. These are **placeholder policies** and should be customized based on your authentication system.

### TODO: Customize RLS Policies

**You MUST update these policies** before production:

1. **Identify your auth system**
   - Are you using Supabase Auth?
   - Custom JWT tokens?
   - Session-based auth?

2. **Update user ID matching**
   - Replace `auth.uid()::text` with your actual user ID retrieval
   - Currently allows all authenticated users (for testing)

3. **Add role-based policies**
   - Contractors can only view/edit their own timesheets
   - Managers can approve timesheets for their team
   - Finance can view all approved timesheets
   - Admins can do everything

### Example: Proper RLS Policy for Contractors

```sql
-- Replace placeholder policy with:
DROP POLICY "Users can read own contracts" ON project_contracts;

CREATE POLICY "Contractors can read own contracts"
  ON project_contracts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "Managers can read team contracts"
  ON project_contracts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('manager', 'owner', 'admin')
    )
  );
```

### Testing RLS Policies

```sql
-- Test as specific user (Supabase Dashboard SQL Editor)
SET request.jwt.claims ->> 'sub' = 'user-sarah';

-- This should only return Sarah's contracts
SELECT * FROM project_contracts;

-- Reset
RESET request.jwt.claims;
```

---

## Triggers & Auto-Updates

### Period Total Auto-Calculation

The migration includes a trigger that **automatically updates** `timesheet_periods.total_hours` and `total_days` whenever entries are added/updated/deleted:

```sql
-- Trigger: trigger_update_period_totals
-- Function: update_period_totals()
```

**Example:**
```sql
-- Insert new entry
INSERT INTO timesheet_entries (period_id, date, hours, task_description, billable)
VALUES ('period-acme-1-w1', '2025-01-11', 8.0, 'Testing', true);

-- Period total automatically updates from 40.0 to 48.0 ✅
SELECT total_hours FROM timesheet_periods WHERE id = 'period-acme-1-w1';
-- Result: 48.0
```

---

## Helper Functions

### `calculate_period_totals(period_id UUID)`

Manually recalculate totals for a specific period:

```sql
SELECT * FROM calculate_period_totals('period-acme-1-w1');
-- Returns: (total_hours: 40.0, total_days: NULL)
```

Use this if totals get out of sync (rare, but possible if triggers fail).

---

## Views

### `v_contracts_with_orgs`

Contracts joined with organization details:

```sql
SELECT * FROM v_contracts_with_orgs 
WHERE org_name = 'Acme Dev Studio'
LIMIT 5;
```

### `v_periods_full`

Periods with full contract and organization context:

```sql
SELECT 
  id,
  user_name,
  org_name,
  week_start_date,
  total_hours,
  status
FROM v_periods_full
WHERE status = 'pending'
ORDER BY week_start_date DESC;
```

---

## Troubleshooting

### Issue: "relation already exists"

**Cause:** Tables were created in a previous run  
**Solution:** Either:
1. Drop all tables and re-run:
   ```sql
   DROP TABLE IF EXISTS allocated_tasks, review_flags, attachments, 
     approval_history, timesheet_entries, timesheet_periods, 
     project_contracts, organizations CASCADE;
   ```
2. Or uncomment the `TRUNCATE` line in `002_seed_demo_data.sql` to clear data

### Issue: "permission denied for table"

**Cause:** RLS policies are blocking access  
**Solution:** 
1. Temporarily disable RLS for testing:
   ```sql
   ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
   -- (repeat for other tables)
   ```
2. Or run queries as `postgres` user (service role)

### Issue: Totals not updating automatically

**Cause:** Trigger might have failed to create  
**Solution:**
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'trigger_update_period_totals';

-- If missing, re-run trigger creation from migration file
```

### Issue: Foreign key constraint violation

**Cause:** Trying to insert data in wrong order  
**Solution:** Always seed in this order:
1. Organizations
2. Contracts
3. Periods
4. Entries (and all related tables)

---

## Next Steps After Migration

1. **Verify data in Supabase Dashboard**
   - Check Table Editor
   - Run verification queries above

2. **Update RLS policies** (IMPORTANT!)
   - Replace placeholder policies with real permissions
   - Test with different user roles

3. **Create API utilities** (Phase 2)
   - Implement `/utils/api/timesheets.ts`
   - Create React hooks for data fetching

4. **Update frontend components** (Phase 3)
   - Replace demo data imports with API calls
   - Add loading states

5. **Test end-to-end**
   - Load approval tab
   - Verify data displays correctly
   - Test approve/reject actions

---

## Rollback

To completely remove all tables and start over:

```sql
-- ⚠️ WARNING: This deletes ALL data!
DROP TABLE IF EXISTS 
  allocated_tasks,
  review_flags,
  attachments,
  approval_history,
  timesheet_entries,
  timesheet_periods,
  project_contracts,
  organizations
CASCADE;

DROP VIEW IF EXISTS v_contracts_with_orgs, v_periods_full CASCADE;
DROP FUNCTION IF EXISTS calculate_period_totals, update_period_totals, update_updated_at_column CASCADE;
```

Then re-run both migration files.

---

## Support

**Documentation:**
- `/docs/CURRENT_ARCHITECTURE.md` - System overview
- `/docs/OPTION_A_IMPLEMENTATION_CHECKLIST.md` - Full implementation guide

**Questions?**
- Check Supabase logs: Dashboard → Logs
- Check Postgres logs: Dashboard → Database → Logs
- Review RLS policies: Dashboard → Authentication → Policies

---

**Migration Status:** ✅ Ready to run  
**Next Action:** Execute migrations in Supabase Dashboard  
**Estimated Time:** 2-3 minutes
