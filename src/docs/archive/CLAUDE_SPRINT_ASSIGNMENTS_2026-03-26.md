# Claude Sprint Assignments — March 26, 2026

**Sprint goal: Close Phase 3 gate. Zero new features until gate passes.**

Phase 3 Gate Policy: If gate = NO-GO, only blocker fixes, bug fixes, migrations, stability tests, and docs alignment are allowed.

---

## BLOCKER 1: Identity Bridge (CRITICAL)

**Assign to: backend-developer agent (Worker A)**

```
Task: Implement graph-node-to-UUID identity mapping

Context:
- approval_records.approver_user_id currently stores graph node IDs like "person-john"
  instead of real Supabase Auth UUIDs
- wg_project_members table has: user_id (UUID) + role + project_id
- The bridge needs to map: graph nodeId -> member row -> auth.users UUID

Files to modify:
- src/utils/api/approvals-supabase.ts (add resolveNodeToUserId helper)
- src/utils/api/timesheets-approval-hooks.ts (use bridge when creating approval records)

Requirements:
1. Add function resolveGraphNodeToUserId(projectId, nodeId) that:
   - Reads wg_project_members WHERE project_id = X
   - Matches member name/role against graph node name from sessionStorage name-dir
   - Returns the real UUID
   - Falls back to current user UUID if no match found
2. Use this function in createApprovalRecord() before inserting
3. Update approvals-supabase.ts getApprovalQueue() to filter by real UUID

Verification:
- Submit a timesheet as Nikola
- Check approval_records in Supabase Dashboard
- approver_user_id should be a UUID, not "person-john"

Do NOT touch: any UI files, any context files, any migration files
```

---

## BLOCKER 2: Transactional Submit (CRITICAL)

**Assign to: backend-developer agent (Worker B) or same Worker A after Blocker 1**

```
Task: Make timesheet submit -> approval record creation atomic

Context:
- Currently submit writes to TimesheetDataContext (local state) THEN creates
  approval_records (async Supabase call)
- If the Supabase call fails, the timesheet shows "Submitted" but no approval
  record exists -> approver never sees it

Files to modify:
- src/utils/api/timesheets-approval-hooks.ts
- src/contexts/TimesheetDataContext.tsx (the changeStatus function)

Requirements:
1. In changeStatus('submitted'), FIRST create the approval record via Supabase
2. Only if that succeeds, update local week status to 'submitted'
3. If Supabase call fails, keep status as 'draft' and show toast error
4. Same pattern for approve/reject: update approval_records FIRST, then local state

Verification:
- Disconnect network -> submit timesheet -> should fail gracefully, stay as Draft
- Reconnect -> submit -> should succeed, status changes, approval_records row exists
- Check: no orphan submitted timesheets without matching approval_records

Do NOT touch: UI components, migration files, approval-fallback.ts
```

---

## BLOCKER 3: State Transition Integrity (CRITICAL)

**Assign to: postgres-pro agent**

```
Task: Add DB constraint preventing approval/timesheet status divergence

Context:
- approval_records has status (pending/approved/rejected)
- wg_timesheet_weeks has status (draft/submitted/approved/rejected)
- These can currently diverge: approval says "approved" but timesheet says "submitted"

Files to modify:
- supabase/migrations/008_state_integrity.sql (new file)

Requirements:
1. Add a trigger on approval_records that, when status changes to 'approved' or 'rejected',
   also updates the corresponding wg_timesheet_weeks row
2. Add CHECK constraint: approval_records.status can only go forward
   (pending -> approved|rejected, never backward)
3. Add unique constraint: one pending approval per (subject_type, subject_id, approval_layer)
   to prevent duplicate approval records

Verification:
- Run migration in Supabase SQL Editor
- Insert test approval_record -> update to 'approved' -> check wg_timesheet_weeks auto-updated
- Try inserting duplicate pending record for same subject -> should fail

Do NOT touch: any TypeScript files
```

---

## TASK 4: QA Gate Evidence Pass

**Assign to: reviewer agent (read-only explorer)**

```
Task: Run PHASE3_GATE_CHECKLIST.md and document pass/fail evidence

Context:
- src/docs/PHASE3_GATE_CHECKLIST.md has 6 sections (A-F)
- Each checkbox needs explicit pass/fail with evidence

Requirements:
1. Read PHASE3_GATE_CHECKLIST.md
2. For each item, describe:
   - Current state (pass/fail/partial)
   - Evidence (which file/function/DB query proves it)
   - If fail: what exactly is missing
3. Write results to src/docs/PHASE3_GATE_RESULTS_2026-03-26.md
4. Final verdict: GO or NO-GO with specific remaining blockers

Do NOT touch: any code files
```

---

## TASK 5: Viewer Dropdown Verification

**Assign to: frontend-developer agent**

```
Task: Verify and fix the timesheet viewer dropdown

Context:
- The dropdown reads from sessionStorage name-dir written by WorkGraphBuilder
- Types in name-dir are: 'company', 'freelancer', 'client', 'agency' (NOT 'person')
- People have orgId set, orgs don't
- Claude fixed the filter to use entry.orgId for person detection
- Codex may have overwritten this fix

Files to check/modify:
- src/components/timesheets/ProjectTimesheetsView.tsx (the viewerOptions useMemo)

Requirements:
1. Read the current viewerOptions useMemo code
2. Verify it uses entry.orgId (not entry.type === 'person') to detect people
3. If broken, fix it:
   - People (have orgId): show as "{name}"
   - Orgs (no orgId): show as "{name} (Client|Agency|Org)"
   - Admin: show as "Admin (Full View)"
4. Test: dropdown should show Nikola, John, TIA (Org), NAS (Client), Admin

Do NOT touch: approval files, context files, migration files
```

---

## TASK 6: localStorage Persistence Verification

**Assign to: frontend-developer agent (same as Task 5)**

```
Task: Verify timesheet data survives page refresh

Context:
- Claude added localStorage persistence to TimesheetDataContext.tsx
- Codex may have overwritten this change
- Without it, all manually entered timesheet data is lost on refresh

Files to check/modify:
- src/contexts/TimesheetDataContext.tsx

Requirements:
1. Check if loadFromLocalStorage() and saveToLocalStorage() functions exist
2. If missing, add them:
   - const LS_KEY = 'workgraph-timesheet-weeks'
   - loadFromLocalStorage(): reads and parses from localStorage, returns StoredWeek[] | null
   - saveToLocalStorage(weeks): filters out demo data (personId starting with 'user-'),
     stringifies and saves
   - Initialize state: try localStorage first, fall back to createSeedData()
   - Add useEffect that saves to localStorage on every weeks change (300ms debounce)
3. Test: create week, add hours, refresh page -> data should survive

Do NOT touch: approval files, UI component files, migration files
```

---

## BANNED TASKS (until gate passes)

These are explicitly forbidden until Phase 3 gate = GO:

- No new invoice features
- No invoice import OCR/LLM integration
- No brainstorm/strategy docs
- No new Phase 4 scaffolding
- No social features
- No CSV import/export
- No Stripe integration planning

---

## Success Criteria for March 26

Phase 3 gate flips to GO when ALL of these are true:

1. [ ] approval_records.approver_user_id contains real UUIDs
2. [ ] Submit failure rolls back cleanly (no orphan submitted status)
3. [ ] Approve/reject updates both approval_records AND wg_timesheet_weeks atomically
4. [ ] Viewer dropdown shows all graph people + orgs correctly
5. [ ] Timesheet data survives page refresh
6. [ ] QA gate evidence document exists with all items passed
7. [ ] npm run build passes with zero errors

When all 7 pass, Phase 4 begins.
