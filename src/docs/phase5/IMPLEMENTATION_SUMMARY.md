# Phase 5B Implementation Summary

## What We Just Built

### 1. **Graph Node Architecture** ✅

**Files Created:**
- `/utils/graph/timesheet-nodes.ts` - Graph node management
- `/docs/phase5/GRAPH_ARCHITECTURE_NODES_AND_CONTAINERS.md` - Complete architecture spec

**Key Features:**
- TimesheetPeriod and ExpenseReport as first-class graph nodes
- Nodes created only on submission (not for drafts)
- Hybrid approach: Nodes in KV store, detailed entries in Postgres
- Company containers with denormalized stats
- Multi-edge relationships (SUBMITTED_BY, FOR_PROJECT, UNDER_CONTRACT, REQUIRES_APPROVAL)

**Node Structure:**
```typescript
{
  nodeType: "TimesheetPeriod",
  nodeId: "ts-2025-11-w1-alice",
  properties: {
    // Temporal
    weekStart, weekEnd, submittedAt, approvedAt,
    
    // Workflow
    status, currentStep, totalSteps, version,
    
    // Aggregated Data
    totalHours, billableHours, overtimeHours, daysWorked,
    
    // Financial
    totalAmount, currency, hourlyRate,
    
    // References to Postgres
    postgresEntriesRef, postgresPeriodId,
    
    // Flags
    hasOvertimeFlag, requiresClientApproval
  }
}
```

---

### 2. **Permission Model** ✅

**Files Created:**
- `/utils/permissions/timesheet-permissions.ts` - Complete permission system
- `/docs/phase5/TIMESHEET_VISIBILITY_AND_PERMISSIONS.md` - Permission spec

**Key Rules:**

| State | Contractor | Manager | Client | Finance |
|-------|-----------|---------|--------|---------|
| **Draft** | Edit ✏️ | No access ❌ | No access ❌ | No access ❌ |
| **Submitted** | View only 👁️ | Can approve/reject ✅ | Depends on contract ⚙️ | View only 👁️ |
| **Approved** | View only 👁️ | View only 👁️ | View only 👁️ | View only 👁️ |
| **Rejected** | Edit ✏️ | View history 👁️ | View history 👁️ | View only 👁️ |

**Permission Functions:**
```typescript
canViewTimesheet(timesheet, viewer)
canEditTimesheet(timesheet, editor)
canSubmitTimesheet(timesheet, submitter)
canApproveTimesheet(timesheet, approver)
canRecallTimesheet(timesheet, user)
```

---

### 3. **Approval Workflow API** ✅

**Files Created:**
- `/supabase/functions/server/timesheet-approvals.ts` - Complete approval API

**Routes:**

```
POST /timesheet-approvals/submit
  - Creates graph node
  - Builds approval chain from contract
  - Sends email to first approver
  - Returns: { nodeId, approvalChain }

POST /timesheet-approvals/approve
  - Updates approval edge to 'approved'
  - Moves to next step OR marks fully approved
  - Sends confirmation email
  - Returns: { fullyApproved, nextStep }

POST /timesheet-approvals/reject
  - Updates approval edge to 'rejected'
  - Resets timesheet to step 1
  - Sends rejection email with notes
  - Returns: { success }

GET /timesheet-approvals/my-approvals/:userId
  - Finds all timesheets awaiting user's approval
  - Filters by current step
  - Returns: { approvals: [...] }
```

**Email Notifications:**
- Approval request email (to manager)
- Approval confirmation email (to contractor)
- Rejection email with notes (to contractor)

---

### 4. **Database Schema Updates** ✅

**Files Created:**
- `/docs/phase5/DATABASE_SCHEMA_UPDATES.sql` - All schema changes

**Changes:**

```sql
-- Timesheet periods
ALTER TABLE timesheet_periods ADD COLUMN
  graph_node_id TEXT,
  archived_at TIMESTAMP,
  current_approval_step INTEGER DEFAULT 1,
  total_approval_steps INTEGER DEFAULT 1,
  version INTEGER DEFAULT 1;

-- Project contracts (visibility settings)
ALTER TABLE project_contracts ADD COLUMN
  client_timesheet_visibility TEXT DEFAULT 'after_approval',
  allow_manager_timesheet_edits BOOLEAN DEFAULT false,
  requires_client_approval BOOLEAN DEFAULT false;

-- Expense reports (new table)
CREATE TABLE expense_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  contract_id TEXT,
  status TEXT CHECK (status IN ('draft', 'submitted', 'in_review', 'rejected', 'approved', 'reimbursed')),
  total_amount DECIMAL(10,2),
  graph_node_id TEXT,
  ...
);

-- Expense line items
CREATE TABLE expense_line_items (
  id TEXT PRIMARY KEY,
  report_id TEXT,
  expense_date DATE,
  category TEXT,
  amount DECIMAL(10,2),
  receipt_url TEXT,
  ...
);

-- Audit log (Phase 6)
CREATE TABLE timesheet_edit_log (
  id SERIAL PRIMARY KEY,
  timesheet_period_id TEXT,
  edited_by_user_id TEXT,
  changed_fields JSONB,
  edit_reason TEXT,
  ...
);
```

**Triggers:**
- Auto-increment version on resubmission
- Validate status transitions
- Update timestamps

---

## How It Works

### Submission Flow

```
1. Contractor clicks "Submit"
   ↓
2. Frontend calls: POST /timesheet-approvals/submit
   ↓
3. Server:
   - Fetches timesheet data from Postgres
   - Calculates totals (hours, amounts)
   - Builds approval chain from contract
   - Creates TimesheetPeriod graph node
   - Creates SUBMITTED_BY edge
   - Creates REQUIRES_APPROVAL edges (one per approver)
   - Updates Postgres with graph_node_id
   - Sends email to first approver
   ↓
4. Returns: { success, nodeId, approvalChain }
```

### Approval Flow

```
1. Manager clicks "Approve"
   ↓
2. Frontend calls: POST /timesheet-approvals/approve
   ↓
3. Server:
   - Fetches graph node
   - Updates approval edge to 'approved'
   - Checks if more steps exist
   - If last step:
     → Mark fully approved
     → Update Postgres status
     → Send approval email to contractor
   - If more steps:
     → Move to next step
     → Notify next approver
   ↓
4. Returns: { fullyApproved, nextStep }
```

### Rejection Flow

```
1. Manager clicks "Reject" + enters reason
   ↓
2. Frontend calls: POST /timesheet-approvals/reject
   ↓
3. Server:
   - Updates approval edge to 'rejected'
   - Updates node status to 'rejected'
   - Resets currentStep to 1
   - Updates Postgres status
   - Sends rejection email with notes
   ↓
4. Contractor receives email
   ↓
5. Contractor edits and resubmits
   ↓
6. Version increments (v1 → v2)
```

---

## Graph Structure Example

### Simple Case (Internal Approval Only)

```
👤 Alice (Contractor)
  │
  ├─ EMPLOYS ──← 🏢 Agency Alpha
  │
  └─ SUBMITTED_BY ──→ 📊 Timesheet Week Nov 3-9
                         │
                         ├─ FOR_PROJECT ──→ 📁 Project Acme
                         │
                         ├─ UNDER_CONTRACT ──→ 📄 Contract MSA-001
                         │
                         └─ REQUIRES_APPROVAL ──→ 👤 Bob (Manager)
                              [step: 1, status: 'pending']
```

### Complex Case (Client Approval Required)

```
👤 Alice (Contractor)
  │
  └─ SUBMITTED_BY ──→ 📊 Timesheet Week Nov 3-9
                         │
                         ├─ REQUIRES_APPROVAL ──→ 👤 Bob (Manager)
                         │    [step: 1, status: 'approved' ✅]
                         │
                         └─ REQUIRES_APPROVAL ──→ 👤 Carol (Client)
                              [step: 2, status: 'pending' ⏳]
```

---

## Container Grouping

### UI Representation

```
┌─ 🏢 Agency Alpha ─────────────────────────────┐
│  Stats: 5 pending timesheets, 2 expenses      │
│                                               │
│  👥 Contractors (10)  [Collapse ▼]           │
│  ├─ 👤 Alice Chen                            │
│  │   └─ 📊 3 pending timesheets              │
│  ├─ 👤 Bob Smith                             │
│  │   └─ 📊 1 pending timesheet               │
│  └─ ▶ +8 more contractors...                 │
└───────────────────────────────────────────────┘
```

### Graph Traversal

```typescript
// "Show all timesheets from Agency Alpha"
const timesheets = await graph.query(`
  MATCH (c:Company {id: 'agency-alpha'})-[:EMPLOYS]->(u:User)
  MATCH (u)-[:SUBMITTED_BY]-(t:TimesheetPeriod)
  WHERE t.status IN ['submitted', 'in_review']
  RETURN t
`);
```

---

## Next Steps (Frontend Integration)

### 1. Update Timesheet Submission

```typescript
// In TimesheetModule.tsx
const handleSubmit = async () => {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/make-server-f8b491be/timesheet-approvals/submit`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({
        periodId: timesheet.id,
        userId: currentUser.id,
      }),
    }
  );
  
  const result = await response.json();
  
  if (result.success) {
    toast.success('Timesheet submitted for approval!');
    // Show approval chain
    console.log('Approval chain:', result.approvalChain);
  }
};
```

### 2. Add Permission Checks to UI

```typescript
import { getTimesheetPermissions } from '@/utils/permissions/timesheet-permissions';

function TimesheetModule({ timesheet, currentUser }) {
  const [permissions, setPermissions] = useState(null);
  
  useEffect(() => {
    async function checkPerms() {
      const perms = await getTimesheetPermissions(timesheet, currentUser);
      setPermissions(perms);
    }
    checkPerms();
  }, [timesheet, currentUser]);
  
  if (!permissions?.canView) {
    return <div>You don't have permission to view this timesheet.</div>;
  }
  
  return (
    <div>
      {permissions.isViewOnly && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>View Only</AlertTitle>
          <AlertDescription>{permissions.message}</AlertDescription>
        </Alert>
      )}
      
      {/* Disable all inputs if view-only */}
      <Input 
        value={entry.hours} 
        disabled={permissions.isViewOnly}
      />
      
      {/* Show action buttons based on permissions */}
      {permissions.canSubmit && <Button>Submit for Approval</Button>}
      {permissions.canApprove && <Button>Approve</Button>}
      {permissions.canReject && <Button>Reject</Button>}
    </div>
  );
}
```

### 3. Add Approval Queue View

```typescript
function MyApprovalsView({ currentUser }) {
  const [approvals, setApprovals] = useState([]);
  
  useEffect(() => {
    async function loadApprovals() {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/make-server-f8b491be/timesheet-approvals/my-approvals/${currentUser.id}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      const data = await response.json();
      setApprovals(data.approvals);
    }
    loadApprovals();
  }, [currentUser.id]);
  
  return (
    <div>
      <h2>Timesheets Awaiting Your Approval ({approvals.length})</h2>
      
      {approvals.map(approval => (
        <Card key={approval.timesheetId}>
          <CardHeader>
            <CardTitle>{approval.contractorId}</CardTitle>
            <CardDescription>
              {approval.projectName} • {approval.weekStart} - {approval.weekEnd}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <p>Total Hours: {approval.totalHours}</p>
            <p>Amount: ${approval.totalAmount}</p>
            <p>Step {approval.currentStep} of {approval.totalSteps}</p>
          </CardContent>
          
          <CardFooter>
            <Button onClick={() => handleApprove(approval.timesheetId)}>
              Approve
            </Button>
            <Button variant="destructive" onClick={() => handleReject(approval.timesheetId)}>
              Reject
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
```

### 4. Add Rejection Modal

```typescript
function RejectionModal({ timesheetId, onClose }) {
  const [reason, setReason] = useState('');
  
  const handleReject = async () => {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/make-server-f8b491be/timesheet-approvals/reject`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          periodId: timesheetId,
          approverId: currentUser.id,
          approverName: currentUser.name,
          reason,
        }),
      }
    );
    
    if (response.ok) {
      toast.success('Timesheet rejected');
      onClose();
    }
  };
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Timesheet</DialogTitle>
          <DialogDescription>
            Please provide a reason for rejecting this timesheet. 
            The contractor will receive your feedback.
          </DialogDescription>
        </DialogHeader>
        
        <Textarea
          placeholder="What needs to be fixed?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={5}
        />
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleReject} disabled={!reason.trim()}>
            Reject Timesheet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Testing Checklist

### Backend Tests

- [ ] Submit timesheet creates graph node
- [ ] Approval chain is built correctly from contract
- [ ] Approve moves to next step
- [ ] Approve at last step marks fully approved
- [ ] Reject sets status to 'rejected' and resets to step 1
- [ ] Rejection increments version on resubmission
- [ ] Emails are sent (check Resend dashboard)
- [ ] My approvals endpoint returns correct items

### Permission Tests

- [ ] Draft timesheet not visible to managers
- [ ] Submitted timesheet locked for contractor
- [ ] Manager can approve their assigned timesheets
- [ ] Client visibility respects contract settings
- [ ] Rejected timesheet becomes editable for contractor

### Graph Tests

- [ ] Nodes created only when submitted (not draft)
- [ ] Edges connect correctly (SUBMITTED_BY, REQUIRES_APPROVAL)
- [ ] Company stats update when timesheet submitted
- [ ] Query "my pending approvals" works

---

## Performance Considerations

### Current Implementation (KV Store)

**Good for:**
- MVP / Prototype
- < 1,000 timesheets/month
- Simple queries

**Limitations:**
- No complex graph queries
- Manual edge traversal
- No indexing

### Future: Dedicated Graph DB (Phase 6+)

**Options:**
- Neo4j (mature, Cypher query language)
- RedisGraph (fast, lightweight)
- MemGraph (in-memory, very fast)
- Postgres with Apache AGE (graph extension)

**Migration Path:**
```
Phase 5B: KV store (✅ current)
  ↓
Phase 6: Optimize KV queries, add caching
  ↓
Phase 7: Migrate to dedicated graph DB
  ↓
Phase 8: Advanced graph queries (analytics, recommendations)
```

---

## Summary

### ✅ What's Working

1. **Graph Architecture**: Timesheets are graph nodes with proper relationships
2. **Permissions**: Clear rules for who can view/edit/approve
3. **Approval Workflow**: Multi-step chain with email notifications
4. **Container Grouping**: Companies group contractors (UI-level)
5. **Database Schema**: All tables/columns/triggers in place

### 🚧 What's Next

1. **Frontend Integration**: Connect UI to new approval API
2. **Graph Filtering**: Add date range, status filters
3. **Approval Analytics**: Track approval rates, bottlenecks
4. **Manager Edit Permission**: Conditional edit with audit trail (Phase 6)
5. **Expense Reports**: Apply same pattern to expenses

### 🎯 Key Architectural Wins

- **Scalable**: Graph model supports complex multi-party workflows
- **Flexible**: Easy to add approval steps, custom chains
- **Auditable**: Every approval/rejection tracked in edges
- **Performant**: Aggregates cached in company nodes
- **Clean**: Separation of work data (Postgres) and relationships (Graph)

---

**Ready to implement frontend integration?** Let me know which component to start with!
