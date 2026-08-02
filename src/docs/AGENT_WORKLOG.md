# WorkGraph Agent Worklog

**Owner:** Nikola + Claude + Codex
**Rule:** Append only. Never edit prior entries. Older entries: `archive/AGENT_WORKLOG_ARCHIVE.md`.

---

## 2026-07-16 - [REVIEW] Claude review + reconcile of Codex C3a (commit 0ec94b3)

Codex built C3a (scoped supply-chain administration) in parallel and handed off
for review. **Verdict: APPROVED, sound** — it's the graph-authority fix I flagged.

Findings:
- **028 verified live-safe.** `wg_projects` RLS: UPDATE has NO authenticated
  policy (direct client updates blocked); SELECT keeps BOTH `wg_projects_member`
  (via wg_user_is_project_member) AND owner — so non-owner members (Rodman) can
  still READ the project. My initial "SELECT owner-only" worry was unfounded.
- **My 027 RPC survives** (SECURITY DEFINER bypasses RLS). Add-approver works.
- **Server PUT is the real C3a win**: rejects changing another org's nodes/edges
  ("You cannot change another organization's graph connections") — this is the
  "James can't delete Triangle Services" protection. Requires a COMPLETE
  graph+parties snapshot for supply-chain updates.
- **🔧 Reconciled (this pass):** my rate editor `handleUpdateNodeData` sent
  `{graph}` WITHOUT `parties` → would throw under Codex's new PUT validation
  once deployed. Fixed to send the full graph+parties snapshot via
  `buildEditableParties`. Works today (server undeployed) and after deploy.
- **⚠️ Deployment coordination:** 028 (applied) + Codex's server projects-api.tsx
  (committed, NOT deployed) are a set. My client fix must be in the bundle before
  the edge function is deployed, else the rate editor breaks. Nothing broken now.
- **📝 Architectural tension to resolve later:** 027 RPC lets the OWNER add
  approvers to a counterparty (G2) for bootstrap; Codex's Edge Function forbids
  the owner changing another org's nodes. Both validate auth (not a hole) but the
  authority models differ. Decide: can the owner bootstrap counterparty people,
  or only that org's verified admin? RPC already supports both.

## Current State (2026-07-08)

- **All migrations 001ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ016 applied** (016 applied + verified 2026-07-08; 010 verified already applied ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â wg_invoices/wg_invoice_templates + RLS live).
- **P4-1 invoice orchestrator DONE** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â invoices-api.ts rewritten to direct Supabase; graph-defined rates wired into generate flow; live-verified in browser. P4-2 list view verified. P4-3 (PDF export) is next `[READY]`.
- **Edge functions:** an OLD build (`make-server-f8b491be`) is live and serving /api/timesheets, /api/contracts, /api/projects/:id/members; newer routes (invitations, approval tokens, B3 guards) 404 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ **fresh `supabase functions deploy server` still required**.
- **Supabase free tier auto-pauses the project** after inactivity (found INACTIVE 2026-07-08, restored via MCP). Check project status if DB suddenly unreachable.
- **Social fully gated** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â `VITE_SHOW_SOCIAL_FEATURES=false` hides dashboard sections, header Feed nav, Write-a-Post, and the freelancer-onboarding feed redirect. Page title now "WorkGraph ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦".
- **Data reality check:** 3 projects, 7 timesheet weeks (draft/submitted, 0 approved), 0 invoices, **0 graph person nodes have rates set** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â set rates in the Graph tab before generating invoices.
- **`APPROVAL_TOKEN_SECRET`** set in Supabase Edge Function secrets ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦; **Supabase CLI** linked; `SUPABASE_ACCESS_TOKEN` in `~/.claude/settings.json`.

## 2026-07-16 - [DONE] CRITICAL: approval route always resolves + submit-path root cause (Claude)

- **User hit "No approval route could be resolved" — nobody could submit a
  timesheet at all.** Traced to ONE root cause, not many: route resolution
  required a person flagged `canApprove`, but (a) the create wizard sets everyone
  canApprove=false, (b) the owner isn't auto-approver of their own org, and
  (c) upstream clients (G2) have no accounts. So the chain dead-ended and every
  submission failed.
- **Fix (buildApprovalRouteSteps + getApprovalRouteForSubmitter in
  TimesheetDataContext):** owner is an authorized internal approver by
  definition; internal approval only from an authorized person (owner/designated,
  never a peer); upstream party with no account → placeholder step "waiting on
  <party>" (dev-walker / future real approver advances) instead of failing.
  Verified vs live failing project proj_1784353244371: Rodman→Nikola→G2(placeholder),
  Nikola→G2. Commit df773d1.
- **Process note for future agents:** we had been fixing one screenshot at a time
  (reactive whack-a-mole) and it kept exposing new seams because the
  submit→approve→invoice path was built by 3 agents and never wired end-to-end.
  The right mode is ONE coherent audit of a full path, not per-screen patches.
- **Follow-ups (NOT done, needed for a clean product):**
  1. Create wizard should default the OWNER to approver and expose per-org
     approver designation (the 🛡 toggle is invisible/unused).
  2. Owner/worker person-node display name is still "Me" on freshly created
     projects (023 normalized only the old deleted project) → approver shows as
     "Me". Normalize on create.
  3. Unify the 3 people-models (wizard graph nodes vs project members vs worker
     roster) — the deepest confusion source.
  4. Test-data sprawl: multiple NAS/BRS projects across accounts; a "reset my
     test data" path would help.

## 2026-07-16 - [DONE] M1 usability fix cluster (Claude)

Driven by Nikola live-testing and hitting friction. NAS project (+ Rodman test
chain) was deleted by the user; only empty BRS / BRS FLOW QA remain.

- **Dev chain-walker** (`DevApprovalChainPanel.tsx`, commit 84efeda): dev-only
  (`import.meta.env.DEV`) panel in the approvals Queue letting the project owner
  advance every pending layer via the same approveItem/rejectItem + RLS + 026
  trigger. Unblocks the full-chain test when G2/NAS have no accounts. Delete
  before pilots. Also: "Signed in as Me" → real name; approvals table
  min-width 1240→980.
- **Role legibility** (commit 4627bce): roles are permission levels, not job
  titles, and the collision mis-assigned workers as Editors (RPC rejects
  Owner/Editor for worker setup). Invite dialog now shows who each role is for
  ("Contributor — Employee/contractor who logs time"); worker-setup hint only
  for Contributor; workspace banner no longer promises Editors a worker
  identity; Team badge shows "Manager" not permanent "Needs setup".
- **Manager graph visibility** (commit 8a0ea90): an Editor invited after
  creation had no graph_node_id/scope → LOCKED_GRAPH_VIEWER, saw nothing, yet
  had canEditGraph. Now Owner/Editor get a "Full project view" even without a
  personal mapping; only managers (getAllowedViewerIds adds "__admin__" for
  Owner/Editor). Unmapped Contributors still correctly locked out.
  ⚠️ Full view shows all rates client-side; M2 wg_get_scoped_graph
  (isProjectManager) must scope this to the manager's own org when wired.

Known-not-fixed (logged for later): the create-project WIZARD's "People" step
uses graph person nodes with a free-text job-title "Role" and hidden/approver
toggles — a THIRD people-model separate from project members (Owner/Editor/…)
and worker mapping. This create-vs-invite-vs-map split disorients users;
unifying it is a real task, not done here.

## 2026-07-16 - [DONE] Codex takeover: approval↔week sync reviewed, verified, committed (Claude)

- Codex ran out of credits mid-task, leaving migration 026 APPLIED to prod but
  unreviewed/uncommitted, plus ~1,800 uncommitted lines. Claude took over.
- **Root cause Codex found (correct):** rejection updated the approval record,
  then tried to update the submitter's week from the APPROVER's browser — RLS
  correctly denied the cross-user write, the helper swallowed the failure and
  reported success. Nikola saw "rejected"; Rodman's week stayed Submitted.
  Second defect: bulkApprove approved the current layer but never spawned the
  next one (stranded Rodman's June 1/8/15 after Nikola's approval).
- **Migration 026 reviewed → APPROVED:** trigger resolves the graph-person vs
  auth-uuid identity mismatch (submitter_user_id → snapshot → members/roster
  mapping), locks the week row, keeps intermediate approvals as `submitted`,
  final layer → `approved`, rejected/changes_requested → `rejected`; hard-fails
  (23503) instead of silently desyncing; maintains data JSONB mirror
  (approvedBy/rejectedBy/notes); SECURITY DEFINER + pinned search_path +
  EXECUTE revoked (matches 024 hygiene). One-time repair spawns missing next
  layers for latest-per-subject approved records only.
- **approvals-supabase.ts diff reviewed → APPROVED** (Claude-owned file):
  all client-side wg_timesheet_weeks writes removed (trigger owns truth);
  bulkApprove spawns next layers; approver scope no longer force-includes the
  viewer's whole org (stricter queue gating).
- **Live DB verified:** trigger installed; every Rodman week consistent with
  its latest approval record — Jun 1/8/15 pending L2 @G2 (un-stranded),
  Jun 29 resubmitted pending L1 @Nikola, Jul 6 pending L2 @James.
  Codex's rollback-only state-machine tests (reject→resubmit; 3-layer
  intermediate-vs-final) passed pre-crash. Build passes.
- Remaining Codex diff (C2 UI, signatory contracts API, timesheet server
  guards, GraphOverlayModal deletion) reviewed at security-relevant depth —
  enforcement correctly lives in reviewed migrations; UI wrappers thin.
  Committed in two chunks (trust-core + C2 surface).

## 2026-07-15 - [DONE] M2 core shipped: wg_get_scoped_graph — Privity Rule as server truth (Claude)

- Migration **025** applied: roster `visibility_scope` (company_only default |
  counterparty | named_chain) + `visible_org_node_ids`; RPC
  **`wg_get_scoped_graph(project_id)`** computes the caller's visible
  nodes/edges server-side and STRIPS commercial fields (pay rates, hour limits,
  cross-org emails) before serialization. SECURITY DEFINER, search_path pinned,
  anon/PUBLIC revoked. Owners/editors get full topology but pay fields only for
  their own org; pay survives only for self + own-org admin/finance.
- **Adversarially verified against live data via JWT impersonation:** Rodman
  company_only → G2/NAS strings absent from payload, 2 external stages (spec
  scenario 8 ✅); Rodman counterparty → G2 façade, no NAS, zero rate keys in
  payload (scenario 9 ✅); Nikola owner → full topology but James's rate ABSENT
  (ownership ≠ omniscience, server-enforced ✅). Rodman set to counterparty
  (real G2 placement); default for future workers stays company_only.
- New client wrapper `src/utils/api/scoped-graph-api.ts` (typed; adoption notes
  in header). **Deliberately NOT wired into UI** — M2-WIRE swaps
  WorkGraphContext/Builder loads to fetchScopedGraph() after Codex's current
  approvals session ends; client computeScopedView() then becomes
  defense-in-depth. Build passes; no Codex-active files touched.
- Review addendum with full test evidence: TRUST_CORE_REVIEW_2026-07-15.md.

## 2026-07-15 - [DONE] Trust-core review of migrations 018-023 → APPROVED + 024 fixes (Claude)

- Full line review of the six applied trust-core migrations + live-DB checks +
  Supabase security advisors. **Verdict: APPROVED with fixes** — schema work is
  well above prototype grade. Report: `src/docs/TRUST_CORE_REVIEW_2026-07-15.md`.
- **Migration 024 written + applied** (zero behavior change — 0 rate/signatory
  rows existed): dropped resurrected legacy SECURITY DEFINER views
  v_contracts_with_orgs/v_periods_full (HIGH — bypassed all RLS via PostgREST;
  015 was supposed to drop them); fixed signatory INSERT privilege escalation
  (any user could grant own org contract access via party-node rows); scoped
  rate subject self-read to pay only (bill-rate margin leak); revoked
  anon/PUBLIC EXECUTE on all SECURITY DEFINER helpers + RPC.
- **Assigned to Codex:** F-3 (022 RPC must not rename an org the caller doesn't
  own), F-2 (issued invoices immutable — status-transition trigger, M2), F-4
  (worker can't read own employment contract — person-signatory branch, C2/M1).
- **Nikola dashboard tasks:** enable leaked-password protection + MFA options;
  delete orphan `server` edge function.
- Codex's uncommitted app/server code diff explicitly NOT covered (in active
  development during review) — separate line review before it commits.

## 2026-07-15 - [DECIDED] Monthly approval workbench spec (Claude, refining Codex)

- Nikola's 20-worker scaling complaint ("Excel would be faster than this queue")
  + Codex's monthly-matrix proposal → formalized as
  `specs/MONTHLY_APPROVAL_WORKBENCH_SPEC.md` (M3 scope, supersedes G2-2).
- Claude's additions to Codex's design: (1) the three-layers ruling — internal
  approver, upstream approver, and finance answer DIFFERENT questions, so each
  layer renders a different masked summary of the same weekly records (privity
  as UX; the honest anti-Excel argument); (2) batch semantics — "Approve N
  weekly submissions" approves per-week records for the caller's layer with a
  shared batch_id, no monthly super-record, single-week reject/reopen;
  (3) baseline v1 kept tiny (expected_weekly_hours + workdays on roster row —
  no calendar engine); (4) no "Rate masked" labels — unauthorized fields simply
  don't render (and post-M2 aren't in the payload); (5) exit test: 20-worker
  month approved in <5 min, every record auditable.
- Build order unchanged: trust-core review first; no implementation now.

## 2026-07-15 - [DECIDED] The Privity Rule — visibility + invitation authority (Claude)

- Nikola's question after the Rodman test: where is "what Rodman sees" defined,
  who may invite whom (can Nikola invite NAS? no), general rule needed for
  rates/contracts/salaries. Codex's three-mode proposal (company_only /
  counterparty / named_chain) endorsed and generalized.
- **Ruling appended to GRAPH_CONFIDENTIALITY_SPEC.md ("DECIDED 2026-07-15 — The
  Privity Rule")**: (1) orgs see one hop — self fully, direct counterparties as
  façades, beyond = anonymous numbered stages + explicit disclosure grants;
  (2) person sight = org sight ∩ org role ∩ per-assignment visibility_scope,
  default company_only; (3) invitations: an edge is created only by its
  endpoints — org admins invite own workers, counterparty invites need edge
  endpoint authority (only G2 can invite NAS), downward subcontracting gated by
  `subcontracting: allowed|with_consent|forbidden` (default with_consent);
  (4) commercial values live on edges/org-private tables (020/021), never
  shared graph JSON; (5) enforcement = M2 server-side get_scoped_graph
  projection — client filter is presentation only. Acceptance scenarios 8–12
  added (incl. DevTools leak test as M2 exit).
- ⚠️ Review debt now critical path: Codex's uncommitted trust-core diff has
  grown (migrations 018–023 applied incl. 022 onboarding RPC + 023 routing
  repair, server hardening, client changes). No new feature work until Claude's
  line review lands. Docs-only session.

## 2026-07-15 - [IDEAS] Phase A agent parking lot (Nikola, triaged by Claude)

Captured from founder discussion — NOT authorized work; unlocks per decision doc.
1. **Ops agent** ("20 timesheets + 100 expense PDFs, no human sorter"): receipt
   extraction → categorize → match to placement → anomaly flags → prepared approval
   batches. = the Chaser + P4-5 extraction + P4-9 expenses. First Phase A build.
2. **Compliance watchdog** (visa/permit expiry, right-to-work, AWR): expiry ALERTS
   are deterministic (date fields + cron — no AI needed); the AI part is reading
   uploaded permits/contracts to extract type+dates and drafting guidance. Extends
   G2-5 placement-readiness. High willingness-to-pay; second Phase A candidate.
3. **Personal/company agents on the network** (find job / find candidates /
   marketing): Phase 9 territory, 18-month deferral stands. Key asset when time
   comes: VERIFIED work history (real approved hours through real placements) —
   matching data LinkedIn/Upwork can't fake. C2 profile-claim model is the bridge.

## 2026-07-15 - [DONE] Product strategy audit → GO decision (Claude)

- Executed `CLAUDE_PRODUCT_STRATEGY_BRIEF.md` (independent audit; read all listed
  docs + verified DB reality: migrations 001–021 applied incl. Codex's 018–021
  trust-core; real second-account invite acceptance works but accepted user has no
  org membership/roster/graph identity → "Graph identity not mapped").
- **Verdict: GO — narrowed thesis, agent-ready architecture, staged agent surface.**
  Canonical: `src/docs/PRODUCT_STRATEGY_DECISION.md` (thesis, customer, job-to-be-
  done, deterministic-vs-AI split, defensibility, kill/defer/keep table, 90-day
  validation plan, explicit kill criteria, M1/M2/M3).
- Central-question ruling: human-SaaS vs agent-layer is a false dichotomy — the
  deterministic trust boundary IS the agent play (org-scoped agents require
  machine-checkable visibility; InTime/Bullhorn architecture can't host counterparty
  agents). First agent = "the Chaser" (Phase A), evidence-gated after M3, zero
  authority.
- Enforced in docs: ROADMAP v3.1 (decision banner; stale "KV-store only"
  constraint corrected to Postgres+RLS reality), TASK_BACKLOG v3.1 (M1/M2/M3
  authorization banner), CLAUDE.md priority order replaced with M1/M2/M3.
- Killed as goals: social feed surface, marketplace (18 mo), "1M users" metric,
  dead graph-versions API. Deferred: Stripe, analytics (except missing-timesheets
  board), placement reports until post-M3.
- NOT committed: Codex's ~1,000-line uncommitted trust-core diff (timesheets/
  contracts/invoices server hardening + client changes) — pending my line review
  next session per reviewer role. Docs-only commit for this audit.

## 2026-07-14 - [DONE] P4-8 consolidated monthly invoices + month-submit label (Claude)

- User: "why independent weeks in my submissions — can I submit whole month?" →
  batch submit ALREADY existed (handleSubmitMonth submits all draft weeks via the A1
  picker); relabeled "Submit month (N weeks)" so it reads as what it does. Approval
  records stay per-week by design (granular dispute cycles).
- User: "one invoice for all my employees to the agency, not one per person" →
  built P4-8: "One invoice per organization" toggle (default ON). Weeks grouped by
  seller org via approval directory; per person-week lines; buyer from billsTo edge;
  orphans fall back to per-person. Dedup moved BEFORE building and now honors
  timesheet_ids arrays (a consolidated week can't be re-invoiced). InvoiceDraft +
  toInvoicePayload carry timesheetIds[].
- User: "hotel/rent-a-car/gasoline costs, agency should approve" → designed P4-9
  billable-expenses card (wg_expenses migration 018, approval via existing chain with
  subject_type 'expense', approved billable expenses → invoice lines at cost,
  double-billing guard). Ready for next session.
- Build passes; toggle verified rendering in live Invoices tab.

## 2026-07-14 - [DONE] Pay-rate org-boundary confidentiality fix (Claude)

- **User-found hole:** logged in as Nikola (viewer "Me", org your-org), James's (G2)
  internal rate was visible AND editable. Two causes: (1) graph-visibility masked
  contract-node rates for non-signatories but had NO person-node rate rule for
  company/agency/client viewers; (2) A4 edit gate checked only canEditGraph (project
  axis), ignoring the org axis — "project ownership is not commercial omniscience".
- **Fix 1 (graph-visibility.ts):** universal rule before per-type rules — person-node
  hourlyRate/dailyRate/fixedAmount masked unless target IS the viewer or belongs to the
  viewer's own org (freelancer viewers additionally never see coworker pay). Orphan
  persons (unresolvable org) default-deny.
- **Fix 2 (NodeDetailDrawer):** `canEditRate` = onUpdateNodeData && !masked && (admin
  view || same-org via buildPersonToOrgMap, now exported). Freelancer viewers never
  edit pay. Cross-org "No rate set" hint no longer offers "Set rate".
- **Verified live as "Me":** James → "Rate hidden for your role", no Edit button.
  Directory check: Me=self visible/editable, James (G2) + John (NAS) masked/locked,
  Admin (Full View) remains the pre-C1 escape hatch for configuring all rates.
- Still client-side enforcement — server-side redaction remains DOC-1 (post-C1).

## 2026-07-14 - [DONE] EDGE DEPLOY unblocked + C1 invitation read path live (Claude)

- **Deploy mystery solved:** the CLI derives the function slug from the folder name, so
  `functions deploy server` created a NEW function `server` that no client calls — while
  stale `make-server-f8b491be` (v90) kept serving. All internal Hono routes are prefixed
  `/make-server-f8b491be/...` because the platform passes the path INCLUDING the slug.
  Fix: shim folder `supabase/functions/make-server-f8b491be/index.ts` → `import "../server/index.tsx"`.
  **Always deploy `make-server-f8b491be`, never `server`.** (Orphan `server` function can
  be deleted from the dashboard.)
- Now live: B3 role guards, approval-token signing routes, invitations API.
- **Gateway/JWT:** verify_jwt is on → signed-out invite-link visitors got 401. Client fix:
  project-invitations.ts sends `Authorization: Bearer <anon key>` when no session.
  Second gotcha: adding an `apikey` header broke CORS preflight (header not in
  allowHeaders) → "Failed to fetch". Fixed both sides: client sends only allowed headers;
  server allowHeaders now includes `apikey`, `x-client-info`.
- **C1 read path verified E2E in browser:** inserted test invitation `inv_claude_e2e_test`
  (NAS, contributor, test-worker@example.com, expires Jul 21) → /invite/inv_claude_e2e_test
  renders project/role/inviter/expiry + Accept/Decline. Accept/decline still needs a REAL
  second-account test (agents must not create accounts) — Nikola: invite a second email
  from the Team dialog, accept from that account, verify wg_project_members row and the
  email-mismatch 403.
- `wg_project_invitations` table exists with full schema (id/project/email/role/expiry/status).

## 2026-07-10 - [DONE] A4 rate UI + queue submitter-visibility (Claude)

- User confusion report (as first real user): submitted week not visible in Queue
  ("signed in as employer"), generated invoice was 0-amount, asked where rates go,
  asked about decentralized DB (answered: no — Postgres+RLS is right; audit trail
  later if multi-party trust becomes a requirement).
- **A4 built:** PersonRateSection in NodeDetailDrawer — set contract type
  (hourly/daily/fixed), rate, currency directly on the person's graph node; persists
  via new `handleUpdateNodeData` in WorkGraphBuilder → `updateProject({ graph })` →
  `wg_projects.graph` (exact source of `resolveProjectRates()`). Gated by `canEditGraph`;
  masked rates not editable; amber warning when no rate is set.
- **Queue UX:** empty state now runs a best-effort lookup of the viewer's own pending
  submissions and renders "Your N submissions are waiting on {approver} — see My
  submissions" instead of the misleading "You are caught up".
- Verified against live data: pending L2 record for week 2026-05-25 (waiting on NAS,
  submitted 2026-07-10) will trigger the new hint in the user's exact scenario.
- Noted (not fixed): `useGraphPersistence` still uses a UUID gate + old edge-function
  graph-version routes — version history is effectively dead for TEXT-id projects.
  Graph persistence itself is fine (updateProject path). Candidate cleanup card.

## 2026-07-10 - [DONE] Antigravity template-system review (Claude)

- Reviewed Antigravity's uncommitted changes (invoices-api.ts, InvoicesWorkspace.tsx,
  InvoiceDetailPrintView.tsx, InvoiceImportPanel.tsx): reusable billing templates persisted
  to wg_invoice_templates (billingDefaults inside layout JSONB — parties, OIB, IBAN, VAT %,
  currency, due-date offset, line description), template picker + save-as-template on the
  invoice detail header, apply-at-generation via selected template, month picker,
  deleteDraftInvoice (draft-only guard enforced in the DELETE query — race-safe).
- **Verdict: approved.** Build passes; billingDefaults round-trips normalize/toRow correctly;
  local template ids are FK-safe (nulled on invoice persist). One false alarm (grep encoding
  artifact in a comment), zero real defects.
- Verified live pipeline via DB: tpl_98f38092… "Project Invoice Template" exists in
  wg_invoice_templates (created through the new UI today).
- Also wired the dead "Export PDF" button to window.print() (Save-as-PDF) until P4-3.
- ⚠️ Housekeeping: the working tree now carries 3 agents' worth of uncommitted work
  (Claude + Codex + Antigravity, ~2,500 lines) + 2 untracked migrations. Checkpoint commit
  strongly recommended before the next agent session.

## 2026-07-10 - [DONE] P4-4 editable invoice draft + migration 017 (Claude)

- User feedback: generated invoice "not industry standard" (0-amount, NAS→NAS parties,
  hardcoded billing@workgraph.com, no VAT/OIB/IBAN, no way to set rates anywhere).
- **Migration 017 applied** (via MCP): wg_invoices + from_party_name/to_party_name/
  from_address/to_address/tax_rate (0-100 check). File: 017_invoice_party_details.sql.
- **invoices-api.ts**: new `updateInvoice()` (fetch-merge-recompute, immutable created_by/
  project_id, 42501/23505 mapped to human errors); buildInvoiceRequestBody computes
  tax_total from taxRate; new fields threaded through normalize/toRow/payload types.
- **InvoiceDetailPrintView**: full edit mode (number, dates, parties w/ address+OIB+IBAN,
  per-line qty/rate with live amounts, VAT %, payment ref, notes). Hardcoded placeholders
  removed. Display shows VAT (x%), payment reference, addresses when present.
- **InvoicesWorkspace**: party names prefilled from approval-dir parties; onSave wiring;
  local-only drafts can't be edited (cloud id required).
- **Live-verified E2E**: 32h week × €85 + 25% VAT = €3,400.00 persisted; user edited the
  same invoice concurrently in their own tab (renamed INV-1-1-1, set G2 Recruitment) —
  concurrent fetch-merge saves worked.
- New backlog cards: P4-5 contract-rate AI extraction (needs deploy + ANTHROPIC_API_KEY),
  P4-6 overtime lines (data model ready), A4 rate-definition UI (drawer is read-only today —
  rates currently settable ONLY via invoice edit).

## 2026-07-10 - [DONE] Approvals queue redesign (A2+A3) + approval data cleanup (Claude)

- Reviewed Codex's approval-chain diff (route-snapshot next-layer spawn + project-scoped
  getLatestPendingApproval): correct, approved. Verified E2E in DB: weeks Jul 6-10, Jun 29,
  May 25 fully approved (L1+L2) with week rows synced.
- ApprovalsWorkbench redesign per user "looks ugly" feedback: single segmented status control
  with counts (was 2 duplicate filter rows + status select), sentence-case headers, colored
  status chips, ApprovalChainMini per-row chain viz (A2), Organization column fixed to use
  submitterOrg (was person.role duplicate), removed explainer/"Captured at submission" noise.
  Verified live on port 3001; build passes.
- **Data cleanup in approval_records (28 -> 11 rows):** deleted 14 zombies referencing
  deleted projects (rendered "Unknown Project"), 1 cross-project misfire, 2 duplicate
  approved-L1s (kept newest + L2 + active pending). Synced desynced weeks 2026-04-06 and
  2026-05-18 to approved (their records were approved; sync had been skipped pre-fix).
  Now: 5 approved weeks, 1 real pending (Mar 30, waiting on G2 seat).
- Residual: SubmissionsView.tsx still lacks chain viz (follow-up in backlog); multi-user
  week-sync still client-side only — needs SECURITY DEFINER trigger (proposed migration 017)
  before real multi-user rollout, since wg_timesheet_weeks RLS blocks non-owner approvers'
  status sync.

## 2026-07-08 - [DONE] live timesheet approval chain verification (Codex)

- Verified the submitter side by switching the workspace persona to `Me`, submitting the `Jul 6-10` timesheet, and reopening it from `My submissions`.
- Verified the approver side by switching the workspace persona to `G2`, opening the approvals queue, and advancing the record through both approval layers.
- Confirmed the first approval record was created for `G2` and the second layer was then created for `NAS`; the second layer was marked `approved` after clicking the reviewer action in the dialog.
- Final submitter-side detail dialog for `bc783241-d7bf-4d30-85f2-3473d89ec447` now shows `Approved` with the timeline `Submitted by nikola.kralj86 -> Approved by G2 -> Approved by NAS`.
- Current queue state in the G2 view still shows other pending submissions, but the tested July 6-10 submission is fully approved end-to-end.

## 2026-07-08 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â [DONE] timesheet approval scope fix + build verification (Codex)

- Verified the existing bundle-splitting / lazy-load work in `vite.config.ts` and `src/components/ProjectWorkspace.tsx` on the real `HybridSocialApp-run` checkout.
- `npm run build` passes in `HybridSocialApp-run` with all chunks under the 400 kB target: `vendor-charts` 312.10 kB, `vendor` 295.72 kB, `vendor-ui` 278.20 kB, `index` 255.07 kB, `vendor-react` 228.48 kB, `workgraph` 227.74 kB, `approvals` 86.81 kB, `timesheets` 61.22 kB, `invoices` 54.33 kB.
- Fixed timesheet approval lookups to include `project_id` in `getLatestPendingApproval()` and updated the call sites in `src/contexts/TimesheetDataContext.tsx` and `src/components/timesheets/ProjectTimesheetsView.tsx` so same-user / same-week approvals do not collide across projects.
- Residual risk: Vite still prints circular chunk warnings for the vendor chunk graph, and the real browser approval chain was not exercised against live project data in this session.
## 2026-07-08 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] P4-1 money loop + 016 applied + live E2E test (Claude, OpusÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Fable session)

- **Migration 016 applied via Supabase MCP** (project was INACTIVE/auto-paused; restored first). Policy `wg_members_scope_contributor` + SECURITY DEFINER fn `wg_user_can_read_project_member` verified live. Timesheet submit unblocked.
- **invoices-api.ts rewritten** (was double-broken: `isUuid()` cloud gate excluded all real `proj_*` TEXT ids ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ everything went localStorage-only; cloud path called undeployed edge routes). Now: shared Supabase client ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ `wg_invoices`/`wg_invoice_templates` directly; localStorage only as network-failure fallback; added `resolveProjectRates()` reading person-node rates from `wg_projects.graph`; constraint-safe inserts (due-date clamp, FK/unique retries); `.update().eq()` row-count check.
- **InvoicesWorkspace.tsx**: hardcoded `defaultRate = 95` removed ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â per-person graph rates (hourly by hours, daily by worked days), missing/masked rate ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 0 + warning toast; currency personÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢templateÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢EUR; sync badges from real per-invoice `syncState`.
- **Live browser verification** (Vite on port 3001 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â port 3000 is another project): dashboard renders WorkGraph-first with zero social sections; `GET /rest/v1/wg_invoices?project_id=eq.proj_1780ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 200 through RLS; Generate button empty-state guard works; header New menu has no Write-a-Post.
- **Also gated/fixed**: AppHeader Feed nav item + Write-a-Post menu item behind `VITE_SHOW_SOCIAL_FEATURES`; FreelancerOnboarding completion now lands on `/app` (was `/app/feed`); `index.html` title ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ "WorkGraph ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Timesheets, Approvals & Invoicing for Agency Supply Chains"; `.claude/launch.json` port corrected.
- **Residual risks**: (1) old edge build still live ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â B3 guards inert until redeploy; (2) full invoice E2E (approved week + real rate ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ non-zero draft) untested because DB has 0 approved weeks and 0 rates ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â needs a rate set on a person node + one approval cycle; (3) template cloud-save path (owner-scoped upsert) unexercised by UI (ImportPanel still uses its own local template store).

## 2026-05-30 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] Strategic refocus: kill "Hybrid Social", ship WorkGraph (Claude)

- **Analysis**: 13 social components in `src/components/social/` have zero data access (no supabase, no fetch, no useQuery). They are pure facade. The WorkGraph engine (45+ components, 22 edge functions, 16 migrations) is 95% of real engineering.
- **Decision**: Social dashboard sections (NetworkFeed, ProfileCard, Connections, Jobs, Messages) already gated behind `VITE_SHOW_SOCIAL_FEATURES=true` (off by default). No code deleted ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â reversible.
- **Backlog reordered**: TASK_BACKLOG.md v3.0 promotes Phase 4 invoice (money loop) to Tier 2a, ahead of A2/A3 cosmetic polish. Added `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â´ CRITICAL` section: M5 (migration 016), edge function deploy, M6 (migration 010 for invoices).
- **Feed route**: `/app/feed` still exists (FeedHome) but is not in the sidebar nav and no links point to it with social features off. Can be removed in a future cleanup pass.
- **Social components**: 13 files in `src/components/social/` totaling ~37 kB. Not deleted ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â parked for Phase 9 per ROADMAP.
- **Residual risk**: None. All changes are additive/reorderable.

## 2026-05-30 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] Supabase secrets + CLI setup (Nikola + Claude)

- `APPROVAL_TOKEN_SECRET` added to Supabase Dashboard ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Settings ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Edge Functions ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Secrets. Resolves Blocker #3.
- `SUPABASE_ACCESS_TOKEN` (personal access token) saved to `~/.claude/settings.json` env. Resolves Blocker #2 (token present; deploy still pending).
- Supabase CLI v2.102.0 installed globally via `npm install -g supabase`, logged in, linked to project.
- `supabase migration list` run: all local migrations (001ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ015) in Local column, Remote empty (expected ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â all applied via SQL Editor, not CLI).
- Migration 015 discovered and verified safe. Added as M4 `[READY]` in TASK_BACKLOG.
- Supabase Advisor warnings noted: Auth RLS Initialization Plan (8 tables), Duplicate Index on `kv_store_f8b491be`, Function Search Path Mutable on `approval_records_set_updated_at` + `wg_set_updated_at`. Non-blocking; future cleanup pass.

---

## 2026-05-30 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] Migration 013 verified applied (Claude)

- Attempted to run `013_graph_node_id_and_invite_link.sql` in SQL Editor ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â syntax error indicated re-run of already-applied migration.
- Queried live DB via Supabase MCP. Confirmed all columns present: `graph_node_id`, `can_approve`, `can_view_rates`, `can_edit_timesheets`, `visible_to_chain`, `scope`, `accepted_at`, `invitation_id`.
- Confirmed FK `wg_project_members_invitation_id_fkey` exists.
- Confirmed RLS policy `wg_members_scope_contributor` present with correct definition.
- Migration 013 was fully applied in an earlier untracked session. M2 marked `[DONE]`, B3 unblocked ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ status changed to `[READY]`.

---

## 2026-05-30 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] A1 submit-timesheet-project-picker (Codex)

- `src/components/timesheets/ProjectTimesheetsView.tsx`: added `listProjects` import, `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter` imports, `Search` + `Briefcase` lucide icons.
- Added `PickerProject` interface (inline, no new file).
- `PersonSection` gains two new props: `projectId: string` and `accessToken: string | null | undefined`.
- New state in `PersonSection`: `pickerOpen`, `pickerProjects`, `pickerLoading`, `pickerSearch`.
- `handleSubmitMonth` now calls `listProjects` on click; if < 2 projects it submits directly (existing behaviour preserved); if 2+ it opens the picker Dialog.
- `doSubmitWithProject(chosenProjectId)` sets `sessionStorage.currentProjectId` to the chosen project before calling `store.setWeekStatus` in a loop, then restores the previous value ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â this routes the approval record to the correct project.
- Search input shown only when project list has 5+ entries.
- Cancel button closes modal without submitting.
- All three `PersonSection` call sites in `ProjectTimesheetsView` updated to pass `projectId` and `accessToken`.
- `npm run build` passes (4.48 s, no TS errors).
- Residual risk: `listProjects` is an async network call on every Submit click (even when there is only 1 project). The call is guarded by a try/catch that falls back to direct submit, so network failures are non-fatal. A future optimisation could cache the result.

---

## 2026-05-30 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] M4 015_purge_dead_legacy_tables applied (Codex)

- Dropped legacy tables (all existed and were dropped): `allocated_tasks`, `review_flags`, `attachments`, `timesheet_entries`, `timesheet_periods`, `project_contracts`, `organizations`, `workgraph_edges`, `workgraph_nodes`, `graph_versions`, `project_members`, `projects`.
- Dropped legacy views (all existed and were dropped): `approval_history`, `approval_queue`, `v_contracts_with_orgs`, `v_periods_full`.
- Verified: 0 legacy table rows remain in `information_schema.tables` for the above names. 0 legacy views remain in `information_schema.views`.
- All DROP statements used `IF EXISTS CASCADE` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â safe, idempotent, no live code references affected.

---

## Current Blockers

| # | Blocker | Owner | Status |
|---|---|---|---|
| ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â | ~~All prior blockers resolved~~ | ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â | ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â |

**No active blockers.** All migrations applied. Secrets configured. CLI linked. B3 ready to implement.

---

## 2026-05-30 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [READY] M5 016_fix_wg_project_members_scope_recursion (Codex)

- User hit submit-timesheet failure: `Failed to load wg_project_members: infinite recursion detected in policy for relation "wg_project_members"`.
- Root cause: migration 013 recreated `wg_members_scope_contributor` as a `SELECT` policy on `wg_project_members` that queries `wg_project_members` inside its own policy body.
- Added `supabase/migrations/016_fix_wg_project_members_scope_recursion.sql`.
- New helper: `public.wg_user_can_read_project_member(project_id, member_id, scope)` as `SECURITY DEFINER`, mirroring the 011 anti-recursion pattern.
- Migration drops and recreates `wg_members_scope_contributor` so it calls the helper instead of self-querying inside the policy.
- Status: SQL migration created locally. Nikola must apply it manually in Supabase SQL Editor, then retry Submit week.

---

## 2026-05-30 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] Approval queue actionability guard (Codex)

- User reported James, a viewer, could see Nikola's submitted timesheet as bulk-actionable in the approval queue.
- Root cause in UI: `ApprovalsWorkbench` treated every pending, non-blocked approval as selectable/actionable.
- Updated `src/components/approvals/ApprovalsWorkbench.tsx` so actionability requires the viewer to be the assigned approver node or an approver-enabled member of the assigned approval party.
- Approval/reject buttons and bulk-select checkbox are now disabled for viewers/non-approvers, even when they can read the queue.
- Residual risk: client-side guard is only UX protection. Server-side enforcement still relies on `approval_records_update` RLS from migration 014 (`approver_user_id = auth.uid()` or project owner). B3 should move all approval mutations behind edge/RPC role checks.

---

## 2026-06-02 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] Approval DAG route snapshot for multi-step spawning (Codex)

- User reproduced core chain failure: Nikola submitted a timesheet, James/G2 approved it, but John/client never received the next approval.
- Root cause: submit flow used `getApprovalStepsForParty()`, a one-step fallback helper, as if it represented the full approval DAG. Approval records were created as `Step 1 of 1`, so `createNextApprovalLayerIfNeeded()` had no reliable route to spawn the next layer.
- `src/contexts/TimesheetDataContext.tsx`: added full upstream route construction from the submitter party through `billsTo` parties, collecting each party with an eligible non-submitter approver.
- Submission snapshots now include `approvalRoute` with ordered approver steps.
- `src/utils/api/approvals-supabase.ts`: `createNextApprovalLayerIfNeeded()` now prefers the stored `subject_snapshot.approvalRoute` instead of reconstructing from stale graph/session state.
- `src/components/approvals/ApprovalsWorkbench.tsx`: displayed total steps now uses the route snapshot length, so new submissions should show `Step 1 of N` correctly.
- `npm run build` passes.
- Residual risk: existing approval records created before this fix do not contain `approvalRoute`; they must be resubmitted/reset or manually repaired before they can spawn downstream approvals.

---

## 2026-04-24 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] D3 kill-local-only-project-mode (Claude)

- Deleted `isLocalOnlyProjectId`, `isLocalProjectId`, `LOCAL_APPROVALS_KEY`, `readLocalApprovals`, `writeLocalApprovals`, `createLocalApprovalId`, `filterLocalApprovals` from `approvals-supabase.ts`.
- Removed all local-storage branches from `createApproval`, `getApprovalQueue`, `getLatestPendingApproval`, `approveItem`, `rejectItem`, `bulkApprove`, `getPendingCount`.
- Removed `proj_local_` guards from `timesheets-api.ts` (project_id now always written).
- Removed `isLocalProjectId` and all call sites from `TimesheetDataContext.tsx` (`loadApprovalParties`, `loadFromApi`, `persistWeek`, `persistStatus`, `isRemoteWorkflow`).
- Zero references to `proj_local_` or local-storage approval paths remain in `src/`.
- `npm run build` passes.

## 2026-04-24 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] S2/D1/D2 security + dead-code pass (Codex)

- Workspace: C-drive only (`C:\Users\nikol\Projects\HybridSocialApp-run`). Node.js v24.15.0 / npm 11.12.1 installed.
- S2: `approval-tokens.ts` reduced to type definitions only. New `approval-tokens-api.tsx` does server-side HMAC-SHA256 sign/verify via `Deno.env.get("APPROVAL_TOKEN_SECRET")`. `crypto.randomUUID()` used throughout. Wired into `index.tsx`.
- D1: deleted 8 dead timesheet calendar views + `approval/` (10 files) + `approval-v2/` (5 files). `ProjectTimesheetsView.tsx` preserved.
- D2: deleted `timesheets-approval.ts` + `timesheets-approval-hooks.ts` (zero live imports confirmed).
- `npm run build` passes after each deletion pass.

## 2026-04-24 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] security-audit + doc overhaul (Claude)

- Full codebase security review. Findings:
  - `approval_records` RLS: `USING (true)` on SELECT/INSERT/UPDATE = any authenticated user reads/modifies all tenants' approval data.
  - `approval-tokens.ts`: hardcoded HMAC secret + `Math.random()` UUIDs in client bundle = forgeable email approval tokens.
  - Self-approval guard: client-side read-then-update, not atomic. DB trigger exists in 012 but not yet applied.
  - Edge functions not deployed = no server-side role enforcement anywhere.
  - ~40k LOC of dead code (parallel timesheet views, approval-v2/, unused approval APIs).
- Written: `supabase/migrations/014_approval_records_rls_fix.sql`.
- Doc cleanup: deleted AGENT_REGISTRY, DOCS_GOVERNANCE, CODEX_SUBAGENT_PLAYBOOK, ARCHITECTURE (stale), APPROVAL_SUBMISSIONS_SPEC duplicate, SQL_SCHEMA_MIGRATION spec, entire archive/. Rewrote TASK_BACKLOG with security-first priority order. Updated CLAUDE.md.

---

## 2026-04-22 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] project-workspace-role-gating (Codex)

- `ProjectWorkspace.tsx`, `WorkGraphBuilder.tsx`: edit/save/invite controls hidden for non-owner/editor roles. `canEditGraph` prop added to WorkGraphBuilder.
- Residual risk: UI-level only ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â server-side enforcement still needs B3.

## 2026-04-22 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] atomic-project-create-path (Codex)

- `ProjectCreateWizard.tsx`, `projects-api.ts`, `supabase/functions/server/projects-api.tsx`: graph sent with initial create payload, no separate updateProject needed. Rollback on downstream insert failure.

## 2026-04-22 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] project-delete-owner-guard (Codex)

- `projects-api.ts`, `ProjectsListView.tsx`: direct Supabase delete path for cloud projects, ownership verified before delete, Delete button hidden for non-owners.

## 2026-04-21 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] approval-submissions-redesign (Codex)

- `ApprovalsWorkbench.tsx`, `SubmissionsView.tsx`, `ApprovalTimeline.tsx`, `ProjectApprovalsTab.tsx`: 6-col grid, drawer-based audit trail, semantic status chips, URL-hash deep linking.

## 2026-04-21 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] task6a-6e approval chain bugs (Codex)

- `approvals-supabase.ts`: party hydration, next-layer spawning, person-level approver routing, async scope resolver, self-approval guard.
- `ApprovalsWorkbench.tsx`: real submitter name from nameDirectory, my-submissions scope via viewerNodeId.
- `ProjectTimesheetsView.tsx`: approve actions fail closed unless viewer matches current pending approver.

## 2026-04-21 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] project-cloud-refresh-persistence (Codex)

- `projects-api.ts`, `ProjectsListView.tsx`, `ProjectCreateWizard.tsx`: `proj_*` TEXT IDs treated as cloud-backed, direct supabaseListProjects() path, cloud rows survive refresh.

## 2026-04-20 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] bundle-splitting (Claude + Codex)

- `vite.config.ts`: 9 chunks, largest 312 kB. Before: single 1741 kB chunk.

## 2026-04-20 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] task2-invoice-edge-functions + task3-invoice-persistence (Codex)

- Edge function routers for invoices, templates, extraction wired in index.tsx.
- `invoices-api.ts`, `InvoicesWorkspace.tsx`: API-backed persistence, cloud/local labels.

## 2026-04-20 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] task4-graph-context-fix (Codex)

- `WorkGraphContext.tsx`: name/approval directories hydrated from sessionStorage or DB on demand. Timesheets and Approvals no longer require Graph tab visit.

## 2026-04-20 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] task5-invite-email (Codex)

- `invitations-api.tsx`, `ProjectInviteMemberDialog.tsx`: invite router with create/lookup/accept routes, email send or log.

## 2026-05-30 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] B3 server-side-role-enforcement (Codex)

- **Files modified**: `supabase/functions/server/projects-api.tsx`, `src/components/ui/dialog.tsx`
- **Changes**:
  - `DELETE /projects/:id`: replaced direct `owner_id === user.id` check with `getCallerRole()` helper and returns `{"error":"Forbidden"}` (standardised) instead of custom message. Callers with no `wg_project_members` row are now also covered since `getCallerRole` returns null for non-owners not in the table.
  - `PUT /projects/:id`: guard was already correct (`role !== "Owner" && role !== "Editor"` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 403). No functional change needed; confirmed in code review.
  - `dialog.tsx`: fixed a pre-existing extra `(` on line 36 (`>((({` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ `>(({`) that was causing the Vite build to fail. Not related to B3.
- **How the guard works**: `getCallerRole` queries `wg_project_members` with the service-role client (bypasses RLS). Returns `"Owner"` for the project's `owner_id`, otherwise returns the member's role or `null` if no accepted membership row exists. No row ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ `null` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 403.
- **Residual risks**: Edge functions are not yet deployed to Supabase (blocked on deploy step). These guards only take effect once `supabase functions deploy server` is run.

## 2026-05-30 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [DONE] dashboard-launchpad-onboarding (Codex)

- **Files modified**: [DashboardPage.tsx](file:///c:/Users/nikol/Projects/HybridSocialApp-run/src/components/dashboard/DashboardPage.tsx)
- **Logic added**:
  - Integrated the "WorkGraph Launch Pad" onboarding checklist banner into the main [DashboardPage](file:///c:/Users/nikol/Projects/HybridSocialApp-run/src/components/dashboard/DashboardPage.tsx) layout.
  - Dynamically switches checklist steps depending on user role/persona (`agency`, `company`, or `freelancer`) matching our Bullhorn-inspired onboarding proposal.
  - Progress checks are reactive to database stats (e.g. automatically checks off items when projects/contracts/earnings exist).
  - Saved completion states and dismiss settings in `localStorage` per `userId` to ensure seamless persistence.
  - Fixed a React Rules of Hooks violation by moving all `useState` declarations above the loading/error early return statements.
- **Residual Risk**: None.

## 2026-07-10 - [DONE] reusable invoice billing templates foundation (Codex)

- Added owner-scoped reusable billing templates on top of existing `wg_invoice_templates`; no new migration required.
- Templates store `layout.billingDefaults`: seller/buyer legal names, addresses, tax IDs/OIB, IBAN, VAT %, payment reference, notes, currency, due-date offset, and first-line wording.
- Draft invoice detail can save the current draft as a reusable template and apply saved templates to drafts; issued/finalized invoices remain stable.
- Main invoice toolbar can select a saved billing template before generating new drafts from approved timesheets, so repeat clients do not need manual party/VAT/payment edits every month.
- Totals still recompute server-side through `updateInvoice()` / `buildInvoiceRequestBody()` from line items plus VAT, so template application cannot leave stale totals.
- Build passes: largest JS chunk `vendor-charts` 312.10 kB; `invoices` chunk 73.54 kB.
- Browser smoke test: `/app/project-workspace` -> Invoices tab rendered the saved-template selector with no console errors.
- Strategy note: Stripe-style foundation is canonical invoice data plus controlled rendering/tax/localization; EN16931/Peppol e-invoice delivery should be a later export/transmission layer, not hardcoded into draft editing.

## 2026-07-10 - [DONE] invoice import/template unification + AI Adapt retry fix (Codex)

- User reported invoice template import/save/apply and AI Adapt felt non-working.
- Root cause: InvoiceImportPanel saved project templates through undeployed `/api/invoice-templates` or its own `invoice-template:{projectId}` localStorage key, while the main invoice workspace read reusable templates from `wg_invoice_templates` / `workgraph-invoice-templates-{projectId}`. This created two disconnected template systems.
- Fixed InvoicesWorkspace to convert imported `ProjectInvoiceTemplate` into the shared `InvoiceTemplate` shape, save it through `saveTemplate()`, refresh the main template selector, and expose imported local templates in the same dropdown as cloud templates.
- Fixed InvoiceImportPanel `Save Template` to delegate persistence to the parent shared template flow when available, with local fallback only as backup.
- Fixed AI Adapt retry to keep the original uploaded `File` on the imported invoice and reuse it; it no longer reconstructs an empty file from the filename.
- `npm run build` passes. Largest JS chunk remains `vendor-charts` 312.10 kB; `invoices` chunk 75.05 kB.
- Browser verification not completed because the in-app browser connection hit the local Windows `CryptUnprotectData` sandbox failure; build/type verification is clean.

## 2026-07-10 - [DONE] invoice draft delete + selected-month generation (Codex)

- Added sellable invoice operations only: draft cleanup and billing-period navigation. No speculative AI/country-compliance generation was added.
- `deleteDraftInvoice()` added to `invoices-api.ts`: deletes only draft invoices, refuses issued/paid/non-draft records, removes local cache entries, and falls back to local draft deletion on network failure.
- `InvoicesWorkspace.tsx` now exposes previous/next/month input controls. Existing invoice list, approved-week count, totals, and `Generate for {month}` are tied to the selected month, enabling invoice generation for prior months after late approvals.
- Draft delete is available from invoice detail and invoice rows, guarded by confirmation and hidden for non-drafts.
- `npm run build` passes. Largest JS chunk remains `vendor-charts` 312.10 kB; `invoices` chunk is 78.69 kB.
- Product stance: these are table-stakes billing workflow features that help demos/sales; AI country invoice generation remains future scope behind deterministic compliance/export rules.

## 2026-07-10 - [DONE] C1 invitation acceptance UI (Codex)

- Added `src/components/invitations/InviteAcceptPage.tsx` for real invite-token acceptance: shows project, role, inviter, expiry, and status.
- Added `src/utils/api/project-invitations.ts` token client for `GET /invitations/:token`, `POST /invitations/:token/accept`, and `POST /invitations/:token/decline`.
- Wired routes: `/invite/:token` plus legacy `/accept-invite?token=...` fallback.
- Auth handoff: unauthenticated users see a sign-in/create-account prompt; after sign-in, pending accept/decline continues with the same invite URL.
- On accept, the page syncs `currentProjectId/currentProjectName` session state and redirects to `/app/project-workspace`.
- Added missing source route `POST /invitations/:token/decline` in `supabase/functions/server/invitations-api.tsx`; updated generated email links to `/invite/{token}`.
- `npm run build` passes. Largest JS chunk remains `vendor-charts` 312.10 kB.
- Deployment caveat: the worklog still says the live edge function is old; C1 needs a fresh `supabase functions deploy server` before token lookup/accept/decline works in production.

## 2026-07-10 - [DONE] C1 invite role/rate-permission lockdown (Codex)

- Clarified product rule in code: project collaboration role controls who can invite; graph person labels like Employee/Agency and project party flags control approval/rate/timesheet visibility.
- Invite hierarchy enforced in shared frontend permissions: Owner can invite Editor/Contributor/Commenter/Viewer; Editor can invite Contributor/Commenter/Viewer; Contributor/Commenter/Viewer cannot invite. Normal invites cannot create another Owner.
- `ProjectInviteMemberDialog` now receives the current user's project role, filters the role dropdown, explains Editor limits, disables the form when the user cannot invite, and blocks stale/invalid role submission.
- Project workspace Team invite and Projects list card menu now hide invite actions when the current role cannot invite.
- Server source routes now enforce the same invite hierarchy in both `/invitations` and legacy `/api/projects/:projectId/members`; browser-only role filtering is no longer trusted.
- New invite-created members default to `can_approve=false`, `can_view_rates=false`, `can_edit_timesheets=false`, `visible_to_chain=true`; explicit project configuration can grant rate/timesheet/approver powers later.
- `npm run build` passes. Largest JS chunk: `vendor-charts` 312.10 kB; all chunks remain under 400 kB. Vite still emits existing manual-chunk circular warnings.
- Deployment caveat: server permission changes require a fresh `supabase functions deploy server` before they protect the live Edge Function.

## 2026-07-10 - [DONE] Full-view graph/rate visibility containment (Codex)

- User caught a sellability blocker: project Owner must not automatically see every downstream contract/rate. Example: an agency Owner should not see the private contract between its contractor and a sub-contractor one level behind.
- Existing ReBAC graph visibility already hides contracts that do not involve the viewer's org and masks non-signatory contract rates, but the prototype exposed `Admin (Full View)` as a normal selectable identity.
- Added `ALLOW_GRAPH_ADMIN_VIEW` debug flag (`VITE_ENABLE_GRAPH_ADMIN_VIEW=true`) and disabled full graph view by default.
- Removed production `Admin (Full View)` options from WorkGraph and Timesheets viewer pickers; stale stored `__admin__` session viewer IDs are now ignored/cleared.
- `computeScopedView()` no longer honors admin full-view unless the debug flag is explicitly enabled; fallback viewer is now a non-admin placeholder.
- `npm run build` passes. Largest JS chunk: `vendor-charts` 312.10 kB; all chunks remain under 400 kB. Vite still emits existing manual-chunk circular warnings.
- Residual risk: this is UI/session containment. A production-grade confidentiality boundary still requires moving private contracts/rates out of shared `wg_projects.graph` JSON into signatory-scoped tables/RPCs with RLS, so each party can only read contract rows they are party to.

## 2026-07-10 - [SPEC] Graph confidentiality model (Codex)

- User refined the sellable model: agency/company project managers should see nearest-node operational data, not the full DAG; employees should see their own earning/pay rate, not the company's bill rate or margin on them.
- Wrote `src/docs/specs/GRAPH_CONFIDENTIALITY_SPEC.md` to separate three axes: project collaboration role, organization role, and graph/contract relationship.
- Key rule: `ProjectRole.Owner` can administer the project shell but does not automatically see all rates/contracts. `org_admin`/`org_finance` controls internal company data. Contract signatory relationship controls private contract/rate visibility.
- Added critical backlog item `GSEC` for the deeper implementation: move private rates/contracts out of shared graph JSON into signatory-scoped tables/RPCs with RLS.
- Immediate containment from prior entry remains valid, but not sufficient for production confidentiality until GSEC is implemented.

## 2026-07-10 - [DONE] G1 viewer identity containment (Codex)

- Restricted production WorkGraph viewer choices to the signed-in user's mapped project identity instead of all graph people/orgs.
- `ProjectMember` type now carries existing backend fields: `graphNodeId`, `canApprove`, `canViewRates`, `canEditTimesheets`, `visibleToChain`.
- Workspace viewer picker now filters name-directory identities by current membership:
  own `graphNodeId` and auth user id are allowed; scoped org view is allowed only for `Owner`/`Editor` as a temporary containment until real org roles exist.
- If no mapped identity exists, Workspace passes a locked `No mapped graph identity` viewer so WorkGraph cannot silently fall back to the first party in the graph.
- WorkGraphBuilder no longer overrides a controlled workspace viewer with its own internal first-party fallback.
- Timesheets viewer dropdown is restricted to the workspace-approved viewer unless `VITE_ENABLE_GRAPH_ADMIN_VIEW=true`.
- `npm run build` passes. Largest JS chunk: `vendor-charts` 312.10 kB; all chunks remain under 400 kB. Existing Vite circular manual-chunk warnings remain.
- Residual risk: G1 is still UI/session containment. G2/G3 must move private contracts/rates to signatory-scoped tables/RPCs with RLS before claiming production-grade confidentiality.

## 2026-07-14 - [SPEC] G2/InTime contractor portal benchmark (Codex)

- User asked Codex to continue Fable's stopped G2 portal research from `https://timesheets.g2recruitment.com/placement/list`.
- Chrome automation could only reach the public RSM InTime login page; authenticated placement list is not visible without the user's logged-in browser session.
- Used public RSM/InTime contractor/manager guides to benchmark the product model: placement profiles, status-bucketed timesheets, expenses as peer approval workflow, Pay/invoices/remittance advice, compliance/AWR/information requests, manager authorise queues, and email/bulk approval patterns.
- Added `src/docs/specs/G2_INTIME_BENCHMARK.md`.
- Added backlog cards: P4-10 `placement-profile-panel`, P4-11 `missing-timesheets-dashboard`, P4-12 `pay-remittance-status`.
- Recommendation: build P4-9 expenses next, then placement profile/missing-timesheet dashboard. These are sellable staffing-portal primitives and fit WorkGraph's graph/trust model.

## 2026-07-14 - [SPEC] Authenticated G2 placement-list findings (Codex)

- User opened the authenticated G2/InTime Placement Search page in Chrome; Codex inspected the page via DevTools snapshot.
- Captured workflow/field structure only, not private row values: placement ref, start/end, job title, worker, provider, Ltd company, payroll cadence, consultant, client, client ref, manager, created/modified, default rate label, default rate pay, default rate type, purchase order number, and expenses PO.
- Product conclusion: WorkGraph needs a placement profile/reporting layer over graph assignments. The graph canvas is not enough for real agencies; they need searchable placement records, PO fields, payroll cadence, consultant/manager routing, and exports.
- Updated `src/docs/specs/G2_INTIME_BENCHMARK.md` with authenticated placement-search findings.
- Expanded P4-10 `placement-profile-panel` and added P4-13 `placement-reporting-export` in `src/docs/TASK_BACKLOG.md`.
- Sellability note: G2/InTime confirms our next build order should stay practical: expenses approval/invoicing, then placement profile/reporting, then missing-timesheet dashboard and pay/remittance status.

## 2026-07-14 - [STRATEGY] Bullhorn lessons and next-step reset (Codex)

- User asked whether WorkGraph is nowhere near Bullhorn and what to learn from Bullhorn before building more.
- Product conclusion: do not compete feature-for-feature with Bullhorn ATS/CRM/automation/pay-bill breadth. WorkGraph's wedge should be graph-aware pay-and-bill for multi-party staffing chains with strict private rate/contract boundaries.
- Added `src/docs/specs/BULLHORN_LESSONS_STRATEGY.md`.
- Added critical backlog epic C2 `company-membership-private-worker-contracts`: company admin invites workers, worker contract/timesheet stays company-private, internal approval happens before upstream agency/client approval, and agency/client approvers cannot see worker-company pay terms or private contracts.
- Decision: broad worker invites should not be treated as done after C1. C1 is token acceptance; C2 is the sellable trust model.

## 2026-07-14 - [SPEC] C2 company directory vs project roster visibility (Codex)

- User raised the real staffing visibility question: when an agency invites a company, should the company decide which employees are visible to the project? Example: a company accountant may need internal access but should not matter to the agency/client.
- Product decision: split company people into a private organization directory and a project-specific roster. Company admins choose who becomes visible on each project.
- Rule: hidden internal people are valid; hidden client-facing workers are not valid for normal staffing workflows. Anyone submitting billable/approvable client-facing time must be visible enough for the direct approver/counterparty to approve the work, while pay rate, private worker-company contract, and margin remain hidden.
- Added `src/docs/specs/C2_COMPANY_MEMBERSHIP_SPEC.md`.
- Updated `src/docs/TASK_BACKLOG.md` C2 to point at the new spec.
- Rewrote `src/docs/README.md` as a current docs index because the docs folder is drifting: `AGENT_WORKLOG.md` and `TASK_BACKLOG.md` are large, newer strategy lives in specs, and some older session/root docs contain stale task guidance.
- No build run; docs/spec-only change.

## 2026-07-14 - [SPEC] C2 social profile claims vs verified company membership (Codex)

- User clarified the future WorkGraph social/SaaS idea: a person may create a profile and declare they work for Company XYZ, while the company owner/admin later controls whether that person can join projects.
- Confirmed this idea exists only partially in the docs: ROADMAP Phase 9 has public freelancer/company profiles, but C2 needed the verification bridge.
- Updated `src/docs/specs/C2_COMPANY_MEMBERSHIP_SPEC.md` with Personal Profile, Company Profile, and membership states: `claimed`, `invited`, `verified`, `rejected`, `removed`.
- Product/security rule: a self-claimed company affiliation grants zero access. Only company-admin verification creates organization membership; only project roster assignment creates project visibility/work eligibility.
- Updated C2 backlog scope/acceptance criteria in `src/docs/TASK_BACKLOG.md`.

## 2026-07-14 - [IN PROGRESS] Trust Core C2 schema + timesheet self-approval hardening (Codex)

- Implemented additive C2 foundation migration `018_c2_organization_membership_and_roster.sql`: company profiles, verified organization membership, project organization mapping, project roster visibility, document/contract signatory scaffolding, and private contract-rate tables.
- Added `src/types/organizations.ts` with typed membership states, organization roles, project roster visibility, and helper predicates.
- Hardened auth cleanup in `AuthContext`: sign-out now clears `workgraph-*`, `wg-*`, and current-project browser cache keys so stale project identity cannot leak across sessions.
- Hardened the timesheet client: TEXT project IDs are no longer dropped, list requests include `project_id`, own-user draft/submission stays direct, cross-user save/submit/reopen is blocked, cross-user approve/reject is forced through the Edge route, and self approve/reject is rejected.
- Hardened `supabase/functions/server/timesheets-api.tsx`: `PATCH /timesheets/:week/status` validates status, blocks self approve/reject, blocks cross-user submit/reopen, and only allows cross-user approve/reject when the reviewer is project owner, accepted Owner/Editor, or has `can_approve=true`.
- Added migration `019_timesheet_self_approval_guard.sql`: DB trigger blocks user-session attempts to approve/reject their own `wg_timesheet_weeks` rows or spoof approval metadata through direct Supabase writes.
- Verification: `git diff --check` passes; `npm run build` passes. Chunk sizes: `vendor-charts` 312.10 kB, `vendor` 295.72 kB, `vendor-ui` 278.58 kB, `index` 266.46 kB, `workgraph` 232.64 kB, `vendor-react` 228.48 kB, `approvals` 87.53 kB, `invoices` 81.07 kB, `timesheets` 61.39 kB. Vite still reports the known manual-chunk circular warnings.
- Not applied/deployed yet: migrations 018/019 must be run in Supabase; the `make-server-f8b491be` Edge function must be redeployed before the server route guard protects production traffic.
- Residual critical risk: private rates/contracts still exist in shared `wg_projects.graph` JSON and invoice RLS is still broader than the final signatory-scoped model. Next Trust Core step should move invoice/rate reads behind server/RLS boundaries before building more invoice/social features.

## 2026-07-14 - [IN PROGRESS] Private bill-rate bridge + employee invoice-generation gate (Codex)

- User corrected the business rule: normal employees/workers do not generate invoices; they submit time and receive salary/pay through their employer. Invoice generation belongs to seller-side finance/admin or a direct freelancer billing the client.
- Added migration `020_private_project_rates_and_invoice_acl.sql`: makes `wg_contract_rates` usable for project-scoped graph-person bill rates via `project_id` + `subject_graph_node_id`, tightens rate writes to project managers or org finance/admin, and moves invoice visibility toward creator/signatory-party access rather than broad project-member access.
- Changed `resolveProjectRates()` to read private `wg_contract_rates` rows first. Legacy graph-rate fallback is disabled by default and only runs when `VITE_ALLOW_GRAPH_RATE_FALLBACK=true`.
- Added `saveProjectPersonRate()` so the graph drawer saves bill rates into `wg_contract_rates` instead of using `wg_projects.graph` as the money source.
- Updated the person rate drawer: loads private project rates, saves private rates, and clears numeric `hourlyRate`/`dailyRate`/`fixedAmount` fields from graph JSON after a successful private save. Graph JSON now keeps display metadata only.
- Gated invoice generation in `InvoicesWorkspace`: only temporary project Owner/Editor roles can generate invoices until C2 org roles (`org_admin`/`org_finance`) are wired. Contributor/Commenter/Viewer get copy explaining employees submit time and finance/admin invoices.
- Aligned the Edge invoices API source: invoice creation now requires billing-manager access instead of any accepted member.
- Verification: `git diff --check` passes; `npm run build` passes. Chunk sizes: `vendor-charts` 312.10 kB, `vendor` 295.72 kB, `vendor-ui` 278.58 kB, `index` 266.51 kB, `workgraph` 252.57 kB, `vendor-react` 228.48 kB, `approvals` 87.53 kB, `invoices` 63.76 kB, `timesheets` 61.39 kB. Known manual-chunk circular warnings remain.
- Not applied/deployed yet: migrations 018/019/020 must be applied in order; `make-server-f8b491be` must be redeployed for Edge-source changes. Existing legacy graph rates will not be trusted for invoices unless explicitly enabling the dev fallback.

## 2026-07-14 - [IN PROGRESS] Signatory-scoped contracts + invoice read hardening (Codex)

- Added migration `021_signatory_scoped_contracts.sql`: `wg_contracts` reads/updates now move from broad owner/project assumptions toward contract owner or verified signatory-party organization access.
- Hardened `supabase/functions/server/contracts-api.tsx`, which uses the service-role key and therefore must enforce authorization itself: project contract lists are filtered through contract signatories, single-contract reads require signatory access, rate fields are redacted for non-rate viewers, updates require owner/org finance/admin access, and project contract creation is blocked for non-Owner/Editor project users until C2 finance roles are wired.
- Hardened `supabase/functions/server/invoices-api.tsx`: invoice lists are filtered by creator or mapped invoice party (`from_party_id`/`to_party_id`) instead of broad project Owner/Editor reads. Invoice creation remains temporarily allowed for project Owner/Editor or mapped seller-side org admin/finance while C2 UI is incomplete.
- Updated `ContractsPage` so redacted rate payloads render as `Rate restricted` and are excluded from average-rate math instead of appearing as `$0/hr`.
- Verification: `git diff --check` passes; `npm run build` passes. Chunk sizes: `vendor-charts` 312.10 kB, `vendor` 295.72 kB, `vendor-ui` 278.58 kB, `index` 266.78 kB, `workgraph` 252.58 kB, `vendor-react` 228.48 kB, `approvals` 87.53 kB, `invoices` 63.76 kB, `timesheets` 61.39 kB. Known manual-chunk circular warnings remain.
- Local caveat: Deno is not installed in this terminal, so Edge source was not `deno check`ed locally. Supabase deploy should be used as the Edge validation gate.
- Not applied/deployed yet: migrations 018/019/020/021 must be applied in order and `make-server-f8b491be` must be redeployed before these server/RLS protections affect production.

## 2026-07-14 - [DONE] Trust Core migrations 018-021 applied + make-server redeployed (Codex)

- Applied the four new Trust Core SQL migrations directly against the linked Supabase database after `db push` hit the repo's duplicate-011 history issue:
  - `018_c2_organization_membership_and_roster.sql`
  - `019_timesheet_self_approval_guard.sql`
  - `020_private_project_rates_and_invoice_acl.sql`
  - `021_signatory_scoped_contracts.sql`
- Repaired migration history so `supabase migration list` now shows local and remote aligned for `018-021`.
- Redeployed the live Edge function slug that the app actually calls: `supabase functions deploy make-server-f8b491be --project-ref gcdtimasyknakdojiufl`.
- Verification:
  - `supabase migration list` shows `018`, `019`, `020`, and `021` as applied remotely.
  - `supabase functions list --project-ref gcdtimasyknakdojiufl` shows `make-server-f8b491be` active at version 93.
- Remaining caveat: local repo still contains a duplicate `011_fix_rls_recursion.sql`, so `supabase db push` will continue to complain about migration ordering until that historical repo issue is cleaned up or bypassed with direct SQL.

## 2026-07-15 - [READY] Claude product strategy audit brief (Codex)

- Added `src/docs/CLAUDE_PRODUCT_STRATEGY_BRIEF.md` for an independent Claude
  `GO` / `PIVOT` / `STOP` review before more product features are built.
- The brief challenges both the existing staffing-SaaS roadmap and the proposed
  organization-scoped agent thesis. It requires a first buyer, completed job,
  measurable outcome, deterministic-versus-agent boundary, feature kill list,
  90-day validation plan, and explicit stop criteria.
- Claude is instructed to produce `PRODUCT_STRATEGY_DECISION.md`, reconcile stale
  roadmap assumptions, and avoid product implementation during the audit.

## 2026-07-15 - [IN PROGRESS] M1 verified worker identity chain (Codex)

- Added migration `022_project_worker_onboarding_rpc.sql` with an owner-only,
  atomic RPC that turns an accepted project invite into a verified organization
  worker, active project-roster record, graph person identity, and internal
  worker-to-company approval edge.
- Added the owner Team action and `ProjectWorkerSetupDialog`: the owner assigns
  company name, worker name, and placement title after invite acceptance. Worker
  defaults are intentionally narrow: own timesheets only, with no rate,
  contract, approval, graph-edit, or invoice permissions.
- Separated current-user identity loading from the privileged Team directory.
  Contributors can now resolve their own RLS-scoped membership and graph node
  without gaining access to the project member list.
- Updated invitation copy to distinguish project-link acceptance from verified
  employee setup. An accepted but unmapped worker now sees a clear setup-pending
  explanation instead of an empty workspace.
- Applied migration `022` to the linked database and aligned its migration
  history. Verified the RPC rejects the invited worker with `42501`; only the
  project owner can perform setup.
- Live-tested the accepted account `Rodman` in project `NAS`: mapped it to
  `Nikola Company` as `org_worker`, confirmed a scoped read-only graph, created
  five July draft weeks for the worker, and confirmed billing controls are
  replaced by an employee-only restricted view. Browser console reported no
  errors.
- `npm run build` passes. Largest chunk is `vendor-charts` at 312.10 kB; all
  chunks remain below 400 kB. Existing manual-chunk circular warnings remain.
- Still required before M1 is complete: enter and submit worker hours, approve
  them internally as Nikola, add real James/John upstream accounts, and verify
  the full approval-to-invoice-ready path without persona switching. Real email
  delivery also still requires SMTP/Resend and a public invite URL.

## 2026-07-15 - [DONE] C2 internal worker approval routing repair (Codex)

- Reproduced the real Rodman submission failure: three June weeks reached
  `wg_timesheet_weeks` as submitted, but their approval snapshots started at G2
  and omitted Nikola Company, leaving Nikola's queue empty.
- Root cause was deterministic in `TimesheetDataContext`: the same-company step
  was resolved correctly and then discarded when `buildApprovalRouteSteps`
  rebuilt the route starting only from the company's `billsTo` targets.
- Fixed route construction so a worker first routes to a different eligible
  approver in their own company, while an owner submitting their own time still
  skips self-approval and routes upstream.
- Added and applied migration `023_internal_worker_approval_route.sql`. It
  repairs pending first-layer worker records through verified organization
  membership, preserves and shifts existing upstream steps, and normalizes
  authenticated graph identities such as `Me` to their account name.
- Live result for Rodman's June submissions is now step 1 Nikola Kralj, step 2
  G2, step 3 NAS. All three pending records carry Nikola's real user UUID.
- Clarified graph connection labels: a worker-to-company approval edge now reads
  `submits here` from the company drawer instead of making the worker look like
  an approver.
- Browser verification as Rodman shows `Nikola Kralj` with the approver badge,
  Rodman as Consultant without one, and both people with `submits here`
  relationships. `npm run build` passes; largest chunk remains 312.10 kB.

## 2026-07-15 - [DONE] Rodman refresh identity + self-approval UI repair (Codex)

- Fixed July timesheets disappearing after refresh. Persisted rows are owned by
  the auth UUID, while the graph UI uses a person-node ID; API hydration now maps
  the signed-in user's rows through accepted `wg_project_members.graph_node_id`.
- Project selection/change events now reload the project-scoped rows, preventing
  provider-load timing from leaving the store on an unmapped identity.
- Removed the green approve hand from a submitter's own weeks. Submitted-week
  controls now require an exact current-assignee identity match and always deny
  self-approval; sharing an organization node is not approval authority.
- Live-verified after hard refresh as Rodman: 24h total, 2 pending, Jul 6-10 (8h)
  and Jun 29-Jul 3 (16h) visible; 0 Approve actions, 2 Recall actions, no console
  errors.
- `npm run build` and `git diff --check` pass. Largest JS chunk is
  `vendor-charts` at 312.10 kB; all chunks remain under 400 kB. Existing Vite
  circular manual-chunk warnings remain.

## 2026-07-15 - [DONE] Real approval path sheet + approver queue isolation (Codex)

- Removed the 486-line `GraphOverlayModal` prototype. It invented generic
  Contractor/Manager/Finance stages, advertised a nonexistent graph overlay,
  exposed duplicate approve/reject shortcuts, and rendered masked-rate hints.
- Added `ApprovalPathSheet`, a read-only right-side sheet driven by the saved
  approval route and trail. It shows the submitter, real current/direct-next
  actors, organizations, step states, hours, and timestamps. Downstream actors
  beyond the direct next hop are anonymized.
- Unauthorized amount/rate fields now do not render in Queue or Details; no
  `Rate masked` or rate-visibility labels remain in the approvals components.
- Fixed queue scoping: a person's organization is no longer added to their
  approver scope unless the graph explicitly marks that person `canApprove`.
  Exact assigned user UUID matching remains supported.
- Live verification: Rodman's Queue no longer contains Nikola Kralj's pending
  item. Before closing that leak, the new sheet rendered the saved route as
  Nikola Kralj / Nikola Company (current), James / G2 (waiting), and the later
  downstream stage; layout was verified without overflow and with no console
  errors.
- `npm run build` and `git diff --check` pass. Approvals chunk is 83.78 kB;
  largest JS chunk remains `vendor-charts` at 312.10 kB, below 400 kB. Existing
  Vite circular manual-chunk warnings remain.

## 2026-07-15 - [DONE] Approval state sync + stalled bulk-chain repair (Codex)

- Confirmed the live failure from Nikola/Rodman testing: the June 29 approval
  row was rejected while its canonical `wg_timesheet_weeks` row remained
  submitted. The old trigger compared graph subject IDs with auth-user week IDs.
- Added and applied `026_approval_timesheet_identity_sync.sql`. The trigger now
  resolves weeks by project + submitter UUID + week start, keeps intermediate
  layers submitted, persists rejection, restores resubmissions to submitted,
  and marks the week approved only on the final route layer.
- Removed browser-side cross-user week updates from `approvals-supabase.ts`;
  approval state is now synchronized by the database transaction. Bulk approval
  now creates the next approval layer for every approved row.
- One-time repair advanced Rodman's stalled June 1, 8, and 15 approvals from
  Nikola's completed layer to pending G2 layer-2 rows. June 29 remains pending
  with Nikola after Rodman's resubmission; July 6 remains pending with James.
- Verified with rollback-only live DB scenarios for reject -> resubmit and a
  complete three-layer approval. Live Rodman browser: Queue empty with no
  Approve/Reject controls; My submissions shows five in-progress weeks with the
  correct waiting-on actor; July survives refresh. `npm run build` passes and
  all generated JS chunks remain below 400 kB.

## 2026-07-27 - [DONE] scoped-supply-chain-administration (Codex)

- Ported the supply-chain ownership repair into the active `HybridSocialApp-run`
  checkout. `ProjectWorkspace`, `WorkGraphBuilder`, and
  `ProjectCreateWizard` now allow an accepted project manager to edit only the
  party mapped by their membership scope. Other parties, their people, and their
  party type are read-only; adding/removing organizations is disabled in the
  regular editor.
- Supply-chain saves now replace the active graph snapshot instead of merging
  missing nodes back in, which prevents future ghost organizations after a
  governed archival/replacement operation. The editor labels the current party
  as `Your organization` and labels the original creator accurately.
- `projects-api.ts` routes graph/party changes through the server API rather
  than the direct client update. `projects-api.tsx` validates the complete
  snapshot against the caller's accepted organization scope and rejects changes
  to another party or its people. Invite requests now include the project ID,
  avoiding ambiguous same-name project lookup without replacing the newer C2
  company/roster workflow.
- Added `028_scoped_supply_chain_administration.sql`, which removes direct
  authenticated `wg_projects` UPDATE access so RLS cannot bypass the server
  party-level check.
- Live UI verification as the NAS-scoped account: G2 and Triangle Services
  were locked; NAS alone was editable; no changes were saved. The browser still
  reports a pre-existing TimesheetStore refresh warning (`Failed to list
  timesheets`) after approval updates.
- Residual: apply migration 028 and deploy the updated Edge Function before
  treating server-side enforcement as live. Existing orphan G2 data is not
  auto-deleted; it needs the later governed structure-change workflow.

## 2026-07-27 - [DONE] invitation-scope-and-workspace-identity (Codex)

- Project invitations now inherit the inviter's accepted project-party scope on
  the server. The browser cannot submit an arbitrary party ID, and an unmapped
  inviter receives a clear error instead of creating an unscoped member.
- The invite dialog explains that a new member joins the inviter's active
  project organization. This makes organization delegation explicit rather than
  treating a project role as a company assignment.
- Removed the `project-main` synthetic fallback from `TimesheetDataContext`.
  A workspace with no selected project no longer issues timesheet/approval
  work under a fake ID.
- Residual: existing BRS FLOW QA data remains mis-scoped (James/John map to NAS
  and the graph has an orphan G2 node). Correct it through a later governed
  data-repair workflow; do not silently mutate production project history.

## 2026-08-02 - [DONE] C3a commit cleanup (Codex)

- Added compatibility fallback for older project-owner membership rows with no
  stored scope: the workspace and Edge project/invitation routes resolve the
  graph creator party as the owner's editable/inviting organization.
- Passed project ID from the project-list invite dialog so scoped invitations do
  not fall back to ambiguous project-name lookup.
- Tightened the project Edge validator to reject forged graph-blob mutations to
  other organizations' new nodes or connections, while allowing changes owned by
  the caller's scoped party.
- Verification: `git diff --check` passes. Per active `AGENTS.md`, build was
  not run in this Codex sandbox.
- Residual: apply migration `028_scoped_supply_chain_administration.sql` and
  deploy `make-server-f8b491be`; Claude review should reconcile remaining
  client graph-write paths such as the rate editor before production use.

## 2026-08-02 - [DONE] C3a edge deploy hardening (Codex)

- Deployed `make-server-f8b491be` after C3a, then caught one validator gap while
  preparing the adversarial check: non-owned party nodes inside `graph.nodes`
  were not compared directly.
- Patched the Edge validator so another organization's party node data cannot
  be renamed/spoofed through the graph JSON while leaving the `parties` array
  unchanged. Only derived `chainPosition` is ignored.
- Verification: `git diff --check` passes before commit; redeploy required after
  this patch.
