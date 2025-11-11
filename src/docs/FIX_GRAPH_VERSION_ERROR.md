# Fix: "column graph_version_id does not exist" Error

## Quick Fix (2 minutes)

You're getting this error because your `timesheet_periods` table already exists but doesn't have the new `graph_version_id` column.

### Solution: Run the Migration Script

1. **Go to your app at `/setup`**
2. **Look for the orange box** that says "Already Have Tables? Use Migration Script"
3. **Click "Copy Migration"** button
4. **Open Supabase SQL Editor** (click the link on the page)
5. **Paste the script and click RUN**
6. **Wait for success message:** "✅ Migration complete!"
7. **Reload the app**
8. **Click "Seed Database"**
9. **Done!** ✅

---

## What the Migration Does

The migration script:
- ✅ Creates the `graph_versions` table
- ✅ Adds `graph_version_id` column to `timesheet_periods`
- ✅ Adds `approved_at` column to `timesheet_periods`
- ✅ Adds `updated_at` column to `timesheet_periods`
- ✅ Creates the `timesheet_entries` table for task tracking
- ✅ Creates indexes for performance
- ✅ Sets up triggers for auto-calculation
- ✅ **Does NOT delete any existing data**

---

## If You Want a Fresh Start

If you want to start completely fresh (this will delete all data):

### Option 1: Drop and Recreate (Fresh Start)

```sql
-- ⚠️ WARNING: This deletes ALL data!
DROP TABLE IF EXISTS timesheet_entries CASCADE;
DROP TABLE IF EXISTS timesheet_periods CASCADE;
DROP TABLE IF EXISTS graph_versions CASCADE;
DROP TABLE IF EXISTS project_contracts CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
```

Then use the **full setup script** (Step 1 on the `/setup` page).

### Option 2: Use Migration (Keep Data)

Use the **migration script** (orange box on `/setup` page) to add missing columns without deleting data.

---

## Troubleshooting

### Error: "relation already exists"
**Solution:** The script is safe to run multiple times. It uses `IF NOT EXISTS` checks.

### Error: "table does not exist"
**Solution:** You need to run the full setup script first (Step 1), not the migration.

### Error: "permission denied"
**Solution:** Make sure you're logged into Supabase and running the script in YOUR project's SQL editor.

### Still seeing the error after running migration?
1. Hard reload the page (Ctrl+Shift+R or Cmd+Shift+R)
2. Check Supabase Table Editor to verify `graph_versions` table exists
3. Check that `timesheet_periods` has the `graph_version_id` column
4. Try running the seed script again

---

## Verify It Worked

After running the migration, verify in Supabase:

### Check Tables Exist
Go to **Table Editor** in Supabase and verify you see:
- ✅ organizations
- ✅ project_contracts
- ✅ graph_versions (NEW)
- ✅ timesheet_periods
- ✅ timesheet_entries (NEW)

### Check Columns Exist
Click on `timesheet_periods` table and verify columns:
- ✅ id
- ✅ contract_id
- ✅ week_start_date
- ✅ week_end_date
- ✅ total_hours
- ✅ status
- ✅ submitted_at
- ✅ **graph_version_id** (NEW)
- ✅ **approved_at** (NEW)
- ✅ **updated_at** (NEW)
- ✅ created_at

### Test Query
Run this in SQL Editor:
```sql
SELECT COUNT(*) FROM graph_versions;
```

If you get a number (even 0), it worked! If you get an error, the table doesn't exist yet.

---

## Complete Success Checklist

- [ ] Migration script copied
- [ ] Pasted in Supabase SQL Editor
- [ ] Clicked RUN
- [ ] Saw "✅ Migration complete!" message
- [ ] Reloaded the app
- [ ] Clicked "Seed Database" button
- [ ] Saw success toast: "4 orgs, 10 contracts, 40 periods"
- [ ] Navigated to Timesheets tab
- [ ] See real contractor names (Sarah Johnson, Mike Chen, etc.)
- [ ] No more errors in console ✅

---

## Why This Happened

You created the database tables **before** we added the temporal graph versioning feature. The `CREATE TABLE IF NOT EXISTS` statement in the full script skips creating tables that already exist, so your existing table didn't get the new columns.

The migration script uses `ALTER TABLE ADD COLUMN IF NOT EXISTS` to safely add columns to existing tables without losing data.

---

## Need More Help?

Check these docs:
- `/docs/TEMPORAL_GRAPH_VERSIONING.md` - Understand how versioning works
- `/docs/TIMESHEET_ARCHITECTURE.md` - Two-level timesheet system explained
- `/docs/QUICK_FIX_SUMMARY.md` - Complete fix summary

Or ask for help with:
- Screenshots of the error
- Your Supabase table structure
- Console error messages
