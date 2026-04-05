# AGENTS.md - WorkGraph Codex Session Card

Read [src/docs/README.md](src/docs/README.md) first.

## Hierarchy

- **Nikola**: Observer only.
- **Antigravity**: Strategic Director.
- **Claude**: Lead Architect. You report to Claude.
- **Codex agents (you)**: Implementation workforce. Report in `src/docs/AGENT_WORKLOG.md`.

## Rules

1. `npm run build` must pass before handoff.
2. No new demo/persona dependencies.
3. One agent per file — no parallel edits to the same file.
4. Update `src/docs/AGENT_WORKLOG.md` with `[DONE]` or `[BLOCKED]` after each task.

---

## 🔴 ACTIVE TASK — Fix end-to-end approval chain

**Single agent owns this. File scope:**
- `src/utils/api/approvals-supabase.ts`
- `src/utils/api/timesheets-api.ts`
- `src/contexts/TimesheetDataContext.tsx`

### What is broken (exact symptoms)

1. **Submitter sees Draft after submit** — timesheet status does not change to `submitted` in the UI after clicking Submit, even though the approval record may be created in DB.
2. **John (NAS client) sees nothing in Approvals** — after James approves, no layer-2 record appears for John.
3. **Chain progression reads sessionStorage** — `buildApprovalPartyRoute()` in `approvals-supabase.ts` reads party data from `sessionStorage`. On page reload sessionStorage is wiped. Must read from DB instead.

### Root causes (already diagnosed)

**Bug A — Status not reflecting after submit:**
`setWeekStatus('submitted')` calls `persistStatus()` → `updateTimesheetStatus()`. If this call fails OR if the local state update (`applyWeekStatusLocally`) doesn't fire, the UI stays on Draft.
- Check: does `applyWeekStatusLocally` get called even when `persistStatus` throws? Currently it does NOT — it's after the `try/catch` which throws on failure.
- Fix: call `applyWeekStatusLocally` BEFORE `persistStatus`. Show the status change immediately in UI. If `persistStatus` fails, log a warning but DO NOT revert the local state (eventual consistency is acceptable here).

**Bug B — Chain progression uses sessionStorage:**
`buildApprovalPartyRoute(projectId, personId)` calls `readApprovalParties(projectId)` which reads from `sessionStorage` key `workgraph-approval-dir:${projectId}`. After page reload this is empty.
- Fix: in `buildApprovalPartyRoute`, when sessionStorage is empty, query `wg_projects.parties` from Supabase directly:
  ```typescript
  const { data } = await supabase
    .from('wg_projects')
    .select('parties')
    .eq('id', projectId)
    .single();
  const parties = data?.parties as ApprovalDirParty[] | null;
  ```
  Use these parties if sessionStorage returns nothing.

**Bug C — Next-layer approver UUID not resolved:**
`createNextApprovalLayerIfNeeded` sets `approverRef = sortedApprovers[0]?.id || nextParty.id`. This is a graph node ID, not a UUID. `createApproval()` then calls `resolveGraphNodeToUserId()` which fails if the project ID is not a UUID.
- Fix: in `resolveGraphNodeToUserId`, when project IS in `wg_projects` (i.e., a valid project ID exists in DB), do this lookup:
  ```sql
  SELECT user_id FROM wg_project_members
  WHERE project_id = $1 AND (scope = $2 OR graph_node_id = $2)
  LIMIT 1
  ```
  where `$2` is the node/party ID. This returns the real UUID for John or James.

### Step-by-step implementation

1. **Fix Bug A** in `src/contexts/TimesheetDataContext.tsx`:
   - In `setWeekStatus`, move `applyWeekStatusLocally(personId, weekStart, 'submitted', ...)` to BEFORE the `persistStatus` call.
   - Wrap `persistStatus` in try/catch that logs but does not rethrow (fire-and-forget with warning).

2. **Fix Bug B** in `src/utils/api/approvals-supabase.ts`:
   - Make `buildApprovalPartyRoute` async.
   - When `readApprovalParties(projectId)` returns empty array, fetch `wg_projects.parties` from Supabase.
   - Parse the parties JSONB as `ApprovalDirParty[]`.

3. **Fix Bug C** in `src/utils/api/approvals-supabase.ts`:
   - In `resolveGraphNodeToUserId`, add a DB fallback:
     ```typescript
     const { data } = await supabase
       .from('wg_project_members')
       .select('user_id')
       .eq('project_id', projectId)
       .or(`scope.eq.${nodeId},graph_node_id.eq.${nodeId}`)
       .not('user_id', 'is', null)
       .limit(1)
       .single();
     if (data?.user_id) return data.user_id as string;
     ```
     Run this whenever the existing heuristic scoring returns nothing useful.

4. **Verify the full flow:**
   - Submit timesheet as Me → UI immediately shows `submitted` (Bug A fixed)
   - James approves → layer-2 record created for John (Bug B + C fixed)
   - John approves → timesheet moves to `approved`
   - Run `npm run build` — must pass with zero TypeScript errors.

### Definition of done

- [ ] Submit as Me → status shows `submitted` immediately without page reload
- [ ] Approve as James → John sees pending approval in Approvals tab
- [ ] Approve as John → timesheet status shows `approved`
- [ ] `npm run build` passes
- [ ] Worklog updated with `[DONE] approval-chain-fix`

---

## 🟢 P2 — Phase 4 invoice work (parallel, different files)

1. Wire Claude API extraction in `src/components/invoices/InvoiceImportPanel.tsx`.
2. EN16931 XML renderer for Croatian eRačun output.
3. Gross Margin Dashboard card per project.

**P2 agents must NOT touch the files listed in the active task above.**
