# WorkGraph Task Backlog

**Version:** 2.0 · **Date:** 2026-04-24 · **Owner:** Claude (writes) / Codex (status updates)

Statuses: `[READY]` → `[IN PROGRESS]` → `[REVIEW]` → `[DONE]` / `[BLOCKED]`

---

## Manual Steps — Nikola applies in Supabase SQL Editor

| # | Migration | Status |
|---|---|---|
| M1 | `012_approval_submitter_id.sql` | `[READY]` |
| M2 | `013_graph_node_id_and_invite_link.sql` | `[READY]` |
| **M3** | **`014_approval_records_rls_fix.sql`** — **CRITICAL SECURITY. Apply first.** | **`[READY]`** |

---

## Tier 0 — Security (apply before any feature work)

### S1 · `approval-rls-fix` · `[READY]` ← APPLY M3 FIRST

**Assignee:** Nikola (manual SQL apply)
**Goal:** Migration 014 replaces the wide-open `USING (true)` policies on `approval_records`
with project-scoped policies. Until M3 is applied, any authenticated user can read/modify
approval records across all tenants.

**Acceptance criteria:**
- [ ] M3 applied in Supabase SQL Editor
- [ ] Run verify query from migration comment — confirms only 3 named policies remain
- [ ] No regression: submitter can still create and view own approvals; approver can still update

---

### S2 · `move-approval-token-signing-server-side` · `[READY]`

**Assignee:** Codex `backend-developer`
**Files:**
- `src/utils/tokens/approval-tokens.ts` (replace client signing with lookup-token pattern)
- `supabase/functions/server/invitations-api.tsx` or new `approval-email-api.tsx`

**Problem:** `approval-tokens.ts` has a hardcoded HMAC secret + `Math.random()` UUIDs in the
client bundle. Anyone can extract it and forge email approval tokens.

**Fix:**
- Remove all signing from client. Client only generates a random opaque lookup ID.
- Backend (edge function) signs and verifies tokens using `APPROVAL_TOKEN_SECRET` env var.
- Use `crypto.getRandomValues()` not `Math.random()` for ID generation.

**Acceptance criteria:**
- [ ] `SECRET_KEY` constant no longer exists in `approval-tokens.ts`
- [ ] Signing + verification lives in a single edge function handler
- [ ] `APPROVAL_TOKEN_SECRET` read from Deno `Deno.env.get('APPROVAL_TOKEN_SECRET')`
- [ ] `npm run build` passes

---

## Tier 1 — Dead Code Purge (do before any new features)

### D1 · `delete-dead-timesheet-views` · `[READY]`

**Assignee:** Codex `reviewer`
**Goal:** Delete every timesheet component that has zero imports outside its own folder.
Confirmed dead (zero live imports):
- `src/components/timesheets/TimesheetCalendarView.tsx`
- `src/components/timesheets/TimesheetManagerCalendarView.tsx`
- `src/components/timesheets/MultiPersonTimesheetCalendar.tsx`
- `src/components/timesheets/EnhancedTimesheetCalendar.tsx`
- `src/components/timesheets/IndividualTimesheet.tsx`
- `src/components/timesheets/TimesheetApprovalView.tsx`
- `src/components/timesheets/UnifiedTimesheetView.tsx`
- `src/components/timesheets/TimesheetModule.tsx`
- `src/components/timesheets/approval/` (entire folder — 12 files, zero external imports)
- `src/components/timesheets/approval-v2/` (entire folder — zero external imports)

**Instructions:** Grep each file for external imports first to confirm zero hits, then delete.
Do not delete `src/components/timesheets/ProjectTimesheetsView.tsx` — that is live.

**Acceptance criteria:**
- [ ] All listed files/folders deleted
- [ ] `npm run build` passes (confirms no live code referenced them)
- [ ] AGENT_WORKLOG updated with final deleted file list

---

### D2 · `delete-dead-approval-components` · `[READY]`

**Assignee:** Codex `reviewer`
**Goal:** Delete dead approval API files. Confirmed dead (zero live imports from app shell):
- `src/utils/api/timesheets-approval.ts` — confirm no import except `approval-v2/` (also dead)
- `src/utils/api/timesheets-approval-hooks.ts` — confirm same

**Instruct:** Grep before deleting. If found imported anywhere live, STOP and report to Claude.

**Acceptance criteria:**
- [ ] Files deleted or confirmed still needed (with evidence)
- [ ] `npm run build` passes

---

### D3 · `kill-local-only-project-mode` · `[READY]`

**Assignee:** Codex `backend-developer` + `frontend-developer` (coordinate)
**Problem:** `proj_local_*` projects live only in the browser. This doubles every write path
(timesheets, approvals, etc. all branch on `isLocalOnlyProjectId()`). In a real B2B SaaS this
mode has no place — it's a demo artifact.

**Fix:**
- Remove `isLocalOnlyProjectId()` branches from `timesheets-api.ts`, `approvals-supabase.ts`,
  `TimesheetDataContext.tsx`, `projects-api.ts`.
- Projects must either be saved to Supabase (real) or not exist. No local-only mode.
- If the user is offline/unauthenticated, show an error, don't silently persist locally.

**Files:**
- `src/utils/api/timesheets-api.ts`
- `src/utils/api/approvals-supabase.ts` (Claude-owned — Codex may edit D3 scope with clearance)
- `src/utils/api/projects-api.ts`
- `src/contexts/TimesheetDataContext.tsx`

**Acceptance criteria:**
- [ ] `isLocalOnlyProjectId` is deleted everywhere
- [ ] `LOCAL_APPROVALS_KEY`, `readLocalApprovals`, `writeLocalApprovals` deleted
- [ ] `workgraph-local-approvals` localStorage key no longer used
- [ ] `npm run build` passes

---

## Tier 2 — Sprint A (Approvals UX)

### A1 · `submit-timesheet-project-picker` · `[READY]`

**Assignee:** Codex `frontend-developer`
**Goal:** When user clicks "Submit Week" and has 2+ projects, show a project picker modal
before submitting. Currently it silently uses the last-focused project.

**Files:**
- `src/components/timesheets/ProjectTimesheetsView.tsx`
- `src/contexts/TimesheetDataContext.tsx`

**Acceptance criteria:**
- [ ] 1 project → submit directly (current behavior)
- [ ] 2+ projects → modal with project list appears
- [ ] 5+ projects → modal has search/filter
- [ ] Cancel does not submit
- [ ] `npm run build` passes

---

### A2 · `approval-queue-chain-visualization` · `[READY]`

**Assignee:** Codex `frontend-developer`
**Goal:** Each approval queue row shows a mini chain: `Submitter → Party1 → Party2` with
filled/faded dots showing the current step.

**Files:**
- `src/components/approvals/ApprovalsWorkbench.tsx`
- `src/components/approvals/SubmissionsView.tsx`

**Spec:** `src/docs/specs/APPROVAL_SUBMISSIONS_SPEC.md`

**Acceptance criteria:**
- [ ] Queue rows show truncated chain with current step highlighted
- [ ] Works for 2-party and 3-party chains
- [ ] Does not break 6-column grid layout
- [ ] `npm run build` passes

---

### A3 · `approval-queue-ux-polish` · `[READY]`

**Assignee:** Codex `frontend-developer`
**Goal:** Column headers sentence case; org name from snapshot (not "Unknown organization");
status chip consistency; empty-state message.

**Files:**
- `src/components/approvals/ApprovalsWorkbench.tsx`

**Acceptance criteria:**
- [ ] Sentence-case headers
- [ ] Real org name from `subject_snapshot.orgName` or nameDirectory
- [ ] Status chips: Pending (yellow), Approved (green), Rejected (red), Draft (grey)
- [ ] Empty state: "No pending approvals" with icon
- [ ] `npm run build` passes

---

## Tier 3 — Sprint B (Graph + Permissions)

### B1 · `project-creation-wizard-redesign` · `[READY]`

**Assignee:** Codex `frontend-developer`
**Spec:** `src/docs/specs/PROJECT_CREATION_SPEC.md`
**Goal:** Step 1 = Name + Type + Visibility + Dates + Work Week only. Remove currency/region.

**Files:** `src/components/workgraph/ProjectCreateWizard.tsx`

**Acceptance criteria:**
- [ ] Currency and Region inputs REMOVED
- [ ] Atomic creation still works
- [ ] `npm run build` passes

---

### B2 · `graph-empty-state-investigation` · `[READY]`

**Assignee:** Codex `reviewer`
**Goal:** Investigate why NAS project graph canvas shows empty. Check DB and mapper.

**Steps:**
1. `SELECT id, name, graph IS NOT NULL FROM wg_projects ORDER BY created_at DESC LIMIT 10`
2. If `graph` null → write path broken, report to Claude
3. If `graph` present → check `mapSupabaseProjectRow()` includes `graph` + `parties`

**Output:** Write findings in AGENT_WORKLOG.md. No code changes without Claude sign-off.

---

### B3 · `server-side-role-enforcement` · `[BLOCKED]`

**Blocked by:** M2 (migration 013 must be applied first)
**Assignee:** Codex `backend-developer`
**Files:** `supabase/functions/server/projects-api.tsx`

**Acceptance criteria:**
- [ ] `PUT /projects/:id` returns 403 if caller is not owner or editor
- [ ] `DELETE /projects/:id` returns 403 if caller is not owner
- [ ] `npm run build` passes

---

## Tier 4 — Sprint C (Invitation Flow)

### C1 · `invitation-acceptance-ui` · `[READY]`

**Assignee:** Codex `frontend-developer`
**Goal:** `/invite/:token` page — shows project name + role, Accept/Decline, redirects on accept.

**Files:**
- `src/components/invitations/InviteAcceptPage.tsx` (new)
- `src/routes.tsx`

**Backend:** `supabase/functions/server/invitations-api.tsx` — `GET /invitations/:token`, `POST /invitations/:token/accept`

**Acceptance criteria:**
- [ ] Shows project name, inviting org, role offered
- [ ] Accept calls `POST /invitations/:token/accept`
- [ ] Success → redirect to workspace
- [ ] Expired/invalid token → clear error
- [ ] Unauthenticated → prompt sign-in, redirect back
- [ ] `npm run build` passes

---

## Phase 4 Queue — Invoice Generation

Held until Tier 0–1 (security + dead code) are resolved.

| Task | Description | Owner | Status |
|---|---|---|---|
| P4-1 | Invoice orchestrator: approved timesheet → invoice draft | Codex backend | `[READY]` |
| P4-2 | Invoice list view with status chips | Codex frontend | `[READY]` |
| P4-3 | Invoice PDF export | Codex frontend | `[READY]` |
| P4-4 | Apply migration 010 (`wg_invoices`) | Nikola | `[READY]` |

Spec: `src/docs/specs/PHASE4_INVOICE_SPEC.md`

---

## Done

| Task | Completed |
|---|---|
| approval-rls-fix migration written (014) | 2026-04-24 |
| approval-submissions-redesign | 2026-04-22 |
| project-workspace-role-gating | 2026-04-22 |
| atomic-project-create-path | 2026-04-22 |
| project-delete-owner-guard | 2026-04-22 |
| project-cloud-refresh-persistence | 2026-04-21 |
| task6a–6e approval chain bugs | 2026-04-21 |
| bundle-splitting (9 chunks <400kB) | 2026-04-20 |
| invoice edge functions scaffolding | 2026-04-20 |
| graph context fix (no tab-visit required) | 2026-04-20 |
| invite email edge function | 2026-04-20 |
