# ✅ CORRECT Architecture: Postgres + KV (Not Just KV)

**Date:** 2025-11-13  
**You were RIGHT:** Use Postgres tables (production architecture), not KV for timesheets!

---

## 🎯 The Correct Architecture

### Production Data (Postgres) ✅

**Everything lives in Postgres except temporary workflow tokens:**

```sql
-- Organizations (companies, agencies)
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL -- 'company', 'agency', 'client'
);

-- User contracts with projects
CREATE TABLE project_contracts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  project_id UUID NOT NULL,
  hourly_rate DECIMAL NOT NULL,
  start_date DATE NOT NULL
);

-- Timesheet periods (weekly/monthly summaries)
CREATE TABLE timesheet_periods (
  id UUID PRIMARY KEY,
  contract_id UUID REFERENCES project_contracts(id),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_hours DECIMAL NOT NULL,
  status TEXT NOT NULL, -- 'draft', 'submitted', 'approved', 'rejected'
  submitted_at TIMESTAMP
);

-- Daily time entries
CREATE TABLE timesheet_entries (
  id UUID PRIMARY KEY,
  period_id UUID REFERENCES timesheet_periods(id),
  entry_date DATE NOT NULL,
  hours DECIMAL NOT NULL,
  description TEXT
);
```

### Temporary Workflow Data (KV Store) ⏱️

**ONLY approval tokens and temporary state:**

```typescript
// One-time approval tokens (7-day expiry)
kv.set('approval_token:abc123', {
  id: 'abc123',
  approval_item_id: 'item-001',
  approver_id: 'bob-id',
  action: 'approve',
  expires_at: '2025-11-20',
  used_at: null
});

// Temporary approval workflow state
kv.set('approval_item:item-001', {
  id: 'item-001',
  timesheet_period_id: 'period-123', // References Postgres!
  current_approver_id: 'bob-id',
  next_approver_id: 'charlie-id',
  status: 'pending'
});
```

---

## 🚀 How Data Flows

### 1. **Timesheet Creation (Alice - Contractor):**
```
Alice creates timesheet
  ↓
POST /timesheets → Postgres
  ↓
INSERT INTO timesheet_periods (status='draft')
INSERT INTO timesheet_entries (hours, date)
  ↓
Alice clicks "Submit for Approval"
  ↓
UPDATE timesheet_periods SET status='submitted'
```

### 2. **Approval Request (System):**
```
System creates approval workflow
  ↓
POST /approvals → KV Store
  ↓
kv.set('approval_item:...', {
  timesheet_period_id: 'period-123', // References Postgres row
  current_approver: Bob
})
kv.set('approval_token:approve-...', {...})
kv.set('approval_token:reject-...', {...})
  ↓
Send email to Bob with token links
```

### 3. **Approval Execution (Bob - Manager):**
```
Bob clicks "Approve" link in email
  ↓
GET /approve/:token → Validate KV token
  ↓
POST /approvals/execute
  ↓
1. Mark token as used in KV
2. Update Postgres: timesheet_periods.status = 'manager_approved'
3. Move to next approver (Charlie) in KV
4. Send email to Charlie
```

### 4. **Final Approval (Charlie - Client):**
```
Charlie clicks "Approve"
  ↓
Same flow as above
  ↓
Final UPDATE: timesheet_periods.status = 'fully_approved'
  ↓
Delete approval_item from KV (workflow complete)
Keep tokens for audit trail (7-day expiry)
```

---

## 📊 Why This Architecture?

### Postgres (Permanent):
✅ Source of truth for all business data  
✅ Supports complex queries (reports, analytics)  
✅ Relational integrity (foreign keys)  
✅ Audit trails and history  
✅ Production-ready, scalable  

### KV Store (Temporary):
✅ Fast key-value access for workflow state  
✅ Automatic expiration (no cleanup needed)  
✅ Simple token validation  
✅ Lightweight temporary cache  
❌ **NOT** suitable for permanent data  

---

## 🎨 Test Mode Persona Filtering

The persona filter works by querying Postgres and filtering results:

```typescript
// In useApprovalsData() hook:
function useApprovalsData() {
  // 1. Load ALL data from Postgres
  const organizations = fetchOrganizations(); // Postgres
  const contracts = fetchAllContracts(); // Postgres
  const periods = fetchPeriodsByContract(); // Postgres
  
  // 2. Filter based on current persona (TEST MODE)
  const { currentPersona } = usePersona();
  
  if (currentPersona.role === 'contractor') {
    // Alice only sees HER contracts
    return contracts.filter(c => c.userId === alice.id);
  }
  
  if (currentPersona.role === 'manager' || 'client') {
    // Bob and Charlie see ALL contracts (for approval)
    return contracts; // No filter
  }
}
```

**This is why you need Postgres set up first!**  
Without Postgres data, there's nothing to filter.

---

## ✅ Your Setup Steps

1. **Go to `/setup` page**
2. **Run SQL migrations** (creates Postgres tables)
3. **Seed demo data** (adds Alice, Bob, Charlie + timesheets)
4. **Switch to Alice** → See ONLY her timesheet ✅
5. **Switch to Bob** → See ALL timesheets (for approval) ✅
6. **Test approval flow** → Bob approves → Charlie approves ✅

---

## 🐛 Common Misunderstanding

❌ **WRONG:** "Store everything in KV"
```typescript
kv.set('timesheet_period:...', { hours: 40, rate: 150 }) // ❌ Bad!
```

✅ **CORRECT:** "Store timesheets in Postgres, tokens in KV"
```typescript
// Postgres (permanent)
INSERT INTO timesheet_periods VALUES (...);

// KV (temporary workflow)
kv.set('approval_token:...', { expires_at: '+7 days' });
```

---

## 📝 Phase 9 Changes

When you implement **real auth** in Phase 9:

### Remove:
- ❌ Persona switcher component
- ❌ Test mode banner
- ❌ Manual persona filtering in hooks

### Add:
- ✅ Supabase Auth (signup, login, logout)
- ✅ Real user sessions
- ✅ Row-level security (RLS) in Postgres
- ✅ JWT-based authorization

### Data stays the same:
- ✅ Postgres tables unchanged
- ✅ KV store usage unchanged
- ✅ Approval workflow unchanged

---

**You are CORRECT:** Use Postgres for production data! 🎯

**Created:** 2025-11-13  
**Status:** Architecture clarified and documented
