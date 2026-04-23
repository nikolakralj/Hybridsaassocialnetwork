# WorkGraph Task Backlog

**Version:** 1.0 · **Date:** 2026-04-22 · **Owner:** Claude (writes) / Codex (status updates)
**Purpose:** Sprint board. Codex reads this to pick the next `[READY]` task. Claude moves tasks through statuses.

Statuses: `[READY]` → `[IN PROGRESS]` → `[REVIEW]` → `[DONE]` / `[BLOCKED]`

---

## Manual Steps (Nikola — no agents)

These require copy-paste into Supabase SQL Editor. No code change needed.

| # | Step | File | Status |
|---|---|---|---|
| M1 | Apply migration 012 | `supabase/migrations/012_approval_submitter_id.sql` | `[READY]` |
| M2 | Apply migration 013 | `supabase/migrations/013_graph_node_id_and_invite_link.sql` | `[READY]` |
| M3 | Run Apr 6-10 timesheet backfill | SQL: `UPDATE wg_timesheet_weeks SET status='approved' WHERE id IN (SELECT subject_id FROM approval_records WHERE decision='approved' AND created_at BETWEEN '2026-04-06' AND '2026-04-10')` | `[READY]` |

---

## Sprint A — Approvals UX + Timesheet Flow (Current)

### A1 · `submit-timesheet-project-picker` · `[READY]`

**Assignee:** Codex `frontend-developer`
**Priority:** High
**Goal:** When the user clicks "New Timesheet" or "Submit Week" and has more than one project, show a project picker modal before submitting. Currently it silently uses whichever project is last focused, which causes timesheet submissions to go to the wrong project.

**Files (Codex-owned for this task):**
- `src/components/timesheets/ProjectTimesheetsView.tsx`
- `src/contexts/TimesheetDataContext.tsx`

**Claude-owned (read-only):**
- `src/utils/api/timesheets-api.ts`
- `src/utils/api/approvals-supabase.ts`

**Acceptance criteria:**
- [ ] If user has exactly 1 project → submit directly (no picker, current behavior)
- [ ] If user has 2+ projects → modal appears listing project names
- [ ] Modal has search/filter for 5+ projects
- [ ] Selecting a project proceeds with submission for that project
- [ ] Cancelling the modal does not submit
- [ ] `npm run build` passes

---

### A2 · `approval-queue-chain-visualization` · `[READY]`

**Assignee:** Codex `frontend-developer`
**Priority:** High
**Goal:** Each row in the approval queue should show a mini approval chain: `Submitter → Party1 → Party2` with dots indicating current step. This makes it immediately clear where a submission is in the chain without opening the drawer. Reference: linear progress dots used in SAP Fiori workflow tiles.

**Files (Codex-owned):**
- `src/components/approvals/ApprovalsWorkbench.tsx`
- `src/components/approvals/SubmissionsView.tsx`

**Spec reference:** `src/docs/APPROVAL_SUBMISSIONS_SPEC.md`

**Acceptance criteria:**
- [ ] Queue rows show `submitter → approver1 → approver2` chain (node names, truncated)
- [ ] Current pending step is highlighted (filled dot or bold)
- [ ] Completed steps are shown as faded/checked
- [ ] Works for 2-party and 3-party chains
- [ ] Does not break existing row layout (6-column grid)
- [ ] `npm run build` passes

---

### A3 · `approval-queue-ux-polish` · `[READY]`

**Assignee:** Codex `frontend-developer`
**Priority:** Medium
**Goal:** Small UX cleanup pass on the approvals queue table.

**Files (Codex-owned):**
- `src/components/approvals/ApprovalsWorkbench.tsx`

**Acceptance criteria:**
- [ ] Column headers use sentence case ("Submitted by" not "SUBMITTED BY")
- [ ] "Unknown organization" replaced with the actual org name from the approval record snapshot (field: `subject_snapshot.orgName` or nameDirectory lookup)
- [ ] Status chips are consistent: Pending (yellow), Approved (green), Rejected (red), Draft (grey)
- [ ] Empty state message when queue has 0 items: "No pending approvals" with icon
- [ ] `npm run build` passes

---

## Sprint B — Project Graph + Permission Gating

### B1 · `project-creation-wizard-redesign` · `[READY]`

**Assignee:** Codex `frontend-developer`
**Priority:** High
**Goal:** Redesign the project creation wizard per `src/docs/PROJECT_CREATION_SPEC.md`. Key changes: remove currency/region fields (not needed at creation), simplify Step 1 to name + type + visibility + dates + work week only.

**Spec:** `src/docs/PROJECT_CREATION_SPEC.md` — read the full spec before starting.

**Files (Codex-owned):**
- `src/components/workgraph/ProjectCreateWizard.tsx`

**Claude-owned (read-only):**
- `src/utils/api/projects-api.ts`

**Acceptance criteria:**
- [ ] Step 1: Project Name, Project Type, Visibility, Start Date, End Date, Work Week (Mon–Fri default)
- [ ] Currency and Region inputs are REMOVED from the wizard
- [ ] Step 2: Supply Chain (parties) — unchanged from current
- [ ] Step 3: Review — unchanged from current
- [ ] Atomic creation still works (graph sent with initial payload)
- [ ] `npm run build` passes

---

### B2 · `graph-empty-state-investigation` · `[READY]`

**Assignee:** Codex `reviewer`
**Priority:** Medium
**Goal:** The NAS project graph canvas shows empty even after the graph/parties fix in `mapSupabaseProjectRow`. Investigate whether the graph data is actually being written correctly by `supabaseCreateProject()` and loaded by `getProject()`, and verify the canvas renders it.

**Files (read — do not edit without clearance):**
- `src/utils/api/projects-api.ts` (Claude-owned — read only)
- `src/components/workgraph/WorkGraphBuilder.tsx`

**Expected investigation steps:**
1. In Chrome DevTools → Application → localStorage, find the cached project row and check if `graph` field has `nodes` and `edges`
2. In Supabase SQL Editor: `SELECT id, name, graph IS NOT NULL as has_graph FROM wg_projects ORDER BY created_at DESC LIMIT 10`
3. If `graph` is null in DB for the NAS project: the write path is broken — report this to Claude
4. If `graph` is present in DB but empty canvas: the read path or render path is broken — check `mapSupabaseProjectRow` includes `graph` field and `WorkGraphBuilder` receives it

**Output:** Write findings in `AGENT_WORKLOG.md`. Do NOT make code changes without explicit Claude sign-off.

---

### B3 · `server-side-role-enforcement` · `[BLOCKED]`

**Blocked by:** M2 (migration 013 must be applied first — adds `graph_node_id`, capability flags to `wg_project_members`)
**Assignee:** Codex `backend-developer` (after M2)
**Goal:** Add server-side role checks to `updateProject()` and `deleteProject()` edge function routes. Currently only UI hides controls for non-owners; the server accepts any authenticated request.

**Files (Codex-owned, after clearance):**
- `supabase/functions/server/projects-api.tsx`

**Acceptance criteria:**
- [ ] `PUT /projects/:id` returns 403 if caller is not owner or editor
- [ ] `DELETE /projects/:id` returns 403 if caller is not owner
- [ ] `GET /projects/:id` returns only fields visible to caller's role
- [ ] `npm run build` passes

---

## Sprint C — Invitation Flow

### C1 · `invitation-acceptance-ui` · `[READY]`

**Assignee:** Codex `frontend-developer`
**Priority:** Medium
**Goal:** Build the invitation acceptance screen. When an invited user clicks the link from their email, they land on `/invite/:token` which should: show the inviting project + org, let them accept or decline, and on accept → redirect to the project workspace.

**Files (Codex-owned):**
- `src/components/invitations/InviteAcceptPage.tsx` (create new)
- `src/routes.tsx` (add `/invite/:token` route)

**Backend exists:** `supabase/functions/server/invitations-api.tsx` — `GET /invitations/:token` (lookup) and `POST /invitations/:token/accept` (accept)

**Acceptance criteria:**
- [ ] `/invite/:token` renders project name, inviting org, role being offered
- [ ] "Accept invitation" button calls `POST /invitations/:token/accept`
- [ ] On success → redirect to the project workspace
- [ ] On error (expired/invalid token) → show clear error with "Contact the project owner" message
- [ ] Works for unauthenticated users (prompt them to sign in first, then redirect back)
- [ ] `npm run build` passes

---

## Phase 4 Queue (Invoice Generation)

These tasks are scoped for after Sprint A is stable.

| Task | Description | Owner | Status |
|---|---|---|---|
| P4-1 | `invoice-orchestrator` — wire `ApproveItem → create invoice draft` | Codex backend-developer | `[READY]` |
| P4-2 | `invoice-list-view` — list invoices per project with status chips | Codex frontend-developer | `[READY]` |
| P4-3 | `invoice-pdf-export` — generate PDF from invoice data | Codex frontend-developer | `[READY]` |
| P4-4 | `apply-migration-010` — `wg_invoices` table (manual, Nikola) | Nikola | `[READY]` |

Spec: `src/docs/specs/PHASE4_INVOICE_SPEC.md`

---

## Done (This Sprint)

| Task | Summary | Completed |
|---|---|---|
| approval-submissions-redesign | SubmissionsView 6-col grid, ApprovalTimeline drawer, semantic chips — grid layout bug fixed | 2026-04-22 |
| project-workspace-role-gating | UI hides edit controls for non-owners/editors | 2026-04-22 |
| atomic-project-create-path | Graph sent with initial createProject payload, no separate updateProject needed | 2026-04-22 |
| cycle1-project-schema-api-correctness | projects-api respects caller-provided status, writes member capability flags | 2026-04-22 |
| project-delete-owner-guard | deleteProject verifies ownership before DB delete | 2026-04-22 |
| project-cloud-refresh-persistence | proj_* IDs now treated as cloud-backed, survive refresh | 2026-04-21 |
| task6a-party-hydration | loadApprovalParties hydrates stripped party payloads from wg_project_members | 2026-04-21 |
| task6b-submitter-name | "Me" replaced with real name from nameDirectory or email local-part | 2026-04-21 |
| task6c-my-submissions-scope | Submitted view filters by viewerNodeId, not user.id | 2026-04-21 |
| task6d-approver-scope-async | getApprovalQueue awaits async scope resolver | 2026-04-21 |
| task6e-approve-from-graph-gate | Approve action fails closed unless viewer matches current pending approver | 2026-04-21 |
| docs-structure-cleanup | src/docs organized: specs/ and archive/ subdirs | 2026-04-22 |
