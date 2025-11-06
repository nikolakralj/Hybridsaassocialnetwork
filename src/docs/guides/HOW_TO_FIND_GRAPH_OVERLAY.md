# 📍 How to Find "View path on graph" Button

**Last Updated:** November 6, 2025  
**Time Required:** 30 seconds

---

## 🎯 Quick Answer

The **"View path on graph"** button is located in the **My Approvals** page, on each approval item row, on the **right side**.

---

## 📋 Step-by-Step Instructions

### **Step 1: Navigate to My Approvals**

1. Look at the **top-right corner** of the app
2. Click the **"Navigate"** button (dropdown menu)
3. Click **"✅ My Approvals"**

```
Visual Guide:
┌─────────────────────────────────────────────┐
│ WorkGraph                      [Navigate ▼] │ ← Click here
└─────────────────────────────────────────────┘

Dropdown appears:
┌──────────────────────────┐
│ 🏠 Landing               │
│ 📰 Feed                  │
│ 📋 Projects              │
│ ✅ My Approvals          │ ← Click this!
│ 🎨 Visual Builder        │
│ 📁 Project Workspace     │
└──────────────────────────┘
```

---

### **Step 2: You're Now on My Approvals Page**

You should see:

```
┌───────────────────────────────────────────────────────┐
│ My Approvals                              [18 items]  │
├───────────────────────────────────────────────────────┤
│ 📊 Stats Bar                                          │
│ Hours: 702.0  Amount: $84.5k  Breached: 3            │
├───────────────────────────────────────────────────────┤
│ 🎯 Filters                                            │
│ [All Projects ▼] [All Parties ▼] [All Steps ▼]       │
├───────────────────────────────────────────────────────┤
│ 📋 Approval Queue                                     │
│                                                        │
│ ☐ Jane Doe [Senior Developer]          [Buttons →]   │
│   Mobile App Redesign · Week of Oct 21                │
│   40.0h · $6,000 · Step 2 of 3                       │
│                                                        │
│ ☐ Mike Chen [Backend Engineer]         [Buttons →]   │
│   Backend API Rebuild · Week of Oct 21                │
│   45.0h · ••• · Step 1 of 3                          │
│                                                        │
│ ☐ Sarah Kim [Senior Developer]         [Buttons →]   │
│   E-commerce Platform · Week of Oct 21                │
│   38.0h · $5,700 · Step 2 of 3                       │
│                                                        │
│ ...more items...                                      │
└───────────────────────────────────────────────────────┘
```

---

### **Step 3: Find the Button on Each Row**

Look at **any approval item row**. On the **right side**, you'll see **4 buttons**:

```
Full Row Layout:
┌────────────────────────────────────────────────────────────────┐
│ ☐ Jane Doe [Senior Developer]                                 │
│   Mobile App Redesign · Week of Oct 21                        │
│   40.0h · $6,000 · Step 2 of 3 · ⚠️ SLA Breached             │
│                                                                 │
│   [Approve] [Reject] [Why?] [👁️ View path on graph]         │
│      ↑         ↑       ↑              ↑                       │
│    Green    Outline  Ghost      THIS ONE! (has eye icon)      │
└────────────────────────────────────────────────────────────────┘
```

**The button you're looking for:**
- **Label:** "View path on graph"
- **Icon:** 👁️ Eye icon
- **Position:** 4th button on the right
- **Style:** Ghost button (subtle, not colored)

---

### **Step 4: Click the Button**

1. Find the **first item** in the queue (Jane Doe)
2. Scroll to the **right side** of that row
3. Click the **"View path on graph"** button (👁️ icon)

```
What happens:
┌─────────────────────────────────────────────┐
│ Approval Path on Graph         [Step 2 of 3]│
│                                              │
│ Jane Doe [Senior Developer]                 │
│ Mobile App Redesign · Week of Oct 21        │
│                                              │
├─────────────────────────────────────────────┤
│                                              │
│   Approval Flow Visualization:              │
│                                              │
│   (1)        (2)        (3)                 │
│ Contractor → Manager → Finance              │
│ Submitted   YOU HERE   Next                 │
│   ✅         🔵         ⚪                   │
│                                              │
├─────────────────────────────────────────────┤
│ [Close]        [Reject]  [Approve from Graph]│
└─────────────────────────────────────────────┘
```

---

## 🔍 Troubleshooting

### **Problem: I don't see "My Approvals" in the Navigate menu**

**Solution:**
1. Make sure you're on the latest version
2. Check the top-right corner for "Navigate" button
3. The route is registered as `approvals` in the system

---

### **Problem: I see the page but no approval items**

**Expected:**
- You should see **18 pending items**
- If you see 0 items, the mock data might not be loading

**Check:**
1. Open browser console (F12)
2. Look for: `✅ Loaded approval queue: 18 items`
3. If you see errors, report them

---

### **Problem: I see the items but no "View path on graph" button**

**Possible causes:**
1. **Scrolling needed:** The button is on the **right side** of the row. Try scrolling horizontally or making your window wider.
2. **Version mismatch:** Make sure you have the latest code (Day 4 complete)

**Check the row structure:**
```
Each row should have 4 buttons:
1. [Approve] - Green button
2. [Reject] - Outline button
3. [Why?] - Ghost button with sparkles icon
4. [👁️ View path on graph] - Ghost button with eye icon ← This one!
```

---

### **Problem: I clicked it but nothing happens**

**Check:**
1. Open browser console (F12)
2. Look for errors
3. The modal should open immediately (no delay)

**Expected behavior:**
- Modal opens full screen (~95% of viewport)
- Shows approval flow diagram
- No console errors

---

## 📸 Visual Reference

### **Where to Click (Annotated):**

```
My Approvals Page:
┌──────────────────────────────────────────────────────────┐
│ My Approvals                                   [18 items]│
├──────────────────────────────────────────────────────────┤
│                                                           │
│ ☐ Jane Doe [Senior Developer]                           │
│   Mobile App Redesign · Week of Oct 21                  │
│   40.0h · $6,000 · Step 2 of 3                          │
│                                                           │
│   [Approve] [Reject] [Why?] [👁️ View path on graph]    │
│                                         ↑                │
│                                         |                │
│                                    CLICK HERE!           │
│                                                           │
├──────────────────────────────────────────────────────────┤
│ ☐ Mike Chen [Backend Engineer]                          │
│   Backend API Rebuild · Week of Oct 21                  │
│   45.0h · ••• · Step 1 of 3                             │
│                                                           │
│   [Approve] [Reject] [Why?] [👁️ View path on graph]    │
│                                         ↑                │
│                                         |                │
│                                    OR HERE!              │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## ✅ Success Checklist

After clicking the button, you should see:

- [x] **Modal opens** (full screen, ~95% of viewport)
- [x] **Header shows:** "Approval Path on Graph"
- [x] **Person name:** "Jane Doe [Senior Developer]"
- [x] **Project name:** "Mobile App Redesign"
- [x] **Step badge:** "Step 2 of 3"
- [x] **Approval flow diagram** with 3 steps
- [x] **Action bar** at bottom with 3 buttons
- [x] **No console errors** (check F12)

If all checked = Success! ✅

---

## 🎯 Alternative: Direct Route

If you can't find the button, you can also navigate directly:

**In AppRouter.tsx:**
- The approvals route is: `"approvals"`
- Set: `setCurrentRoute("approvals")`

**Or manually:**
- The component is: `<ApprovalsWorkbench />`
- It's already imported and rendered when route = "approvals"

---

## 📝 Summary

**Location:** My Approvals page → Each row → 4th button on right  
**Button name:** "View path on graph"  
**Icon:** 👁️ Eye  
**Action:** Opens graph overlay modal

**Navigate there:**
1. Top-right → "Navigate" → "✅ My Approvals"
2. Find any item (e.g., Jane Doe)
3. Look at right side of row
4. Click button with eye icon 👁️

**That's it!** 🎉

---

**Created:** November 6, 2025  
**Status:** Current (Day 4)  
**Component:** `/components/approvals/ApprovalsWorkbench.tsx`

**Need help?** Check the console (F12) for errors!
