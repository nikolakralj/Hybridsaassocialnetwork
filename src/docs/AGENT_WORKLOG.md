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
- `build-fix` (Antigravity) Remove duplicate `sumWeekHours` declaration in `TimesheetDataContext.tsx`
- `fix` (Antigravity) Pass `orgId` to `ProjectTimesheetsView` in `ProjectWorkspace.tsx` to enable Codex's person-viewer fix


---

## Open Issues / User-Observed Behavior

### 1) ~~Graph viewer does not always carry into Timesheets/Approvals~~ — FIXED (baf8537)

Fixed by Claude on 2026-03-24. `storedViewerMeta` now uses event-driven state instead of
stale `useMemo`. `viewingAs` name chain now reads `storedViewerMeta?.name` before falling
back to `currentPersona?.name`.

### 2) ~~Approval-routing fallback not deterministic~~ — FIXED (070ff75 + baf8537)

Fixed by Codex (approval-fallback.ts) + Claude (cache staleness). The full policy chain
(same-company → upstream → client) is now correctly enforced in both graph generation
and the timesheets approval button visibility.

### 3) View-as permissions model still in transition

Question raised:
- who should be able to see/select a party or person in "Viewing as"?

Current behavior:
- test-oriented broad switching is still present in parts of app.

Action needed:
- finalize membership/role-based "view-as" constraints for production mode.
- This is a Phase 3 gate item (A.3) and should be tackled before Phase 4.

---

## Known Working Environment

Primary working copy:
- `C:\Users\NK\Projects\HybridSocialApp-run`

Important:
- Continue work in this C: path (not G:) unless explicitly requested.

Run locally:
- `npm install`
- `npm run dev:all` — starts Vite + Edge Function together (recommended)
- OR: `npm run dev` (Vite only, API calls fall back to localStorage)
- OR: `npm run dev -- --host 0.0.0.0 --port 3000` (Vite with network access)

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
Task: Complete Approval Fallback Policy + Regression Checks
Owner: Codex
Phase: Phase 4 Prep
Files: src/utils/graph/auto-generate.ts, approval filtering logic
Goal: Implement proper approval fallback: 1. same-company approver, 2. upstream approver, 3. client approver. Define final fallback and add role/viewer regression checks.
Status: in-progress
Notes: Antigravity gave the green light for Codex to start this while Antigravity styles the onboarding wizard.
```

### Codex Update — 2026-03-24 (Step 2 Implementation)

Status: in-progress (implementation complete, local verification pending)

Completed in code:
- Added shared fallback policy utility:
  - `src/utils/graph/approval-fallback.ts`
  - deterministic order: same-company approver -> nearest upstream approver -> client approver
  - exposed:
    - `getApprovalStepsForParty(...)`
    - `canViewerApproveSubmitter(...)`
- Updated wizard graph generator:
  - `src/utils/graph/auto-generate.ts`
  - approval edges now emit per fallback step with metadata:
    - `order`, `mode`, `approverPartyId`
  - added validation guard for parties with no fallback approver path
- Added runtime approval directory for cross-tab consistency:
  - `src/components/workgraph/WorkGraphBuilder.tsx`
  - persists `workgraph-approval-dir:${projectId}` in `sessionStorage` from graph nodes/edges
- Replaced prefix-based approver checks in timesheets with policy-based checks:
  - `src/components/timesheets/ProjectTimesheetsView.tsx`
  - approver rights now evaluate against fallback chain via `canViewerApproveSubmitter(...)`
  - wired into both row-level and drawer-level approve actions

Verification note:
- Could not complete `npm install` / `npm run build` verification in this workspace path (`G:\My Drive\HybridSocialApp`) due repeated tar extraction/EPERM/EBADSIZE errors (Google Drive sync-lock behavior on `node_modules`).
- Recommended verification path remains:
  - `C:\Users\NK\Projects\HybridSocialApp-run`

```
Task: Implement Industry-Ready Timesheet Data Model UI (Phase 3.5)
Owner: Antigravity
Phase: Phase 3.5
Files: src/components/timesheets/ProjectTimesheetsView.tsx
Goal: Update UI to match the newly implemented TimeEntry[] data model in `src/types/timesheets.ts` to resolve TypeScript errors and show multiple categories.
Status: done
Notes: Codex implemented the underlying data model. Antigravity completed the UI refactoring to clear TS errors, wire up the TimeEntry[] design, and finish Phase 3.5 visualization.
```

```
Task: [PAUSED] Premium UI Styling for Create Project Wizard
Owner: Antigravity
Phase: UI Polish
Files: src/components/projects/CreateProjectWizard.tsx
Goal: Elevate the visual design of the Supply Chain / Graph generation wizard.
Status: paused
Notes: Paused due to Claude's Priority Call. UI polish is a distraction until the core Auth/DB is real.
```

### ✅ CLAUDE HANDOFF — 2026-03-24 (commit baf8537)

All three Option D blockers are **DONE and pushed to main**.

#### What was fixed

**1. `dev:all` script** — `package.json`
- `npm run dev:all` now runs Vite + Supabase edge functions concurrently in one terminal
- `npm run dev:edge` alias added for edge-only start
- `concurrently ^9.2.1` added as devDependency

**2. Viewer sync bug** — `src/components/timesheets/ProjectTimesheetsView.tsx`
- Root cause found: `storedViewerMeta` was `useMemo([projectId])` — computed ONCE on mount and never updated when WorkGraphBuilder wrote new viewer to sessionStorage.
- Fix: replaced with `useState` + `workgraph-viewer-changed` event listener. Component now re-reads sessionStorage and re-renders immediately when viewer changes in graph tab.
- Second root cause: `viewingAs` name chain skipped `storedViewerMeta?.name` and fell directly to `currentPersona?.name` (Nikola). Fixed to check `storedViewerMeta?.name` first.
- Result: selecting David in Graph tab now immediately reflects in Timesheets eye badge.

**3. Approval party staleness** — `src/components/timesheets/ProjectTimesheetsView.tsx`
- Root cause: `cachedApprovalParties` was a module-level variable never invalidated after graph-tab sessionStorage writes. `useMemo([projectId, store.version])` in the component re-called `getApprovalParties`, but the function returned the stale module cache, not fresh data.
- Fix: removed module-level cache. `getApprovalParties` always reads fresh from sessionStorage. Added `graphVersion` state (increments on `workgraph-viewer-changed`) to `approvalParties` useMemo dep so approval buttons refresh after any graph update.
- Result: approval buttons now show/hide correctly after visiting graph tab, without requiring a project reload.

#### What was NOT changed (already correct)
- `approval-fallback.ts` — Codex's implementation is solid. `getApprovalStepsForParty` and `canViewerApproveSubmitter` are correct. Already wired into `auto-generate.ts` and `ProjectTimesheetsView.tsx`.
- `AppLayout.tsx` — auth guard (redirect to `/?auth=signin`) already exists and works.
- `PersonaContext.tsx` — `buildAuthPersona(user)` bridge already exists. For logged-in users, `currentPersona` correctly uses real auth identity. The `TEST_PERSONAS[0]` fallback only applies to unauthenticated users who are already redirected by AppLayout.

#### Build status
- `npm run build` — clean, zero errors, 3296 modules.

#### Open issues after this fix
- Issue 1 (viewer sync) — **RESOLVED**
- Issue 2 (approval fallback) — **RESOLVED** (was already implemented by Codex, staleness now fixed)
- Issue 3 (view-as permission model) — still open, needs proper role-based constraints

---

### 🚨 CLAUDE'S PRIORITY CALL (March 2026) 🚨
Based on Claude's architectural review, we are executing an immediate hard pivot to infrastructure correctness.

```
Task: Fix the 3 Major Infrastructure Blockers (Option D)
Owner: Claude / Codex
Phase: Pre-Phase 4 Cleanup
Files: package.json, ProjectWorkspace.tsx, auto-generate.ts
Goal:
1. Add `dev:all` script to run Vite and Edge functions in parallel so API calls don't fail silently.
2. Fix Viewer State sync bug so selecting a user in Graph propagates consistently to Timesheet view.
3. Define the deterministic fallback rule in `auto-generate.ts` for when no approver is assigned.
Status: DONE — commit baf8537
```

```
Task: Phase 4 Foundation - Kill the Persona (Real Auth Integration)
Owner: Antigravity / Codex (Collaboration)
Phase: Phase 4 Priority
Goal: Remove the demo `PersonaContext`. Read only from actual Supabase `Auth` context.
Status: unstarted
```

```
Task: Phase 4 Foundation - SQL Schema Migration (Escape the KV Trap)
Owner: Codex
Phase: Phase 4 Priority
Files: supabase/migrations/
Goal: Convert the conceptual `WorkGraph` and `TimeEntry` models into rigid PostgreSQL relational tables. We must drop the KV JSONB blobs before attempting Phase 8 billing.
Status: unstarted
```

