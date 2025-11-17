# 🚀 WorkGraph Quick Reference: Core Workflow

**One-page visual guide to the complete project → timesheet → approval flow.**

---

## 📍 Navigation Map

```
Main Routes:
├── #/projects              → List all projects, create new
├── #/project-workspace     → Single project hub
│   ├── Tab: Overview       → Project stats & activity
│   ├── Tab: Project Graph  → Visual approval structure
│   ├── Tab: Timesheets     → Time entry & submission ⭐
│   ├── Tab: Approvals      → Project-scoped approvals ⭐
│   └── Tab: Contracts      → Contract management
├── #/approvals             → Global approval queue (cross-project) ⭐
├── #/dashboard             → Personal dashboard & earnings
└── #/notifications         → Activity feed & notifications
```

**⭐ = Core workflow components**

---

## 🔄 Complete Workflow (30 seconds)

### **1️⃣ Create Project** → `#/projects`

```
Click "+ New Project"
  ↓
Enter: Name, Description, Dates
  ↓
Click "Create Project"
  ↓
Visual WorkGraph Builder opens
```

---

### **2️⃣ Set Up Approval Structure** → Visual Builder

```
Add Nodes:
  Company: TechVentures (Client)
    └─ Contract: $150/hr
        └─ Agency: StaffingPro
            └─ Contract: $95/hr
                └─ Freelancer: Sarah Chen

Define Approval Chain:
  Layer 1: Agency Lead
  Layer 2: Client PM
  Layer 3: Client Finance

Click "Compile & Publish"
```

---

### **3️⃣ Enter Time** → `#/project-workspace` → Timesheets Tab

```
Option A: Quick Add
  Click on a day → Enter hours → Save

Option B: Drag & Drop
  Drag existing entry to new day

Option C: Bulk Entry
  Click "Copy Last Week" → Select days → Apply

Result: Time logged (status: Draft)
```

---

### **4️⃣ Submit for Approval** → Same View

```
Click "Submit for Approval"
  ↓
Status changes: Draft → Submitted
  ↓
Approval chain activated:
  Sarah → Agency Lead → Client PM → Client Finance
```

---

### **5️⃣ Approve Timesheets** → `#/approvals`

```
Global Approvals Workbench

View All Pending:
  ├── Timesheets
  ├── Expenses
  ├── Invoices
  └── Contracts

For Each Item:
  1. Review details (click row → drawer opens)
  2. See approval path (click "View on graph")
  3. Approve or Reject
  
Bulk Actions:
  Select multiple → "Approve Selected (5)" → Done
```

---

### **6️⃣ Final Approval & Payment** → Same View

```
Finance Layer Approval:
  Click "Approve"
    ↓
  Status: Approved
    ↓
  Invoice auto-generated
    ↓
  Click "Download PDF"
    ↓
  Payment processed
```

---

## 🎨 Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         WORKGRAPH WORKFLOW                       │
└─────────────────────────────────────────────────────────────────┘

SETUP PHASE (One-time)
━━━━━━━━━━━━━━━━━━━━━━

  [Create Project]
        ↓
  [Add Companies/Agencies]
        ↓
  [Define Approval Chain]
        ↓
  [Compile & Publish]
        ↓
  ✅ Project Live


RECURRING WORKFLOW (Weekly)
━━━━━━━━━━━━━━━━━━━━━━━━━

CONTRACTOR FLOW:
┌──────────────────┐
│  Enter Time      │  ← Drag-drop, quick add, bulk entry
│  (Draft)         │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│  Submit          │  ← Click "Submit for Approval"
│  (Submitted)     │
└────────┬─────────┘
         │
         ↓
┌────────────────────────────────────────────┐
│          APPROVAL CHAIN                    │
├────────────────────────────────────────────┤
│                                            │
│  Layer 1: Agency Lead                      │
│    ↓                                       │
│  Review hours, approve work quality        │
│    ↓                                       │
│  [Approve] ──────────────────→ Layer 2     │
│                                            │
│  Layer 2: Client PM                        │
│    ↓                                       │
│  Review deliverables, approve scope        │
│    ↓                                       │
│  [Approve] ──────────────────→ Layer 3     │
│                                            │
│  Layer 3: Client Finance                   │
│    ↓                                       │
│  Review costs, approve payment             │
│    ↓                                       │
│  [Approve] ──────────────────→ Invoice     │
│                                            │
└────────────────────────────────────────────┘
         │
         ↓
┌──────────────────┐
│  Invoice         │  ← Auto-generated PDF
│  (Approved)      │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│  Payment         │  ← Contractor gets paid
│  (Complete)      │
└──────────────────┘


MANAGER VIEW:
┌────────────────────────────────────────────┐
│      Global Approvals Workbench            │
├────────────────────────────────────────────┤
│                                            │
│  [Filter] Type | Status | Project         │
│                                            │
│  ☐ Sarah - Mobile App - 40h - $3,800      │
│  ☐ John - Website - 32h - $2,880          │
│  ☐ Maria - Backend - 25h - $2,500         │
│                                            │
│  [Approve Selected (3)]  [View on Graph]   │
│                                            │
└────────────────────────────────────────────┘
```

---

## 🗺️ Component Architecture

### **Timesheet Entry Flow:**

```
ProjectWorkspace.tsx
  └─ Tab: Timesheets
      └─ ProjectTimesheetsView.tsx ─────────┐
           │                                 │
           ├─ MultiPersonTimesheetCalendar   │ ← Calendar grid (all contractors)
           │    └─ EnhancedCalendarCell      │ ← Individual day cell
           │         └─ EnhancedDayEntryModal│ ← Add/edit time
           │                                 │
           └─ OrganizationGroupedTable       │ ← Approval table view
                └─ MonthlyTimesheetDrawer    │ ← Daily details
```

### **Approval Flow:**

```
AppRouter.tsx
  └─ Route: #/approvals
      └─ ApprovalsWorkbench.tsx ────────────┐
           │                                 │
           ├─ Filter Bar                     │ ← Type, Status, Priority
           ├─ Search Bar                     │ ← Free text search
           │                                 │
           ├─ Approval Table                 │ ← All pending items
           │    ├─ Checkbox (bulk select)    │
           │    ├─ Item details              │
           │    └─ Action buttons            │
           │                                 │
           ├─ GraphOverlayModal              │ ← Visual approval path
           │                                 │
           └─ Bulk Action Bar                │ ← Approve/reject selected
```

---

## 🎯 Key Features by Route

### **`#/projects` - Projects List**
- ✅ Create new projects
- ✅ Search/filter projects
- ✅ View project cards (status, team, deadlines)
- ✅ Quick actions (edit, archive, view)

### **`#/project-workspace` - Project Hub**
- ✅ **Overview Tab:** Stats, activity, deadlines
- ✅ **Project Graph Tab:** Visual approval structure
- ✅ **Timesheets Tab:** Multi-person calendar, time entry
- ✅ **Approvals Tab:** Project-scoped approval queue
- ✅ **Contracts Tab:** Contract management

### **`#/approvals` - Global Approvals**
- ✅ Cross-project approval queue
- ✅ Filter by: Type, Status, Priority, Project
- ✅ Bulk approve/reject
- ✅ Visual graph overlay
- ✅ Email deep-links (mock)

### **`#/dashboard` - Personal Dashboard**
- ✅ Earnings tracking (monthly, YTD)
- ✅ Pending approvals widget
- ✅ Active contracts
- ✅ Earnings chart
- ✅ Network activity feed

### **`#/notifications` - Activity Feed**
- ✅ Real-time notifications
- ✅ 14 notification types
- ✅ Priority levels
- ✅ Click-to-navigate
- ✅ Mark as read/unread

---

## 🧪 Quick Test Script

**Time: 2 minutes**

```bash
# 1. Create Project
Open: #/projects
Click: "+ New Project"
Enter: "Test Project"
Click: "Create Project"

# 2. Enter Time
Open: #/project-workspace
Click: "Timesheets" tab
Click: Any day cell
Enter: 8 hours, "Development work"
Click: "Save"
Click: "Submit for Approval"

# 3. Approve
Open: #/approvals
Find: "Test Project" item
Click: "Approve"
Verify: Item disappears from queue

# 4. Check Dashboard
Open: #/dashboard
Verify: Earnings updated
Verify: Hours updated

✅ Success! Core workflow complete.
```

---

## 📊 Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete & Production-Ready |
| 🟡 | Working (using mock data) |
| ⏳ | In Progress |
| 🔴 | Not Started |

---

## 🔗 Quick Links

- **Full Status:** [`/docs/CORE_WORKFLOW_STATUS.md`](./CORE_WORKFLOW_STATUS.md)
- **Master Roadmap:** [`/docs/roadmap/MASTER_ROADMAP.md`](./roadmap/MASTER_ROADMAP.md)
- **Architecture:** [`/docs/architecture/MULTI_PARTY_ARCHITECTURE.md`](./architecture/MULTI_PARTY_ARCHITECTURE.md)
- **Test Guide:** [`/docs/guides/QUICK_TEST_CHECKLIST.md`](./guides/QUICK_TEST_CHECKLIST.md)

---

**🎉 You now know everything about the core workflow!**

Print this page and keep it handy while building. 📄
