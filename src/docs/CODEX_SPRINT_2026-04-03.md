# Codex Sprint — April 3, 2026

**From: Claude (Lead Architect)**
**To: Codex (Implementation Workforce)**
**Project path: C:\Users\NK\Projects\HybridSocialApp-run**

Read `CLAUDE.md` and `AGENTS.md` before starting.
Run `npm run build` after EVERY task. Do not mark [DONE] without a passing build.

---

## Current State

- Phase 3: GO
- Phase 4: OPEN
- Build: PASSING (3300 modules, one large-chunk warning only — ignore it)
- Last work: Claude fixed approval UX (decision packet, day grid, project name table fix)

---

## Sprint Tasks — Assign to Parallel Agents

These tasks have DISJOINT file scope. Run agents A and B in parallel.
Agent C runs after A completes (depends on A's output).

---

### AGENT A — Bug B: Approval route DB fallback
**Model: GPT-5.3-Codex or GPT-5.1-Codex-Max**
**File: `src/utils/api/approvals-supabase.ts` ONLY**

**The problem:**
`buildApprovalPartyRoute(projectId, submitterPersonId)` reads from sessionStorage:
```typescript
function buildApprovalPartyRoute(projectId, submitterPersonId) {
  const parties = readApprovalParties(projectId); // reads sessionStorage
  if (parties.length === 0) return [];            // ← BAILS HERE on reload
  ...
}
```
After page reload, sessionStorage is empty → route is empty → no next approval layer created.
The chain breaks after any reload.

**The fix:**
1. Make `buildApprovalPartyRoute` async.
2. When `readApprovalParties` returns empty, fetch from `wg_projects`:
```typescript
async function buildApprovalPartyRoute(
  projectId: string,
  submitterPersonId: string
): Promise<ApprovalDirParty[]> {
  let parties = readApprovalParties(projectId);

  if (parties.length === 0 && isUuid(projectId)) {
    const { data } = await supabase
      .from('wg_projects')
      .select('parties')
      .eq('id', projectId)
      .maybeSingle();
    const raw = data?.parties;
    if (Array.isArray(raw)) parties = raw as ApprovalDirParty[];
    else if (raw && typeof raw === 'object' && Array.isArray((raw as any).parties)) {
      parties = (raw as any).parties as ApprovalDirParty[];
    }
  }

  if (parties.length === 0) return [];
  // ... rest of existing function unchanged
}
```
3. Update `createNextApprovalLayerIfNeeded` to `await buildApprovalPartyRoute(...)`.
4. Run `npm run build` — must pass with zero TS errors.

**Definition of done:**
- [ ] `buildApprovalPartyRoute` is async
- [ ] DB fallback from `wg_projects.parties` when sessionStorage empty
- [ ] `createNextApprovalLayerIfNeeded` awaits it correctly
- [ ] `npm run build` passes
- [ ] Worklog updated: `[DONE] bug-b-db-fallback`

---

### AGENT B — Bug C: UUID resolution direct JOIN
**Model: GPT-5.3-Codex or GPT-5.2-Codex**
**File: `src/utils/api/approvals-supabase.ts` ONLY**

**COORDINATE with Agent A — do NOT both edit at same time.**
Agent B should start on analysis while Agent A implements, then B applies its change after A finishes.

**The problem:**
`resolveGraphNodeToUserId` uses name/email scoring heuristics to find the real UUID.
Heuristics silently fail when names don't match exactly.

Current flow:
```typescript
// scores by: graph_node_id match (400), name match (300), email prefix (200)
// Falls back to undefined if score = 0
```

**The fix — add direct JOIN as first attempt before heuristic:**
After the early-return checks (lines ~361-368), before the heuristic scoring block, add:

```typescript
// Direct JOIN attempt: highest confidence, no heuristic
if (isUuid(projectId)) {
  const { data: directMatch } = await supabase
    .from('wg_project_members')
    .select('user_id')
    .eq('project_id', projectId)
    .or(`scope.eq.${nodeId},graph_node_id.eq.${nodeId}`)
    .not('user_id', 'is', null)
    .limit(1)
    .maybeSingle();
  if (directMatch?.user_id) return directMatch.user_id as string;
}
// Fall through to existing heuristic scoring if no direct match
```

This runs first. If it finds a match, returns immediately. If not, existing heuristic scoring
still runs as before — no regression.

**Definition of done:**
- [ ] Direct JOIN runs before heuristic scoring
- [ ] Existing heuristic scoring unchanged as fallback
- [ ] `npm run build` passes
- [ ] Worklog updated: `[DONE] bug-c-uuid-direct-join`

---

### AGENT C — Phase 4: Invoice scaffold wiring
**Model: GPT-5.4 or GPT-5.4-Mini**
**Runs AFTER Agent A and B complete**
**Files: `src/components/invoices/` directory ONLY**

Read `src/docs/PHASE4_INVOICE_SPEC.md` before starting.

**Task:**
Wire the `InvoiceImportPanel.tsx` to call Claude API for template extraction.

Current state: `src/components/invoices/InvoiceImportPanel.tsx` exists as a scaffold.

Implement:
1. File upload input that accepts PDF/image
2. On upload, call `POST /api/invoice-extract` (edge function stub — just log if not deployed)
3. Show loading state: "Analyzing your invoice template..."
4. On success, show extracted fields preview:
   - detected locale (e.g., hr-HR)
   - seller/buyer label names
   - invoice number format
   - VAT rate
5. "Save template" button → calls `createInvoiceTemplate()` (stub if API not ready)
6. Error state if extraction fails

The Claude API prompt to use for extraction is already written in `PHASE4_INVOICE_SPEC.md`.
Use `claude-sonnet-4-6` model.

Do NOT implement the edge function itself (that requires SUPABASE_ACCESS_TOKEN which is not
available). Just the frontend component.

**Definition of done:**
- [ ] File upload UI implemented
- [ ] Loading state shown during extraction
- [ ] Extracted fields rendered in preview
- [ ] Save template button present
- [ ] `npm run build` passes
- [ ] Worklog updated: `[DONE] phase4-invoice-import-panel`

---

### AGENT D — Self-approval guard verification
**Model: GPT-5.4-Mini**
**Files: `src/contexts/TimesheetDataContext.tsx` ONLY**
**Can run in parallel with C**

**The problem:**
When a person submits their own timesheet and they are also listed as an approver in their
own party, they appear in their own approval queue (James approves James).

The guard exists in `getApprovalRouteForSubmitter`:
```typescript
const eligibleApprovers = firstStep.approverIds.filter((id) => id !== personId);
const approverUserRef = [...eligibleApprovers].sort()[0] || firstStep.partyId;
```

**The issue:** When `eligibleApprovers` is empty (James is the only approver in his party),
it falls back to `firstStep.partyId` (the party node ID, e.g., "G2"). This party ID gets
stored as `approver_user_id`. The approval then shows in James's queue because the
`approverNodeId` filter matches "G2".

**The fix:**
When `eligibleApprovers` is empty, do NOT fall back to `firstStep.partyId` for
`approverUserRef`. Instead, look at the NEXT step in the chain:

```typescript
// If all approvers in firstStep are the submitter, advance to next step
let resolvedStep = firstStep;
let eligibleApprovers = firstStep.approverIds.filter((id) => id !== personId);

if (eligibleApprovers.length === 0 && steps.length > 1) {
  const nextStep = steps.find((step, idx) => idx > 0 && (
    step.approverIds.length === 0 ||
    !step.approverIds.every((id) => id === personId)
  ));
  if (nextStep) {
    resolvedStep = nextStep;
    eligibleApprovers = nextStep.approverIds.filter((id) => id !== personId);
  }
}

const approverUserRef = [...eligibleApprovers].sort()[0] || resolvedStep.partyId;
const partyName = parties.find((party) => party.id === resolvedStep.partyId)?.name;
```

**Definition of done:**
- [ ] James does not see his own timesheet in his approval queue
- [ ] Approval routes to the next upstream party when submitter = sole approver
- [ ] `npm run build` passes
- [ ] Worklog updated: `[DONE] self-approval-guard`

---

## File Ownership Map

| Agent | Owns | Must NOT touch |
|---|---|---|
| A | `approvals-supabase.ts` (buildApprovalPartyRoute) | everything else |
| B | `approvals-supabase.ts` (resolveGraphNodeToUserId) — after A | everything else |
| C | `src/components/invoices/*` | approval files |
| D | `TimesheetDataContext.tsx` (getApprovalRouteForSubmitter) | approval files |

A and B edit the same file but different functions. They must NOT run simultaneously.
A completes → A marks done → B starts.

---

## Worklog Protocol

After each task, append to `src/docs/AGENT_WORKLOG.md`:
```
## 2026-04-03 - [task name]
- Changed: [file list]
- What changed: [2-3 lines]
- Verification: npm run build passed (vite build, N modules)
```

---

## What NOT to touch

- `src/components/approvals/ApprovalsWorkbench.tsx` — Claude owns, recently updated
- `src/components/approvals/ProjectApprovalsTab.tsx` — Claude owns
- `supabase/migrations/` — do not add new migrations without explicit instruction
- `CLAUDE.md` — never modify
- `AGENTS.md` — read only, do not modify task list
