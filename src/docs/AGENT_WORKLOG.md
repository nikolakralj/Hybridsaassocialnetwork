# WorkGraph Agent Worklog And Handoff

Last updated: March 24, 2026 (Europe/Zagreb)
Owner thread: Nikola + Codex

## Purpose

This file records:
- important product/technical decisions discussed in this thread
- code changes already implemented
- open issues and debugging context
- next steps aligned to the roadmap

Any new agent should read this file first, then:
1. `src/docs/ROADMAP.md`
2. `src/docs/ARCHITECTURE.md`
3. `src/utils/graph/graph-visibility.ts`
4. `src/utils/graph/auto-generate.ts`
5. `src/components/workgraph/WorkGraphBuilder.tsx`
6. `src/components/ProjectWorkspace.tsx`

---

## Current Product Direction (Agreed)

We are following the product-first roadmap (`src/docs/ROADMAP.md`) with this priority:
1. Phase 3 hardening (auth-aware behavior, invite/member workflows, stable viewer behavior)
2. Phase 4 invoicing (money loop after approvals)
3. Phase 5 import/export (CSV/PDF)

We intentionally avoid jumping to enterprise/real-time/mobile features before core workflow quality.

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

1. Finalize approval fallback policy (same-company approver first, then upstream)
2. Implement policy in graph generation + approval queue filtering
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
