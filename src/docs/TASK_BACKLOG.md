# WorkGraph Task Backlog

**Version:** 2.1 · **Date:** 2026-04-26 · **Owner:** Claude (writes) / Codex (status updates)

Statuses: `[READY]` → `[IN PROGRESS]` → `[REVIEW]` → `[DONE]` / `[BLOCKED]`

---

## Manual Steps — Nikola applies in Supabase SQL Editor

| # | Migration | Status |
|---|---|---|
| M1 | `012_approval_submitter_id.sql` | `[DONE]` |
| M2 | `013_graph_node_id_and_invite_link.sql` — blocks B3 | `[READY]` |
| M3 | `014_approval_records_rls_fix.sql` — applied 2026-04-24 | `[DONE]` |
| M4 | `015_purge_dead_legacy_tables.sql` — drops orphaned pre-wg_ tables, safe to apply | `[READY]` |

---

## Tier 0 — Security ✅ COMPLETE

### S1 · `approval-rls-fix` · `[DONE]` — 2026-04-24

M3 applied. Verified: `approval_records_select`, `approval_records_insert`, `approval_records_update`
all present with project-scoped USING clauses. `approval_records_block_self_approval` trigger live.

---

### S2 · `move-approval-token-signing-server-side` · `[DONE]` — 2026-04-24

- `SECRET_KEY` removed from `approval-tokens.ts` (type definitions only)
- `supabase/functions/server/approval-tokens-api.tsx` created: HMAC-SHA256 signing + timing-safe verify
- `APPROVAL_TOKEN_SECRET` read from `Deno.env.get()`; `crypto.randomUUID()` for IDs
- Wired into `index.tsx` as `registerApprovalTokenRoutes(app)`
- `npm run build` passes

⚠️ **Nikola action required:** Set `APPROVAL_TOKEN_SECRET` in Supabase Dashboard → Settings → Edge Functions → Secrets before deploying.

---

## Tier 1 — Dead Code Purge ✅ COMPLETE

### D1 · `delete-dead-timesheet-views` · `[DONE]` — 2026-04-24

All listed files/folders deleted. `ProjectTimesheetsView.tsx` preserved. Build passes.

---

### D2 · `delete-dead-approval-components` · `[DONE]` — 2026-04-24

`timesheets-approval.ts` and `timesheets-approval-hooks.ts` deleted. Build passes.

---

### D3 · `kill-local-only-project-mode` · `[DONE]` — 2026-04-26

- `isLocalOnlyProjectId`, `isLocalProjectId`, `LOCAL_APPROVALS_KEY`, `readLocalApprovals`,
  `writeLocalApprovals`, `createLocalApprovalId`, `filterLocalApprovals` all deleted
- Local-storage branches removed from `createApproval`, `getApprovalQueue`,
  `getLatestPendingApproval`, `approveItem`, `rejectItem`, `bulkApprove`, `getPendingCount`
- `proj_local_` guards removed from `timesheets-api.ts`
- `isLocalProjectId` and all call sites removed from `TimesheetDataContext.tsx`
- Zero references to `proj_local_` remain in `src/`
- `npm run build` passes

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

Tier 0–1 complete. Phase 4 is now unblocked but deprioritized until Sprint A–C are done.

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
| S1 approval-rls-fix (M3/014 applied + verified) | 2026-04-24 |
| S2 move-approval-token-signing-server-side | 2026-04-24 |
| D1 delete-dead-timesheet-views (30 files, ~13k LOC) | 2026-04-24 |
| D2 delete-dead-approval-components | 2026-04-24 |
| D3 kill-local-only-project-mode | 2026-04-26 |
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
| dashboard-launchpad-onboarding (role-based checklist, DashboardPage.tsx) | 2026-05-30 |
