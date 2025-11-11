# 🧪 Phase 3 Testing Guide: Timesheet Row Deep Links

**Feature:** Click a timesheet row → View that person's approval chain in Project Graph  
**Date:** 2025-01-07  
**Status:** ✅ READY TO TEST

---

## 🎯 **WHAT WE'RE TESTING**

### **Feature Overview:**
- ✅ "View on graph" menu item in timesheet row kebab menus
- ✅ Clicking opens Project Graph tab
- ✅ Graph focuses on the selected person's node
- ✅ Shows approval chain scope
- ✅ Optional: historical snapshot if timesheet was submitted

### **User Flow:**
```
1. Go to Project Workspace → Timesheets tab
2. Hover over any timesheet row
3. Click kebab menu (⋯)
4. See "View on graph" option (with Network icon)
5. Click "View on graph"
   ↓
6. Tab switches to "Project Graph"
7. Toast notification: "Opening Project Graph: approval chain view"
8. URL hash updates: #scope=approvals&focus=userId
9. Graph focuses on that person's node
10. Approval chain is highlighted
```

---

## 📋 **TEST CHECKLIST**

### **Test 1: Menu Item Appears** ✅
**Goal:** Verify the menu item is visible

**Steps:**
1. ✅ Go to **Project Workspace** → **Timesheets** tab
2. ✅ Hover over any timesheet row
3. ✅ Click the kebab menu (⋯) button

**Expected Result:**
- ✅ Menu opens with these options:
  1. 👁️ View Details
  2. 🕸️ **View on graph** ← NEW!
  3. ✅ Quick Approve (if pending)
  4. ❌ Request Changes (if pending)
  5. --- separator ---
  6. 📥 Download PDF
  7. 💬 Add Comment
  8. 📜 View History

**Pass Criteria:**
- [ ] "View on graph" appears second in the list
- [ ] Network icon (🕸️) shows next to text
- [ ] Text is "View on graph" (not "View in graph")

---

### **Test 2: Monthly View - Click Handler Works** ✅
**Goal:** Verify the deep link works in monthly view

**Steps:**
1. ✅ Go to **Timesheets** tab
2. ✅ Switch to **Month** view (if not already)
3. ✅ Find a timesheet row for "Sarah Chen" (or any contractor)
4. ✅ Hover → Click kebab menu (⋯)
5. ✅ Click **"View on graph"**

**Expected Result:**
- ✅ Toast notification appears: "Opening Project Graph: approval chain view"
- ✅ Tab automatically switches to **"Project Graph"**
- ✅ URL hash updates to: `#scope=approvals&focus=user-sarah`
- ✅ Graph focuses on Sarah's node
- ✅ Approval chain is visible

**Pass Criteria:**
- [ ] Toast shows for 2 seconds
- [ ] Tab switch is smooth (no page reload)
- [ ] URL hash contains `scope=approvals`
- [ ] URL hash contains `focus=user-sarah` (or appropriate userId)
- [ ] Graph highlights Sarah's node

---

### **Test 3: Weekly View - Click Handler Works** ✅
**Goal:** Verify the deep link works in weekly view

**Steps:**
1. ✅ Go to **Timesheets** tab
2. ✅ Switch to **Week** view
3. ✅ Find a timesheet row for "Marcus Rodriguez"
4. ✅ Hover → Click kebab menu (⋯)
5. ✅ Click **"View on graph"**

**Expected Result:**
- ✅ Toast notification appears
- ✅ Tab switches to **Project Graph**
- ✅ URL hash updates with Marcus's userId
- ✅ Graph focuses on Marcus's node

**Pass Criteria:**
- [ ] Works the same as monthly view
- [ ] No console errors
- [ ] Graph rendering is smooth

---

### **Test 4: Multiple Contractors** ✅
**Goal:** Verify it works for different people

**Steps:**
1. ✅ Click "View on graph" for **Sarah Chen**
2. ✅ Verify Sarah's node is focused
3. ✅ Go back to Timesheets tab
4. ✅ Click "View on graph" for **Marcus Rodriguez**
5. ✅ Verify Marcus's node is focused
6. ✅ Go back to Timesheets tab
7. ✅ Click "View on graph" for **Alex Kim**
8. ✅ Verify Alex's node is focused

**Expected Result:**
- ✅ Each person's node is correctly focused
- ✅ URL hash updates with correct userId each time
- ✅ Graph re-centers on the selected person

**Pass Criteria:**
- [ ] Focus changes for each person
- [ ] No stale data from previous selections
- [ ] Toast shows each time

---

### **Test 5: Historical Snapshot (asOf parameter)** 🔮
**Goal:** Verify historical snapshots work when available

**Steps:**
1. ✅ Find a timesheet that has `submittedAt` timestamp
2. ✅ Click "View on graph"
3. ✅ Check URL hash

**Expected Result:**
- ✅ URL hash includes: `#scope=approvals&focus=userId&asOf=2024-11-05`
- ✅ Graph shows historical snapshot (if implemented)
- ✅ Warning banner appears: "Viewing historical snapshot" (Phase 5 feature)

**Pass Criteria:**
- [ ] `asOf` parameter is present in URL
- [ ] Timestamp is correct (matches submission time)
- [ ] Future: Historical graph loads (Phase 5)

**Note:** Phase 5 (As-Of Snapshots) not implemented yet, so the asOf parameter will be in the URL but won't affect the graph yet.

---

### **Test 6: Menu Doesn't Interfere with Other Actions** ✅
**Goal:** Verify the new menu item doesn't break existing functionality

**Steps:**
1. ✅ Click "View Details" → Verify drawer opens
2. ✅ Close drawer
3. ✅ Click "Quick Approve" → Verify approval works
4. ✅ Click "Download PDF" → Verify PDF action triggers
5. ✅ Click "View on graph" → Verify it works

**Expected Result:**
- ✅ All other menu items still work
- ✅ No interference between actions

**Pass Criteria:**
- [ ] View Details still opens drawer
- [ ] Quick Approve still works
- [ ] View on graph doesn't prevent other actions

---

### **Test 7: Console Logging** 🪵
**Goal:** Verify debug logging works

**Steps:**
1. ✅ Open browser DevTools (F12)
2. ✅ Go to Console tab
3. ✅ Click "View on graph" on any row

**Expected Result:**
- ✅ Console logs show:
  ```
  handleViewInGraph called with: user-sarah, 2024-11-05T10:30:00Z
  Opening Project Graph: approval chain view
  ```

**Pass Criteria:**
- [ ] No red errors in console
- [ ] Debug logs are clear and helpful
- [ ] userId and timestamp are correct

---

### **Test 8: Edge Cases** 🧪

#### **8A: No Graph Available**
**Steps:**
1. ✅ Click "View on graph" for a contractor
2. ✅ If no graph is configured yet...

**Expected Result:**
- ✅ Tab still switches to Project Graph
- ✅ Empty state shows (if no nodes)
- ✅ No crashes

---

#### **8B: Missing submittedAt**
**Steps:**
1. ✅ Click "View on graph" for a draft timesheet (no submission date)

**Expected Result:**
- ✅ URL hash: `#scope=approvals&focus=userId` (no asOf)
- ✅ Still works, just no historical snapshot

---

#### **8C: Rapid Clicking**
**Steps:**
1. ✅ Click "View on graph" 3 times quickly

**Expected Result:**
- ✅ Only one toast notification
- ✅ Tab switches only once
- ✅ No multiple graph loads

---

## 🎯 **ACCEPTANCE CRITERIA**

### **Must Have:**
- [x] Menu item appears in both monthly and weekly views
- [x] Menu item has Network icon
- [x] Clicking opens Project Graph tab
- [x] URL hash updates with correct parameters
- [x] Toast notification shows
- [x] Graph focuses on correct person
- [x] No console errors

### **Should Have:**
- [ ] Smooth tab transition
- [ ] Toast disappears after 2 seconds
- [ ] Works for all contractors
- [ ] asOf parameter included when available

### **Nice to Have:**
- [ ] Loading state while graph renders
- [ ] Animation when focusing on node
- [ ] Historical banner (Phase 5)

---

## 🐛 **COMMON ISSUES & FIXES**

### **Issue 1: Menu Item Not Visible**
**Symptoms:** Can't see "View on graph" in menu

**Fix:**
1. Check that OrganizationGroupedTable has `onViewInGraph` prop
2. Verify Network icon is imported
3. Clear browser cache

---

### **Issue 2: Tab Doesn't Switch**
**Symptoms:** Menu item clicks but nothing happens

**Fix:**
1. Check console for errors
2. Verify CustomEvent is dispatching: `window.dispatchEvent(...)`
3. Check ProjectWorkspace has event listener

---

### **Issue 3: Wrong Person Focused**
**Symptoms:** Graph focuses on wrong person

**Fix:**
1. Verify userId is correct in console log
2. Check that contract.userId matches the person
3. Verify focus parameter in URL hash

---

### **Issue 4: No Toast Notification**
**Symptoms:** Tab switches but no toast

**Fix:**
1. Check that toast is imported: `import { toast } from 'sonner@2.0.3'`
2. Verify Toaster component is in App.tsx
3. Check console for toast errors

---

## 📊 **TEST RESULTS TEMPLATE**

```markdown
## Test Results - Phase 3

**Tester:** [Your Name]
**Date:** [YYYY-MM-DD]
**Browser:** [Chrome/Firefox/Safari]

### Test 1: Menu Item Appears
- [ ] PASS / [ ] FAIL
- Notes: _______

### Test 2: Monthly View
- [ ] PASS / [ ] FAIL
- Notes: _______

### Test 3: Weekly View
- [ ] PASS / [ ] FAIL
- Notes: _______

### Test 4: Multiple Contractors
- [ ] PASS / [ ] FAIL
- Notes: _______

### Test 5: Historical Snapshot
- [ ] PASS / [ ] FAIL
- Notes: _______

### Test 6: Other Menu Items
- [ ] PASS / [ ] FAIL
- Notes: _______

### Test 7: Console Logging
- [ ] PASS / [ ] FAIL
- Notes: _______

### Test 8: Edge Cases
- [ ] PASS / [ ] FAIL
- Notes: _______

### Overall Status:
- [ ] ✅ ALL TESTS PASSED - Ready to ship!
- [ ] ⚠️ MINOR ISSUES - Fix before shipping
- [ ] ❌ BLOCKING ISSUES - Do not ship

### Issues Found:
1. _______
2. _______
3. _______
```

---

## 🚀 **NEXT STEPS AFTER TESTING**

### **If All Tests Pass:**
1. ✅ Mark Phase 3 as COMPLETE
2. ✅ Update `/docs/IMPLEMENTATION-STATUS.md`
3. ✅ Commit changes
4. ✅ Move to Phase 4 (Graph Snapshot Card)

### **If Tests Fail:**
1. ❌ Document failures in test results
2. 🔧 Fix issues
3. 🔄 Re-test
4. ✅ Repeat until all pass

---

## 📚 **RELATED DOCUMENTATION**

- `/docs/PHASE-2-6-IMPLEMENTATION.md` - Full implementation spec
- `/docs/PHASES-3-6-COMPLETED.md` - Phase summaries
- `/docs/IMPLEMENTATION-STATUS.md` - Overall status
- `/docs/TESTING-PHASE-2-FIGMA-MAKE.md` - Phase 2 testing (reference)

---

**Ready to test? Let's go!** 🚀

Start with Test 1 and work through the checklist systematically. Good luck!
