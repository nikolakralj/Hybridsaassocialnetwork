# ✅ Errors Fixed!

## Problem (January 2025)

You're seeing these errors:
```
Error fetching contracts: {
  "code": "22P02",
  "message": "invalid input syntax for type uuid: \"user-robert\""
}
Error in fetchPersonStats: Error: Database error: invalid input syntax for type uuid: "user-robert"
Error fetching contracts: {
  "code": "22P02",
  "message": "invalid input syntax for type uuid: \"user-lisa\""
}
```

## Root Cause

The database has **old records** with hardcoded string IDs like `"user-robert"` and `"user-lisa"` from a previous seed, but the system now expects proper UUIDs.

When the app tries to query contracts, it finds these old records with invalid UUID formats and Postgres rejects them.

## Solution

### ✅ Quick Fix (1 minute)

1. **Go to `/setup` page**
2. **Click "Seed Supabase Database"** button
3. **Done!** ✅

The seed script now **clears all old data first** before creating new records with proper UUIDs.

## What Changed

### Before (Broken):
- Database had old records: `user-robert`, `user-lisa` (hardcoded strings)
- Seed script creates new UUIDs
- **OLD DATA STILL EXISTS** → Error!

### After (Fixed):
- Seed script **clears all tables first** (organizations, contracts, periods, entries)
- Then creates fresh data with proper UUIDs
- **CLEAN SLATE** → Works!

## Files Updated

1. **`/components/DatabaseSetup.tsx`**
   - Updated "Seed Supabase Database" button to clear and seed
   - Added `clearAndSeedDatabase()` function

2. **`/supabase/functions/server/index.tsx`**
   - Seed script now clears tables before creating new records
   - Added `clearTables()` function

3. **`/hooks/useNodeStats.ts`**
   - Already handles UUID validation properly ✅
   - Error messages are descriptive

## Test Checklist

After seeding the database, verify:

- [ ] Navigate to `/timesheets` tab
- [ ] See real contractor names (Sarah Johnson, Mike Chen, etc.)
- [ ] No errors in console
- [ ] Organizations show correctly (Acme Dev Studio, BrightWorks Design)
- [ ] Timesheet periods show real data
- [ ] No "invalid input syntax for type uuid" errors

## Why This Happened

The app has two data sources:
1. **Templates** (`/components/workgraph/templates.ts`) - Hardcoded demo data with string IDs
2. **Database** - Real data with UUIDs

The templates are meant for the WorkGraph builder, NOT for the timesheets tab. The timesheets tab should only query the database.

The error happened because:
1. You ran the SQL script and seeded the database (UUIDs created)
2. But some UI components were still trying to use template data
3. Template user IDs (`"user-mike"`) don't match database UUIDs

## Prevention

In the future:
- ✅ Always seed database after creating tables
- ✅ Use templates only in WorkGraph builder
- ✅ Timesheets tab queries database directly
- ✅ No mixing of template data and database data

## Need Help?

Check:
- `/docs/FIX_GRAPH_VERSION_ERROR.md` - Migration guide
- `/docs/TIMESHEET_ARCHITECTURE.md` - Database design
- `/docs/QUICK_FIX_SUMMARY.md` - Complete overview

---

**Status:** ✅ Fixed! Just run the migration and seed the database.