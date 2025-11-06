# ✅ Quick Test Checklist - WorkGraph Phase 5 Days 1-4

**Total Time:** 2-5 minutes  
**Goal:** Verify all Day 1-4 features work with no errors

---

## 🎯 THE 2-MINUTE CRITICAL PATH

### **Test 1: Navigate to My Approvals** (30 seconds)
```
1. Look at top navigation bar (dark gray)
2. Click "Navigate" button (top right)
3. Click "✅ My Approvals"

Expected Result:
✅ Approvals Workbench page loads
✅ See "My Approvals" heading
✅ See 18 pending items in queue
✅ Stats bar shows: 702.0h, $84.5k, 3 breached
✅ No console errors (press F12 to check)
```

**PASS/FAIL:** _______

---

### **Test 2: Open Graph Overlay** (30 seconds)
```
1. Find first item in queue (Jane Doe)
2. Click "View path on graph" button (has 👁️ icon)

Expected Result:
✅ Modal opens full screen (~95% of viewport)
✅ Shows "Approval Path on Graph" header
✅ Shows "Jane Doe [Senior Developer]"
✅ Shows "Mobile App Redesign"
✅ Shows "Step 2" badge
✅ Approval flow diagram visible
✅ Action bar at bottom with 3 buttons
✅ No console errors
```

**PASS/FAIL:** _______

---

### **Test 3: Approve from Graph** (30 seconds)
```
1. Click "Approve Now from Graph" button

Expected Result:
✅ Button shows "Approving..." with spinner
✅ Toast notification: "Approved from graph!"
✅ Toast shows: "Moving to step 3"
✅ Modal closes automatically
✅ Back at approvals queue
✅ Jane Doe item is GONE
✅ Pending count is now 17 (was 18)
✅ No console errors
```

**PASS/FAIL:** _______

---

### **Test 4: Verify Multiple Items** (30 seconds)
```
1. Click "View path on graph" on a DIFFERENT item
2. Check that modal shows different person/project
3. Press Escape key

Expected Result:
✅ Modal shows correct data for new item
✅ No data mixing (not Jane's data)
✅ Escape key closes modal
✅ Back at queue
✅ No console errors
```

**PASS/FAIL:** _______

---

## 🎉 SUCCESS CRITERIA

**If all 4 tests PASS:**
- ✅ Days 1-4 are working perfectly!
- ✅ Graph overlay integration is functional
- ✅ Ready to continue to Day 5 or test more features

**If any test FAILS:**
- ❌ Note which step failed
- ❌ Check console (F12) for error message
- ❌ Share error with team for debugging

---

## 🔍 EXTENDED TESTS (Optional - 5 more minutes)

### **Test 5: Filters** (1 minute)
```
1. Click "All Projects" dropdown
2. Select "Mobile App Redesign"
   ✅ Queue filters to matching items
   ✅ Count updates

3. Click "All Parties" dropdown
4. Select "TechCorp"
   ✅ Queue filters further
   ✅ Combines with project filter

5. Click "Clear Filters"
   ✅ Back to 17 items (or 18 if you didn't approve)
```

**PASS/FAIL:** _______

---

### **Test 6: Bulk Approve** (1 minute)
```
1. Click checkboxes on 2 items
   ✅ Checkboxes select
   ✅ "Approve Selected (2)" button appears

2. Click "Approve Selected (2)"
   ✅ Confirmation dialog
   ✅ Shows 2 items
   ✅ Shows total hours/amount

3. Click "Approve All"
   ✅ Loading state
   ✅ Success toast
   ✅ 2 items disappear
   ✅ Count decreases by 2
```

**PASS/FAIL:** _______

---

### **Test 7: Rate Masking** (30 seconds)
```
1. Scroll through queue
2. Find item with amount "$6,000"
3. Find item with amount "•••"

Expected Result:
✅ Some items show dollar amounts
✅ Some items show "•••" (masked)
✅ Masked items have "Rate masked" badge
✅ Can still approve masked items
```

**PASS/FAIL:** _______

---

### **Test 8: SLA Tracking** (30 seconds)
```
1. Look for items with red ⚠️ badge
2. Look for items with amber 🟡 badge
3. Look for items with green ✅ badge

Expected Result:
✅ Red = "SLA Breached" (overdue)
✅ Amber = "<24h" (due soon)
✅ Green = "OK" (plenty of time)
✅ Stats bar shows "3" breached items
```

**PASS/FAIL:** _______

---

### **Test 9: Reject Flow** (1 minute)
```
1. Open graph overlay on any item
2. Click "Reject" button
   ✅ Prompt appears: "Rejection reason:"

3. Enter "Test rejection"
4. Click OK
   ✅ Button shows "Rejecting..."
   ✅ Toast: "Rejected"
   ✅ Modal closes
   ✅ Item disappears from queue
```

**PASS/FAIL:** _______

---

### **Test 10: Projects List** (1 minute)
```
1. Navigate → "Projects"
   ✅ Projects grid loads
   ✅ See sample projects
   ✅ Each card shows name, members, dates

2. Click "Create Project"
   ✅ Wizard opens
   ✅ Shows 4 steps
   ✅ Can fill form

3. Click "Cancel"
   ✅ Back to projects list
```

**PASS/FAIL:** _______

---

## 📊 FINAL SCORE

**Critical Path (Required):**
- Test 1: Navigate to My Approvals [ PASS / FAIL ]
- Test 2: Open Graph Overlay [ PASS / FAIL ]
- Test 3: Approve from Graph [ PASS / FAIL ]
- Test 4: Multiple Items [ PASS / FAIL ]

**Total:** _____ / 4

**Extended Tests (Optional):**
- Test 5: Filters [ PASS / FAIL ]
- Test 6: Bulk Approve [ PASS / FAIL ]
- Test 7: Rate Masking [ PASS / FAIL ]
- Test 8: SLA Tracking [ PASS / FAIL ]
- Test 9: Reject Flow [ PASS / FAIL ]
- Test 10: Projects [ PASS / FAIL ]

**Total:** _____ / 6

---

## 🐛 ERROR TRACKING

**If you encounter errors, record them here:**

### Error 1:
```
Test: _________
Step: _________
Error message: _________
Screenshot: _________
```

### Error 2:
```
Test: _________
Step: _________
Error message: _________
Screenshot: _________
```

---

## ✅ NEXT STEPS

### **If 4/4 Critical Tests Pass:**
```
Option 1: Continue Testing
  → Run extended tests (5 more minutes)
  → Test edge cases
  → Test on mobile/different browsers

Option 2: Move to Day 5
  → Add keyboard shortcuts (a/r keys)
  → Add step badges on nodes
  → Add approval history

Option 3: Connect Real Database
  → Replace mocks with Supabase
  → Create real approval flow
  → Wire up timesheet submissions
```

### **If Any Critical Test Fails:**
```
1. Note which test failed
2. Check console (F12) for errors
3. Take screenshot
4. Share with team
5. Debug together
```

---

## 🎯 DEFINITION OF "DONE"

**Critical Path = PASS means:**
- ✅ Users can view approval queue
- ✅ Users can see visual approval flow
- ✅ Users can approve from graph
- ✅ No console errors
- ✅ UI is polished and professional
- ✅ Ready for Day 5 enhancements

**All 10 Tests = PASS means:**
- ✅ All Day 1-4 features work perfectly
- ✅ No bugs found
- ✅ Production-ready quality
- ✅ Can demo to stakeholders
- ✅ Ready to ship!

---

**Created:** November 6, 2025  
**Version:** 1.0  
**Status:** Ready to use

**Instructions:** Print this checklist, run through each test, mark PASS/FAIL, report results.
