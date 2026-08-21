# WorkGraph Task Backlog

**Version:** 3.1 · **Date:** 2026-07-15 · **Owner:** Claude (writes) / Codex (status updates)

Statuses: `[READY]` → `[IN PROGRESS]` → `[REVIEW]` → `[DONE]` / `[BLOCKED]`

> ## ⚖️ STRATEGY DECISION 2026-07-15 — READ FIRST
> **`src/docs/PRODUCT_STRATEGY_DECISION.md` is canonical.** Verdict: GO, narrowed.
> **Only three milestones are authorized until pilots produce evidence:**
>
> 1. **M1 — Identity chain complete (C2 minimum):** invite → accept → verified org
>    membership → project roster → graph person mapping → correctly scoped
>    workspace. Exit: a real second account runs submit → approve → invoice with
>    no persona switching, no SQL repair, no "Graph identity not mapped".
> 2. **M2 — Trust boundary is server truth:** reads flow through the 019–021 ACL
>    paths; client masks become presentation only; export/print leak-checked;
>    adversarial two-account checklist committed.
> 3. **M3 — Month-end close kit:** monthly approval workbench
>    (`specs/MONTHLY_APPROVAL_WORKBENCH_SPEC.md`, supersedes G2-2), expenses
>    (P4-9), invoice PDF (P4-3), consolidated-invoice polish, readiness warnings.
>
> Everything else is deferred regardless of its status below. Killed as goals:
> social feed surface, matchmaker/marketplace (18 mo), "1M users" framing,
> KV-only constraint, dead graph-versions API. Phase A ("the Chaser" org-scoped
> agent — detect/chase/prepare/draft, zero authority) unlocks only after M3 +
> customer-zero close. Any task not traceable to M1/M2/M3 needs a documented
> exception in AGENT_WORKLOG before work starts.

> Refocus (2026-05-30, superseded): Phase 4 promoted ahead of A2/A3 — completed.

---

## 🔴 CRITICAL — Do These First

| # | Action | Owner | Status |
|---|---|---|---|
| M5 | Apply `016_fix_wg_project_members_scope_recursion.sql` — applied 2026-07-08 via Supabase MCP, policy + fn verified live | Claude | `[DONE]` |
| DEPLOY | `make-server-f8b491be` redeployed with scoped project, invitation, and billing-timesheet routes (2026-08-21) | Codex | `[DONE]` |
| GSEC | Implement graph confidentiality model from `src/docs/specs/GRAPH_CONFIDENTIALITY_SPEC.md`: project role != rate visibility, org role != project role, contract rates signatory-scoped. G0/G1 UI containment started 2026-07-10; RLS-backed contract/rate tables still required. | Claude/Codex | `[IN PROGRESS]` |
| C2 | Company membership + private worker contracts: Nikola-company-admin invites worker, worker submits contract/timesheet, Nikola approves internally, James/John approve upstream work but cannot see worker-company private contract/pay terms. Spec now required before broad worker invites. | Claude/Codex | `[IN PROGRESS]` |
| M6 | `010_phase4_invoice_schema.sql` — verified already applied (wg_invoices + wg_invoice_templates + RLS live, 2026-07-08) | — | `[DONE]` |

> **Note (2026-07-08):** Supabase free tier **auto-paused** the project (status INACTIVE) —
> this is what "broke" timesheet submit alongside the 016 recursion. Restored via MCP.
> If the app suddenly can't reach the DB, check project status first.

---

## Manual Steps — Nikola applies in Supabase SQL Editor

| # | Migration | Status |
|---|---|---|
| M1 | `012_approval_submitter_id.sql` | `[DONE]` |
| M2 | `013_graph_node_id_and_invite_link.sql` — verified applied 2026-05-30 | `[DONE]` |
| M3 | `014_approval_records_rls_fix.sql` — applied 2026-04-24 | `[DONE]` |
| M4 | `015_purge_dead_legacy_tables.sql` — drops orphaned pre-wg_ tables, applied 2026-05-30 | `[DONE]` |
| M5 | `016_fix_wg_project_members_scope_recursion.sql` — RLS recursion fix, applied 2026-07-08 | `[DONE]` |

---

## Tier 0 — Security ✅ COMPLETE

### S1 · `approval-rls-fix` · `[DONE]` — 2026-04-24

M3 applied. Verified: `approval_records_select`, `approval_records_insert`, `approval_records_update`
all present with project-scoped USING clauses. `approval_records_block_self_approval` trigger live.

---

### S2 · `move-approval-token-signing-server-side` · `[DONE]` — 2026-04-24

- `SECRET_KEY` removed from `approval-tokens.ts` (type definitions only)
- `supabase/functions/server/approval-tokens-api.tsx` created: HMAC-SHA256 signing + timing-safe verify
- `APPROVAL_TOKEN_SECRET` read from `Deno.env.get()`; `crypto.randomUUID()` for IDs
- Wired into `index.tsx` as `registerApprovalTokenRoutes(app)`
- `npm run build` passes

⚠️ **Nikola action required:** Set `APPROVAL_TOKEN_SECRET` in Supabase Dashboard → Settings → Edge Functions → Secrets before deploying.

---

## Tier 1 — Dead Code Purge ✅ COMPLETE

### D1 · `delete-dead-timesheet-views` · `[DONE]` — 2026-04-24

All listed files/folders deleted. `ProjectTimesheetsView.tsx` preserved. Build passes.

---

### D2 · `delete-dead-approval-components` · `[DONE]` — 2026-04-24

`timesheets-approval.ts` and `timesheets-approval-hooks.ts` deleted. Build passes.

---

### D3 · `kill-local-only-project-mode` · `[DONE]` — 2026-04-26

- `isLocalOnlyProjectId`, `isLocalProjectId`, `LOCAL_APPROVALS_KEY`, `readLocalApprovals`,
  `writeLocalApprovals`, `createLocalApprovalId`, `filterLocalApprovals` all deleted
- Local-storage branches removed from `createApproval`, `getApprovalQueue`,
  `getLatestPendingApproval`, `approveItem`, `rejectItem`, `bulkApprove`, `getPendingCount`
- `proj_local_` guards removed from `timesheets-api.ts`
- `isLocalProjectId` and all call sites removed from `TimesheetDataContext.tsx`
- Zero references to `proj_local_` remain in `src/`
- `npm run build` passes

---

## Tier 2a — Phase 4: Invoice / Money Loop (PROMOTED)

> Moved ahead of A2/A3 cosmetic polish. The money loop is the revenue.

### P4-1 · `invoice-orchestrator` · `[DONE]` — 2026-07-08

Implemented by Claude. `invoices-api.ts` fully rewritten:
- **Was double-broken:** used `isUuid()` as the cloud gate (all real `proj_*` TEXT-id projects
  silently went to localStorage) AND called undeployed edge-function routes.
- Now uses the shared Supabase client directly against `wg_invoices` / `wg_invoice_templates`
  (same pattern as projects-api). localStorage kept only as offline fallback (`syncState: 'local'`).
- New `resolveProjectRates()`: reads hourly/daily rates from person nodes in `wg_projects.graph`
  (unmasked source of truth). `InvoicesWorkspace` generate flow uses per-person graph rates —
  the hardcoded `defaultRate = 95` is gone. Missing/masked rate → 0 + warning toast, never a fake rate.
- Daily contracts bill by worked-day count; hourly by hours. Currency: person → template → EUR.
- Constraint handling: due_date clamp, template FK retry, duplicate invoice-number retry,
  `.update().eq()` row-count check per CLAUDE.md rule #1.
- **Live-verified in browser:** `GET /rest/v1/wg_invoices?project_id=eq.proj_1780…` → 200 via RLS.
  Empty-state guard verified. Build passes.

⚠️ Graphs currently have **0 person nodes with rates set** — set rates in the Graph tab
before generating real invoices, or drafts will be 0-amount with a warning.

---

### P4-2 · `invoice-list-view` · `[DONE]` — 2026-07-08

Already existed in `InvoicesWorkspace.tsx` (project-scoped list, month filter, search,
status chips: Draft grey / Issued blue / Paid green / Partially paid amber / Overdue rose)
— verified rendering live against `wg_invoices` with the rewritten API. Per-invoice
cloud/local sync badge now reflects actual `syncState` instead of a project-level guess.

---

### P4-3 · `invoice-pdf-export` · `[READY]`

**Assignee:** Codex `frontend-developer`
**Goal:** Generate downloadable PDF from invoice data.

**Acceptance criteria:**
- [ ] PDF export button on invoice detail
- [ ] PDF includes line items, totals, parties, VAT, tax IDs, IBAN, payment ref (all now on the record)
- [ ] `npm run build` passes

---

### P4-4 · `editable-invoice-draft` · `[DONE]` — 2026-07-10

Migration 017 (`from_party_name`, `to_party_name`, `from_address`, `to_address`, `tax_rate`) applied.
`updateInvoice()` added to invoices-api (fetch-merge-recompute; totals always consistent with
line items + VAT %; permission/duplicate-number errors surfaced). `InvoiceDetailPrintView`
edit mode: invoice number, dates, From/Bill-To (name, address, OIB, IBAN), per-line
description/qty/rate with live amounts, VAT %, payment reference, notes. Hardcoded
"WorkGraph Billing / billing@workgraph.com" removed; party names prefill from graph parties.
**Live-verified:** rate €85 + VAT 25% on a 32h week → €2,720 + €680 = €3,400 persisted
(user edited in parallel — concurrent saves merged correctly). Build passes.

---

### P4-4b - `invoice-template-profiles` - `[DONE]` - 2026-07-10

Implemented by Codex. Reusable invoice billing templates now sit on top of the existing
`wg_invoice_templates` table using `layout.billingDefaults`; no migration required.
Saved templates capture repeat-client invoice defaults: seller/buyer legal names, addresses,
tax IDs/OIB, IBAN, VAT %, payment reference, notes, currency, due-date offset, and first-line
wording. Draft invoice detail can save the current draft as a template and apply a saved
template to a draft. The main invoice toolbar can select a saved template before generating
new drafts from approved timesheets. Issued/finalized invoices stay immutable; totals still
recompute from line items + VAT through the API layer. Build passes.

Strategic note: this is the Stripe-like foundation - canonical invoice data plus reusable
rendering/business defaults now; EN16931/Peppol XML export and country-specific delivery
networks belong in a later compliance/export layer.

---
### P4-5 · `contract-rate-extraction` · `[READY]`

**Assignee:** Claude (AI integration) — needs edge deploy + `ANTHROPIC_API_KEY` secret
**Goal:** Upload a contract PDF → Claude extracts rate, rate type (hourly/daily/fixed),
currency, overtime multiplier → prefills a review form → **human confirms** → applies to
the person's graph node / invoice defaults. AI reads, human decides — never auto-applied.

**Acceptance criteria:**
- [ ] Upload PDF/image on project → extraction returns {rate, rateType, currency, overtimeMultiplier?}
- [ ] Review/edit form before anything is saved
- [ ] Confirmed values written to person node data (graph) so P4-1 resolver picks them up
- [ ] Graceful failure when nothing found (manual entry fallback)

---

### P4-6 · `overtime-invoice-lines` · `[READY]`

**Assignee:** Codex `frontend-developer`
**Goal:** Weeks containing `TimeEntry.category === 'overtime'` produce a separate invoice
line: overtime hours × `rateMultiplier` (default 1.5) × base rate. Regular hours stay on
the base line. Data model already supports it (`TimeEntry.category`, `rateMultiplier`).

---

### P4-7 · `engagement-type-employee-vs-contractor` · `[READY]`

**Assignee:** Claude (data-model decision) → Codex implementation
**Why:** Employees don't write invoices — they only submit timesheets. Today the
orchestrator treats every person as a self-billing contractor (one invoice per
person-week at the person's rate). Wrong for employees.

**Design:**
- `engagementType: 'employee' | 'contractor'` on person graph nodes (default `contractor`
  for backward compat); editable next to the A4 rate editor in `PersonRateSection`
- For **employees**, the person-node rate = internal *pay* rate (never on an invoice);
  their approved hours roll up into the **company's** invoice to its counterparty,
  priced from the company↔agency contract edge (sell rate)
- For **contractors**, current behavior stands (self-invoice at person rate)
- Generate-from-approved groups employee weeks by (company, counterparty, month)
  into one aggregate invoice with per-person lines

**Acceptance criteria:**
- [ ] Engagement type editable on person node (graph editors only)
- [ ] Employee weeks never produce a person-billed invoice
- [ ] Aggregate company invoice from employee weeks with per-person lines
- [ ] Contractor path unchanged; `npm run build` passes

---

### P4-8 · `consolidated-monthly-invoice` · `[DONE]` — 2026-07-14

"One invoice per organization" toggle (default ON) on invoice generation:
`groupWeeksBySellerOrg()` groups approved weeks by the submitter's party (via approval
directory), one invoice per seller org per month with a line per person-week; buyer
resolved from the org's `billsTo` edge. Unresolvable people fall back to per-person
invoices. Dedup now happens BEFORE building and honors `timesheet_ids` arrays, so a
week inside a consolidated invoice can never be re-invoiced. Also: timesheets
batch-submit button relabeled "Submit month (N weeks)" — the capability existed but
read as single-week. Build passes; toggle verified rendering live.

---

### P4-9 · `billable-expenses` · `[READY]`

**Assignee:** Claude (migration + approval wiring) → Codex (UI)
**User story:** "I have additional costs — hotel, rent-a-car, gasoline — the agency
should approve them and they belong on the invoice."

**Design (industry standard: Harvest/Deel/Expensify):**
- Migration 018: `wg_expenses` (id, project_id, person_id, date, category
  travel/lodging/transport/materials/other, description, amount NUMERIC, currency,
  billable BOOLEAN default true, receipt_url TEXT null for now, status
  draft/submitted/approved/rejected, timestamps) + project-scoped RLS
- **Approval reuses the existing chain**: submit creates an `approval_records` row with
  `subject_type: 'expense'` + snapshot (amount/category/receipt) — same queue, same
  route resolution, same per-layer spawning as timesheet weeks; renders in
  ApprovalsWorkbench with a receipt/amount cell instead of the day grid
- Expense entry UI on project (Timesheets tab section or own tab): date, category,
  amount, currency, description, billable flag
- Invoice generation appends approved billable expenses of the month as separate
  lines below hours ("Expenses — Hotel, Jul 3: €140.00"), at cost (no markup v1),
  marks them invoiced (expense → invoice_id link) to prevent double-billing

**Acceptance criteria:**
- [ ] Expense CRUD + submit for approval
- [ ] Expense rows appear in approver queue and complete the chain
- [ ] Approved billable expenses land on the next generated invoice as lines
- [ ] An expense can never be invoiced twice
- [ ] `npm run build` passes

---

### P4-10 · `placement-profile-panel` · `[READY]`

**Benchmark:** `src/docs/specs/G2_INTIME_BENCHMARK.md`

**Why:** G2/InTime is placement-centric: contractors see placement details,
client/agency context, documents, compliance/AWR, timesheets, expenses, and pay
from one work container. The authenticated G2 Placement Search also exposes
operational agency fields: placement ref, client ref, worker, provider, payroll
cadence, consultant, client manager, PO number, expenses PO, default rate label,
default pay amount, and rate type. WorkGraph should map this to graph assignments
without breaking confidentiality.

**Scope:**
- Placement panel/drawer for a person assignment in the project
- Shows person, org, client/counterparty, role/title, engagement type, start/end,
  payroll cadence, consultant, manager, placement ref, client ref, approval route,
  expense policy, PO number, expenses PO, and document/compliance readiness
- Shows rate label/type and pay/bill summary only when allowed by
  `GRAPH_CONFIDENTIALITY_SPEC.md`
- Links to Timesheets, Expenses, Invoices/Pay, Documents for that placement
- Honors GRAPH_CONFIDENTIALITY_SPEC visibility rules

**Acceptance criteria:**
- [ ] Person/assignment drawer has a placement summary section
- [ ] Shows approval route + missing setup warnings
- [ ] Shows PO / expenses PO / payroll cadence fields
- [ ] Does not expose hidden rates/contracts
- [ ] `npm run build` passes

---

### P4-11 · `missing-timesheets-dashboard` · `[READY]`

**Benchmark:** InTime status buckets: Draft, Unauthorised/Submitted, Approved,
Rejected, Search/History.

**Scope:**
- Add manager/org dashboard card for expected vs submitted vs approved vs missing
  weeks
- Highlight rejected weeks that need resubmission
- Link directly to person-week rows
- Work from project month + graph assignment list, not only existing week rows

**Acceptance criteria:**
- [ ] Missing weeks are visible even when no timesheet row exists yet
- [ ] Rejected weeks surface with rejection reason
- [ ] Org/person visibility follows current scoped viewer
- [ ] `npm run build` passes

---

### P4-12 · `pay-remittance-status` · `[READY]`

**Benchmark:** InTime contractor Pay area exposes invoices, credit notes, and
remittance advice slips.

**Scope:**
- Add invoice payment/remittance status fields and UI
- Show issued invoices/remittance docs to the signatory only
- Credit notes remain follow-up unless needed by first customer

**Acceptance criteria:**
- [ ] Invoice list/detail shows payment/remittance state
- [ ] Signatory-scoped visibility documented/enforced
- [ ] `npm run build` passes

---

### P4-13 · `placement-reporting-export` · `[READY]`

**Benchmark:** Authenticated G2 Placement Search has search, sortable columns,
Choose Columns, entries-per-page controls, Detailed Report, Download Detailed
Report, and CSV.

**Scope:**
- Placement list/report view derived from graph assignments
- Column chooser with saved defaults
- CSV export and detailed report export
- Filters for worker, provider, client, manager, consultant, date range, payroll
  cadence, missing PO, missing expenses PO, and expired/ending placements
- Export respects graph confidentiality: no hidden contracts/rates leak through CSV

**Acceptance criteria:**
- [ ] Searchable placement list exists outside the graph canvas
- [ ] User can choose visible columns
- [ ] CSV export redacts unauthorized rate/contract fields
- [ ] Detailed report includes placement, approval, PO, timesheet, expense, and
      invoice status summaries
- [ ] `npm run build` passes

---

### DOC-1 · `signatory-scoped-documents-and-invoices` · `[READY]` (lands with/after C1)

**Assignee:** Claude (RLS) + Codex (UI)
**Spec:** `src/docs/specs/GRAPH_CONFIDENTIALITY_SPEC.md` (data classes + org roles)
**Why:** Confidentiality is about documents in general, not just rates. Found concrete
gap: `wg_invoices` SELECT RLS (migration 010) lets **any accepted project member** read
every project invoice — an employee-member would see the company↔agency invoice.
Acceptable under single-account personas; must be fixed before real worker accounts.

**Scope:**
- Tighten `wg_invoices` SELECT to: creator, project owner, or members of a signatory org
  (needs org-membership mapping → C1 dependency)
- Documents model: every stored document (contract PDF, PO, invoice, NDA) belongs to a
  signatory pair (party_a, party_b) + optional explicit shares; RLS scoped accordingly
- Server-side graph redaction per GRAPH_CONFIDENTIALITY_SPEC (rates masked in the
  payload, not just client-side `computeScopedView`)

---

### A4 · `rate-definition-ui` · `[DONE]` — 2026-07-10

`PersonRateSection` in NodeDetailDrawer: view + edit billing rate on person nodes
(contract type hourly/daily/fixed + rate + currency), writing the exact keys
`resolveProjectRates()` reads (`contractType`/`hourlyRate`/`dailyRate`/`fixedAmount`/`currency`).
Persists immediately via `updateProject(projectId, { graph })` → `wg_projects.graph`.
Edit affordance only for graph editors (`canEditGraph`); masked (`••••`) rates show
"hidden for your role" and cannot be edited. Missing rate shows amber warning
("invoices will come out at 0") — closes the recurring €0-invoice loop. Build passes.

**Also fixed (same session):** approvals Queue empty state now detects the viewer's own
pending submissions and says who they're waiting on + points to "My submissions"
(was a misleading "You are caught up").

---

## Tier 2b — Sprint A (Approvals UX)

### A1 · `submit-timesheet-project-picker` · `[DONE]` — 2026-05-30

`ProjectTimesheetsView.tsx`: picker Dialog opens on Submit when 2+ projects; search shown at 5+; cancel does not submit; 1-project path unchanged. Build passes.

---

### A2 · `approval-queue-chain-visualization` · `[DONE]` — 2026-07-10 (workbench) / follow-up: SubmissionsView

`ApprovalChainMini` in `ApprovalsWorkbench.tsx`: per-row chain `Submitter → Party1 → Party2`
with dots — done steps emerald, current step amber ring (or emerald/rose once decided),
future steps faded. Uses `subject_snapshot.approvalRoute`; synthesizes steps for
pre-route records. Serves both queue and my-submissions scopes of the workbench.
Build passes. **Follow-up `[READY]`:** reuse in `SubmissionsView.tsx` card list.

---

### A3 · `approval-queue-ux-polish` · `[DONE]` — 2026-07-10

- Sentence-case headers; "Current Approver" column → "Approval chain" (hosts A2 viz)
- Organization column now uses resolved `item.submitterOrg` (was duplicating person.role)
- Status chips colored: Pending amber, Approved green, Rejected rose, other grey (`statusChipClass`)
- Duplicate filter rows merged into ONE segmented control with counts (standalone);
  embedded variant renders no inner filter row (host owns pills)
- Removed noise: explainer paragraph, "Captured at submission", "Step x of y" duplicates;
  day mini-grid em-dashes → dots
- Empty state already present ("No pending approvals"), verified live. Build passes.

---

## Tier 3 — Sprint B (Graph + Permissions)

### B1 · `project-creation-wizard-redesign` · `[READY]`

**Assignee:** Codex `frontend-developer`
**Spec:** `src/docs/specs/PROJECT_CREATION_SPEC.md`
**Goal:** Step 1 = Name + Type + Visibility + Dates + Work Week only. Remove currency/region.

**Files:** `src/components/workgraph/ProjectCreateWizard.tsx`

**Acceptance criteria:**
- [ ] Currency and Region inputs REMOVED
- [ ] Atomic creation still works
- [ ] `npm run build` passes

---

### B2 · `graph-empty-state-investigation` · `[READY]`

**Assignee:** Codex `reviewer`
**Goal:** Investigate why NAS project graph canvas shows empty. Check DB and mapper.

**Steps:**
1. `SELECT id, name, graph IS NOT NULL FROM wg_projects ORDER BY created_at DESC LIMIT 10`
2. If `graph` null → write path broken, report to Claude
3. If `graph` present → check `mapSupabaseProjectRow()` includes `graph` + `parties`

**Output:** Write findings in AGENT_WORKLOG.md. No code changes without Claude sign-off.

---

### B3 · `server-side-role-enforcement` · `[DONE]` — 2026-05-30

`projects-api.tsx`: DELETE guard updated to use `getCallerRole()` (was owner_id-only check); PUT guard already used `getCallerRole()`. Both return `{"error":"Forbidden"}` 403. Also fixed pre-existing `dialog.tsx` extra-paren bug. Build passes. ⚠️ Takes effect only after `supabase functions deploy server`.

---

## Tier 4 — Sprint C (Invitation Flow)

### C1 · `invitation-acceptance-ui` · `[DONE]` — 2026-07-10

**Assignee:** Codex `frontend-developer`
**Goal:** `/invite/:token` page — shows project name + role, Accept/Decline, redirects on accept.

**Files:**
- `src/components/invitations/InviteAcceptPage.tsx` (new)
- `src/routes.tsx`

**Backend:** `supabase/functions/server/invitations-api.tsx` — `GET /invitations/:token`, `POST /invitations/:token/accept`, `POST /invitations/:token/decline`

**Acceptance criteria:**
- [x] Shows project name, inviting org, role offered
- [x] Accept calls `POST /invitations/:token/accept`
- [x] Success → redirect to workspace
- [x] Expired/invalid token → clear error
- [x] Unauthenticated → prompt sign-in, redirect back
- [x] `npm run build` passes

Implemented in `InviteAcceptPage.tsx` with `/invite/:token` and legacy
`/accept-invite?token=...` route support. Added token client in
`project-invitations.ts`; added missing source decline route in
`supabase/functions/server/invitations-api.tsx`. Requires fresh edge deploy
because the currently live function build is documented as old.

---

### C2 · `company-membership-private-worker-contracts` · `[IN PROGRESS]`

**Spec:** `src/docs/specs/C2_COMPANY_MEMBERSHIP_SPEC.md`
**Strategy:** `src/docs/specs/BULLHORN_LESSONS_STRATEGY.md`
**Dependency:** `src/docs/specs/GRAPH_CONFIDENTIALITY_SPEC.md`

**Why:** C1 proves invite-token acceptance, but a sellable staffing workflow needs
company membership and signatory-scoped documents. A company admin should be able
to invite workers into their company, approve their timesheets/contracts, and
keep worker-company private contracts hidden from agency/client approvers.
The future social profile layer is allowed to let a person claim they work for a
company, but that claim must not grant organization membership until a company
admin verifies it.

**Canonical scenario:**
- Nikola is `org_admin` of his company inside the project.
- Nikola invites Worker 1 and Worker 2 as company workers.
- Worker submits a timesheet and/or worker-company contract.
- Nikola approves internally first.
- James and John approve upstream timesheet work as agency/client approvers.
- James and John cannot see the private worker-company contract, worker pay rate,
  or Nikola-company margin.

**Scope:**
- Organization membership roles separate from project roles:
  `org_admin`, `org_finance`, `org_manager`, `org_worker`, `org_viewer`
- Membership states:
  `claimed`, `invited`, `verified`, `rejected`, `removed`
- Invite mode distinguishes:
  company worker, agency collaborator, client approver, project viewer
- Accepted invite maps the real account to a graph person and/or org membership
- Company admin can approve/reject self-claimed company affiliation from future
  personal/social profiles
- Worker-company documents are signatory-scoped by default
- Timesheet approval route can include internal company approval before upstream
  agency/client approval
- Debug-only persona switcher for local testing; no production arbitrary
  impersonation

**Acceptance criteria:**
- [ ] Worker invite creates org membership, not only project membership
- [ ] Self-claimed company affiliation creates no access until company admin
      verifies it
- [ ] Worker can submit own timesheet under their mapped graph identity
- [ ] Nikola/company admin can approve the worker's first approval layer
- [ ] Upstream agency/client approvers can approve work but cannot read
      worker-company private contracts or pay terms
- [ ] A second worker can be invited and tested independently
- [ ] Document/rate visibility is enforced server-side or explicitly marked
      blocked until GSEC tables/RPCs land
- [ ] `npm run build` passes

---

### C3 · `counterparty-real-account-approver` · `[IN REVIEW]`

**Owner:** Codex (invitation/membership area) · **Claude reviews.**
**Spec basis:** `IDENTITY_AUTHORITY_MODEL.md` (C3b), `GRAPH_CONFIDENTIALITY_SPEC.md`.
**Goal:** retire the dev chain-walker crutch — a real G2 person (James) logs in and
approves G2's layer himself, instead of the owner dev-approving it.

**What already exists (build ON these, don't duplicate):**
- `wg_assign_party_approver` RPC (027): owner OR verified party-org admin adds an
  approver *node* to a party (canApprove=true). Node has email but no linked uid yet.
- "Add approver" UI on party nodes (NodeDetailDrawer / WorkGraphBuilder).
- Invitation accept flow (C1) + `wg_assign_project_member_as_worker` (022, the
  owner→own-worker pattern to mirror).
- Approval route already routes to a party's canApprove people; approval_records
  UPDATE RLS = `wg_user_owns_project OR approver_user_id = auth.uid()`.

**The missing link — design decided:**
1. **Invite** as an approver: extend the invite so an invited person can be tagged
   to a party (the "represents G2" selection). Store the target party on the
   invitation/member row.
2. **On accept**, run a new RPC `wg_link_member_as_party_approver(project_id,
   member_id, party_graph_node_id)` — mirror of 022 but targeting the *party's*
   org, authorized to the project owner OR that party org's verified admin:
   - upsert the party's approver person node with `userId = member.user_id`,
     `canApprove = true`, name/email from the member;
   - set `wg_project_members.graph_node_id = node`, `scope = party`;
   - upsert `wg_organization_members` for the party org (verified, `org_approver`);
   - so approval records for that party carry `approver_user_id = member.user_id`.
3. **Verification of representation:** the party org's existing verified admin
   promotes/verifies the invitee (Facebook-page model). Bootstrap: project owner
   may seed the first party admin for testing (matches 027's owner path).
4. Once linked, the approval route resolves that layer's `approverUserRef` to the
   real uid → James sees it in his Queue and approves via existing RLS. No dev-walker.

**Acceptance criteria:**
- [x] Party-tagged invite and acceptance link a real account as party approver
- [x] G2's approver signs in, sees the pending item in their Queue, approves it
- [x] The layer completes with `approver_user_id` = the real account (not placeholder)
- [x] A non-authorized caller cannot link an approver to a party they don't administer
- [x] Owner bootstrap and unauthorized-link paths pass rollback-only database tests
- [x] Dev chain-walker no longer needed for that party
- [ ] `npm run build` passes (not run because active `AGENTS.md` prohibits it)

**⚠️ Coordination:** touches invitations-api, ProjectInviteMemberDialog, org
membership (Codex's active area) + a new migration. Reconcile with C3a's scoped
Edge Function (graph writes must send the complete snapshot). Claude available to
review + reconcile as with C3a.

Implementation landed and was deployed on 2026-08-21 in migration 029 plus the
invitation UI/API. Migration 030 closes the remaining trust-review findings, 031
reports the scoped `org_approver` role to the UI, and
`supabase/tests/030_trust_c3_regression.sql` passes live inside `BEGIN/ROLLBACK`.
Live multi-account acceptance completed on 2026-08-21: James accepted the G2
invite, saw the pending layer in his own queue, and approved it through RLS. The
stored layer-2 `approver_user_id` matches James's real auth UID. C3 remains in
review only for Claude reconciliation/build verification.

---

## Phase 4 Queue — Invoice Generation

**PROMOTED to Tier 2a above.** P4-1, P4-2, P4-3 now take priority over A2/A3 cosmetic polish.
P4-4 (migration 010) is in the CRITICAL section at the top of this document.

Spec: `src/docs/specs/PHASE4_INVOICE_SPEC.md`

---

## Done

| Task | Completed |
|---|---|
| P4-1 invoice-orchestrator (graph rates, direct Supabase persistence) | 2026-07-08 |
| P4-2 invoice-list-view (verified live) | 2026-07-08 |
| M5 016 RLS recursion fix applied + verified | 2026-07-08 |
| M6 010 invoice schema verified applied | 2026-07-08 |
| Social gate extended: AppHeader Feed nav + Write-a-Post + onboarding redirect + page title | 2026-07-08 |
| A1 submit-timesheet-project-picker | 2026-05-30 |
| B3 server-side-role-enforcement (deploy pending) | 2026-05-30 |
| M4 015_purge_dead_legacy_tables applied | 2026-05-30 |
| S1 approval-rls-fix (M3/014 applied + verified) | 2026-04-24 |
| S2 move-approval-token-signing-server-side | 2026-04-24 |
| D1 delete-dead-timesheet-views (30 files, ~13k LOC) | 2026-04-24 |
| D2 delete-dead-approval-components | 2026-04-24 |
| D3 kill-local-only-project-mode | 2026-04-26 |
| approval-submissions-redesign | 2026-04-22 |
| project-workspace-role-gating | 2026-04-22 |
| atomic-project-create-path | 2026-04-22 |
| project-delete-owner-guard | 2026-04-22 |
| project-cloud-refresh-persistence | 2026-04-21 |
| task6a–6e approval chain bugs | 2026-04-21 |
| bundle-splitting (9 chunks <400kB) | 2026-04-20 |
| invoice edge functions scaffolding | 2026-04-20 |
| graph context fix (no tab-visit required) | 2026-04-20 |
| invite email edge function | 2026-04-20 |
| dashboard-launchpad-onboarding (role-based checklist, DashboardPage.tsx) | 2026-05-30 |
