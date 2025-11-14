# Quick Reset Guide - Testing Approvals

## ✅ **Easiest Way: Use the Button in Approvals Tab**

1. Go to **My Approvals** tab
2. Look at the top right, next to the badges
3. Click **"Reset Test Data"** button
4. Page will reload automatically
5. Done! Status is back to `draft` ✅

---

## 📊 **What Gets Reset?**

### Postgres Database
```
timesheet_periods table:
  - status: 'manager_approved' → 'draft'
  - current_approval_step: 2 → 1
  - reviewed_by: null
  - reviewed_at: null
  - review_notes: null
  - graph_node_id: null
```

### KV Store (Graph Nodes)
```
Deleted:
  - graph:node:ts-2025-11-04-alice
  - graph:edge:ts-2025-11-04-alice:requires_approval:user-bob:step1
  - All related graph edges
```

---

## 🔄 **Testing Workflow After Reset**

### Test 1: Submit → Approve
```
1. Click "Reset Test Data"
2. Status is now 'draft'
3. Submit timesheet (triggers graph creation)
4. Switch to Bob (Manager)
5. Go to My Approvals
6. Click Approve
7. Status becomes 'manager_approved' ✅
```

### Test 2: Submit → Reject
```
1. Click "Reset Test Data"
2. Submit timesheet
3. Switch to Bob
4. Click Reject
5. Add rejection reason
6. Status becomes 'rejected'
7. Alice can edit and resubmit ✅
```

### Test 3: Multi-Step Approval
```
1. Click "Reset Test Data"
2. Submit timesheet
3. Bob approves (step 1)
4. Status: 'manager_approved'
5. Charlie approves (step 2, if configured)
6. Status: 'client_approved' or 'fully_approved' ✅
```

---

## 🎯 **Two Ways to Reset**

### Option 1: Button in Approvals Tab (Recommended)
- **Location:** My Approvals tab → Top right → "Reset Test Data" button
- **Pros:** Super easy, one click, auto-reload
- **Cons:** Only resets the test timesheet (period-test-001)

### Option 2: Database Setup Page
- **Location:** Database Setup page → "Reset Timesheet to Draft" section
- **Pros:** Can see detailed response
- **Cons:** Need to navigate to a different page

---

## 🔍 **Verify the Reset Worked**

### Check in UI
```
1. Go to My Approvals tab
2. Look at Alice's timesheet
3. Status badge should say "Draft" (gray)
4. NOT "Manager Approved" (green)
```

### Check in Supabase (Optional)
```
1. Go to Supabase → Table Editor
2. Open timesheet_periods table
3. Find row with id = 'period-test-001'
4. Check status column = 'draft'
5. Check graph_node_id = null

6. Go to KV Store table (kv_store_f8b491be)
7. Filter by key starting with 'graph:'
8. Should see NO entries for 'ts-2025-11-04-alice'
```

---

## ⚠️ **Troubleshooting**

### "Failed to reset" error
**Problem:** API call failed  
**Solution:** 
1. Check browser console for errors
2. Make sure backend server is running
3. Try the Database Setup Page button instead

### Button doesn't appear
**Problem:** Code not updated  
**Solution:** 
1. Refresh the page (hard refresh: Cmd+Shift+R / Ctrl+Shift+R)
2. Clear browser cache
3. Check that the file was saved

### Status still shows "Manager Approved"
**Problem:** Page didn't reload or cache issue  
**Solution:** 
1. Manually refresh the page
2. Check Postgres directly in Supabase
3. If status IS draft in DB, it's just a UI cache issue

### Graph nodes still exist
**Problem:** Deletion didn't work  
**Solution:** 
1. Check backend logs
2. Manually delete from KV store in Supabase
3. SQL: `DELETE FROM kv_store_f8b491be WHERE key LIKE 'graph:%';`

---

## 💡 **Pro Tips**

### Reset Often
- Reset before each test run
- Keeps data clean and predictable
- Avoids confusion about state

### Use Console Logs
- Open browser console (F12)
- See detailed logs about:
  - Graph node deletion
  - Postgres updates
  - API responses

### Test Different Flows
```
Round 1: Submit → Approve
Round 2: Submit → Reject → Resubmit → Approve
Round 3: Submit → Approve (Manager) → Approve (Client)
```

---

## 📋 **Quick Reference**

| Task | Action |
|------|--------|
| **Reset to draft** | Click "Reset Test Data" button |
| **Submit timesheet** | Use submit API or UI |
| **Approve as Bob** | Switch persona → My Approvals → Approve |
| **Reject as Bob** | Switch persona → My Approvals → Reject |
| **Check graph nodes** | Supabase → KV Store → filter "graph:" |
| **Check status** | Supabase → timesheet_periods → status column |

---

## ✅ **Summary**

**The Fastest Way:**
1. Click "Reset Test Data" in Approvals tab
2. Wait for reload
3. Test your approval flow again!

**No terminal, no SQL, no hassle!** 🎉
