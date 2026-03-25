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

**All Phase 3 blockers closed. Phase 4 open.**

Next tasks (see [PHASE4_INVOICE_SPEC.md](PHASE4_INVOICE_SPEC.md)):
1. DB schema: `wg_invoice_templates` + `wg_invoices` migration
2. InvoiceImportPanel: wire Claude API extraction (scaffold exists at `src/components/invoices/InvoiceImportPanel.tsx`)
3. EN16931 XML renderer for Croatian eRačun output

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
