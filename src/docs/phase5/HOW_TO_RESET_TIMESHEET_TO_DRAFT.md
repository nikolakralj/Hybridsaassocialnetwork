# How to Reset Timesheet to Draft

## 🎯 Three Ways to Reset a Timesheet

---

## Option 1: Use API Route (Easiest for Testing)

### New Route: `/reset-to-draft`

```bash
curl -X POST http://localhost:54321/functions/v1/make-server-f8b491be/timesheet-approvals/reset-to-draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "periodId": "period-test-001"
  }'
```

**What it does:**
- ✅ Deletes graph node
- ✅ Deletes all approval edges
- ✅ Resets Postgres status to 'draft'
- ✅ Clears review notes, approvers, etc.
- ✅ Ready to submit again!

**Response:**
```json
{
  "success": true,
  "message": "Timesheet reset to draft - ready to submit again"
}
```

---

## Option 2: Use Rejection Flow (Production-Like)

This is the **normal workflow** - managers reject timesheets that need changes:

```bash
# Submit timesheet
curl -X POST .../timesheet-approvals/submit \
  -H "Content-Type: application/json" \
  -d '{
    "periodId": "period-test-001",
    "userId": "user-alice"
  }'

# Reject it (sends back to draft with 'rejected' status)
curl -X POST .../timesheet-approvals/reject \
  -H "Content-Type: application/json" \
  -d '{
    "periodId": "period-test-001",
    "approverId": "user-bob",
    "approverName": "Bob Manager",
    "reason": "Please add more task details for Nov 5-6"
  }'
```

**What happens:**
- Status = `rejected` (not `draft`)
- Contractor can edit entries
- Contractor can resubmit
- Version increments on resubmit
- Review notes preserved

**Difference from Option 1:**
- Rejection preserves audit trail (who rejected, when, why)
- Reset wipes everything clean

---

## Option 3: Direct SQL (Quick & Dirty)

Run in **Supabase SQL Editor**:

```sql
-- Reset specific period
UPDATE timesheet_periods 
SET 
  status = 'draft',
  current_approval_step = 1,
  reviewed_by = NULL,
  reviewed_at = NULL,
  review_notes = NULL,
  graph_node_id = NULL,
  submitted_at = NULL
WHERE id = 'period-test-001';

-- Clean up graph nodes (optional but recommended)
DELETE FROM kv_store_f8b491be 
WHERE key LIKE 'graph:node:ts-%' 
   OR key LIKE 'graph:edge:%';
```

**When to use:**
- Quick testing iterations
- Resetting test data
- Debugging graph issues

---

## 📋 Complete Test Cycle

### Full Workflow Test

```bash
# 1. Seed data (one-time)
# Use Database Setup Page in the app

# 2. Reset to draft (if needed)
curl -X POST .../reset-to-draft -d '{"periodId": "period-test-001"}'

# 3. Submit timesheet
curl -X POST .../submit -d '{"periodId": "period-test-001", "userId": "user-alice"}'

# 4. Get Bob's pending approvals
curl .../my-approvals/user-bob

# 5. Approve as Bob
curl -X POST .../approve -d '{
  "periodId": "period-test-001",
  "approverId": "user-bob",
  "approverName": "Bob Manager",
  "comment": "Looks good!"
}'

# 6. Approve as Carol (if 2-step approval)
curl -X POST .../approve -d '{
  "periodId": "period-test-001",
  "approverId": "user-carol",
  "approverName": "Carol Client",
  "comment": "Approved for payment"
}'

# 7. Verify fully approved
# Check Postgres: status = 'manager_approved'
# Check graph: status = 'approved'
```

---

## 🔄 Rejection & Resubmit Cycle

```bash
# 1. Submit
curl -X POST .../submit -d '{"periodId": "period-test-001", "userId": "user-alice"}'

# 2. Reject
curl -X POST .../reject -d '{
  "periodId": "period-test-001",
  "approverId": "user-bob",
  "approverName": "Bob Manager",
  "reason": "Missing details"
}'

# 3. Alice fixes entries (use Timesheets tab)
# Status is 'rejected', so entries are editable

# 4. Resubmit (version will increment to 2)
curl -X POST .../submit -d '{"periodId": "period-test-001", "userId": "user-alice"}'

# 5. Approve
curl -X POST .../approve -d '{...}'
```

---

## 🧪 Testing Different Scenarios

### Single-Step Approval (Manager Only)

```sql
-- Create contract without client approval
UPDATE project_contracts 
SET requires_client_approval = false
WHERE id = 'contract-test-001';

-- Reset timesheet
curl -X POST .../reset-to-draft -d '{"periodId": "period-test-001"}'

-- Submit (will only have 1 approval step)
curl -X POST .../submit -d '{"periodId": "period-test-001", "userId": "user-alice"}'

-- Approve (fully approved after 1 step!)
curl -X POST .../approve -d '{
  "periodId": "period-test-001",
  "approverId": "user-bob",
  "approverName": "Bob Manager"
}'
```

### Two-Step Approval (Manager + Client)

```sql
-- Create contract with client approval
UPDATE project_contracts 
SET requires_client_approval = true
WHERE id = 'contract-test-001';

-- Reset and submit
curl -X POST .../reset-to-draft -d '{"periodId": "period-test-001"}'
curl -X POST .../submit -d '{"periodId": "period-test-001", "userId": "user-alice"}'

-- Step 1: Manager approves
curl -X POST .../approve -d '{
  "periodId": "period-test-001",
  "approverId": "user-bob",
  "approverName": "Bob Manager"
}'
# Response: { "fullyApproved": false, "nextStep": 2 }

-- Step 2: Client approves
curl -X POST .../approve -d '{
  "periodId": "period-test-001",
  "approverId": "user-carol",
  "approverName": "Carol Client"
}'
# Response: { "fullyApproved": true, "nextStep": null }
```

---

## 🎯 When to Use Each Option

| Scenario | Best Option | Why |
|----------|-------------|-----|
| **Testing submit flow repeatedly** | Option 1 (API) | Fast, clean slate |
| **Testing rejection handling** | Option 2 (Reject) | Real workflow |
| **Debugging graph issues** | Option 3 (SQL) | Direct control |
| **Production workflow** | Option 2 (Reject) | Audit trail preserved |
| **QA testing** | Option 2 (Reject) | Matches real usage |

---

## 🔍 Verify State

### Check Postgres

```sql
SELECT 
  id,
  status,
  current_approval_step,
  total_approval_steps,
  reviewed_by,
  graph_node_id,
  submitted_at,
  reviewed_at
FROM timesheet_periods
WHERE id = 'period-test-001';
```

**Expected after reset:**
```
status = 'draft'
current_approval_step = 1
reviewed_by = NULL
graph_node_id = NULL
submitted_at = NULL
reviewed_at = NULL
```

### Check Graph

```sql
-- Check if graph nodes exist
SELECT key, value->>'nodeType', value->'properties'->>'status'
FROM kv_store_f8b491be
WHERE key LIKE 'graph:node:ts-%';

-- Check approval edges
SELECT key, value->'metadata'->>'status'
FROM kv_store_f8b491be
WHERE key LIKE 'graph:edge:%:requires_approval:%';
```

**Expected after reset:**
- No rows (graph cleaned up)

**Expected after submit:**
- 1 node with status = 'submitted'
- 1-2 edges with status = 'pending'

---

## ✅ Summary

**Fastest way to reset:**
```bash
curl -X POST http://localhost:54321/functions/v1/make-server-f8b491be/timesheet-approvals/reset-to-draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"periodId": "period-test-001"}'
```

**Then submit again:**
```bash
curl -X POST http://localhost:54321/functions/v1/make-server-f8b491be/timesheet-approvals/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"periodId": "period-test-001", "userId": "user-alice"}'
```

**No reseeding required!** 🎉
