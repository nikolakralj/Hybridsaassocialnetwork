# Timesheet Visibility & Permission Model

## Overview
This document defines the visibility rules and edit permissions for timesheets across different states and user roles in WorkGraph.

## Core Principles

### 🔐 Security & Accountability
- **Clear Ownership**: Each timesheet is owned by the contractor who created it
- **Audit Trail**: All changes, approvals, and rejections are logged
- **Non-Repudiation**: Once submitted, the contractor's original submission is locked
- **Transparency**: All stakeholders can see who made what changes and when

### 🎯 Workflow Integrity
- **Work-in-Progress Privacy**: Draft timesheets are private to the creator
- **Immutable Submissions**: Submitted timesheets cannot be edited by the submitter
- **Clear Approval Path**: Changes require rejection and resubmission, not in-line editing

---

## Permission Matrix

### 1. DRAFT State (Contractor Working)

| Role | Can View? | Can Edit? | Can Submit? | Can Delete? |
|------|-----------|-----------|-------------|-------------|
| **Contractor (Owner)** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Manager** | ❌ No* | ❌ No | ❌ No | ❌ No |
| **Client** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Finance** | ❌ No | ❌ No | ❌ No | ❌ No |

**\*Manager Exception**: Managers should NOT see draft timesheets by default. This is work-in-progress data that may be:
- Incomplete
- Inaccurate (contractor still adjusting)
- Missing notes or context
- Not ready for review

**Why this matters**: Showing drafts creates confusion, premature questions, and wastes manager time reviewing incomplete data.

**Optional Feature**: Contractors could optionally "share draft" for early feedback, but this should be explicit opt-in.

---

### 2. SUBMITTED State (Pending Manager Approval)

| Role | Can View? | Can Edit? | Can Approve? | Can Reject? | Can Recall? |
|------|-----------|-----------|--------------|-------------|-------------|
| **Contractor (Owner)** | ✅ Yes (View Only) | ❌ No | ❌ No | ❌ No | ⚠️ Optional Feature |
| **Manager** | ✅ Yes | ⚠️ See Below | ✅ Yes | ✅ Yes (with notes) | ❌ No |
| **Client** | ⚠️ Depends | ❌ No | ❌ No | ❌ No | ❌ No |
| **Finance** | ✅ Yes (View Only) | ❌ No | ❌ No | ❌ No | ❌ No |

#### Manager Edit Permission - Two Approaches:

**Approach A: View Only (Recommended for MVP)**
- ✅ **Managers CANNOT edit submitted timesheets**
- If errors found → Reject with detailed notes
- Contractor fixes and resubmits
- **Pros**: Clear accountability, simple workflow, full audit trail
- **Cons**: Extra round-trip if minor errors

**Approach B: Conditional Edit (Future Enhancement)**
- ✅ **Managers CAN edit with contractor pre-approval**
- Contractor grants "allow corrections" flag when submitting
- All manager edits are logged with timestamps
- Contractor gets notification of changes before final approval
- **Pros**: Faster for minor corrections (e.g., rounding errors)
- **Cons**: More complex, requires additional UI/UX, potential for disputes

**RECOMMENDATION**: Start with Approach A (View Only), add Approach B in Phase 6+ if needed.

---

### 3. MANAGER_APPROVED State (Pending Finance/Invoice)

| Role | Can View? | Can Edit? | Can Revert? |
|------|-----------|-----------|-------------|
| **Contractor (Owner)** | ✅ Yes (View Only) | ❌ No | ❌ No |
| **Manager** | ✅ Yes (View Only) | ❌ No | ⚠️ Yes (with reason) |
| **Client** | ✅ Yes (View Only) | ❌ No | ❌ No |
| **Finance** | ✅ Yes | ❌ No | ✅ Yes (sends back to manager) |

**Why lock after approval?**
- Prevents "approval creep" where numbers change after approval
- Clear handoff between manager → finance → payment
- If errors discovered, formal revert process required

---

### 4. REJECTED State (Sent Back to Contractor)

| Role | Can View? | Can Edit? | Can Resubmit? |
|------|-----------|-----------|---------------|
| **Contractor (Owner)** | ✅ Yes | ✅ Yes (becomes draft) | ✅ Yes (after fixes) |
| **Manager** | ✅ Yes (rejected version) | ❌ No | ❌ No |
| **Client** | ⚠️ Depends | ❌ No | ❌ No |
| **Finance** | ✅ Yes (View Only) | ❌ No | ❌ No |

**Rejection Notes Required**: Manager must provide clear notes explaining:
- What needs to be fixed
- Which entries are problematic
- Any missing information

**Version History**: System should keep both:
- Original rejected version (read-only)
- New editable draft version

---

### 5. FINANCE_APPROVED State (Ready for Payment)

| Role | Can View? | Can Edit? | Can Revert? |
|------|-----------|-----------|-------------|
| **Contractor (Owner)** | ✅ Yes (View Only) | ❌ No | ❌ No |
| **Manager** | ✅ Yes (View Only) | ❌ No | ❌ No |
| **Client** | ✅ Yes (View Only) | ❌ No | ❌ No |
| **Finance** | ✅ Yes (View Only) | ❌ No | ⚠️ Emergency Only |

**Immutable After Finance Approval**: This is the final locked state. Changes require formal amendment process.

---

## Client Visibility Rules

### Question: Should clients see timesheets before submission?

**Answer: NO (by default)**

#### Why Clients Shouldn't See Drafts:
1. **Work-in-Progress**: Draft data is incomplete and may not reflect final hours
2. **Confusion**: Clients may question hours that the contractor is still adjusting
3. **Micromanagement**: Real-time visibility can lead to unhealthy oversight
4. **Business Model**: Most consulting relationships don't give clients this level of access

#### When Should Clients See Timesheets?

**Option 1: After Manager Approval (Recommended)**
- ✅ Client sees timesheets after manager approves them
- ✅ Data is vetted and accurate
- ✅ Professional appearance
- ✅ Aligns with standard consulting practices

**Option 2: After Submission (More Transparent)**
- ✅ Client sees timesheets as soon as contractor submits
- ✅ Can provide feedback during manager review
- ✅ More collaborative approach
- ⚠️ Risk: Client might reject things manager would approve

**Option 3: Custom Per-Contract (Most Flexible)**
- Each contract has a `client_visibility` setting:
  - `none`: Client never sees timesheets (agency handles all)
  - `after_approval`: Client sees after manager approves
  - `after_submission`: Client sees immediately after submission
  - `real_time`: Client sees drafts (rare, only for specific contracts)

**RECOMMENDATION**: Start with Option 1 (after manager approval), add contract-level settings in Phase 6+.

---

## Technical Implementation

### Database Changes Needed

```sql
-- Add visibility rules to contracts
ALTER TABLE project_contracts ADD COLUMN client_timesheet_visibility TEXT 
  CHECK (client_timesheet_visibility IN ('none', 'after_approval', 'after_submission', 'real_time'))
  DEFAULT 'after_approval';

-- Add manager edit permission flag
ALTER TABLE project_contracts ADD COLUMN allow_manager_timesheet_edits BOOLEAN DEFAULT false;

-- Add audit log for edits (if we implement Approach B)
CREATE TABLE timesheet_edit_log (
  id SERIAL PRIMARY KEY,
  timesheet_period_id INTEGER REFERENCES timesheet_periods(id),
  edited_by_user_id INTEGER REFERENCES users(id),
  edit_timestamp TIMESTAMP DEFAULT NOW(),
  changed_fields JSONB, -- e.g., {"entry_123": {"old_hours": 8, "new_hours": 7.5}}
  edit_reason TEXT,
  contractor_notified_at TIMESTAMP
);
```

### Frontend Permission Checks

```typescript
// Permission helper functions
function canViewTimesheet(
  timesheet: Timesheet,
  viewer: User,
  contract: Contract
): boolean {
  // Contractor can always view their own
  if (viewer.id === timesheet.contractor_id) return true;
  
  // Draft = private to contractor only
  if (timesheet.status === 'draft') return false;
  
  // Manager can view submitted+
  if (viewer.role === 'manager' && timesheet.status !== 'draft') return true;
  
  // Client visibility depends on contract settings
  if (viewer.role === 'client') {
    const visibility = contract.client_timesheet_visibility;
    
    if (visibility === 'none') return false;
    if (visibility === 'after_approval') {
      return ['manager_approved', 'finance_approved'].includes(timesheet.status);
    }
    if (visibility === 'after_submission') {
      return ['submitted', 'manager_approved', 'finance_approved'].includes(timesheet.status);
    }
    if (visibility === 'real_time') return true;
  }
  
  // Finance can view submitted+
  if (viewer.role === 'finance' && timesheet.status !== 'draft') return true;
  
  return false;
}

function canEditTimesheet(
  timesheet: Timesheet,
  editor: User,
  contract: Contract
): boolean {
  // Only contractor can edit draft or rejected
  if (editor.id === timesheet.contractor_id) {
    return ['draft', 'rejected'].includes(timesheet.status);
  }
  
  // Manager edit permission (if we implement Approach B)
  if (editor.role === 'manager' && 
      timesheet.status === 'submitted' &&
      contract.allow_manager_timesheet_edits) {
    return true;
  }
  
  // Nobody else can edit
  return false;
}
```

### UI Changes Required

#### Timesheet Status Indicator
```tsx
function TimesheetStatusBadge({ status, viewerRole }: { status: TimesheetStatus, viewerRole: string }) {
  if (status === 'draft' && viewerRole === 'contractor') {
    return <Badge variant="secondary"><Clock /> Draft - Not Visible to Others</Badge>;
  }
  
  if (status === 'submitted' && viewerRole === 'contractor') {
    return (
      <Badge variant="outline">
        <AlertTriangle /> Submitted - Locked Until Reviewed
      </Badge>
    );
  }
  
  // ... other states
}
```

#### Permission-Based UI
```tsx
function TimesheetModule({ timesheet, viewer, contract }) {
  const canView = canViewTimesheet(timesheet, viewer, contract);
  const canEdit = canEditTimesheet(timesheet, viewer, contract);
  const isViewOnly = canView && !canEdit;
  
  if (!canView) {
    return <div>You don't have permission to view this timesheet.</div>;
  }
  
  return (
    <div>
      {isViewOnly && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>View Only</AlertTitle>
          <AlertDescription>
            {viewer.role === 'contractor' 
              ? "This timesheet has been submitted and cannot be edited. If you need to make changes, please contact your manager."
              : "You have view-only access to this timesheet."
            }
          </AlertDescription>
        </Alert>
      )}
      
      {/* Render timesheet with all inputs disabled if isViewOnly */}
      <TimesheetGrid entries={timesheet.entries} disabled={isViewOnly} />
      
      {/* Show different action buttons based on permissions */}
      {canEdit && <Button>Save Draft</Button>}
      {canEdit && <Button>Submit for Approval</Button>}
      {viewer.role === 'manager' && timesheet.status === 'submitted' && (
        <>
          <Button variant="success">Approve</Button>
          <Button variant="destructive">Reject</Button>
        </>
      )}
    </div>
  );
}
```

---

## User Stories

### Story 1: Contractor Creates Timesheet
```
AS A contractor
WHEN I create a new timesheet
THEN it starts in "draft" status
AND only I can see it
AND I can edit all fields
AND I can save changes without submitting
AND my manager/client CANNOT see it yet
```

### Story 2: Contractor Submits Timesheet
```
AS A contractor
WHEN I submit my timesheet for approval
THEN the status changes to "submitted"
AND all fields become read-only for me
AND my manager receives a notification
AND I can view the timesheet but cannot edit it
AND the system shows a clear "Submitted - Awaiting Approval" message
```

### Story 3: Manager Reviews Timesheet
```
AS A manager
WHEN a contractor submits a timesheet
THEN I receive a notification
AND I can view the complete timesheet
AND I can see all hours, notes, and calculated totals
AND I CANNOT edit the timesheet directly (MVP)
AND I can approve or reject with notes
```

### Story 4: Manager Finds Error (Approach A - View Only)
```
AS A manager
WHEN I find an error in a submitted timesheet
THEN I click "Reject"
AND I write detailed notes explaining the issue
AND the timesheet goes back to "rejected" status
AND the contractor receives a notification
AND the contractor can now edit and resubmit
```

### Story 5: Manager Finds Minor Error (Approach B - Future)
```
AS A manager
WHEN I find a minor error in a submitted timesheet
AND the contractor has enabled "allow corrections"
THEN I can click "Edit" to make small changes
AND the system logs all my changes with timestamps
AND the contractor receives a notification of changes
AND the contractor must acknowledge before final approval
```

### Story 6: Client Views Approved Timesheet
```
AS A client
WHEN a manager approves a timesheet
AND my contract has client_visibility = "after_approval"
THEN I can view the timesheet in my dashboard
AND I see all hours, rates, and calculated amounts
AND I CANNOT edit anything
AND I can export to PDF or download
```

---

## Rejection Workflow

### Manager Rejects Timesheet

**Required Information:**
1. ✅ Rejection reason (text field, required)
2. ✅ Specific entries with issues (optional, can highlight)
3. ✅ Suggested corrections (optional, helpful for contractor)

**System Actions:**
1. Change status from `submitted` → `rejected`
2. Store rejection notes in `timesheet_periods.review_notes`
3. Store rejected timestamp in `timesheet_periods.reviewed_at`
4. Create new draft copy for contractor to edit
5. Send email notification to contractor with rejection notes
6. Log event in audit trail

**Contractor Actions After Rejection:**
1. View rejected version (read-only, for reference)
2. Edit new draft version with corrections
3. Add notes explaining changes made
4. Resubmit for approval

**UI Flow:**
```
[Submitted Timesheet] 
  → Manager clicks "Reject"
  → Modal appears: "Why are you rejecting?"
     - Text area for notes (required)
     - Checkbox: "Highlight specific entries" (optional)
     - If checked, manager can click on entries to flag them
  → Manager clicks "Confirm Rejection"
  → Contractor receives email + in-app notification
  → Contractor sees banner: "Timesheet Rejected - Please Review Manager's Notes"
  → Contractor can view side-by-side:
     - Left: Rejected version (read-only)
     - Right: New draft (editable)
  → Contractor makes fixes and resubmits
```

---

## Email Notifications

### Submission Email (to Manager)
```
Subject: New Timesheet Submitted - [Contractor Name] - Week of [Date]

Hi [Manager Name],

[Contractor Name] has submitted a timesheet for your approval.

Period: [Week Start] - [Week End]
Total Hours: [X.XX] hours
Estimated Amount: $[X,XXX.XX]

Review and approve: [Link to Approval Page]

---
WorkGraph Approval System
```

### Approval Email (to Contractor)
```
Subject: Timesheet Approved - Week of [Date]

Hi [Contractor Name],

Your timesheet for [Week Start] - [Week End] has been approved by [Manager Name].

Total Hours: [X.XX] hours
Amount: $[X,XXX.XX]
Payment ETA: [Date]

View details: [Link to Timesheet]

---
WorkGraph
```

### Rejection Email (to Contractor)
```
Subject: Timesheet Requires Changes - Week of [Date]

Hi [Contractor Name],

Your timesheet for [Week Start] - [Week End] has been returned for revision.

Manager's Notes:
[Rejection reason text]

Please review the feedback and resubmit your timesheet.

Edit timesheet: [Link to Timesheet]

---
WorkGraph
```

---

## Implementation Phases

### Phase 5A (Current Sprint) ✅
- [x] Basic draft/submitted/approved states
- [x] Contractor can edit draft only
- [x] Manager can approve/reject
- [x] Email notifications on state changes

### Phase 5B (Next Sprint) 🎯
- [ ] Implement view-only enforcement in UI
- [ ] Add "View Only" indicators/alerts
- [ ] Disable inputs when `status !== 'draft'`
- [ ] Add rejection modal with notes
- [ ] Show rejection notes to contractor
- [ ] Add contract-level `client_visibility` setting

### Phase 6 (Future)
- [ ] Manager conditional edit permission (Approach B)
- [ ] Audit log for all timesheet changes
- [ ] Side-by-side rejected vs. draft view
- [ ] Contractor "allow corrections" flag
- [ ] Manager change notifications
- [ ] Version history tracking

---

## FAQ

### Q: What if a contractor makes a genuine mistake after submission?
**A**: They should contact their manager immediately. Manager can reject the timesheet with notes, contractor fixes and resubmits. This should be a quick process (same day).

### Q: What if the manager is unavailable and the timesheet is urgent?
**A**: Future feature: "Escalation" workflow where timesheets auto-escalate to next-level manager after X days. For MVP, contractor should reach out directly.

### Q: Can a contractor recall a submitted timesheet?
**A**: Not in MVP. Once submitted, only manager can reject. Future feature: "Recall" button (only if not yet reviewed, time-limited).

### Q: Should we show hourly rates to clients?
**A**: Depends on contract type. Some contracts hide rates (fixed price), others show them (T&M). Add `hide_rates` flag to `project_contracts` table.

### Q: What about amendments after payment?
**A**: Phase 7+ feature. Requires "Amendment" workflow with separate approval chain and corrective invoicing.

---

## Summary & Recommendation

### ✅ For MVP (Phase 5):

1. **Draft State**: Private to contractor only
   - Managers/clients cannot see
   - Only contractor can edit

2. **Submitted State**: View only for contractor, manager can review
   - Contractor: View only (locked)
   - Manager: View + Approve/Reject (NO edit)
   - Client: No access yet (add in Phase 5B)

3. **Rejection Flow**: Manager rejects with notes, contractor fixes
   - Clear rejection reasons required
   - Contractor edits new draft and resubmits

4. **Client Visibility**: After manager approval
   - Add `client_timesheet_visibility` to contracts
   - Default to `after_approval`
   - Always view-only for clients

This approach provides:
- ✅ Clear accountability (who submitted what)
- ✅ Audit trail (all changes tracked)
- ✅ Simple workflow (no complex edit permissions)
- ✅ Professional appearance (no work-in-progress leaks)
- ✅ Room to grow (can add manager edit in Phase 6)

---

**Next Steps**: Do you agree with this model? Should we proceed with implementing the view-only enforcement and client visibility settings?
