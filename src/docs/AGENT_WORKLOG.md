# WorkGraph Agent Worklog

**Owner:** Nikola + Claude + Codex
**Rule:** Append only. Never edit prior entries. Older entries: `archive/AGENT_WORKLOG_ARCHIVE.md`.

---

## Current State (2026-07-08)

- **All migrations 001ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ016 applied** (016 applied + verified 2026-07-08; 010 verified already applied ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â wg_invoices/wg_invoice_templates + RLS live).
- **P4-1 invoice orchestrator DONE** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â invoices-api.ts rewritten to direct Supabase; graph-defined rates wired into generate flow; live-verified in browser. P4-2 list view verified. P4-3 (PDF export) is next `[READY]`.
- **Edge functions:** an OLD build (`make-server-f8b491be`) is live and serving /api/timesheets, /api/contracts, /api/projects/:id/members; newer routes (invitations, approval tokens, B3 guards) 404 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ **fresh `supabase functions deploy server` still required**.
- **Supabase free tier auto-pauses the project** after inactivity (found INACTIVE 2026-07-08, restored via MCP). Check project status if DB suddenly unreachable.
- **Social fully gated** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â `VITE_SHOW_SOCIAL_FEATURES=false` hides dashboard sections, header Feed nav, Write-a-Post, and the freelancer-onboarding feed redirect. Page title now "WorkGraph ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦".
- **Data reality check:** 3 projects, 7 timesheet weeks (draft/submitted, 0 approved), 0 invoices, **0 graph person nodes have rates set** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â set rates in the Graph tab before generating invoices.
- **`APPROVAL_TOKEN_SECRET`** set in Supabase Edge Function secrets ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦; **Supabase CLI** linked; `SUPABASE_ACCESS_TOKEN` in `~/.claude/settings.json`.

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
