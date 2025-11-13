# 🔧 Database Setup Page

## Location

**URL:** `/setup`

**Component:** `/components/DatabaseSetupPage.tsx`

---

## What It Does

This is the **ONLY** setup page you need. It combines all setup tasks into one unified interface:

### ✅ Step 1: Create Postgres Tables
- Checks if production tables exist
- Shows copy-paste SQL if they don't
- Tables: `organizations`, `projects`, `project_contracts`, `timesheet_periods`, `timesheet_entries`

### ✅ Step 2: Seed Demo Data
- Creates test personas (Alice, Bob, Charlie)
- Creates sample timesheet (40h @ $150/hr = $6,000)
- Populates all relationships

### ✅ Step 3: Create Approval Workflow (Optional)
- Generates KV tokens for email-based approvals
- Links to the Postgres timesheet data

### ✅ Step 4: Clear Test Data
- Removes approval tokens from KV
- Keeps Postgres data intact

---

## How to Access

### From Dev Nav:
Click **"🔧 Database Setup"** in the top developer navigation bar

### Direct URL:
Go to `/setup` in your browser

### From Error Messages:
If tables are missing, you'll see a button: **"Go to Database Setup"**

---

## Deleted Old Pages

These pages have been **REMOVED** (consolidated into `/setup`):

- ❌ `/components/ApprovalTestDataSeeder.tsx`
- ❌ `/components/DatabaseSetup.tsx`
- ❌ `/components/DatabaseSetupGuide.tsx`
- ❌ `/components/EmailTest.tsx`
- ❌ `/components/timesheets/DatabaseSyncTest.tsx`

**Reason:** Too many scattered test pages. Now there's just ONE.

---

## Architecture Reminder

### Production Data (Postgres):
```
✅ organizations
✅ projects
✅ project_contracts
✅ timesheet_periods
✅ timesheet_entries
```

### Temporary Workflow (KV Store):
```
⏱️ approval_token:*
⏱️ approval_item:*
```

---

## Next Steps After Setup

1. ✅ Click "Check Tables" to verify Postgres schema
2. ✅ Click "Seed Demo Data" to create Alice, Bob, Charlie
3. ✅ Switch to **Alice** persona (top nav)
4. ✅ Go to **Projects** → **Timesheets**
5. ✅ You should see ONLY Alice's timesheet!
6. ✅ Switch to **Bob** → See ALL timesheets in "My Approvals"
7. ✅ Test the approval flow!

---

**Created:** 2025-11-13  
**Status:** Single unified setup page ✅
