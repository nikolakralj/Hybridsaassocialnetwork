# ⚠️ IMPORTANT: Test Mode Data Limitation

## Current Status

The persona test mode is **PARTIALLY WORKING** with the following limitation:

### ✅ What Works:
- Persona switcher in top nav
- Test mode banner
- Backend KV storage (approval items, tokens, timesheet periods)
- Approval execution via backend APIs
- Email sending (to console in test mode)

### ❌ What Doesn't Work Yet:
**The Project Timesheets view still shows NO DATA (or old mock data)**

### Why?

The system has **two separate data sources**:

1. **KV Store** (where the seeder saves data)
   - Used for: Approval items, approval tokens, timesheet summaries
   - ✅ Working with test personas

2. **Postgres Tables** (where the UI loads from)
   - Used for: Organizations, ProjectContracts, TimesheetPeriods, TimesheetEntries
   - ❌ Empty (no migrations allowed per your requirements)

The `ProjectTimesheetsView` component loads from Postgres via:
```
useApprovalsData() → fetchOrganizations() → Supabase.from('organizations')
```

But the seeder stores in:
```
KV store → kv.set('timesheet_period:...', data)
```

### Solutions:

#### Option 1: Use Postgres (Recommended for Real Testing)
Follow the Database Setup guide to create and populate Postgres tables:
1. Go to `/setup`
2. Run the SQL migrations
3. Seed demo data  
4. **Then** the persona filtering will work

#### Option 2: Mock Data Only (Quick Test)
The persona filter **IS** working - it just has no real data to filter.
You can validate the filtering logic works by checking console logs:
```
[TEST MODE] Filtering 3 orgs for persona: Alice Chen (contractor)
[TEST MODE] Contractor filtered: 0 contracts  ← No data in Postgres!
```

#### Option 3: Bypass Postgres (Not Recommended)
We could modify `fetchOrganizations()` to read from KV instead of Postgres, but:
- This creates technical debt
- The real app will use Postgres in production
- Better to test with real data architecture

---

## Recommended Testing Flow

###For Full End-to-End Testing:

1. **Setup Postgres** (one-time):
   ```
   Go to /setup → Run SQL → Seed Demo Data
   ```

2. **Switch Personas**:
   - Select "Alice Chen" (Contractor)
   - Go to "Projects" → "Timesheets"
   - ✅ Should see ONLY Alice's timesheets

3. **Test Approval Flow**:
   - Switch to "Bob Martinez" (Manager)
   - Go to "✅ My Approvals"
   - Approve Alice's timesheet
   - Switch to "Charlie Davis" (Client)
   - Final approval

### For Quick Persona Switching Test:

If you just want to validate the persona switcher UI works:
1. Switch between personas - dropdown works ✅
2. Check console for filtering logs ✅
3. Banner shows test mode warning ✅

But you won't see actual timesheet data without Postgres.

---

## Next Steps

**If you want to proceed with full testing:**
→ Set up Postgres tables as described in `/docs/guides/DATABASE_SETUP_GUIDE.md`

**If Postgres setup is blocked:**
→ We can create a "Mock Mode" toggle that uses in-memory test data

**If you're satisfied with partial validation:**
→ Mark Phase 5 as "Persona switcher implemented, pending Postgres for full E2E test"

---

**Created:** 2025-11-13  
**Status:** Persona filtering logic implemented, waiting for Postgres data
