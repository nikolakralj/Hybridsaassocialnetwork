# Easy UI Testing Guide - No Terminal Needed! 🎉

## ❌ You DON'T Need Bash/Terminal

All testing can be done through the **UI buttons** in the Database Setup Page!

---

## 🎯 Where to Go

1. **In the app**, look for a link/button to **"Database Setup"** 
2. Or navigate to the setup page (it should be accessible from your app's navigation)

---

## 📋 Step-by-Step Testing

### 1️⃣ First Time Setup

```
✅ Click "Check Tables"
   → Ensures Postgres tables exist
   → If missing, copy/paste SQL into Supabase

✅ Click "Seed Demo Data"
   → Creates Alice, Bob, Charlie
   → Creates test timesheet (40h @ $150/hr)
   → Status = 'submitted' (ready for approval)
```

### 2️⃣ Test Approval Flow

```
Switch to Bob (Manager)
   → Go to Approvals tab
   → See Alice's timesheet
   → Click Approve
   → Status changes to 'manager_approved'
```

### 3️⃣ Reset and Test Again

```
✅ Click "Reset Timesheet to Draft"
   → Clears graph nodes
   → Sets status back to 'draft'
   → Ready to submit again!

Now you can:
   → Test submit flow
   → Test approval flow
   → Test rejection flow
   → Repeat as many times as you want!
```

---

## 🖼️ About That Graph You Saw

The graph showing "15 Nodes, 20 Edges" is **NOT your timesheet data**.

**What it is:**
- The **WorkGraph Builder** component
- Loads a **default template** for project structure
- Shows example companies, contracts, timesheets
- It's a **planning tool**, not your actual data

**Your actual timesheet data:**
- Lives in Postgres tables
- Shows up in the Timesheets tab
- Shows up in the Approvals tab
- NOT in the graph builder

**To clear the graph:**
- That's just a UI template
- It will reset when you refresh the page
- It doesn't affect your timesheet data

---

## 🔄 Complete Testing Workflow

### Round 1: Submit → Approve

```
1. Database Setup Page
   ✅ Seed Demo Data (if not done already)

2. Switch to Alice
   → Projects → Timesheets
   → See timesheet (40h, status = 'submitted')

3. Switch to Bob
   → My Approvals
   → See Alice's timesheet
   → Click Approve

4. Done! Timesheet approved ✅
```

### Round 2: Reset & Test Rejection

```
1. Database Setup Page
   ✅ Reset Timesheet to Draft

2. Test rejection flow:
   - Submit as Alice (via API or UI)
   - Bob rejects with reason
   - Alice sees rejection notes
   - Alice edits and resubmits

3. Done! Tested rejection flow ✅
```

### Round 3: Test Graph-Based Approvals

```
1. Database Setup Page
   ✅ Reset Timesheet to Draft

2. Submit timesheet (triggers graph creation)
   - Graph node created: ts-2025-11-04-alice
   - Approval edges created
   - Email sent to Bob

3. Bob approves (graph edges update)
   - Edge status: pending → approved
   - Node moves to next step

4. Verify in Supabase KV:
   - graph:node:ts-2025-11-04-alice
   - graph:edge:ts-2025-11-04-alice:requires_approval:user-bob:step1
```

---

## 🎯 Common Tasks

| What You Want | What To Click |
|---------------|---------------|
| **Start fresh** | Reset Timesheet to Draft |
| **Test submit again** | Reset → then submit via UI |
| **Test rejection** | Reset → Submit → Bob rejects |
| **Clear everything** | Clear KV Data (danger zone) |
| **See approval chain** | Switch to Bob → My Approvals |
| **Check graph nodes** | Supabase → KV Store → filter "graph:" |

---

## 📊 Verify Everything Works

### Check Postgres

Go to Supabase → Table Editor:

```
timesheet_periods:
  - id: period-test-001
  - status: draft (after reset) or submitted (after submit)
  - graph_node_id: ts-2025-11-04-alice (after submit)

timesheet_entries:
  - 5 rows for Alice (Nov 4-8, 8h each)
```

### Check KV Store

Go to Supabase → KV Store (table: kv_store_f8b491be):

After submit, you should see:
```
graph:node:ts-2025-11-04-alice
  → Contains timesheet metadata

graph:edge:ts-2025-11-04-alice:requires_approval:user-bob:step1
  → Contains approval edge (status: pending)
```

After reset:
```
(no graph keys - all cleaned up)
```

---

## ⚡ Pro Tips

### ✅ DO Use UI Buttons
- Fast
- No typos
- Can't mess up the API call
- Visual feedback

### ❌ DON'T Use Bash
- Unless you're comfortable with curl
- Terminal not needed for basic testing

### 🔄 Reset Often
- Reset before each test
- Keeps data clean
- Prevents confusion

### 📝 Use the Personas
- Alice = Contractor (submits timesheets)
- Bob = Manager (approves first)
- Charlie = Client (approves second, if needed)

---

## 🚨 Troubleshooting

### "Period not found" error when resetting
**Problem:** The period ID doesn't match  
**Solution:** Check what period ID the seed data creates, update the reset function

### Graph still shows after reset
**Problem:** You're looking at the WorkGraph Builder template  
**Solution:** That's normal! It's not your timesheet data. Go to Timesheets tab instead.

### Can't approve timesheet
**Problem:** Wrong persona or timesheet not submitted  
**Solution:** 
1. Make sure timesheet is submitted (not draft)
2. Make sure you're Bob (the manager)
3. Check My Approvals tab

---

## ✅ Summary

**No bash needed!** Just use the Database Setup Page:

1. **Seed Demo Data** → Creates test data
2. **Reset Timesheet to Draft** → Resets for testing
3. **Clear KV Data** → Nuclear option (clears everything)

**Your timesheet data is in:**
- Postgres tables (timesheets tab)
- KV store (graph nodes, after submit)

**The graph builder is:**
- A separate planning tool
- Not your timesheet data
- Just a template

**Test as many times as you want without ever opening a terminal!** 🎉
