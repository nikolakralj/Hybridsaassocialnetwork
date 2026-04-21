# AGENTS.md — WorkGraph Codex Session Card

Read [src/docs/README.md](src/docs/README.md) first.

## Hierarchy

- **Nikola**: Product owner / observer.
- **Claude**: Lead Architect. You report to Claude. Claude reviews all output before Phase gates.
- **Codex agents (you)**: Implementation workforce. Report in `src/docs/AGENT_WORKLOG.md`.

## Rules

1. **Do NOT run `npm install` or attempt to repair node_modules.** Your sandbox does not have the full node_modules tree. Running npm will waste your entire context window fixing a non-issue.
2. **Do NOT run `npm run build` to verify.** Claude runs the build on the real dev machine. Your job is to write correct code and report what you changed.
3. Make the code changes. Then write a clear `[DONE]` entry in `AGENT_WORKLOG.md` listing: what files changed, what logic changed, any residual risk.
4. No new demo/persona dependencies.
5. One agent per file — no parallel edits to the same file.
6. Never touch files outside your assigned scope for the current task.

---

## Current Phase: Phase 4 — Invoice Generation

Phase 3 is GO. Phase 4 exit gate requires:
- Invoice data persisted to Supabase (not localStorage)
- Invoice edge functions deployed
- No tab-visit ordering requirement for approval chain to load

---

## 🔴 TASK 1 — Bundle Splitting (CRITICAL PERFORMANCE)

**Agent role:** `frontend-developer`
**File ownership:** `vite.config.ts`, `src/components/ProjectWorkspace.tsx`

### Problem

The app builds as a single 1.74 MB JS chunk. This is a production disqualifier — real users wait 3–5 seconds on first load.

### What to do

**Step 1 — vite.config.ts**: Add `build.rollupOptions.output.manualChunks`:

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-flow': ['@xyflow/react'],
  'vendor-ui': [/* radix-ui packages, lucide-react, sonner, clsx, tailwind-merge */],
  'workgraph': [/* glob src/components/workgraph/* */],
  'timesheets': [/* glob src/components/timesheets/* */],
  'approvals': [/* glob src/components/approvals/* */],
  'invoices': [/* glob src/components/invoices/* */],
}
```

Use a function form of `manualChunks` if needed to handle dynamic imports cleanly.

**Step 2 — ProjectWorkspace.tsx**: Lazy-load the heavy tab panels with `React.lazy()` + `Suspense`:
- WorkGraph tab → `React.lazy(() => import('./workgraph/WorkGraphBuilder'))`
- Timesheets tab → `React.lazy(() => import('./timesheets/ProjectTimesheetsView'))`
- Approvals tab → `React.lazy(() => import('./approvals/ApprovalsWorkbench'))`
- Invoices tab → `React.lazy(() => import('./invoices/InvoicesWorkspace'))`

Wrap each lazy component in `<Suspense fallback={<div className="p-8 text-muted-foreground">Loading...</div>}>`.

### Definition of done

- [ ] `npm run build` passes with no TypeScript errors
- [ ] No single chunk exceeds 400 kB (gzip)
- [ ] Report actual chunk sizes in AGENT_WORKLOG.md
- [ ] Worklog entry: `[DONE] task1-bundle-splitting`

---

## 🔴 TASK 2 — Invoice Edge Functions (PHASE 4 GATE)

**Agent role:** `backend-developer`
**File ownership:** `supabase/functions/server/invoices-api.tsx`, `supabase/functions/server/invoice-templates-api.tsx`, `supabase/functions/server/invoice-extract-api.tsx`, `supabase/functions/server/index.tsx`

### What to build

**File 1: `supabase/functions/server/invoices-api.tsx`**

Hono router registered at `/invoices`. Follow the exact same pattern as `projects-api.tsx` (cors, auth middleware, supabase service client, JSON responses).

Routes:
- `POST /invoices` — insert row into `wg_invoices`, return created invoice with id
- `GET /invoices?project_id=X` — list all invoices for that project
- `PATCH /invoices/:id` — update `status` field only (draft→issued→paid→partially_paid→overdue)

Table: `wg_invoices` (created in migration 010 — columns: id, project_id, template_id, invoice_number, from_party_id, to_party_id, issue_date, due_date, currency, line_items JSONB, subtotal, tax_total, total, status, timesheet_ids, notes, created_by, created_at, updated_at).

**File 2: `supabase/functions/server/invoice-templates-api.tsx`**

Hono router registered at `/invoice-templates`.

Routes:
- `POST /invoice-templates` — insert into `wg_invoice_templates`, return created template
- `GET /invoice-templates?owner_id=X` — list templates for that user
- `DELETE /invoice-templates/:id` — soft delete (set is_default=false, delete row)

**File 3: `supabase/functions/server/invoice-extract-api.tsx`**

Hono router registered at `/invoice-extract`.

Route: `POST /invoice-extract`
- Receives `{ fileBase64: string, mimeType: string }`
- Calls Anthropic SDK (`claude-sonnet-4-6`) with this system prompt:

```
You are an invoice template extractor.
Analyze the provided invoice and return a JSON object with this exact structure:
{
  "locale": "hr-HR",
  "layout": {
    "header": { "invoiceNumberLabel": "Račun:", "position": "top-left" },
    "parties": { "sellerLabel": "PRODAVATELJ:", "buyerLabel": "KUPAC:", "layout": "two-column-right" },
    "lineItems": { "columns": ["#", "Naziv", "JM", "Količina", "Cijena", "Iznos"], "hasStandardIdentifier": true },
    "totals": { "position": "bottom-right", "showSubtotal": true, "showTaxBreakdown": true }
  },
  "compliance": { "standard": "urn:cen.eu:en16931:2017", "taxScheme": "VAT", "idScheme": "9934", "paymentRefFormat": "HR99", "taxRate": 25 },
  "fieldMap": { "invoiceNumber": "Račun", "issueDate": "Datum izdavanja", "dueDate": "Datum dospijeća", "currency": "Šifra valute" }
}
Return only the JSON object, no explanation.
```

- If `ANTHROPIC_API_KEY` env var is not set, return a hardcoded Croatian eRačun stub (same shape as above) so the UI still works without the key.

**index.tsx**: Register all three new routers. Follow existing pattern.

### Definition of done

- [ ] `npm run build` passes
- [ ] All three route files created following existing Hono patterns
- [ ] Registered in index.tsx
- [ ] Worklog entry: `[DONE] task2-invoice-edge-functions`

---

## 🔴 TASK 3 — Wire Invoices to Supabase (PHASE 4 GATE)

**Agent role:** `frontend-developer`
**File ownership:** `src/utils/api/invoices-api.ts` (new file), `src/components/invoices/InvoicesWorkspace.tsx`

**Do NOT touch:** `src/components/invoices/InvoiceImportPanel.tsx`

### Problem

`InvoicesWorkspace.tsx` generates invoices and stores them in sessionStorage/localStorage. The `wg_invoices` DB table exists but is never written to. Invoices are lost on tab close.

### What to build

**New file: `src/utils/api/invoices-api.ts`**

```typescript
const BASE = '/make-server-f8b491be';
const LOCAL_KEY = (projectId: string) => `workgraph-invoices-${projectId}`;

export async function createInvoice(invoice: InvoicePayload, accessToken?: string): Promise<Invoice>
export async function listInvoices(projectId: string, accessToken?: string): Promise<Invoice[]>
export async function updateInvoiceStatus(id: string, status: string, accessToken?: string): Promise<void>
export async function saveTemplate(template: InvoiceTemplate, accessToken?: string): Promise<InvoiceTemplate>
export async function listTemplates(ownerId: string, accessToken?: string): Promise<InvoiceTemplate[]>
```

Rules:
- If `projectId` matches `/^proj_/` (local project): use localStorage fallback with `LOCAL_KEY(projectId)`, no API call.
- For UUID projects: call the edge function API. On network failure, fall back to localStorage and log a warning.
- Follow the exact same pattern as `src/utils/api/projects-api.ts` (fetch + error handling + fallback).

**Update `InvoicesWorkspace.tsx`**:
- On mount: call `listInvoices(projectId)` instead of reading sessionStorage
- On invoice generate: call `createInvoice(...)` then refresh the list
- On status change (draft→issued): call `updateInvoiceStatus(...)`
- Show a small badge "Saved to cloud" vs "Local only" on each invoice card based on whether the project ID is UUID

### Definition of done

- [ ] `npm run build` passes
- [ ] Generated invoice survives a browser tab close + reopen for UUID projects
- [ ] Local `proj_...` projects fall back gracefully without API errors
- [ ] Worklog entry: `[DONE] task3-invoice-persistence`

---

## 🟡 TASK 4 — Fix SessionStorage Graph Coupling

**Agent role:** `frontend-developer`
**File ownership:** `src/contexts/WorkGraphContext.tsx`, `src/components/timesheets/ProjectTimesheetsView.tsx`, `src/components/approvals/ApprovalsWorkbench.tsx`

**Read-only reference:** `src/components/workgraph/WorkGraphBuilder.tsx` (do not modify)

### Problem

Timesheets and Approvals tabs read `workgraph-approval-dir:${projectId}` and `workgraph-name-dir:${projectId}` from sessionStorage. These are only written by WorkGraphBuilder when the Graph tab is visited. If a user goes directly to Timesheets, the approval chain is empty.

### What to do

**Expand `WorkGraphContext.tsx`**:

```typescript
interface WorkGraphContextValue {
  nameDirectory: Record<string, Record<string, string>>; // projectId → {nodeId: name}
  approvalDirectory: Record<string, ApprovalDirEntry[]>; // projectId → parties
  loadGraphContext: (projectId: string) => Promise<void>;
}
```

`loadGraphContext(projectId)`:
1. Check sessionStorage first (`workgraph-approval-dir:${projectId}`) — if populated, parse and store in context state. Done.
2. If sessionStorage is empty: call `getLatestGraph(projectId)` from `src/utils/api/workgraph-supabase.ts`.
3. From the fetched graph nodes/edges, build the name directory and approval directory using the same logic already in WorkGraphBuilder (extract it, don't duplicate it — import or inline the minimal version).
4. Store in context state AND write back to sessionStorage so the next tab visit is fast.

**In `ProjectTimesheetsView.tsx` and `ApprovalsWorkbench.tsx`**:
- Add `const { approvalDirectory, nameDirectory, loadGraphContext } = useWorkGraphContext()`
- On mount when directories are empty for current projectId: call `loadGraphContext(projectId)`
- Replace direct `sessionStorage.getItem('workgraph-approval-dir:...')` reads with context values

WorkGraphBuilder's sessionStorage writes remain unchanged — they are the fast path. This is additive only.

### Definition of done

- [ ] `npm run build` passes
- [ ] Timesheets tab loads approval chain correctly without visiting Graph tab first
- [ ] Worklog entry: `[DONE] task4-graph-context-fix`

---

## 🟡 TASK 5 — Invite by Email Edge Function

**Agent role:** `backend-developer`
**File ownership:** `supabase/functions/server/invitations-api.tsx`, `supabase/functions/server/index.tsx`, `src/components/projects/ProjectInviteMemberDialog.tsx`

### What to build

**`supabase/functions/server/invitations-api.tsx`**:

- `POST /invitations` — create invite token (use `crypto.randomUUID()`), insert into `wg_project_invitations` (table from migration 004), call `sendEmail()` from `email.tsx` with body: `"You've been invited to [project name] on WorkGraph. Accept: [VITE_APP_URL]/accept-invite?token=[token]"`
- `GET /invitations/:token` — return invitation details (project name, inviter, role, expiry)
- `POST /invitations/:token/accept` — link accepting user_id to `wg_project_members` for the project

Register in `index.tsx`.

**`ProjectInviteMemberDialog.tsx`**: Replace any stub `console.log` or placeholder with a real `fetch` to `POST /make-server-f8b491be/invitations`. Show success via Sonner toast. On error, show error toast.

### Definition of done

- [ ] `npm run build` passes
- [ ] Invite creates a record in `wg_project_invitations`
- [ ] Email would be sent (log the payload if SMTP not configured)
- [ ] Worklog entry: `[DONE] task5-invite-email`

---

## 🔴 TASK 6 — Approval Chain Correctness (PHASE 4 BLOCKER, 5 BUGS)

Manual QA on the 4-party supply chain (Me → G2 → Andritz → NAS-client) surfaced six approval-chain defects. Bug #4 (self-approval guard) was already patched by Claude in `src/utils/api/approvals-supabase.ts` → `approveItem()`. Your job is the remaining five.

**Reference context for testing scenarios:**
- Supply chain: `Me (contractor)` → `G2 (agency)` bills `Andritz (company)` bills `NAS-client (end client)`
- People: Me, James (G2), Martin (PLC/other contractor), Benjamin (Martin's org), John (NAS-client)
- Known working: James approving Me's timesheet produces layer 1 approval (confirmed OK).
- Known broken: After James approves, queue says "already approved" for John — layer for NAS-client is never created.

---

### 6A — Chain skip: Client layer never spawned

**Agent role:** `backend-developer`
**File ownership:** `src/utils/api/approvals-supabase.ts` (EXCLUSIVELY — frontend-developer may not touch)

**Root cause:** `createNextApprovalLayerIfNeeded` (around line 290–348) computes `nextParty` via `route[currentIndex + 1] : route[currentLayer]`. This fails when:
1. `approver_node_id` is a person id not present in the `route` (which contains party ids) → `currentIndex = -1` → falls back to `route[currentLayer]` which has off-by-one semantics against 1-based `approval_layer`.
2. `buildApprovalPartyRoute` only pushes parties that have `canApprove` people — if the final client party lacks the `canApprove` flag (graph-building omission) it is silently dropped from the route.

**Fix:**
1. In `buildApprovalPartyRoute`, always push every reachable upstream party into the route, regardless of `canApprove`. Defer the "has approvers" check to `createNextApprovalLayerIfNeeded`, which must skip (not drop) parties with zero approvers and continue walking. Log `[approvals.route]` at info level with the resolved party ids.
2. In `createNextApprovalLayerIfNeeded`, resolve the current party deterministically:
   - If `approver_node_id` matches a party id → use that party's route index as `currentIndex`.
   - Else look up which party contains that node id as a person → use that party's index.
   - Else log a warning and use `currentLayer - 1` (layer is 1-based, route is 0-based).
3. Advance through the route until you find a party with at least one `canApprove` person. If you reach the end of the route, return `false` (final layer complete). Do NOT use `route[currentLayer]` as a fallback.
4. Add structured `console.debug('[approvals.nextLayer]', { currentLayer, currentPartyId, routeIds, nextPartyId })` to make future debugging cheap.

**Definition of done:**
- [ ] Chain Me → G2 → Andritz → NAS spawns three layers: G2 (layer 1 at submit), Andritz (layer 2 after G2 approves), NAS (layer 3 after Andritz approves). Verify by inspecting `approval_records` rows.
- [ ] After NAS approves, `syncTimesheetWeekStatusFromApproval` sets `wg_timesheet_weeks.status = 'approved'`.
- [ ] Worklog entry: `[DONE] task6a-chain-spawn`

---

### 6B — Submitter shows as "Me" instead of real name

**Agent role:** `frontend-developer`
**File ownership:** `src/components/approvals/ApprovalsWorkbench.tsx` (shared with 6C, 6D — same agent, sequential)

**Root cause:** `ApprovalsWorkbench.tsx` lines ~269–272:
```ts
const submitterName = subjectSnapshot?.submitterName
  || item.timesheetData?.contractorName
  || subjectSnapshot?.title
  || (item.subjectType === "timesheet" ? "Submitted timesheet" : "Unknown");
```
None of these fall back to the `nameDirectory` that already holds `nodeId → displayName`. For own submissions, `subjectSnapshot.submitterName` is literally "Me" (the viewer label).

**Fix:**
1. Add a resolver `resolveSubmitterDisplayName(item, nameDirectory)` that:
   - Reads `item.timesheetData?.submitterId || subjectSnapshot?.submitterId || parsed-from-subjectId`.
   - Looks up that id in `nameDirectory[item.projectId]`.
   - Falls back to the existing chain only if the directory has no entry.
2. Explicitly reject the string `"Me"` as a valid `submitterName` — treat it as absent and continue down the fallback chain.
3. Pipe the resolved name into the existing card renderer.

**Definition of done:**
- [ ] Approval card always shows the real person name (e.g., "Nikola", "Martin") not "Me".
- [ ] Worklog entry: `[DONE] task6b-submitter-name`

---

### 6C — "My submissions" leaks other-org approvals

**Agent role:** `frontend-developer` (same file as 6B — handle after 6B)
**File ownership:** `src/components/approvals/ApprovalsWorkbench.tsx`, `src/utils/api/approvals-supabase.ts` read-only reference

**Root cause:** The "My submissions" tab filters only by `submitterUserId: user.id` (line 242). When a user switches the viewer dropdown to a different person (e.g., Martin while logged in as Nikola), the tab still queries Nikola's user id, which returns Nikola's submissions — incorrectly labelled as "Martin's".

**Fix:**
1. When the viewer has been switched via the view-as dropdown, determine the intended submitter identity:
   - Resolve `viewerNodeId` to a Supabase user id via `resolveGraphNodeToUserId(projectId, viewerNodeId)` (reuse the helper from `approvals-supabase.ts`; export it if not already).
   - If resolution succeeds, set `filters.submitterUserId = resolvedId`.
   - Additionally pass the viewer's party (org) id so the backend can also filter on `approver_node_id.in (viewer's org descendants)` when checking submissions that originated in other orgs.
2. If no resolution is possible (demo-only node, no linked user), fall back to filtering by the viewer's **graph node id** as `submitterGraphNodeId` — add this optional filter to `ApprovalQueueFilters` and to the Supabase query (new `or()` on `submitter_graph_node_id` or equivalent column if present; otherwise match via `approval_records.subject_id` prefix).
3. Never fall through to `user.id` when `viewerNodeId` is set.

**Definition of done:**
- [ ] Viewing as Martin shows only Martin's own submissions in "My submissions", never other users'.
- [ ] Worklog entry: `[DONE] task6c-my-submissions-scope`

---

### 6D — Org viewer sees empty queue (`getApproverScopeNodeIds` stale)

**Agent role:** `backend-developer` (after 6A completes — same file)
**File ownership:** `src/utils/api/approvals-supabase.ts`

**Root cause:** `getApproverScopeNodeIds` (line ~401) reads approval parties from `readApprovalParties(projectId)` which is sessionStorage-only. If the viewer arrives at Approvals tab without visiting the Graph tab, sessionStorage is empty → scope returns `[viewerNodeId]` only → the queue query matches nothing.

**Fix:**
1. Change `getApproverQueue` flow: when `filters.approverNodeId` is set and sessionStorage returns empty parties, `await loadApprovalParties(projectId)` (the Supabase-backed version already defined higher up) and recompute scope ids from the fresh result.
2. Extract a helper `async function resolveApproverScopeNodeIds(projectId, viewerNodeId): Promise<string[]>` that wraps the current synchronous logic but awaits on Supabase fallback when sessionStorage is empty.
3. Call the async version from inside the filter block; keep the synchronous version for hot paths that don't touch Supabase.

**Definition of done:**
- [ ] Logging into a fresh session, navigating directly to Approvals tab as Benjamin (or any org approver) shows pending items in the queue without first visiting the Graph tab.
- [ ] Worklog entry: `[DONE] task6d-approver-scope-async`

---

### 6E — "Approve from graph" still clickable after full approval

**Agent role:** `frontend-developer`
**File ownership:** `src/components/timesheets/ProjectTimesheetsView.tsx` (EXCLUSIVELY for this task)

**Root cause:** `canViewerApprovePerson` (line 448) returns `true` whenever the viewer is in the approval chain, with no check on whether the current week's canonical status is already `approved`. The drawer's inner gate (`canApprove && week.status === 'submitted'`, line 1397) catches the simplest case, but the "Approve from graph" visual affordance and the inline row buttons (lines 611, 630) do not re-check status.

**Fix:**
1. Extend `canViewerApprovePerson` to accept an optional `week?: StoredWeek` argument. If `week.status === 'approved' || week.status === 'draft'`, return `false` immediately.
2. Update callers at lines 611, 630, 748 to pass the relevant week object (or a `getWeek(personId, weekStart)` lookup).
3. In the WeekDetailDrawer consumer (line 748), the gate already correctly suppresses the button via `canApprove && week.status === 'submitted'` — leave that inner check as a belt-and-braces safety net but ensure `canApprove` itself is now `false` when the week is approved so the "Approve from graph" chip elsewhere in the UI goes away too.
4. Grep for any other use of `canApprovePerson` / `canApprove` and ensure they honor the same week-status gate.

**Definition of done:**
- [ ] After NAS approves the final layer, re-opening the week drawer shows NO approve button anywhere, and the "Approve from graph" affordance is hidden.
- [ ] Worklog entry: `[DONE] task6e-approve-from-graph-gate`

---

### Test Plan for Task 6 (manual, after all 6A-6E land)

Reproduce the supply chain: `Me → G2 (James) → Andritz → NAS (John)` with Martin (PLC) and Benjamin (Martin's org) as secondary submitters.

1. Submit timesheet as Me → `approval_records` has one row, `approver_node_id` = G2-party, `approval_layer = 1`.
2. View as James (G2) → approve → second row appears for Andritz, `layer = 2`, timesheet status still `submitted`.
3. View as Andritz approver → approve → third row for NAS, `layer = 3`.
4. View as John (NAS-client) → queue shows the pending item (not "already approved"). Approve → `wg_timesheet_weeks.status = 'approved'`.
5. Re-open the timesheet drawer as any viewer → no approve button, no "Approve from graph" affordance.
6. Switch viewer to Martin (different org) → "My submissions" tab shows only Martin's own items, not Me's.
7. Name column shows "Nikola" / "Martin" — never "Me".
8. As a logged-in user, try to approve your own submission via a direct API call → `approveItem` throws "You cannot approve your own submission." (Already fixed by Claude — just verify didn't regress.)

---

---

## 🔴 TASK 6F — Timesheet submit impersonation (CRITICAL)

**Agent role:** `backend-developer` (new worker — does NOT overlap with 6A/6D worker)
**File ownership:** `src/utils/api/timesheets-api.ts`, `supabase/functions/server/timesheets-api.tsx` (edge function)

**Do NOT touch:** `src/utils/api/approvals-supabase.ts` (Codex 6A/6D is in flight there).

**Root cause:** `timesheets-api.ts` around line 78–90 accepts `options?.personId` from the caller and writes it into `wg_timesheet_weeks.user_id` / `submitter_user_id` without verifying that the caller IS that person. A contractor can submit hours under another contractor's identity.

**Fix:**
1. In the edge-function side (`supabase/functions/server/timesheets-api.tsx`): always derive the authoritative `user_id` from the validated JWT (`c.get('user').id`) and WRITE that into `user_id`. If the request body attempts to set a different `user_id`, either reject with 403 or silently override. Only admins (role `Owner`/`Editor` via `wg_project_members`) may submit on behalf of another person — and even then, the edge function logs an audit trail entry before doing so.
2. In the client-side `timesheets-api.ts`: stop sending `personId` as an arbitrary override. Keep it only as a display hint; the server is authoritative.
3. Add a unit-testable guard: if `options.personId` is set AND does not match `auth.user.id` AND the caller's role is not Owner/Editor, throw `"You cannot submit a timesheet for another person."` client-side too (defense in depth).

**Definition of done:**
- [ ] An attempt to submit with a forged `personId` returns 403.
- [ ] Admin-on-behalf-of submission works and writes an audit row (can be a `console.log` + kv_store entry for now).
- [ ] Worklog entry: `[DONE] task6f-timesheet-impersonation`

---

## 🔴 TASK 6G — Invite token single-use (CRITICAL)

**Agent role:** `backend-developer` (may be the same as 6F — both edge-side)
**File ownership:** `supabase/functions/server/invitations-api.tsx`, migration `supabase/migrations/011_invitation_used_at.sql` (NEW)

**Root cause:** `invitations-api.tsx` accept-by-token verifies email match but never marks the token as consumed. A leaked token can be replayed.

**Fix:**
1. Migration `011_invitation_used_at.sql`: add `used_at TIMESTAMPTZ NULL` and `used_by UUID NULL` to `wg_project_invitations`. Add partial unique index: `CREATE UNIQUE INDEX wg_invites_token_unused ON wg_project_invitations(token) WHERE used_at IS NULL;` — this makes the single-use guarantee atomic at the DB layer.
2. In the POST `/invitations/:token/accept` handler: update statement must be `UPDATE ... SET used_at = NOW(), used_by = :user WHERE token = :token AND used_at IS NULL RETURNING *`. If zero rows returned, reply 410 Gone with `"This invitation has already been used or has expired."`.
3. Also enforce `expires_at` during the accept (reject if past).
4. Wrap the member-link step in the same transaction so a failure rolls back the "used" flag.

**Definition of done:**
- [ ] Accepting the same token twice returns 410 the second time.
- [ ] Expired tokens return 410.
- [ ] Worklog entry: `[DONE] task6g-invite-single-use`

---

## 🔴 TASK 6H — Invoice cross-org authorization (CRITICAL, PHASE 4 GATE)

**Agent role:** `backend-developer`
**File ownership:** `supabase/functions/server/invoices-api.tsx`

**Do NOT touch:** `src/utils/api/invoices-api.ts` client code (that's task 6I scope; same agent may pick it up sequentially).

**Root cause:** `POST /invoices` accepts `from_party_id` and `to_party_id` from the request body without any check that the caller controls the `from_party_id`. A user can issue an invoice FROM an org they have no relationship to.

**Fix:**
1. Before insert, fetch the graph for the project (same helper used by approvals — look for `getLatestGraph` or equivalent in `supabase/functions/server/workgraph-*.tsx`).
2. Resolve the authenticated user to a party id via `wg_project_members.graph_node_id` → party lookup in the graph.
3. Verify: the caller's party (or an ancestor of it in the `billsTo` chain) equals `from_party_id`. If not, reject with 403 `"You cannot issue an invoice from a party you do not control."`.
4. Additionally verify `to_party_id` is reachable from `from_party_id` via `billsTo` — no invoicing to unrelated orgs.

**Definition of done:**
- [ ] A user whose party is `G2` cannot POST an invoice with `from_party_id = 'andritz'` — returns 403.
- [ ] A user whose party is `Me` CAN invoice to `G2` (direct billsTo).
- [ ] Worklog entry: `[DONE] task6h-invoice-authz`

---

## 🔴 TASK 6I — Invoice gate on approved timesheets (PHASE 4 GATE)

**Agent role:** `backend-developer` (sequential after 6H, same file + client)
**File ownership:** `supabase/functions/server/invoices-api.tsx`, `src/utils/api/invoices-api.ts`

**Root cause:** Invoice generation does not verify that every timesheet in `timesheet_ids` is in status `approved`. A user can issue an invoice for draft/pending work.

**Fix:**
1. In the edge function POST handler, after the authz check from 6H: `SELECT id, status FROM wg_timesheet_weeks WHERE id IN (...)`. If ANY row is not `'approved'`, reject with 422 `"Cannot invoice un-approved timesheets: [ids]"`.
2. In the client `invoices-api.ts` `createInvoice()`, mirror the same check before sending — precheck status and throw early for better UX. But the server check remains authoritative.
3. Add a client-side helper `timesheetIsInvoiceable(timesheet)` returning `{ok: boolean, reason?: string}`.

**Definition of done:**
- [ ] Invoice creation with at least one un-approved timesheet returns 422.
- [ ] Full-approval chain (Me→G2→Andritz→NAS) must all be `approved` for invoicing to succeed.
- [ ] Worklog entry: `[DONE] task6i-invoice-gate`

---

## 🟠 TASK 6J — Additional hardening (bundled, HIGH priority)

**Agent role:** `security-auditor` (or backend-developer with security review hat)
**File ownership:** `src/contexts/AuthContext.tsx`, `supabase/functions/server/approvals.tsx` (legacy token file)

**Do NOT touch:** `approvals-supabase.ts` (Codex active), `ApprovalsWorkbench.tsx` (Codex active), `ProjectTimesheetsView.tsx` (Codex active).

**Fixes to bundle:**
1. **Sign-out sessionStorage cleanup** (AuthContext.tsx around line 201): in `signOut()`, after clearing React state, iterate `Object.keys(sessionStorage)` and delete every key starting with `workgraph-` or `wg-`. This prevents Bob from seeing Alice's cached `name-dir` / `approval-dir` / `viewer-meta` after a logout-login flip on the same device.
2. **Weak approval tokens** (approvals.tsx:294 area — the LEGACY kv-store-backed approvals router, not `approvals-supabase.ts`): replace any `Date.now() + Math.random()` token generation with `crypto.randomUUID()`.
3. **Graph cycle detection in `buildApprovalPartyRoute`** — **SKIP FOR NOW**. Codex is editing this function in 6A. Claude will review the 6A patch and add cycle detection as a follow-up if Codex doesn't include it.

**Definition of done:**
- [ ] Manual test: log in as A, log out, log in as B on same browser — no A-era data in sessionStorage.
- [ ] All approval-token generation uses `crypto.randomUUID()`.
- [ ] Worklog entry: `[DONE] task6j-hardening`

---

## Task Execution Order

Run Tasks 1, 2, 3 in parallel (disjoint file sets).
Run Task 4 after Task 1 (needs clean build baseline).
Run Task 5 after Task 2 (shares index.tsx).

**Task 6 dispatch (all subtasks):**
- **Currently in flight:**
  - 6A / 6D on `approvals-supabase.ts` (backend-developer). Claude's self-approval check must be upgraded to an atomic `UPDATE ... WHERE status = 'pending' AND submitter_user_id <> :user RETURNING *` pattern as part of 6D. Add this to the 6D scope.
  - 6B / 6C on `ApprovalsWorkbench.tsx` (frontend-developer). The `matchesSubmitterFilters` helper already landed — continue from there.
  - 6E on `ProjectTimesheetsView.tsx` (separate frontend-developer).
- **New, disjoint — spawn immediately:**
  - 6F on `timesheets-api.ts` + `timesheets-api.tsx` (new backend-developer, no conflict with 6A/6D).
  - 6G on `invitations-api.tsx` + migration 011 (same or new backend-developer).
  - 6H then 6I on `invoices-api.tsx` and `invoices-api.ts` (sequential, one backend-developer).
  - 6J on `AuthContext.tsx` + legacy `approvals.tsx` (new agent — explicitly avoids files 6A/6E own).

## Current Blockers for Codex

None known. All Phase 3 blockers are closed.
