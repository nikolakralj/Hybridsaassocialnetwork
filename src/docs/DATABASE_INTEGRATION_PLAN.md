# 🗄️ Database Integration Plan - Complete Workflow

**Goal:** Connect the entire workflow (Project Creation → Timesheet Entry → Approval) to Supabase database.

---

## 📋 What We're Building

A fully functional end-to-end workflow:

```
1. Create Project → Supabase `projects` table
2. Build WorkGraph → Supabase `workgraph_nodes` + `workgraph_edges` tables
3. Add Contracts → Supabase `project_contracts` table
4. Enter Time → Supabase `timesheet_entries` table (already working!)
5. Submit for Approval → Supabase `approval_records` table
6. Approve/Reject → Updates `approval_records`, triggers next layer
```

---

## ✅ What's Already Done

### **Database Schema:**
- ✅ `/docs/database/COMPLETE_TIMESHEET_SCHEMA.sql` - Timesheets schema
- ✅ `/docs/database/COMPLETE_WORKGRAPH_SCHEMA.sql` - Projects, WorkGraph, Approvals schema

### **API Layer:**
- ✅ `/utils/api/projects-supabase.ts` - Project CRUD operations
- ✅ `/utils/api/workgraph-supabase.ts` - WorkGraph nodes/edges operations
- ✅ `/utils/api/approvals-supabase.ts` - Approval queue operations
- ✅ `/utils/api/timesheets.ts` - Timesheet operations (already working!)

---

## 🔧 Implementation Steps

### **Step 1: Run Database Migrations** ✅

Execute the SQL schemas in Supabase:

```bash
# In Supabase Dashboard → SQL Editor:

1. Run: /docs/database/COMPLETE_TIMESHEET_SCHEMA.sql
   ✅ Creates: organizations, project_contracts, graph_versions, timesheet_periods, timesheet_entries

2. Run: /docs/database/COMPLETE_WORKGRAPH_SCHEMA.sql
   ✅ Creates: projects, project_members, workgraph_nodes, workgraph_edges, approval_records
   ✅ Creates sample data for testing
```

### **Step 2: Update Project Creation** 

Replace mock with Supabase in `ProjectsListView.tsx`:

```typescript
// OLD:
import { createProjectMock } from '../../utils/api/projects';

// NEW:
import { createProject } from '../../utils/api/projects-supabase';
```

### **Step 3: Update WorkGraph Builder**

Connect WorkGraphBuilder to database:

```typescript
// In /components/workgraph/WorkGraphBuilder.tsx

import { 
  getProjectGraph, 
  saveProjectGraph, 
  publishGraphVersion 
} from '../../utils/api/workgraph-supabase';

// On load:
const graph = await getProjectGraph(projectId);

// On save:
await saveProjectGraph(projectId, { nodes, edges });

// On publish:
await publishGraphVersion(projectId, "Initial setup");
```

### **Step 4: Update Approval Queue**

Replace mock approvals with real data:

```typescript
// In /components/approvals/ApprovalsWorkbench.tsx

// OLD:
import { getApprovalQueueMock } from '../../utils/api/approvals-queue';

// NEW:
import { getApprovalQueue, approveItem, rejectItem } from '../../utils/api/approvals-supabase';
```

### **Step 5: Create Approvals on Timesheet Submit**

When timesheet is submitted, create approval records:

```typescript
// In /components/timesheets/ProjectTimesheetsView.tsx

import { createApproval } from '../../utils/api/approvals-supabase';

const handleSubmitTimesheet = async (periodId: string) => {
  // 1. Update timesheet status
  await updateTimesheetStatus(periodId, 'submitted');
  
  // 2. Get approval chain from graph
  const graph = await getActiveVersion(projectId);
  const approvers = extractApprovers(graph);
  
  // 3. Create approval record for Layer 1
  await createApproval({
    projectId,
    subjectType: 'timesheet',
    subjectId: periodId,
    approverUserId: approvers[0].userId,
    approverName: approvers[0].name,
    approverNodeId: approvers[0].nodeId,
    approvalLayer: 1,
    status: 'pending',
    submittedAt: new Date().toISOString(),
  });
};
```

### **Step 6: Handle Approval Actions**

When approver clicks "Approve":

```typescript
// In /components/approvals/ApprovalsWorkbench.tsx

const handleApprove = async (approvalId: string) => {
  // 1. Approve current layer
  const approval = await approveItem(approvalId);
  
  // 2. Check if there's a next layer
  const nextLayer = approval.approvalLayer + 1;
  const graph = await getActiveVersion(approval.projectId);
  const nextApprover = findNextApprover(graph, nextLayer);
  
  if (nextApprover) {
    // 3. Create next approval record
    await createApproval({
      projectId: approval.projectId,
      subjectType: approval.subjectType,
      subjectId: approval.subjectId,
      approverUserId: nextApprover.userId,
      approverName: nextApprover.name,
      approverNodeId: nextApprover.nodeId,
      approvalLayer: nextLayer,
      status: 'pending',
      submittedAt: new Date().toISOString(),
    });
  } else {
    // 4. No more layers - mark timesheet as fully approved
    await updateTimesheetStatus(approval.subjectId, 'approved');
  }
};
```

---

## 🧪 Testing Plan

### **Test 1: Project Creation** (2 minutes)

```bash
1. Navigate to #/projects
2. Click "+ New Project"
3. Enter: "Test Project 1"
4. Click "Create"
5. Open Supabase Dashboard → projects table
6. Verify: New row exists with name "Test Project 1"
```

### **Test 2: WorkGraph Building** (5 minutes)

```bash
1. Open project from Test 1
2. Visual Builder should load
3. Add nodes:
   - Company: "Test Corp"
   - Agency: "Test Agency"
   - Freelancer: "John Doe"
4. Connect with edges (contracts)
5. Click "Save Draft"
6. Open Supabase Dashboard → workgraph_nodes table
7. Verify: 3 rows with labels above
8. Open workgraph_edges table
9. Verify: 2 rows (contract edges)
```

### **Test 3: Time Entry** (3 minutes)

```bash
1. Navigate to Timesheets tab
2. Click on Monday
3. Enter: 8 hours, "Development"
4. Click "Save"
5. Open Supabase Dashboard → timesheet_entries table
6. Verify: New row with hours=8, task_name="Development"
```

### **Test 4: Approval Submission** (5 minutes)

```bash
1. In Timesheets tab
2. Click "Submit for Approval"
3. Open Supabase Dashboard → approval_records table
4. Verify: New row with status='pending', approval_layer=1
5. Navigate to #/approvals
6. Verify: Pending approval shows in queue
```

### **Test 5: Approval Action** (3 minutes)

```bash
1. In Approvals Workbench
2. Find pending approval from Test 4
3. Click "Approve"
4. Open Supabase Dashboard → approval_records table
5. Verify: status='approved', decided_at is set
6. Verify: If multi-layer, new row exists for layer 2
```

### **Test 6: End-to-End** (10 minutes)

```bash
Complete workflow:
1. Create project ✓
2. Build graph with 3-layer approval ✓
3. Publish graph ✓
4. Add contract ✓
5. Enter 40 hours of time ✓
6. Submit for approval ✓
7. Layer 1 approves ✓
8. Layer 2 approves ✓
9. Layer 3 approves ✓
10. Generate invoice ✓
```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  projects                 ← Project creation                │
│  ├─ project_members       ← Team members                    │
│  └─ workgraph_nodes       ← Visual graph nodes              │
│      └─ workgraph_edges   ← Contracts & approvals           │
│                                                             │
│  graph_versions           ← Published graph snapshots       │
│                                                             │
│  project_contracts        ← Contractor agreements           │
│  └─ timesheet_periods     ← Weekly summaries                │
│      └─ timesheet_entries ← Daily time logs                 │
│                                                             │
│  approval_records         ← Approval queue & history        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         ↕                           ↕
┌─────────────────┐         ┌─────────────────┐
│  API Layer      │         │  API Layer      │
│                 │         │                 │
│  projects-      │         │  approvals-     │
│  supabase.ts    │         │  supabase.ts    │
│                 │         │                 │
│  workgraph-     │         │  timesheets.ts  │
│  supabase.ts    │         │  (existing!)    │
└─────────────────┘         └─────────────────┘
         ↕                           ↕
┌─────────────────────────────────────────────────────────────┐
│                    REACT COMPONENTS                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ProjectsListView         ← Create/list projects            │
│  WorkGraphBuilder         ← Visual graph editor             │
│  ProjectTimesheetsView    ← Time entry                      │
│  ApprovalsWorkbench       ← Approval queue                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Migration Strategy

### **Phase 1: Projects & WorkGraph** (Today)
- ✅ Run database migrations
- ✅ Update ProjectsListView to use Supabase
- ✅ Update WorkGraphBuilder to save to database
- ✅ Test project creation → graph building

### **Phase 2: Approvals Integration** (Today)
- ✅ Update ApprovalsWorkbench to use Supabase
- ✅ Connect timesheet submit → create approval
- ✅ Connect approve action → update record
- ✅ Test approval flow

### **Phase 3: Polish & Testing** (Tomorrow)
- ⏳ End-to-end testing
- ⏳ Error handling
- ⏳ Loading states
- ⏳ Real-time subscriptions (optional)

---

## 🎯 Success Criteria

You'll know it's working when:

1. ✅ You can create a project via UI and see it in Supabase
2. ✅ You can build a WorkGraph and see nodes/edges in database
3. ✅ You can publish a graph version and see it in graph_versions table
4. ✅ You can enter time and see entries in timesheet_entries table
5. ✅ You can submit timesheet and see approval in approval_records table
6. ✅ You can approve and see status change + next layer created
7. ✅ You can complete full 3-layer approval and generate invoice

---

## 📝 Next Steps

Ready to start? Here's the order:

1. **First:** Run the SQL migrations in Supabase
2. **Second:** I'll update the components to use the new APIs
3. **Third:** We test each step together

**Let me know when you're ready to run the migrations!** 🚀
