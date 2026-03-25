# WorkGraph Agent Worklog Archive

This file preserves the detailed history removed from the active log. It is the source of truth for dated decisions, implementation notes, and handoffs.

## 2026-03-26 - Worklog Compression

- The active worklog was compressed to keep only the last 7 days, current blockers, and current assignments.
- The docs index now lives in [README.md](README.md) so future docs can point there instead of copying ownership or status.
- Use this archive for the longer historical entries that no longer belong in the live snapshot.

## Core Context Snapshot

- Purpose: central synchronization point for multi-agent collaboration across Nikola, Codex, and Antigravity.
- What the worklog recorded: product and technical decisions, code changes already implemented, open issues and debugging context, and next steps aligned to the roadmap.
- Read order that was originally required: `src/docs/ROADMAP.md`, `src/docs/ARCHITECTURE.md`, `src/utils/graph/graph-visibility.ts`, `src/utils/graph/auto-generate.ts`, `src/components/workgraph/WorkGraphBuilder.tsx`, `src/components/ProjectWorkspace.tsx`.
- Current product direction at the time: Phase 3 hardening first, then Phase 4 invoicing, then Phase 8 Stripe integration, then Phase 5 import/export; enterprise, real-time, mobile, and complex AI matchmaking were intentionally deferred.
- Reasoning captured in the log: recent deep-dive analysis said the fastest path to success was the payment transaction layer.

## Environment And Roadmap

- Known working environment: `C:\Users\NK\Projects\HybridSocialApp-run`; continue work there rather than `G:\...` unless explicitly requested.
- Local run commands captured in the log: `npm install`, `npm run dev:all`, `npm run dev`, and `npm run dev -- --host 0.0.0.0 --port 3000`.
- Near-term roadmap in the log: harden persona/viewer consistency between Graph, Timesheets, and Approvals; keep Team/Settings working.
- Next recommended actions in the log: fix `TimesheetDataContext.tsx` demo-data leakage and `UnifiedTimesheetView.tsx` filtering; finalize approval fallback policy; add a lightweight viewer/role regression harness; start Phase 4 invoice generation.

## Protocols And Handoffs

- Roles section: Antigravity handled strategy/comments and isolated feature slices; Codex handled integration, bug fixes, build verification, and final push safety checks.
- File ownership rule: do not edit the same file in parallel; claim owned files in the worklog before coding; release ownership on commit or handoff.
- Task lifecycle: plan, implement, handoff, integrate.
- Branch/commit convention: default branch `main`; commit prefixes `feat:`, `fix:`, and `docs:`.
- Conflict prevention checklist: pull latest first, declare ownership, pause and reassign if overlap appears, never force-push over another agent.
- Active task template was preserved as a plain text block in the original log.
- Current active task snapshot at archive time: `Complete Approval Fallback Policy + Regression Checks`; owner `Codex`; phase `Phase 4 Prep`; files `src/utils/graph/approval-fallback.ts`, `src/utils/graph/auto-generate.ts`, and approval filtering logic; goal was the same-company -> upstream -> client fallback plus regression checks; status `in-progress`; notes said Antigravity had the green light while it styled the onboarding wizard.

## Historical Timeline

### 2026-03-24 - Step 2 Implementation

- Status recorded: in-progress, with implementation complete and local verification pending.
- Added `src/utils/graph/approval-fallback.ts`; deterministic order was same-company approver -> nearest upstream approver -> client approver.
- Exposed `getApprovalStepsForParty(...)` and `canViewerApproveSubmitter(...)`.
- Updated `src/utils/graph/auto-generate.ts` so approval edges emit per fallback step with metadata `order`, `mode`, and `approverPartyId`; added a validation guard for parties with no fallback approver path.
- Added runtime approval directory support in `src/components/workgraph/WorkGraphBuilder.tsx`; it persists `workgraph-approval-dir:${projectId}` in sessionStorage from graph nodes and edges.
- Replaced prefix-based approver checks in `src/components/timesheets/ProjectTimesheetsView.tsx` with policy-based checks using `canViewerApproveSubmitter(...)` for row-level and drawer-level approve actions.
- Verification note: `npm install` and `npm run build` could not complete in `G:\My Drive\HybridSocialApp` because of tar extraction, EPERM, and EBADSIZE errors caused by Google Drive sync-lock behavior on `node_modules`.
- Recommended verification workspace remained `C:\Users\NK\Projects\HybridSocialApp-run`.
- Task snapshot preserved from that section: `Implement Industry-Ready Timesheet Data Model UI (Phase 3.5)` owned by Antigravity for `src/components/timesheets/ProjectTimesheetsView.tsx`; goal was to update the UI to the new `TimeEntry[]` model, clear TypeScript errors, and show multiple categories; status was done.
- Another preserved task snapshot from that section: `Premium UI Styling for Create Project Wizard` owned by Antigravity for `src/components/projects/CreateProjectWizard.tsx`; goal was premium styling for the graph generation wizard; status paused because Claude's Priority Call shifted focus back to core auth and DB work.

### 2026-03-24 - Claude Handoff (commit `baf8537`)

- All three Option D blockers were marked done and pushed to `main`.
- `package.json` gained `npm run dev:all`, which runs Vite and Supabase edge functions concurrently; `npm run dev:edge` was added as an edge-only alias; `concurrently ^9.2.1` was added as a dev dependency.
- `src/components/timesheets/ProjectTimesheetsView.tsx` viewer sync bug was fixed by replacing `useMemo([projectId])` storage reads with `useState` plus a `workgraph-viewer-changed` listener; the `viewingAs` chain now checks `storedViewerMeta?.name` before `currentPersona?.name`.
- Approval-party staleness was fixed in the same file by removing the module-level `cachedApprovalParties` cache; `getApprovalParties` now always reads fresh from sessionStorage and `graphVersion` increments on viewer changes so approval buttons refresh.
- The handoff explicitly said `approval-fallback.ts` was already correct, `AppLayout.tsx` already had the auth guard, and `PersonaContext.tsx` already had the `buildAuthPersona(user)` bridge.
- Build status at that point: `npm run build` clean, 3296 modules, zero errors.
- Open issues after the fix: viewer sync resolved, approval fallback resolved, but the view-as permission model still needed role-based constraints.

### 2026-03-24 - Priority Call

- Architectural review triggered an immediate pivot to infrastructure correctness.
- Task `Fix the 3 Major Infrastructure Blockers (Option D)`: add `dev:all`, fix viewer state sync in the graph -> timesheet path, and define the deterministic fallback rule in `auto-generate.ts`.
- Task `Phase 4 Foundation - Kill the Persona (Real Auth Integration)`: remove demo `PersonaContext` and read only from real Supabase Auth; status unstarted at the time.
- Task `Phase 4 Foundation - SQL Schema Migration (Escape the KV Trap)`: convert `WorkGraph` and `TimeEntry` from KV JSONB blobs to rigid PostgreSQL relational tables before Phase 8 billing; status later marked done.

### 2026-03-25 - SQL Migration

- `supabase/migrations/005_workgraph_core.sql` created 5 tables to replace the KV pattern: `wg_projects`, `wg_project_members`, `wg_project_invitations`, `wg_contracts`, and `wg_timesheet_weeks`.
- The migration preserved TEXT ID formats such as `proj_xxx`, `ctr_xxx`, `mem_xxx`, and `inv_xxx`; it included RLS policies, `updated_at` triggers, and indexes.
- `projects-api.tsx` was rewritten from KV to SQL: KV imports and helper indexes were removed, `db()` returned a service-role client, and `rowToProject()`, `rowToMember()`, and `rowToInvitation()` mapped snake_case DB rows back to the existing JSON shape.
- `timesheets-api.tsx` was rewritten from KV to SQL: `wg_timesheet_weeks` row IDs were `{userId}:{weekStart}`, `PUT` used `upsert({ onConflict: "id" })`, and month filtering used proper date arithmetic across December to January.
- `contracts-api.tsx` was rewritten from KV to SQL: KV index management was replaced by DB queries, `rowToContract()` merged dedicated columns with the JSONB blob, and delete paths enforced `owner_id`.
- Build status: `npm run build` clean, 3296 modules, zero errors.
- Migration status at that point was recorded as live in Supabase project `gcdtimasyknakdojiufl`; the log said all 5 tables were present and the SQL-backed edge functions were ready to deploy.
- The same handoff said deploy still needed to happen for edge functions, `PersonaContext` cleanup was a separate task, and the Phase 4 invoice scaffold was still to be done.
- Additional completed items in that section: the incorrect `.sql.tsx` extension on `001_timesheet_approval_tables.sql.tsx` was fixed, the `Scope: {scope}` badge was removed from `ProjectWorkspace.tsx`, and the hardcoded `Client: Acme Corp · Due: Jan 31, 2024` header text was removed.
- The log also recorded that `npm run build` stayed clean at 3297 modules after those cleanup edits.

### 2026-03-25 - Approver Visibility And Viewer Switcher

- Problem recorded: when John switched viewers in the Timesheets tab, he saw `No timesheet data` instead of Nikola's submitted weeks; the `👁 Nikola` badge was static.
- Root cause for visibility: the filter only showed a person's own weeks, so an approver with no personal weeks saw an empty view.
- Fix applied in `ProjectTimesheetsView.tsx`: if `viewerId` exists, filter weeks where `personId === viewerId` or `canViewerApproveSubmitter(viewerId, w.personId, parties)`.
- Viewer switcher fix: the static badge became a clickable dropdown that lists all people, orgs, clients, and an Admin option from the graph name directory.
- Clicking a name writes `workgraph-viewer-meta:${projectId}` to sessionStorage and fires `workgraph-viewer-changed`, so Graph is no longer required just to switch viewer.
- Build status after the fix: `npm run build` clean, 3297 modules, zero errors.
- Still pending at that point: strip hardcoded demo data from `TimesheetDataContext.tsx`, delete dead demo files (`demo-data-approval.ts`, `demo-data-comprehensive.ts`, `demo-data-multi-party.ts`), and clean up the graph data showing Acme Dev Studio / BrightWorks if it was not real project data.

### 2026-03-25 - Approval Flow Wiring And YOU Badge Fix

- Workspace note: `C:\Users\NK\Projects\HybridSocialApp-run` was the only active workspace; `G:\...` was described as a backup to ignore.
- `ProjectApprovalsTab.tsx` no longer used hardcoded mock stats; the stats now come from real `approval_records` via `ApprovalsWorkbench`.
- `ProjectTimesheetsView.tsx` now calls `createApproval()` when `changeStatus('submitted')` fires; the record includes `approver_node_id`, `subjectId` as `{personId}:{weekStart}`, and `status: 'pending'`; failures are logged but do not block submission.
- The log noted that `approver_user_id` was still a placeholder graph node ID until real UUIDs were linked through project members.
- `graph-visibility.ts` was fixed so admin view assigns `hopDistance: 99` to every node, preventing the YOU badge from appearing everywhere; the YOU badge still works normally for person/org views.
- `approvals-supabase.ts` fixed a status filter bug where `status: 'all'` accidentally collapsed to pending only; `ApprovalQueueFilters` gained `approverNodeId`, and `ApprovalsWorkbench` passed `viewerNodeId` so the queue filters by graph node.
- The archive preserved the approval flow technical spec: Nikola submits a week, `changeStatus('submitted')` creates a pending approval for `org-nas`, John opens Approvals as `org-nas`, the queue filters by `approver_node_id`, John approves, and the invoice tab can generate a draft from approved weeks.
- Missing link captured in the log: `approver_user_id` in `approval_records` needed John's real Supabase UUID, which in turn required `wg_project_members` to carry `graph_node_id`; until then, `approver_node_id` was the primary matching key.
- Build status again was clean at 3297 modules with zero TypeScript errors.

### 2026-03-25 - C Workspace Only

- Execution context: all active work was done in `C:\Users\NK\Projects\HybridSocialApp-run`, and no further development happened in the `G:\...` workspace.
- Edge deploy path: `npx supabase functions deploy server --project-ref gcdtimasyknakdojiufl --workdir .` succeeded for the `server` function; the log explicitly said `supabase db push` was not run.
- Persona removal in runtime: `PersonaProvider` was removed from `src/App.tsx`; runtime consumers switched to `useAuth` in `WorkGraphBuilder.tsx`, `ProjectTimesheetsView.tsx`, `ApprovalsWorkbench.tsx`, and `src/utils/api/timesheets-approval-hooks.ts`.
- `src/contexts/NotificationContext.tsx` was updated to resolve name and approval context from sessionStorage graph directories instead of hardcoded persona fixtures.
- Auth profile metadata now carried `organization_id` and `role`.
- Invoicing scaffold: `src/components/invoices/InvoicesWorkspace.tsx` and `src/components/invoices/InvoiceDetailPrintView.tsx` were added, `Invoices` became a core module/tab in `ProjectWorkspace.tsx`, and invoice drafts now generate from approved weeks for the selected month.
- Build verification passed cleanly in the C workspace.
- Notes preserved from that section: `supabase/functions/server/index.ts` was a minimal shim importing `./index.tsx`, and CLI migration history could lag manual SQL editor execution.

### 2026-03-25 - Subagent Reuse Setup

- Scope was docs-only coordination work in `C:\Users\NK\Projects\HybridSocialApp-run`.
- Added `src/docs/CODEX_SUBAGENT_PLAYBOOK.md`.
- Mapped recommended `awesome-codex-subagents` to WorkGraph phases: Phase 3 auth/invites, Phase 4 invoice loop, and Phase 5 import/export.
- Added conflict-prevention protocol covering file ownership rules, parallel-agent boundaries, and a handoff/DoD checklist.
- Added ready-to-paste task prompts for approval fallback hardening, timesheet UX polish, and SQL/RLS security review.
- The reason recorded: the user asked to proceed with subagent reuse, and the playbook was meant to reduce merge conflicts and speed handoff in a multi-agent workflow.

### 2026-03-25 - Worker A Handoff

- Owned files updated: `src/utils/graph/approval-fallback.ts`, `src/utils/graph/auto-generate.ts`, and `src/docs/AGENT_WORKLOG.md`.
- Approval routing was recorded as a deterministic path: submitter org approver -> nearest upstream billTo org approver -> project owner fallback.
- Defensive `console.debug` and `console.warn` logging was added around fallback selection so graph issues could be traced without changing runtime behavior.
- Local verification with `npm run build` in `C:\Users\NK\Projects\HybridSocialApp-run` stayed clean.
- Residual risk: if persisted graph data lacks an explicit owner marker and the topology is malformed or cyclic, the helper still falls back deterministically but may return no approver path.

### 2026-03-25 - Phase 3 Gate Audit

- Decision: NO-GO for Phase 4 start.
- Summary: core auth and graph foundations were mostly in place, but approval pipeline and data-layer consistency were not stable enough for a money-loop gate.
- Checklist A, identity and viewer consistency: partial; real auth was active, but cross-tab/view switching drift was still observed.
- Checklist B, project + graph persistence: partial; SQL tables and edge deploy path existed, but local fallback plus mixed persistence paths still risked state divergence.
- Checklist C, invite + membership flow: partial; APIs and UI existed, but end-to-end verification had not been recorded as complete.
- Checklist D, incremental supply chain: partial; draft and incremental graph patterns existed, but history-safe regression needed an explicit pass.
- Checklist E, visibility rules: partial; several fixes had landed, but a stable permission sweep for person, org, and client viewer options was still needed.
- Hard blockers listed: `approval_records` schema missing from checked-in migrations, approval identity mapping inconsistent, submit -> queue path not fully transactional, and approval progression/state transitions incomplete.
- Not a hard blocker but still a risk: multi-layer persistence conflict across `localStorage`, in-memory context, and SQL-backed tables.
- Immediate execution order recommended: add `approval_records` migration, normalize approver identity mapping, make submit -> queue creation blocking or rollback on failure, verify end-to-end with a manual script, and rerun the gate checklist before opening Phase 4 invoicing.

### 2026-03-25 - Implementation Agent A (Blocker #1)

- Added `supabase/migrations/007_approval_records.sql` to define `approval_records` for current frontend API usage.
- The schema matched `src/utils/api/approvals-supabase.ts` create/query/update fields and included `approver_node_id` and `graph_version_id`.
- TEXT IDs were used for `project_id`, `subject_id`, `approver_user_id`, and `approver_node_id` to support the mixed UUID plus graph-node identity flow.
- Indexes were added for project/status lookup, approver-user lookup, approver-node lookup, and subject history ordering by approval layer.
- RLS was enabled with authenticated `SELECT/INSERT/UPDATE` policies.
- Idempotent `updated_at` trigger wiring was added with `approval_records_set_updated_at` and `approval_records_updated_at`.

### 2026-03-25 - Timesheet Refresh-Loss Fix

- User issue recorded: timesheet entries disappeared after page refresh.
- Root cause 1 in `src/contexts/TimesheetDataContext.tsx`: the API load path overwrote state with `[]` when the backend returned no rows, even if local persisted rows existed.
- Root cause 2: the API persist path was blocked for non-UUID `personId` values, so many real graph-person weeks never synced remotely.
- Fixes applied: keep local non-demo weeks when authenticated API returns zero rows; remove the UUID-only gate for API persistence and status updates; add auth-session reload invalidation so identity changes reset the API-load guard; keep demo filtering centralized in `isDemoPersonId`.
- Validation: `npm run build` passed after the changes.
- Files touched: `src/contexts/TimesheetDataContext.tsx`.

### 2026-03-25 - Response To Claude Boss Comments

- Accepted points: too many parallel edits reduced finish quality, worker naming in the worklog was ambiguous, gate discipline drift occurred, and documentation volume increased faster than verified end-to-end closure.
- Corrections applied: added `src/docs/AGENT_REGISTRY.md` for explicit agent identity, added a hard phase-gate policy in docs, and fixed the refresh-loss issue in the timesheets store.
- Execution policy going forward: max two writer agents in parallel, every task must use disjoint file ownership, and every handoff must include exact files, risk, and verification steps.

## Open Issues At Archive Time

- Graph viewer carryover into Timesheets/Approvals and deterministic approval fallback were later marked resolved in the history above.
- The view-as permission model remained open and needed role-based constraints.
- The Phase 3 gate audit still treated approval identity mapping, submit -> queue consistency, and persistence mixing as blockers until the later migration work landed.
- Demo-data cleanup in timesheet views was still listed as a follow-up when the approver visibility work was written.
- The log repeatedly called out the risk of state divergence across `localStorage`, in-memory context, and SQL-backed storage.
