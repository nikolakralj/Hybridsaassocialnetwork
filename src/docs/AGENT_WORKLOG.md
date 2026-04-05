# WorkGraph Agent Worklog

Last updated: March 26, 2026 09:50 (Europe/Zagreb)
Owner thread: Nikola + Codex + Claude

## Purpose

Live snapshot only. Older detail lives in [AGENT_WORKLOG_ARCHIVE.md](AGENT_WORKLOG_ARCHIVE.md).

## Current State

- Phase 3 gate: ✅ **GO**.
- Phase 4 is OPEN. First feature: Approval-to-Invoice Orchestrator (see PHASE4_INVOICE_SPEC.md).
- Autonomous Mode: ACTIVE. Antigravity directs Claude; Claude directs Codex.
- Keep this file short: last 7 days, current blockers, current assignments.

## Last 7 Days

- 2026-03-25: approval flow wiring, SQL migration, and viewer/approval consistency were stabilized enough for the current gate snapshot.
- 2026-03-25: docs-only cleanup added the governance rules and subagent playbook reference.
- 2026-03-24: the gate audit and fallback policy work were pushed into the archive for dated history.

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

## 2026-04-05 - [DONE] bug-b-db-fallback

- Changed: src/utils/api/approvals-supabase.ts
- What changed: loadApprovalParties() now returns early for non-UUID project IDs and uses DB fallback (wg_projects.parties) for UUID projects when session storage is empty. createNextApprovalLayerIfNeeded() already awaited uildApprovalPartyRoute() and remains aligned with this path.
- Verification: 
pm run build passed (ite build, 3300 modules).
