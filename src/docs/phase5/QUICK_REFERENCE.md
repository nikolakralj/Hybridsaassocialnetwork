# Quick Reference: Graph-Based Timesheet Approvals

## API Endpoints

### Submit Timesheet
```bash
POST /make-server-f8b491be/timesheet-approvals/submit
Content-Type: application/json
Authorization: Bearer {publicAnonKey}

{
  "periodId": "abc-123",
  "userId": "user-alice"
}

Response:
{
  "success": true,
  "nodeId": "ts-2025-11-03-alice",
  "approvalChain": [
    { "step": 1, "approverId": "user-bob", "approverName": "Bob Manager", "role": "manager" },
    { "step": 2, "approverId": "user-carol", "approverName": "Carol Client", "role": "client" }
  ]
}
```

### Approve Timesheet
```bash
POST /make-server-f8b491be/timesheet-approvals/approve
Content-Type: application/json

{
  "periodId": "abc-123",
  "approverId": "user-bob",
  "approverName": "Bob Manager",
  "comment": "LGTM"
}

Response:
{
  "success": true,
  "fullyApproved": false,
  "nextStep": 2,
  "message": "Moved to next approval step"
}
```

### Reject Timesheet
```bash
POST /make-server-f8b491be/timesheet-approvals/reject
Content-Type: application/json

{
  "periodId": "abc-123",
  "approverId": "user-bob",
  "approverName": "Bob Manager",
  "reason": "Missing task descriptions for Nov 5-6"
}

Response:
{
  "success": true,
  "message": "Timesheet rejected - contractor can now edit and resubmit"
}
```

### Get My Pending Approvals
```bash
GET /make-server-f8b491be/timesheet-approvals/my-approvals/{userId}
Authorization: Bearer {publicAnonKey}

Response:
{
  "approvals": [
    {
      "timesheetId": "abc-123",
      "graphNodeId": "ts-2025-11-03-alice",
      "contractorId": "user-alice",
      "projectName": "ACME Website",
      "weekStart": "2025-11-03",
      "weekEnd": "2025-11-09",
      "totalHours": 40,
      "totalAmount": 3000,
      "submittedAt": "2025-11-10T14:30:00Z",
      "currentStep": 1,
      "totalSteps": 2
    }
  ]
}
```

---

## Permission Functions

### Check View Permission
```typescript
import { canViewTimesheet } from '@/utils/permissions/timesheet-permissions';

const canView = await canViewTimesheet(
  { id: 'ts-123', contractorId: 'user-alice', status: 'submitted', ... },
  { id: 'user-bob', role: 'manager', companyId: 'company-1' }
);
// Returns: true (manager can view submitted timesheets)
```

### Check Edit Permission
```typescript
import { canEditTimesheet } from '@/utils/permissions/timesheet-permissions';

const canEdit = await canEditTimesheet(
  { id: 'ts-123', contractorId: 'user-alice', status: 'submitted', ... },
  { id: 'user-alice', role: 'contractor', companyId: 'company-1' }
);
// Returns: false (contractor can't edit submitted timesheets)
```

### Get All Permissions
```typescript
import { getTimesheetPermissions } from '@/utils/permissions/timesheet-permissions';

const permissions = await getTimesheetPermissions(timesheet, currentUser);
console.log(permissions);
/*
{
  canView: true,
  canEdit: false,
  canSubmit: false,
  canApprove: true,
  canReject: true,
  canRecall: false,
  isViewOnly: false,
  message: undefined
}
*/
```

---

## Graph Node Schema

### TimesheetPeriod Node
```typescript
{
  nodeType: "TimesheetPeriod",
  nodeId: "ts-2025-11-03-alice",
  properties: {
    // Temporal
    weekStart: "2025-11-03",
    weekEnd: "2025-11-09",
    submittedAt: "2025-11-10T14:30:00Z",
    approvedAt?: "2025-11-11T09:00:00Z",
    lastModifiedAt: "2025-11-10T14:30:00Z",
    
    // Workflow
    status: "in_review", // draft | submitted | in_review | rejected | approved | locked
    currentStep: 2,
    totalSteps: 2,
    version: 1,
    
    // Data
    totalHours: 40,
    billableHours: 40,
    overtimeHours: 0,
    daysWorked: 5,
    totalAmount: 3000,
    currency: "USD",
    hourlyRate: 75,
    
    // References
    postgresEntriesRef: "period_id = 'abc-123'",
    postgresPeriodId: "abc-123",
    
    // Flags
    hasOvertimeFlag: false,
    requiresClientApproval: true
  }
}
```

### Approval Edge
```typescript
{
  type: "REQUIRES_APPROVAL",
  from: "ts-2025-11-03-alice",
  to: "user-bob",
  metadata: {
    step: 1,
    status: "approved", // pending | approved | rejected
    approvedAt: "2025-11-11T09:00:00Z",
    approvalComment: "LGTM",
    notifiedAt: "2025-11-10T14:31:00Z",
    remindersSent: 0
  }
}
```

---

## Status Flow

```
┌─────────┐
│  DRAFT  │ ← Contractor creates/edits
└────┬────┘
     │ Submit
     ↓
┌──────────────┐
│  SUBMITTED   │ ← Waiting for first approver
└──────┬───────┘
       │ Approve
       ↓
┌──────────────┐
│  IN_REVIEW   │ ← Multi-step approval process
└──────┬───────┘
       │ Last approver approves
       ↓
┌──────────────┐
│  APPROVED    │ ← Fully approved, ready for payment
└──────┬───────┘
       │ Generate invoice
       ↓
┌──────────────┐
│   LOCKED     │ ← Tied to invoice, immutable
└──────────────┘

       ┌──────────────┐
       │  REJECTED    │ ← Any approver rejects
       └──────┬───────┘
              │ Contractor fixes
              ↓
       Back to DRAFT (version++)
```

---

## Contract Settings

### Visibility Settings
```sql
-- How clients see timesheets
UPDATE project_contracts SET client_timesheet_visibility = 
  'none'              -- Client never sees timesheets
  'after_approval'    -- Client sees after manager approves (DEFAULT)
  'after_submission'  -- Client sees as soon as contractor submits
  'real_time'         -- Client sees drafts (rare)
WHERE id = 'contract-123';
```

### Approval Settings
```sql
-- Whether client approval is required
UPDATE project_contracts SET requires_client_approval = true
WHERE id = 'contract-123';

-- Whether managers can edit submitted timesheets (Phase 6)
UPDATE project_contracts SET allow_manager_timesheet_edits = true
WHERE id = 'contract-123';
```

---

## Database Queries

### Get Timesheet with Full Details
```sql
SELECT 
  tp.*,
  pc.hourly_rate,
  pc.requires_client_approval,
  p.name as project_name,
  u.name as contractor_name
FROM timesheet_periods tp
JOIN project_contracts pc ON tp.contract_id = pc.id
JOIN projects p ON pc.project_id = p.id
JOIN users u ON pc.user_id = u.id
WHERE tp.id = 'abc-123';
```

### Get All Pending Timesheets
```sql
SELECT * FROM timesheet_periods
WHERE status IN ('submitted', 'in_review')
ORDER BY submitted_at ASC;
```

### Get Contractor's Timesheets
```sql
SELECT tp.*, pc.hourly_rate
FROM timesheet_periods tp
JOIN project_contracts pc ON tp.contract_id = pc.id
WHERE pc.user_id = 'user-alice'
ORDER BY tp.week_start_date DESC;
```

---

## Email Templates

### Approval Request
**Subject:** New Timesheet Submitted - {contractor} - Week of {date}

**Body:**
```
Hi {approver},

{contractor} has submitted a timesheet for your approval.

Period: {weekStart} - {weekEnd}
Total Hours: {hours} hours
Estimated Amount: ${amount}

[Review and Approve Button]
```

### Approval Confirmation
**Subject:** Timesheet Approved - Week of {date}

**Body:**
```
Hi {contractor},

Your timesheet for {weekStart} - {weekEnd} has been approved by {approver}.

Total Hours: {hours} hours
Amount: ${amount}
Payment ETA: Within 5 business days

[View Details Button]
```

### Rejection Notice
**Subject:** Timesheet Requires Changes - Week of {date}

**Body:**
```
Hi {contractor},

Your timesheet for {weekStart} - {weekEnd} has been returned for revision by {approver}.

Manager's Notes:
{rejectionReason}

Please review the feedback and resubmit your timesheet.

[Edit Timesheet Button]
```

---

## Testing Commands

### Seed Test Data
```bash
# Run database schema updates
psql -f /docs/phase5/DATABASE_SCHEMA_UPDATES.sql

# Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('timesheet_periods', 'expense_reports', 'timesheet_edit_log');
```

### Test Submission
```bash
curl -X POST http://localhost:54321/functions/v1/make-server-f8b491be/timesheet-approvals/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {anonKey}" \
  -d '{
    "periodId": "test-period-123",
    "userId": "user-alice"
  }'
```

### Check Graph Node
```sql
SELECT * FROM kv_store_f8b491be 
WHERE key LIKE 'graph:node:ts-%'
LIMIT 5;
```

### Check Approval Edges
```sql
SELECT * FROM kv_store_f8b491be 
WHERE key LIKE 'graph:edge:%:requires_approval:%'
LIMIT 5;
```

---

## Common Patterns

### Display Status Badge
```tsx
import { getStatusBadgeInfo } from '@/utils/permissions/timesheet-permissions';

function StatusBadge({ status, viewerRole }) {
  const { variant, label, description } = getStatusBadgeInfo(status, viewerRole);
  
  return (
    <Badge variant={variant} title={description}>
      {label}
    </Badge>
  );
}
```

### Permission-Based Form
```tsx
function TimesheetForm({ timesheet, currentUser }) {
  const [permissions, setPermissions] = useState(null);
  
  useEffect(() => {
    async function check() {
      const perms = await getTimesheetPermissions(timesheet, currentUser);
      setPermissions(perms);
    }
    check();
  }, [timesheet, currentUser]);
  
  if (!permissions?.canView) return <AccessDenied />;
  
  const disabled = permissions.isViewOnly;
  
  return (
    <form>
      {permissions.message && <Alert>{permissions.message}</Alert>}
      
      <Input disabled={disabled} />
      <Textarea disabled={disabled} />
      
      {permissions.canSubmit && <Button>Submit</Button>}
      {permissions.canApprove && <Button>Approve</Button>}
    </form>
  );
}
```

### Approval Queue
```tsx
function ApprovalQueue({ currentUser }) {
  const { data: approvals } = useQuery({
    queryKey: ['my-approvals', currentUser.id],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/my-approvals/${currentUser.id}`);
      return res.json();
    },
  });
  
  return (
    <div>
      <h2>Pending Approvals ({approvals?.length || 0})</h2>
      {approvals?.map(a => (
        <ApprovalCard key={a.timesheetId} approval={a} />
      ))}
    </div>
  );
}
```

---

## Troubleshooting

### Timesheet Won't Submit
**Check:**
1. Is timesheet in 'draft' status?
2. Does contract exist and have approval chain?
3. Are there entries in timesheet_entries table?
4. Check server logs for errors

### Can't Approve Timesheet
**Check:**
1. Is user the current approver? (check currentStep)
2. Is timesheet in 'submitted' or 'in_review' status?
3. Check approval edge exists: `graph:edge:{nodeId}:requires_approval:{userId}:step{N}`

### Emails Not Sending
**Check:**
1. RESEND_API_KEY is set
2. Using delivered@resend.dev for testing
3. Check Resend dashboard for delivery status
4. Check server logs for email errors

### Permission Denied
**Check:**
1. User role is correct
2. Timesheet status matches expected state
3. Contract visibility settings
4. Graph node exists (if submitted)

---

## Migration Checklist

- [ ] Run DATABASE_SCHEMA_UPDATES.sql
- [ ] Verify all columns added (graph_node_id, client_timesheet_visibility, etc.)
- [ ] Update existing contracts with default visibility settings
- [ ] Test submission creates graph nodes
- [ ] Test approval flow (submit → approve → approve → fully approved)
- [ ] Test rejection flow (submit → reject → edit → resubmit)
- [ ] Verify emails send to delivered@resend.dev
- [ ] Test permission checks in UI
- [ ] Add approval queue view
- [ ] Add rejection modal with notes
- [ ] Test multi-step approval chains

---

**Need help?** Check `/docs/phase5/IMPLEMENTATION_SUMMARY.md` for detailed examples!
