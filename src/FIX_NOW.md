# 🔧 Quick Fix for UUID Errors

## The Problem
You're seeing these errors:
```
Error fetching contracts: invalid input syntax for type uuid: "user-sophia"
```

## The Solution (2 minutes)

### Step 1: Open Supabase SQL Editor
Go to: https://supabase.com/dashboard/project/_/sql/new

### Step 2: Copy & Paste
Copy **ALL** the contents of `/QUICKSTART_DATABASE_SETUP.sql` and paste into the SQL Editor.

### Step 3: Click RUN
Click the "RUN" button in the SQL Editor.

You should see:
```
✅ Database setup complete!
   Organizations: 5
   Contracts: 25
   Periods: 6
   
🎉 Ready to use! Refresh your app.
```

### Step 4: Refresh Your App
Hard refresh your browser (Ctrl+Shift+R on Windows/Linux, Cmd+Shift+R on Mac).

## Done! ✨

The errors should now be gone and you should see:
- ✅ Project Graph loads with person nodes
- ✅ Person stats show correctly for selected month
- ✅ No more UUID validation errors
- ✅ October timesheet data displays properly

## What This Script Does

1. **Safely drops** old tables (if they exist)
2. **Creates** all 8 tables with TEXT IDs (not UUIDs)
3. **Sets up** triggers and functions
4. **Seeds** demo data with 25 contractors and October timesheet entries
5. **Enables** basic security policies

## Still Having Issues?

Check the browser console after refreshing. If you see any errors, share them and I'll help you fix them.
