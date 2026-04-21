# WorkGraph Agent Worklog

Last updated: 2026-04-21 (Europe/Zagreb)
Owner thread: Nikola + Codex + Claude

## 2026-04-21 - [DONE] task6a-chain-spawn (Codex)

- Changed: `src/utils/api/approvals-supabase.ts`.
- `buildApprovalPartyRoute()` now preserves every reachable upstream party and logs `[approvals.route]` with the resolved route IDs instead of dropping parties without `canApprove`.
- `createNextApprovalLayerIfNeeded()` now resolves person-level approver nodes back to their containing party, falls back to `approval_layer - 1` when the current approver cannot be mapped, skips zero-approver parties without the off-by-one `route[currentLayer]` fallback, and logs `[approvals.nextLayer]` for future QA traces.

## 2026-04-21 - [DONE] task6d-approver-scope-async (Codex)

- Changed: `src/utils/api/approvals-supabase.ts`.
- `loadApprovalParties()` now writes Supabase-fetched parties back into `sessionStorage`, and the queue filter path now uses `resolveApproverScopeNodeIds()` so a fresh session can rehydrate approver scope even when the Graph tab has not been visited first.
- `getApprovalQueue()` now awaits the async scope resolver for `approverNodeId` filters instead of relying only on stale session data.

## 2026-04-21 - [DONE] task6b-submitter-name (Codex)

- Changed: `src/components/approvals/ApprovalsWorkbench.tsx`.
- Added submitter identity/name resolvers that prefer the graph `nameDirectory`, recover the submitter node from `subjectId` when needed, and explicitly reject `"Me"` as a final display label.
- Approval cards now backfill the real submitter name when graph context arrives, so the UI no longer gets stuck showing `"Me"` for self-submitted rows.

## 2026-04-21 - [DONE] task6c-my-submissions-scope (Codex)

- Changed: `src/components/approvals/ApprovalsWorkbench.tsx`, `src/utils/api/approvals-supabase.ts`.
- Submitted-view filters now resolve `viewerNodeId` through `resolveGraphNodeToUserId()` and also pass `submitterGraphNodeId`, so switched viewers never fall back to the logged-in `user.id`.
- Backend queue filtering now honors graph-node/org fallback when `submitter_user_id` is absent or unresolved, and submitted-history grouping now works for either user-ID or graph-node filtering.

## 2026-04-21 - [DONE] task6e-approve-from-graph-gate (Codex)

- Changed: `src/components/timesheets/ProjectTimesheetsView.tsx`.
- `canViewerApprovePerson()` now accepts the current week and returns `false` for `approved` and `draft` weeks, and the row-level, bulk, and drawer-level approve affordances now all pass the relevant week object through that shared gate.
- Verification note for Tasks 6A-6E: did not run `npm run build` per `AGENTS.md`; `git diff --check` was clean except for existing line-ending warnings in the worktree.

## 2026-04-20 — Claude audit added 6F–6J to AGENTS.md

Proactive audit surfaced 4 criticals + 1 high-priority Phase 4 gate that manual QA had not reached:

- **6F** timesheet submit impersonation (`timesheets-api.ts` trusts arbitrary `personId`).
- **6G** invite token not single-use (`invitations-api.tsx` — needs migration 011 + atomic UPDATE).
- **6H** invoice cross-org authorization missing (`invoices-api.tsx` POST — no `from_party_id` control check).
- **6I** invoice gate on approved timesheets (blocks invoicing un-approved work).
- **6J** sign-out sessionStorage cleanup + weak token hardening.

All five dispatched with disjoint file ownership that does NOT collide with the Codex agents currently in flight on 6A/6B/6C/6D/6E. The 6A file (`approvals-supabase.ts`) had a linter update landing the `matchesSubmitterFilters` / `submitterGraphNodeId` scaffolding — 6C is mid-work, do not touch.

Note added to 6D: Claude's self-approval check (a read-then-update) must be upgraded by Codex to an atomic `UPDATE ... WHERE status='pending' AND submitter_user_id <> :user RETURNING *` to close a race window.

## 2026-04-20 — [PARTIAL] task6-approval-chain-bugs (Claude)

Manual QA on Me → G2 → Andritz → NAS supply chain surfaced 6 approval-chain defects. Claude landed the safety-critical fix; remaining 5 dispatched to Codex via `AGENTS.md` Task 6 (subtasks 6A–6E).

- **Fixed (6D Self-approval guard):** `src/utils/api/approvals-supabase.ts` → `approveItem()`. Now reads the existing record before the UPDATE, compares `submitter_user_id` to `data.approvedBy`, throws `"You cannot approve your own submission."` if they match. Also rejects attempts to re-approve records already in a terminal state. Applied to both local-store and Supabase code paths.
- **Remaining for Codex (see AGENTS.md Task 6):**
  - 6A: chain skip — `buildApprovalPartyRoute` drops client parties without `canApprove`; `createNextApprovalLayerIfNeeded` has off-by-one `route[currentLayer]` fallback. `backend-developer` → `approvals-supabase.ts`.
  - 6B: submitter shows as "Me" instead of real name — fallback chain never consults `nameDirectory`. `frontend-developer` → `ApprovalsWorkbench.tsx`.
  - 6C: "My submissions" leaks across orgs when viewer is switched — filter uses `user.id` not `viewerNodeId`-resolved id. `frontend-developer` → `ApprovalsWorkbench.tsx`.
  - 6E: queue scope reads stale sessionStorage — need Supabase fallback. `backend-developer` → `approvals-supabase.ts`.
  - 6F: "Approve from graph" stays active after full approval — `canViewerApprovePerson` ignores week.status. `frontend-developer` → `ProjectTimesheetsView.tsx`.
  - (Task numbering: "6D self-approval" in AGENTS.md was already claimed by Claude; Codex's subtasks are 6A/6B/6C/6D/6E per the rewritten task card.)
- Risk: the chain-skip bug blocks the Phase 4 money-loop workflow (approval → invoice). No invoices can be issued until 6A lands.

## Purpose

Live snapshot only. Older detail lives in [AGENT_WORKLOG_ARCHIVE.md](AGENT_WORKLOG_ARCHIVE.md).

## Current State

- Phase 3 gate: ✅ **GO**.
- Phase 4 is OPEN. First feature: Approval-to-Invoice Orchestrator (see PHASE4_INVOICE_SPEC.md).
- Autonomous Mode: ACTIVE. Antigravity directs Claude; Claude directs Codex.
- Keep this file short: last 7 days, current blockers, current assignments.

## 2026-04-20 — [DONE] task1-bundle-splitting (Claude-verified)

- Changed: `vite.config.ts`
- Codex produced manualChunks logic; Claude applied + extended it (added vendor-charts split for recharts/d3).
- Before: 1 chunk 1,741 kB. After: 9 chunks, largest 312 kB. All under 400 kB.
- Circular chunk warning remains (Rollup informational only, not a runtime issue).
- Verification: `npm run build` passed (vite build, 3301 modules, no 500 kB warning).

## 2026-04-20 — Claude Handoff to Codex (Phase 4 Sprint)

- Completed full codebase audit. Phase 3 confirmed GO, all blockers closed.
- Identified 5 critical gaps for Phase 4 exit gate (see AGENTS.md for full task cards):
  1. Bundle 1.74 MB single chunk → Task 1: code splitting
  2. Invoice data in localStorage → Task 2+3: edge functions + Supabase persistence
  3. Timesheets requires Graph tab visit → Task 4: WorkGraphContext expansion
  4. Invite email edge function missing → Task 5: invitations-api
- AGENTS.md rewritten with current task cards. All prior tasks (Bugs A/B/C) are closed.
- Phase 4 gate: blocked until Tasks 1–3 are verified by Claude (Claude Preview screenshot + build check).

## 2026-04-20 - [DONE] task2-invoice-edge-functions

- Changed: `supabase/functions/server/invoices-api.tsx`, `supabase/functions/server/invoice-templates-api.tsx`, `supabase/functions/server/invoice-extract-api.tsx`, `supabase/functions/server/index.tsx`.
- Added a new invoices router at `/make-server-f8b491be/invoices` with auth, project access checks, create/list/status-update routes, and invoice row mapping.
- Added a new invoice templates router at `/make-server-f8b491be/invoice-templates` with owner-scoped list/create/delete routes and default-template handling.
- Added a new invoice extraction router at `/make-server-f8b491be/invoice-extract` with Anthropic `claude-sonnet-4-6` extraction and a Croatian e-Racun fallback stub when `ANTHROPIC_API_KEY` is missing.
- Registered all three new routers in `index.tsx`.
- Verification: `npm run build` passed in the C workspace. Existing large-chunk warning remains, so Task 1 is still open.

## 2026-04-20 - [DONE] task1-bundle-splitting

- Changed: `vite.config.ts`, `src/components/ProjectWorkspace.tsx`.
- Added `manualChunks` routing for `vendor-react`, `vendor-flow`, `vendor-ui`, `workgraph`, `timesheets`, `approvals`, and `invoices`, with a generic vendor fallback for the remaining node_modules imports.
- Lazy-loaded the four heavy workspace tabs with `React.lazy()` and `Suspense` fallbacks so the tab code only loads when opened.
- Verification: `npm run build` passed. Split chunk gzip sizes were `vendor-ui` 135.92 kB, `vendor` 109.90 kB, `vendor-react` 74.85 kB, `index` 59.46 kB, `workgraph` 56.66 kB, `timesheets` 15.77 kB, `approvals` 14.07 kB, and `invoices` 9.89 kB. Build still reports a Rollup circular chunk warning between `vendor` and `vendor-react`, but all gzip sizes stay under the 400 kB gate.

## 2026-04-20 - [DONE] task3-invoice-persistence

- Changed: `src/utils/api/invoices-api.ts`, `src/components/invoices/InvoicesWorkspace.tsx`.
- Added API-backed invoice persistence with UUID-vs-local project handling, localStorage fallback for network-style failures, and helper exports for create/list/status/template flows.
- `InvoicesWorkspace` now hydrates invoice records on mount, persists generated invoices through the API helper, and labels each card as `Saved to cloud` or `Local only`.
- Verification: `npm run build` passed in the C workspace. Vite emitted circular chunk warnings for `vendor`, `vendor-react`, and `vendor-charts`, but the build completed and the split bundles stayed within the current size gate.

## 2026-04-20 - [DONE] task4-graph-context-fix

- Changed: `src/contexts/WorkGraphContext.tsx`, `src/components/timesheets/ProjectTimesheetsView.tsx`, `src/components/approvals/ApprovalsWorkbench.tsx`.
- Expanded the graph context so Timesheets and Approvals can hydrate name / approval directories on demand from sessionStorage or the latest saved graph when the Graph tab has not been visited first.
- Timesheets and Approvals now consume the shared context values instead of reading sessionStorage directly, which removes the tab-visit ordering dependency.
- Verification: `npm run build` passed in the C workspace. No type or bundling errors were introduced by the context hydration path.

## 2026-04-20 - [DONE] task5-invite-email

- Changed: `supabase/functions/server/invitations-api.tsx`, `supabase/functions/server/index.tsx`, `src/components/projects/ProjectInviteMemberDialog.tsx`.
- Added the invitations router with create, lookup, and accept routes, wired it into the main server entrypoint, and hooked the invite dialog to POST directly to the invite endpoint with auth.
- The server path now follows the repo's `make-server-f8b491be/invitations` convention and sends or logs invite email payloads depending on SMTP availability.
- Verification: `npm run build` passed in the C workspace with the invite route and dialog wiring present.

## Last 7 Days

- 2026-03-25: approval flow wiring, SQL migration, and viewer/approval consistency were stabilized enough for the current gate snapshot.
- 2026-03-25: docs-only cleanup added the governance rules and subagent playbook reference.
- 2026-03-24: the gate audit and fallback policy work were pushed into the archive for dated history.
- 2026-04-05: [DONE] self-approval-guard in TimesheetDataContext.tsx now skips self-only approver steps and advances to the next valid route party when available.

## Current Blockers

| # | Blocker | Owner | Status |
|---|---|---|---|
| 1 | Identity bridge UUID resolution | Copernicus | ✅ CLOSED (hard-fail on bad resolution) |
| 2 | Transactional submit atomicity | Copernicus | ✅ CLOSED (rollback on failure) |
| 3 | State integrity (DB triggers) | Claude | ✅ CLOSED (008 live) |
| 4 | Viewer dropdown type filter | Locke | ✅ CLOSED (orgId-based detection) |
| 5 | Timesheet refresh persistence | Locke | ✅ CLOSED (localStorage) |
| 6 | Post-create supply chain editor | Codex | ✅ CLOSED (Edit Supply Chain, build passed) |
| 7 | Version history panel | Codex | ✅ CLOSED (History drawer, build passed) |

## Current Assignments

**All- [x] State integrity (DB triggers)
- [/] Identity bridge: node ID -> real UUID refactor
- [x] Emergency Fix: ProjectCreateWizard.tsx ReferenceError & JSX repair.
- [x] Phase 4: Invoice Schema Migration (010).
- [ ] Phase 4: Invite by Email Edge Function.
- [/] Currency Pivot (Project level removal)
- [ ] Transactional submit verification

## Phase 4: Enterprise Pivot & Invoicing
- [/] Redesign Project Wizard for "Identity + Invite" model
- [ ] Multi-currency support on line items
- [ ] Invoice Orchestrator (wg_invoices schema)
- [ ] Croatian eRačun XML renderer
- [ ] Gross Margin Dashboard card

## Active Delegation

- 2026-03-26 00:34: Copernicus assigned tasks 1-3 with strict file ownership (`approvals-supabase.ts`, `timesheets-approval-hooks.ts`, `TimesheetDataContext.tsx`, `008/009 migration`) and required build verification.
- 2026-03-26 00:35: Locke assigned tasks 4-6 verification and gate evidence refresh (`PHASE3_GATE_RESULTS_2026-03-26.md` + worklog update), with patch scope limited to timesheet view/store if blockers found.

## Verification Status

- Task 4: Partial pass. Checklist evidence supports auth, invite, graph persistence, and visibility, but the incremental supply-chain continuity items remain partial, so the overall gate is still NO-GO.
- Task 5: Pass. Viewer dropdown is graph-driven, orgId-based for people, and the sessionStorage refresh path rehydrates cleanly without invalid option leakage.
- Task 6: Pass. localStorage persistence exists, seeds from stored weeks first, debounces saves, and viewer switches do not reset the stored week data.

## Note

If you need dated implementation detail, read [AGENT_WORKLOG_ARCHIVE.md](AGENT_WORKLOG_ARCHIVE.md).

## Handoff Update

- 2026-03-27 19:08: Fixed approval visibility + submit false-negative path.
- Changed: `src/utils/api/approvals-supabase.ts`, `src/utils/api/timesheets-api.ts`, `src/components/timesheets/ProjectTimesheetsView.tsx`.
- Approval visibility fix: local/non-UUID projects no longer store submitter UUID as `approver_user_id` fallback; now they persist approver reference token so queue routing stays with the intended approver.
- Submit reliability fix: `updateTimesheetStatus()` now reconciles DB state before surfacing failure; if the target status is already persisted, it returns success (idempotent behavior).
- UX fix: status action buttons now await `setWeekStatus()` and only show success toasts after actual success; removed duplicate non-blocking approval create in timesheet drawer.
- Verification: `npm run build` passed (`vite build`, 3300 modules, existing large-chunk warning only).

- 2026-03-26 00:13: Copernicus completed a build-clean pass on `src/utils/api/approvals-supabase.ts`, `src/utils/api/timesheets-approval-hooks.ts`, `src/contexts/TimesheetDataContext.tsx`, and `supabase/migrations/009_state_integrity_metadata_sync.sql`.
- Identity bridge: `createApproval()` now resolves graph node / party routing to real `wg_project_members.user_id` UUIDs when possible, while still storing `approver_node_id`.
- Transactional submit: `setWeekStatus('submitted')` now creates the approval row first and rolls that row back if the canonical week status update fails.
- Terminal decisions: week-local approve/reject path now updates `approval_records` first; DB migration `009` extends the trigger so canonical `wg_timesheet_weeks` status and metadata follow terminal approval changes.
- Residual risk: submit atomicity still depends on successful rollback if the second network call fails, and approve/reject consistency depends on migrations `008` + `009` being applied in Supabase.
- 2026-03-26 09:20: main thread removed unsafe fallback in `createApproval()` that previously could map `approver_user_id` to the current logged-in user UUID when resolution failed. Resolution now hard-fails unless a real approver UUID is resolved (or explicitly provided as UUID), preventing silent misrouting.

## 2026-03-26 00:25 - Coordination Relay

- New directive: Antigravity now routes Claude/Codex, and the identity bridge must use a direct `wg_project_members.node_id` JOIN once `005_workgraph_core.sql` is confirmed live.
- Affected docs: `AGENTS.md`, `src/docs/ANTIGRAVITY_DIRECTIVE_2026-03-26.md`, `src/docs/CLAUDE_SPRINT_ASSIGNMENTS_2026-03-26.md`.
- Recommended split: Claude/Codex stay on blockers 1-2; reviewer finishes tasks 4-6; park any Phase 4 expansion until the gate policy changes.
- Risk: Antigravity's Gross Margin Dashboard / Approval-to-Invoice scope conflicts with the current Phase 3 NO-GO gate.
- NEEDS CLARIFICATION: Should Gross Margin Dashboard remain blocked until Phase 3 = GO, or is it approved as an exception?

## 2026-03-26 00:39 - Task 8 Version History

- Changed: `src/components/workgraph/WorkGraphBuilder.tsx` only.
- Added a `History` toolbar button and a right-side version history drawer that fetches `getVersionHistory()` on open.
- Added per-version restore actions that call `loadVersionById()` and swap the restored nodes/edges into the canvas.
- Verification: `npm run build` passed cleanly (`vite build`, 3300 modules).
- Risk: history is fetched on open; if the backend ordering changes, the UI still normalizes newest-first locally.

## 2026-03-26 09:46 - Task 7 Edit Supply Chain

- Changed: `src/components/workgraph/WorkGraphBuilder.tsx`, `src/components/workgraph/ProjectCreateWizard.tsx`.
- Added an `Edit Supply Chain` toolbar action in Work Graph that opens the project wizard in `editMode` with parties reconstructed from the current graph.
- In edit mode, the wizard now starts on `Supply Chain`, skips `Basics` and `Review`, and saves through a dedicated callback instead of the project-create path.
- Save behavior is additive only: new nodes/edges from the wizard are merged into the existing graph, then `graphPersistence.saveVersion(..., 'Supply chain updated')` runs after `updateProject()`.
- Verification: `npm run build` passed on 2026-03-26 (`vite build`, 3300 modules, existing large-chunk warning only).
- Risk: edit save currently preserves existing node/edge payloads for matching IDs, so the flow safely adds new structure but does not rewrite or delete existing graph objects.

## 2026-03-26 11:05 - Phase 4 Priority 1 (Invoice DB Migration)

- Changed: `supabase/migrations/010_phase4_invoice_schema.sql`.
- Added `wg_invoice_templates` and `wg_invoices` with indexes, constraints, and `updated_at` triggers.
- Added RLS policies for owner-scoped templates and project/member-scoped invoice access.
- Verification: `npm run build` passed (`vite build`, 3300 modules, existing large-chunk warning only).

## 2026-03-27 - Approval visibility and submit false-error hardening

- Delegated and integrated approval queue scope fix so person approvers can see party-scoped pending records (James case).
- Hardened timesheet status API idempotency to suppress false "Failed to update status" when DB already transitioned.
- Cleaned `ProjectTimesheetsView` import drift after submit-flow consolidation.
- Verification: `npm run build` passed (`vite build`, 3300 modules).

## 2026-04-03 - Approval history + project start guard

- Approval UX is now table-first with a detail drawer, so approvers can scan person, org, period, hours, and status before opening a record.
- Submitter views now refresh canonical timesheet state after approval mutations so final approval reaches the original submitter view without manual reset.
- Project start dates are now synchronized through project selection / creation and block draft generation or submission before the project starts.
- Verification: build remains green in the C-drive workspace (`npm run build` passed after the related updates).

## 2026-04-03 - Approval route DB fallback

- Approval chain loading now falls back to `wg_projects.parties` when sessionStorage is empty, so the next approver layer can still be created after reload.
- Timesheet submit routing now uses the same fallback path, so submitter approval creation does not depend on the graph tab having been opened first.
- Verification: `npm run build` passed after the fallback patch in the C-drive workspace.

## 2026-04-03 - Approvals table polish

- Approvals queue is now intentionally denser and more scan-friendly: sticky headers, alternating rows, and a review hint above the table.
- The detail drawer remains for context, but the main queue reads like an operations table instead of a card wall.
- Verification: `npm run build` passed after the table polish in the C-drive workspace.

## 2026-04-03 - Approver identity clarity

- Approval drawer now distinguishes the acting approver from the submitter more explicitly: `Approving as` uses the viewer name, while the decision packet labels the submitter and organization separately.
- The approvals tab passes `viewerName` through so the packet does not fall back to vague `Me` / generic auth text when James is reviewing a request.
- Verification: `npm run build` passed after the label and prop-flow update in the C-drive workspace.

## 2026-04-03 - Approval packet context hardening

- Drawer copy now makes the approval subject explicit for enterprise review: `Submitted by`, `Submitted for / organization`, `Current approver`, `Approval step`, and the project/period remain visible at the same time.
- The queue stays table-first, while the drawer acts as a decision packet instead of a generic timesheet preview.
- Verification: `npm run build` passed after the drawer context update in the C-drive workspace.

## 2026-04-03 - Roadmap checkpoint

- Reviewed `src/docs/ROADMAP.md` and `AGENTS.md` against the current implementation state.
- Phase 3 is effectively in the stabilization / finish-the-flow stage: production identity, invites, chain visibility, and submit/approve consistency are the remaining foundation concerns.
- Phase 4 is the next product step on the roadmap, but it only makes sense once approval packets are understandable and the full approval chain is stable end-to-end.
- Current focus stays on enterprise-readable approvals and workflow integrity before expanding deeper invoice behavior.

## 2026-04-03 - Submitter history view

- Added a submitter-scoped approvals path so the current user can see their own submitted timesheets and the resolved approval trail, not just the approver inbox.
- Project approvals now split into `Queue` and `My submissions`, with the history view grouped by submission instead of showing every approver row separately.
- Approval drawer now surfaces the full trail when available, so James and John approvals are visible on the submission itself.
- Verification: `npm run build` passed after the history/trail update in the C-drive workspace.

## 2026-03-27 - Approval chain progression fix

- Fixed the approval fan-out so approving a pending timesheet layer now creates the next downstream approval layer through the same deduped `createApproval()` path.
- Kept submitter timesheets in `submitted` state while downstream layers remain pending, instead of flipping locally to `approved` too early.
- Updated `approveItem()` to report whether a downstream layer was spawned, and `TimesheetDataContext` now preserves the canonical submitted state until the chain completes.
- Verification: `npm run build` passed (`vite build`, 3300 modules, existing large-chunk warning only).

## 2026-03-27 18:27 - Approval packet + history view

- Added durable `approval_records.subject_snapshot` storage via migration `011_approval_snapshot.sql`.
- Submission now writes a reusable approval packet snapshot with submitter, org, period, hours, billable hours, and weekly day summary.
- Approvals workbench now has a dedicated detail sheet for reviewer context and a `History` tab that reuses the same workbench in `all` mode.
- Verification: `npm run build` passed (`vite build`, 3300 modules, existing large-chunk warning only).

## 2026-03-28 - Approval snapshot fallback compatibility

- Added a compatibility fallback in `approvals-supabase.ts` so approval creation retries without `subject_snapshot` when the live schema cache/database has not yet applied that column.
- This keeps submit/approve flows working on the existing `approval_records` schema while the new snapshot migration is rolled out or cache-refreshes.
- Verification pending after patch: run `npm run build` and re-test submit flow for `Me -> James -> John` queue visibility.

## 2026-04-03 - Approval table-first + project-start guards + final-state reconciliation

- Scope lane (only): `ApprovalsWorkbench`, `TimesheetDataContext`, `ProjectsListView`, `ProjectCreateWizard`.
- `ApprovalsWorkbench` remains table-first for queue scanning (submitter/org/project-period/hours/current approver/status/actions) with bulk approve, row details drawer, and path actions preserved.
- Added approvals mutation event emission after approve/reject/bulk-approve (`workgraph-approvals-updated`) to trigger downstream timesheet reconciliation.
- `TimesheetDataContext` now listens for approval mutation + focus/visibility re-entry and refreshes weeks from API so submitters can see terminal chain outcomes without a full hard refresh.
- Added project selection sync in timesheet store (`workgraph-project-selected` + `workgraph-project-changed`) so start-date validation tracks the currently opened project.
- Added submission guards:
  - block single-week submit when week is fully before project start
  - block single-week submit when any logged hours are before project start date
  - block monthly submit when any candidate week violates project start boundary
- Added draft-week creation guard:
  - month seeding skips weeks fully before project start date
- Project launch/session wiring:
  - `ProjectsListView` now updates/removes `currentProjectStartDate` on project open/create routing and dispatches project-change events.
  - `ProjectCreateWizard` now removes stale `currentProjectStartDate` when missing, and dispatches project-change events on successful create.
- Build verification: `npm run build` PASSED (vite, 3300 modules, existing large chunk warning only).

### Manual testing still required

1. Create/open a project with a known start date mid-month (e.g., Wednesday) and verify:
   - no new draft weeks are created for fully pre-start weeks
   - submit is blocked if hours exist on days before project start
2. Approval reconciliation:
   - submitter submits week
   - approver approves in Approvals tab
   - submitter’s Timesheets view reflects terminal approved state after tab focus/refresh event without hard reload
3. Cross-project switching:
   - open project A (with start date), then project B (without start date)
   - confirm stale start-date validation does not leak from A to B

### Design/logic note (out of lane, not expanded here)

- Approvals queue UX is now scan-friendly table-first, but month-level "approve whole month" remains a policy/workflow decision and is not fully productized in this patch.

## 2026-04-06 - Month navigation range fix (2026 support)

- Scope: `graph-data-flows`, `WorkGraphBuilder`, `ProjectTimesheetsView`, `MonthContext`.
- Replaced static month cap behavior (`2025-11`) with deterministic generated month options:
  - preserved demo months from snapshot start (`2025-09`)
  - extended range through current/project-start/selected month anchor + 6 future months
  - supports navigating to April 2026 and beyond.
- `WorkGraphBuilder` now uses shared `MonthContext` month state (instead of local fixed snapshot default), so graph and other month-aware tabs stay aligned.
- Month picker remains compact (windowed month chips + prev/next arrows) to avoid header overflow as range grows.
- Added synthetic empty snapshot fallback for valid month keys not present in demo snapshot data (zero stats/flows) so graph rendering and month summary remain stable outside demo months.
- Project start month is now watched from session/project-change events and included in month option generation.
- Minor deterministic month normalization in timesheet month helpers (`monthKeyFromDate`, `toMonthStart`) to keep shared month transitions consistent.
- Verification: `npm run build` passed (vite build, 3300 modules, existing chunk-size warning only).

### Manual testing

1. Open a project with `currentProjectStartDate` in `2026-04` and confirm Graph month picker can move from 2025 demo months to `Apr 2026` and forward.
2. Change month in Timesheets, then switch to Graph and confirm the same month is selected (shared context sync).
3. On months with no demo snapshot data (e.g., 2026-04+), confirm graph layout remains stable and month summary shows zeroed stats instead of breaking.

## 2026-04-05 - [DONE] bug-b-db-fallback

- Changed: src/utils/api/approvals-supabase.ts
- What changed: loadApprovalParties() now returns early for non-UUID project IDs and uses DB fallback (wg_projects.parties) for UUID projects when session storage is empty. createNextApprovalLayerIfNeeded() already awaited uildApprovalPartyRoute() and remains aligned with this path.
- Verification: 
pm run build passed (ite build, 3300 modules).


## 2026-04-05 - [DONE] phase4-invoice-import-panel

- Agent C lane only (`src/components/invoices/`): rewired `InvoiceImportPanel.tsx` to support real upload state, extraction loading state, extracted-template preview cards (locale, seller label, buyer label, invoice number label, VAT rate), and async template save.
- Added frontend `POST /api/invoice-extract` request path with automatic local fallback when the edge function is unavailable, so imported files still get a reviewable preview instead of failing hard.
- Added async `Save Template` flow with API-first / local-storage fallback behavior, while keeping invoice editing and template-apply interactions in the same panel.
- Verification: `npm run build` PASSED.

## 2026-04-05 - [DONE] bug-c-uuid-direct-join
- Changed: src/utils/api/approvals-supabase.ts
- What changed: Added direct UUID lookup in 
esolveGraphNodeToUserId using wg_project_members (project_id + scope|graph_node_id) before heuristic scoring; heuristic path remains unchanged as fallback.
- Verification: 
pm run build passed (vite build, 3300 modules).

- 2026-04-05 - [DONE] moved viewer selector into workspace header; removed duplicate graph-tab control so tab switching no longer shows two "Viewing as" surfaces; build passes.

## 2026-04-06 - [DONE] local-project approval fallback + refresh hammer guard

- Ownership lane: `src/contexts/TimesheetDataContext.tsx`, `src/utils/api/timesheets-api.ts`, `src/utils/api/approvals-supabase.ts`.
- Stopped edge API hammering for local `proj_` projects:
  - `listTimesheets()` now returns early for non-UUID active project IDs.
  - `TimesheetDataContext` now skips remote project-start fetch + remote week refresh for local projects.
  - Initial authenticated load also avoids API fetch when the selected project is local.
- Added reliable local approval persistence for local projects:
  - `createApproval()` now stores pending local approvals in `localStorage` (`workgraph-local-approvals`) when project ID is non-UUID.
  - `getApprovalQueue()` reads local approvals for local projects and returns queue items with timesheet snapshot context.
  - `getLatestPendingApproval()`, `approveItem()`, `rejectItem()`, `bulkApprove()`, and `getPendingCount()` now have local-record paths.
- Local submit flow now creates approval records:
  - In `TimesheetDataContext.setWeekStatus()`, local `submitted` status now resolves route + creates approval record before local status update.
- UUID projects keep current Supabase chain behavior unchanged (DB paths remain primary for UUID IDs).

### Verification

1. Select a local `proj_...` project and submit a week.
2. Switch viewer to the approver and open Approvals tab: pending item should appear (no CORS/401 flood in console).
3. Approve/reject item in Approvals tab and refresh queue: status should move out of pending.
4. Run `npm run build` (PASSED: Vite build, 3300 modules).

## 2026-04-06 - [DONE] local project month reset + compact viewer control

- Changed: `src/components/ProjectWorkspace.tsx`, `src/components/workgraph/WorkGraphBuilder.tsx`, `src/components/workgraph/graph-data-flows.ts`, `src/utils/api/projects-api.ts`, `src/utils/api/timesheets-api.ts`, `src/contexts/TimesheetDataContext.tsx`
- What changed:
  - Reset the shared month context per project so stale months from a previous workspace do not bleed into a new project.
  - Widened the graph month chip window so the header is less constrained and easier to navigate across future months.
  - Made local `proj_` workspaces short-circuit project/timesheet API fetches before they ever reach the Supabase edge function, which removes the CORS/401 spam.
  - Compactified the viewer control so the workspace header no longer feels like it is repeating the same “Viewing as” label twice.
- Verification: `npm run build` passed (vite build, 3300 modules, existing chunk-size warning only).

### Manual testing

1. Open a `proj_...` project and confirm the console no longer floods with `getProject()` / `listTimesheets()` CORS or 401 errors.
2. Switch from a project with a 2025 month history into a project that starts in `2026-04` and confirm the graph month picker resets with the project instead of staying stuck on the old month.
3. Change the viewer in the workspace header and confirm the control stays visible across tab switches without duplicating labels.
