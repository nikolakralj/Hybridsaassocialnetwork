# ✅ Postgres Setup for Test Mode (Phase 5)

## Architecture: Production-Ready

**You are CORRECT** - we use **Postgres tables** (production architecture), not KV store for timesheets!

### 🏗️ Data Architecture:

```
┌─────────────────────────────────────┐
│         POSTGRES (Production)        │
├─────────────────────────────────────┤
│ • organizations                     │
│ • project_contracts                 │
│ • timesheet_periods                 │
│ • timesheet_entries                 │
│ • projects                          │
│ • users (Phase 9)                   │
└─────────────────────────────────────┘
           ↓
    Real data storage
    
┌─────────────────────────────────────┐
│      KV STORE (Temporary only)      │
├─────────────────────────────────────┤
│ • approval_token:* (7-day expiry)   │
│ • approval_item:* (workflow state)  │
└─────────────────────────────────────┘
           ↓
    Approval workflow only
```

---

## 🚀 Setup Instructions

### Step 1: Go to `/setup` page

Navigate to the database setup page in your WorkGraph app.

### Step 2: Run SQL Migrations

Click the button to execute the Postgres schema creation. This creates all production tables.

**Tables created:**
- `organizations` - Companies, agencies, freelancer virtual orgs
- `projects` - Project metadata
- `project_contracts` - Links users to projects with rates
- `timesheet_periods` - Weekly/monthly summaries (with status: draft, submitted, approved)
- `timesheet_entries` - Daily time logs

### Step 3: Seed Demo Data

Run the seed script to populate with test data for **Alice, Bob, and Charlie**.

**Demo data includes:**
- ✅ 3 test users (Alice Chen, Bob Martinez, Charlie Davis)
- ✅ 2 organizations (Acme Dev Studio, BrightWorks Design)
- ✅ 1 test project (WorkGraph MVP)
- ✅ Timesheet periods for Alice (40h, $150/hr = $6000)
- ✅ Daily time entries (Mon-Fri, 8h each)

### Step 4: Verify Data

Check the Supabase UI or run queries to confirm:
```sql
SELECT * FROM organizations;
SELECT * FROM project_contracts;
SELECT * FROM timesheet_periods;
```

---

## 🎯 How Test Mode Works

### Frontend (React):
```tsx
useApprovalsData() 
  ↓
fetchOrganizations() → Supabase.from('organizations')
  ↓
fetchAllContracts() → Supabase.from('project_contracts')
  ↓
fetchPeriodsByContract() → Supabase.from('timesheet_periods')
```

### Persona Filter (TEST MODE):
```tsx
// In useApprovalsData() hook:
if (currentPersona.role === 'contractor') {
  // Show ONLY Alice's timesheets
  filter(contract => contract.userId === alice.id)
}
if (currentPersona.role === 'manager' || 'client') {
  // Show ALL timesheets (for approval)
  return allContracts;
}
```

### Approval Actions:
```
Bob clicks "Approve"
  ↓
POST /approvals-kv/execute
  ↓
KV: Update approval_item status
  ↓
Postgres: Update timesheet_periods.status = 'approved'
  ↓
Send email to next approver (Charlie)
```

---

## ✅ Expected Results After Setup

### 1. Switch to Alice (Contractor):
- Go to "Projects" → "Timesheets"
- ✅ See ONLY Alice Chen's timesheet (40h)
- ✅ Status: "Submitted" (waiting for approval)

### 2. Switch to Bob (Manager):
- Go to "✅ My Approvals"
- ✅ See Alice's pending timesheet
- ✅ Can approve to move to Charlie

### 3. Switch to Charlie (Client):
- Go to "✅ My Approvals"
- ✅ Initially empty
- ✅ After Bob approves, see Alice's timesheet
- ✅ Can give final approval

---

## 🐛 Troubleshooting

### "I don't see any timesheets"
**Problem:** Postgres tables are empty  
**Solution:** Go to `/setup` and run seed script

### "I see all contractors, not just Alice"
**Problem:** Persona filter not working  
**Solution:** Check console logs for `[TEST MODE] Filtering...` messages. Make sure persona switcher is active.

### "Seed button says 'Postgres not set up'"
**Problem:** Missing tables  
**Solution:** Run SQL migrations first (Step 2 above)

### "Database error when loading timesheets"
**Problem:** Table schema mismatch  
**Solution:** Drop existing tables and re-run migrations

---

## 📋 Test Checklist

- [ ] Postgres tables created via `/setup`
- [ ] Demo data seeded (Alice, Bob, Charlie)
- [ ] Alice sees only her timesheet (40h, $6000)
- [ ] Bob sees Alice's timesheet in "My Approvals"
- [ ] Persona switcher works (dropdown in header)
- [ ] Test mode banner is visible
- [ ] Console shows `[TEST MODE] Filtering...` logs

---

## 🎉 Once Working:

You have a fully functioning test environment with:
- ✅ Production Postgres schema
- ✅ Persona-based data filtering
- ✅ Real approval workflow (KV-based tokens)
- ✅ Email notifications (console logs for now)

**Phase 5 Complete!** 🚀

Next phase will add:
- Phase 6: Commercial controls (PO budgets, invoice tracking)
- Phase 9: Real authentication (Supabase Auth, no more persona switcher)

---

**Created:** 2025-11-13  
**Status:** Ready for Postgres setup  
**Architecture:** Production-ready, test-mode enabled
