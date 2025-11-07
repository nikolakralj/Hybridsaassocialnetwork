# 🧪 Phase 2 Testing Guide - Figma Make Environment

**Environment:** Figma Make (iframe/embedded)  
**Feature:** Deep Links from Overview Cards  
**Updated:** 2024-01-24

---

## 🎯 **IMPORTANT: Figma Make URL Behavior**

Since you're testing in Figma Make, the **main URL won't change** (Figma controls it). Instead, we use:

✅ **Hash-based routing** (`#scope=money`)  
✅ **Visual toast notifications** (confirmation feedback)  
✅ **Automatic tab switching**

Your URL will **always** look like:
```
https://www.figma.com/make/OWlIxcQRvwzJtCW8s6SlNX/...?node-id=0-1&p=f&t=...
```

But the **hash fragment** will change:
```
#scope=money
#scope=approvals
```

---

## ✅ **TEST 1: Budget Card → Money Flow**

### **Steps:**

1. **Go to 📁 Project Workspace**

2. **Verify you're on Overview tab**
   - Should see 3 cards at top

3. **Hover over "Budget Progress" card** (left card)
   - **Expected:** Kebab menu (⋯) appears in top-right corner
   - Should fade in smoothly

4. **Click the ⋯ menu**
   - **Expected:** Dropdown menu opens

5. **Click "Show money flow in graph"**
   - Has Network icon (🕸️) next to text

### **Expected Results:**

✅ **Toast appears:** "Opening Project Graph: money view"  
✅ **Tab switches** to "Project Graph" (automatically)  
✅ **URL hash changes** to: `#scope=money`  
✅ **Graph loads** (skeleton → full view)  

### **How to Verify:**

**Visual:**
- Project Graph tab is now active (highlighted)
- Graph canvas appears
- Toast notification shows at bottom

**Technical (F12 Console):**
```javascript
// Check hash
console.log(window.location.hash); 
// Should be: "#scope=money"
```

---

## ✅ **TEST 2: Pending Approvals → Graph View**

### **Steps:**

1. **Click back to Overview tab** (manually)

2. **Hover over "Pending Approvals" card** (right card)
   - **Expected:** "View on graph →" button appears
   - Should fade in smoothly

3. **Click "View on graph →"**

### **Expected Results:**

✅ **Toast appears:** "Opening Project Graph: approvals view"  
✅ **Tab switches** to "Project Graph"  
✅ **URL hash changes** to: `#scope=approvals`  
✅ **Graph loads**

### **How to Verify:**

**Technical:**
```javascript
// Check hash
console.log(window.location.hash);
// Should be: "#scope=approvals"
```

---

## 🔍 **QUICK VISUAL CHECKLIST**

### **Hover States:**
- [ ] Budget card ⋯ menu appears on hover
- [ ] Pending Approvals button appears on hover
- [ ] Both fade in smoothly (not instant)

### **Tab Switching:**
- [ ] Tab changes automatically (no manual click needed)
- [ ] "Project Graph" tab becomes highlighted
- [ ] Tab change is instant (no delay)

### **Toast Notifications:**
- [ ] Toast appears at bottom of screen
- [ ] Shows correct message ("money view" or "approvals view")
- [ ] Disappears after 2 seconds
- [ ] Has success checkmark icon

### **Graph Loading:**
- [ ] Shows skeleton loader first (gray boxes)
- [ ] Then shows full WorkGraphBuilder
- [ ] Node palette on left
- [ ] Canvas in center
- [ ] Properties panel on right

---

## 🐛 **TROUBLESHOOTING**

### **Issue: Buttons don't appear on hover**

**Solution:**
- Make sure you're **fully hovering** over the card
- Try hovering over the card's padding area
- Check if browser supports `:hover` (all modern browsers do)

---

### **Issue: Toast doesn't appear**

**Check Console (F12):**
```
Look for errors related to 'sonner' or 'toast'
```

**Verify toast import:**
```typescript
import { toast } from "sonner";
```

---

### **Issue: Tab doesn't switch**

**Open Console (F12) and run:**
```javascript
// Test if event listener is working
window.dispatchEvent(new CustomEvent('changeTab', { 
  detail: 'project-graph' 
}));

// Tab should switch to Project Graph
```

**If nothing happens:**
- Check browser console for errors
- Verify `useEffect` is registered
- Refresh the page

---

### **Issue: Hash doesn't change**

**Check in Console:**
```javascript
// Manually test hash change
window.location.hash = 'scope=money';
console.log(window.location.hash);
// Should output: "#scope=money"
```

**If hash doesn't update:**
- Figma Make might block hash changes
- Feature still works via state (tab switching)
- Hash is bonus for debugging

---

## 📸 **STEP-BY-STEP VISUAL TEST**

### **Complete Flow (60 seconds):**

```
1. ✅ Navigate to Project Workspace
   → See "Mobile App Redesign" header
   → See Overview tab active
   
2. ✅ Test Budget Card Deep Link
   → Hover Budget card
   → See ⋯ appear (top-right)
   → Click ⋯
   → See dropdown menu
   → Click "Show money flow in graph"
   → See toast: "Opening Project Graph: money view"
   → See tab switch to "Project Graph"
   → See graph load
   → Open Console (F12)
   → Type: window.location.hash
   → Should see: "#scope=money"
   
3. ✅ Test Approvals Card Deep Link
   → Click "Overview" tab
   → Hover "Pending Approvals" card
   → See "View on graph →" button appear
   → Click button
   → See toast: "Opening Project Graph: approvals view"
   → See tab switch to "Project Graph"
   → Check Console: window.location.hash
   → Should see: "#scope=approvals"
   
4. ✅ Verify State Persistence
   → Click "Timesheets" tab
   → Click "Project Graph" tab
   → Hash should still be "#scope=approvals"
   → WorkGraphBuilder receives correct scope prop
```

---

## 🎬 **ACCEPTANCE CRITERIA**

### **Phase 2 is COMPLETE when:**

- [x] Budget card kebab menu appears on hover
- [x] "Show money flow in graph" option works
- [x] Pending Approvals button appears on hover
- [x] "View on graph →" button works
- [x] Both deep links switch tab automatically
- [x] Toast notifications appear
- [x] Hash updates (visible in console)
- [x] No page reload
- [x] No console errors
- [x] Graph loads successfully

---

## 🚀 **NEXT STEPS AFTER TESTING**

Once all tests pass:

1. ✅ **Mark Phase 2 as complete**
2. 🚧 **Move to Phase 3:** Timesheet row deep links
3. 🚧 **Move to Phase 4:** Graph Snapshot card
4. 🚧 **Move to Phase 5:** As-of snapshots
5. 🚧 **Move to Phase 6:** Keyboard shortcuts

---

## 💡 **DEBUGGING TIPS**

### **Console Commands:**

```javascript
// Check current hash
console.log('Hash:', window.location.hash);

// Check active tab
console.log('Active tab:', document.querySelector('[role="tab"][data-state="active"]')?.textContent);

// Manually trigger deep link
const event = new CustomEvent('changeTab', { detail: 'project-graph' });
window.dispatchEvent(event);

// Check if WorkGraphBuilder received props
// (Look for console.log inside WorkGraphBuilder)
```

### **Visual Inspection:**

- Right-click card → Inspect
- Look for `class="group"` on Card
- Look for `group-hover:opacity-100` on Button
- Verify `opacity-0` changes to `opacity-100` on hover

---

## 📝 **REPORT TEMPLATE**

After testing, report results:

```
✅ Budget Card Deep Link
   - Hover: Works / Doesn't work
   - Menu: Opens / Doesn't open
   - Tab switch: Works / Doesn't work
   - Hash: #scope=money / Different / Missing
   - Toast: Shows / Doesn't show
   - Graph: Loads / Doesn't load

✅ Approvals Card Deep Link
   - Hover: Works / Doesn't work
   - Button: Appears / Doesn't appear
   - Tab switch: Works / Doesn't work
   - Hash: #scope=approvals / Different / Missing
   - Toast: Shows / Doesn't show
   - Graph: Loads / Doesn't load

🐛 Issues Found:
   - [List any issues]

📊 Overall Status:
   - [ ] All tests passed
   - [ ] Some issues found
   - [ ] Major issues blocking
```

---

**Happy Testing! 🎯**

If you encounter any issues, check the console first and try the debugging commands above.
