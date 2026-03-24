# WorkGraph Agent Worklog And Handoff

Last updated: March 24, 2026 (Europe/Zagreb)
Owner thread: Nikola + Codex

## Purpose

This file serves as the **central synchronization point** for multi-agent collaboration (Nikola, Codex, and Antigravity). It records:
- important product/technical decisions discussed across all threads
- code changes already implemented
- open issues and debugging context
- next steps aligned to the roadmap

Any new agent acting on this repo MUST read this file first, then review:
1. `src/docs/ROADMAP.md`
2. `src/docs/ARCHITECTURE.md`
3. `src/utils/graph/graph-visibility.ts`
4. `src/utils/graph/auto-generate.ts`
5. `src/components/workgraph/WorkGraphBuilder.tsx`
6. `src/components/ProjectWorkspace.tsx`

---

## Current Product Direction (Agreed)

We are following the product-first roadmap (`src/docs/ROADMAP.md`) with this priority:
1. **Phase 3 hardening** (auth-aware behavior, invite/member workflows, stable viewer behavior)
2. **Phase 4 invoicing** (closing the money loop after approvals — this is the core operational driver)
3. **Phase 8 Stripe integration** (accelerated priority to capture transactional GMV and drive real profitability)
4. **Phase 5 import/export** (CSV/PDF for lowering adoption friction)

We intentionally avoid jumping to enterprise/real-time/mobile or complex AI Matchmaking features until core workflow quality is proven. Recent deep-dive analyses confirm the fastest path to success is executing the payment transactional layer (Phases 4 & 8).

---

## Implemented Changes (Recent)

### Phase 3 / Stability commits already on `main`

- `f29373e` Wire Team/Settings controls and add roadmap scope item
- `f75441e` Fix missing `ProjectConfigurationDrawer` import
- `6689715` Fix missing drawer state and settings save handler
- `cac89bd` Persist graph viewer across tabs and sync timesheets view
- `230986f` Add resilient local fallback for project creation/list
- `fa02005` Sync viewer selection immediately across workspace tabs

### Earlier relevant commits

- `d74e094` Show locally stored projects after authenticated login
- `c54df09` Add month seeding action for empty timesheet view
- `a1bf2d8` Stop viewer selection flicker from restore/persist loop
- `b17a213` Phase 3 hardening for viewer/persistence/graph migration
- `5d0d660` Keep real project people visible outside demo snapshots
- `aaaaa8e` Restore coworker visibility for person viewers

---

## Open Issues / User-Observed Behavior

### 1) Graph viewer does not always carry into Timesheets/Approvals

Observed:
- user selects `David` in Graph view
- switching to Timesheets can still show eye badge as `Nikola Kralj`

Likely cause:
- race/miss between graph selection event and tab-level viewer fallback

Current local fix in progress:
- `ProjectWorkspace.tsx` now resolves viewer from `sessionStorage` key
  `workgraph-viewer-meta:${projectId}` and uses it as effective viewer override.
- This makes tab display robust even if an event is missed.

### 2) Approval-routing expectations need explicit product rule

Question raised:
- if timesheet submitter belongs to TIA and there is no TIA approver, should NAS approver (client side) auto-fallback?

Current state:
- approval edges are generated from configured approvers per party/connection.
- explicit fallback policy is not fully formalized/documented yet.

Action needed:
- define deterministic fallback rule in product spec and enforce in
  `src/utils/graph/auto-generate.ts` and approval queue derivation logic.

### 3) View-as permissions model still in transition

Question raised:
- who should be able to see/select a party or person in "Viewing as"?

Current behavior:
- test-oriented broad switching is still present in parts of app.

Action needed:
- finalize membership/role-based "view-as" constraints for production mode.

---

## Known Working Environment

Primary working copy:
- `C:\Users\NK\Projects\HybridSocialApp-run`

Important:
- Continue work in this C: path (not G:) unless explicitly requested.

Run locally:
- `npm install`
- `npm run dev -- --host 0.0.0.0 --port 3000`

---

## Near-Term Roadmap Execution Plan

### In Progress

- Harden persona/viewer consistency between Graph, Timesheets, and Approvals
- Keep Team/Settings entry points functional and non-breaking

### Next (recommended)

**🔥 Immediate Codex Handoff Task:**
1. **Fix Timesheets Data Sync:** The `TimesheetDataContext.tsx` is currently merging hardcoded demo data (Alex Chen, BrightWorks) into the UI. Ensure `UnifiedTimesheetView.tsx` (and related timesheet tables) strictly filter by the actual `projectId` and the `workgraph-viewer-meta:${projectId}` state. Discard demo profiles so that only the real graph members (e.g., Nikola, David, John) render in the Timesheets tab.
2. **Approval Fallback Policy:** Finalize approval fallback policy (same-company approver first, then upstream) and implement policy in graph generation + approval queue filtering.

*(Once Codex completes these fixes, update this worklog and Antigravity will scaffold Phase 4 Invoicing.)*

3. Add lightweight test harness for role/viewer permutations
4. Start Phase 4 invoice generation scaffold (approved timesheet -> invoice draft)

---

## Handoff Checklist For Next Agent

Before coding:
1. Read this file and `src/docs/ROADMAP.md`.
2. Reproduce current viewer-switch flow with the same personas:
   - David (submitter), Nikola (same-party approver), John (client approver).
3. Confirm whether `ProjectWorkspace.tsx` local viewer fallback patch is present and committed.

When proposing changes:
1. Keep changes aligned to Phase 3/4 priorities.
2. Avoid adding enterprise-scale features prematurely.
3. Document behavior changes in this worklog with date + commit hash.

---

## Two-Agent Coding Protocol (Codex + Antigravity)

This protocol is active while Claude is unavailable.

### Roles

- **Antigravity**
  - proposes strategy and comments on roadmap/product direction
  - can implement isolated feature slices when ownership is clearly assigned
- **Codex**
  - owns integration, bug fixes, build verification, and final push safety checks
  - resolves merge conflicts and keeps implementation aligned with roadmap phases

### File Ownership Rule (Critical)

- Do not edit the same file in parallel.
- Before starting a task, claim file ownership in this worklog:
  - `Owner: Codex` or `Owner: Antigravity`
  - list exact file paths
  - add claim timestamp
- Ownership is released only after:
  - code is committed, or
  - a handoff note is written here.

### Task Lifecycle

1. **Plan**
   - Add a short task entry under "Active Tasks" with scope, owner, files, and expected output.
2. **Implement**
   - Keep commits small and scoped to owned files.
3. **Handoff**
   - Write what changed, risks, and test status.
4. **Integrate**
   - Codex pulls latest, verifies build/runtime, and pushes stable result.

### Branch / Commit Convention

- Default branch: `main` (current repo practice).
- Commit message format:
  - `feat: ...` for new functionality
  - `fix: ...` for defects/regressions
  - `docs: ...` for protocol/spec/worklog updates

### Conflict Prevention Checklist

- Pull latest before editing.
- Declare owned files in this worklog before coding.
- If overlap is discovered, pause and reassign ownership in this file first.
- Never force-push over another agent's work.

### Active Tasks (Template)

Copy and fill this block for each new task:

```
Task:
Owner:
Phase:
Files:
Goal:
Status: planned | in-progress | done
Notes:
```

### Current Active Tasks

```
Task: Fix Timesheet Demo Data Sync + Approval Fallback Policy
Owner: Codex
Phase: Phase 3 / Phase 4 Prep
Files: src/contexts/TimesheetDataContext.tsx, src/components/timesheets/UnifiedTimesheetView.tsx, src/utils/graph/auto-generate.ts
Goal: Ensure Timesheets strictly filter by projectId/viewer-meta instead of merging global demo data. Formalize approval fallback rules.
Status: planned
Notes: Assigned by Antigravity. Codex to implement, test, and commit. Once done, Antigravity will claim ownership for Phase 4 Invoicing.
```
