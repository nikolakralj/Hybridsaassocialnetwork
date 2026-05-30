# WorkGraph Agent Worklog

**Owner:** Nikola + Claude + Codex
**Rule:** Append only. Never edit prior entries. Older entries: `archive/AGENT_WORKLOG_ARCHIVE.md`.

---

## Current State (2026-05-30)

- **All Tier 0 + Tier 1 tasks complete.** S1 (RLS fix), S2 (token signing), D1 (dead timesheet views), D2 (dead approval APIs), D3 (local-only project mode), dashboard-launchpad-onboarding all done.
- **Migrations 012 + 014 applied.** Self-approval trigger + project-scoped RLS live.
- **Migration 013** pending apply (Nikola) — blocks B3.
- **Migration 015** pending apply (Nikola) — safe, drops dead legacy tables.
- **Supabase CLI** installed (v2.102.0) and linked to `gcdtimasyknakdojiufl`.
- **`SUPABASE_ACCESS_TOKEN`** in `~/.claude/settings.json` — CLI can deploy edge functions.
- **`APPROVAL_TOKEN_SECRET`** set in Supabase Edge Function secrets ✅ — token signing unblocked.
- **Edge functions** not yet deployed (pending explicit deploy command).

## 2026-05-30 — [DONE] Supabase secrets + CLI setup (Nikola + Claude)

- `APPROVAL_TOKEN_SECRET` added to Supabase Dashboard → Settings → Edge Functions → Secrets. Resolves Blocker #3.
- `SUPABASE_ACCESS_TOKEN` (personal access token) saved to `~/.claude/settings.json` env. Resolves Blocker #2 (token present; deploy still pending).
- Supabase CLI v2.102.0 installed globally via `npm install -g supabase`, logged in, linked to project.
- `supabase migration list` run: all local migrations (001–015) in Local column, Remote empty (expected — all applied via SQL Editor, not CLI).
- Migration 015 discovered and verified safe. Added as M4 `[READY]` in TASK_BACKLOG.
- Supabase Advisor warnings noted: Auth RLS Initialization Plan (8 tables), Duplicate Index on `kv_store_f8b491be`, Function Search Path Mutable on `approval_records_set_updated_at` + `wg_set_updated_at`. Non-blocking; future cleanup pass.

---

## 2026-05-30 — [DONE] Migration 013 verified applied (Claude)

- Attempted to run `013_graph_node_id_and_invite_link.sql` in SQL Editor — syntax error indicated re-run of already-applied migration.
- Queried live DB via Supabase MCP. Confirmed all columns present: `graph_node_id`, `can_approve`, `can_view_rates`, `can_edit_timesheets`, `visible_to_chain`, `scope`, `accepted_at`, `invitation_id`.
- Confirmed FK `wg_project_members_invitation_id_fkey` exists.
- Confirmed RLS policy `wg_members_scope_contributor` present with correct definition.
- Migration 013 was fully applied in an earlier untracked session. M2 marked `[DONE]`, B3 unblocked → status changed to `[READY]`.

---

## 2026-05-30 — [DONE] M4 015_purge_dead_legacy_tables applied (Codex)

- Dropped legacy tables (all existed and were dropped): `allocated_tasks`, `review_flags`, `attachments`, `timesheet_entries`, `timesheet_periods`, `project_contracts`, `organizations`, `workgraph_edges`, `workgraph_nodes`, `graph_versions`, `project_members`, `projects`.
- Dropped legacy views (all existed and were dropped): `approval_history`, `approval_queue`, `v_contracts_with_orgs`, `v_periods_full`.
- Verified: 0 legacy table rows remain in `information_schema.tables` for the above names. 0 legacy views remain in `information_schema.views`.
- All DROP statements used `IF EXISTS CASCADE` — safe, idempotent, no live code references affected.

---

## Current Blockers

| # | Blocker | Owner | Status |
|---|---|---|---|
| — | ~~All prior blockers resolved~~ | — | — |

**No active blockers.** All migrations applied. Secrets configured. CLI linked. B3 ready to implement.

---

## 2026-04-24 — [DONE] D3 kill-local-only-project-mode (Claude)

- Deleted `isLocalOnlyProjectId`, `isLocalProjectId`, `LOCAL_APPROVALS_KEY`, `readLocalApprovals`, `writeLocalApprovals`, `createLocalApprovalId`, `filterLocalApprovals` from `approvals-supabase.ts`.
- Removed all local-storage branches from `createApproval`, `getApprovalQueue`, `getLatestPendingApproval`, `approveItem`, `rejectItem`, `bulkApprove`, `getPendingCount`.
- Removed `proj_local_` guards from `timesheets-api.ts` (project_id now always written).
- Removed `isLocalProjectId` and all call sites from `TimesheetDataContext.tsx` (`loadApprovalParties`, `loadFromApi`, `persistWeek`, `persistStatus`, `isRemoteWorkflow`).
- Zero references to `proj_local_` or local-storage approval paths remain in `src/`.
- `npm run build` passes.

## 2026-04-24 — [DONE] S2/D1/D2 security + dead-code pass (Codex)

- Workspace: C-drive only (`C:\Users\nikol\Projects\HybridSocialApp-run`). Node.js v24.15.0 / npm 11.12.1 installed.
- S2: `approval-tokens.ts` reduced to type definitions only. New `approval-tokens-api.tsx` does server-side HMAC-SHA256 sign/verify via `Deno.env.get("APPROVAL_TOKEN_SECRET")`. `crypto.randomUUID()` used throughout. Wired into `index.tsx`.
- D1: deleted 8 dead timesheet calendar views + `approval/` (10 files) + `approval-v2/` (5 files). `ProjectTimesheetsView.tsx` preserved.
- D2: deleted `timesheets-approval.ts` + `timesheets-approval-hooks.ts` (zero live imports confirmed).
- `npm run build` passes after each deletion pass.

## 2026-04-24 — [DONE] security-audit + doc overhaul (Claude)

- Full codebase security review. Findings:
  - `approval_records` RLS: `USING (true)` on SELECT/INSERT/UPDATE = any authenticated user reads/modifies all tenants' approval data.
  - `approval-tokens.ts`: hardcoded HMAC secret + `Math.random()` UUIDs in client bundle = forgeable email approval tokens.
  - Self-approval guard: client-side read-then-update, not atomic. DB trigger exists in 012 but not yet applied.
  - Edge functions not deployed = no server-side role enforcement anywhere.
  - ~40k LOC of dead code (parallel timesheet views, approval-v2/, unused approval APIs).
- Written: `supabase/migrations/014_approval_records_rls_fix.sql`.
- Doc cleanup: deleted AGENT_REGISTRY, DOCS_GOVERNANCE, CODEX_SUBAGENT_PLAYBOOK, ARCHITECTURE (stale), APPROVAL_SUBMISSIONS_SPEC duplicate, SQL_SCHEMA_MIGRATION spec, entire archive/. Rewrote TASK_BACKLOG with security-first priority order. Updated CLAUDE.md.

---

## 2026-04-22 — [DONE] project-workspace-role-gating (Codex)

- `ProjectWorkspace.tsx`, `WorkGraphBuilder.tsx`: edit/save/invite controls hidden for non-owner/editor roles. `canEditGraph` prop added to WorkGraphBuilder.
- Residual risk: UI-level only — server-side enforcement still needs B3.

## 2026-04-22 — [DONE] atomic-project-create-path (Codex)

- `ProjectCreateWizard.tsx`, `projects-api.ts`, `supabase/functions/server/projects-api.tsx`: graph sent with initial create payload, no separate updateProject needed. Rollback on downstream insert failure.

## 2026-04-22 — [DONE] project-delete-owner-guard (Codex)

- `projects-api.ts`, `ProjectsListView.tsx`: direct Supabase delete path for cloud projects, ownership verified before delete, Delete button hidden for non-owners.

## 2026-04-21 — [DONE] approval-submissions-redesign (Codex)

- `ApprovalsWorkbench.tsx`, `SubmissionsView.tsx`, `ApprovalTimeline.tsx`, `ProjectApprovalsTab.tsx`: 6-col grid, drawer-based audit trail, semantic status chips, URL-hash deep linking.

## 2026-04-21 — [DONE] task6a-6e approval chain bugs (Codex)

- `approvals-supabase.ts`: party hydration, next-layer spawning, person-level approver routing, async scope resolver, self-approval guard.
- `ApprovalsWorkbench.tsx`: real submitter name from nameDirectory, my-submissions scope via viewerNodeId.
- `ProjectTimesheetsView.tsx`: approve actions fail closed unless viewer matches current pending approver.

## 2026-04-21 — [DONE] project-cloud-refresh-persistence (Codex)

- `projects-api.ts`, `ProjectsListView.tsx`, `ProjectCreateWizard.tsx`: `proj_*` TEXT IDs treated as cloud-backed, direct supabaseListProjects() path, cloud rows survive refresh.

## 2026-04-20 — [DONE] bundle-splitting (Claude + Codex)

- `vite.config.ts`: 9 chunks, largest 312 kB. Before: single 1741 kB chunk.

## 2026-04-20 — [DONE] task2-invoice-edge-functions + task3-invoice-persistence (Codex)

- Edge function routers for invoices, templates, extraction wired in index.tsx.
- `invoices-api.ts`, `InvoicesWorkspace.tsx`: API-backed persistence, cloud/local labels.

## 2026-04-20 — [DONE] task4-graph-context-fix (Codex)

- `WorkGraphContext.tsx`: name/approval directories hydrated from sessionStorage or DB on demand. Timesheets and Approvals no longer require Graph tab visit.

## 2026-04-20 — [DONE] task5-invite-email (Codex)

- `invitations-api.tsx`, `ProjectInviteMemberDialog.tsx`: invite router with create/lookup/accept routes, email send or log.

## 2026-05-30 — [DONE] B3 server-side-role-enforcement (Codex)

- **Files modified**: `supabase/functions/server/projects-api.tsx`, `src/components/ui/dialog.tsx`
- **Changes**:
  - `DELETE /projects/:id`: replaced direct `owner_id === user.id` check with `getCallerRole()` helper and returns `{"error":"Forbidden"}` (standardised) instead of custom message. Callers with no `wg_project_members` row are now also covered since `getCallerRole` returns null for non-owners not in the table.
  - `PUT /projects/:id`: guard was already correct (`role !== "Owner" && role !== "Editor"` → 403). No functional change needed; confirmed in code review.
  - `dialog.tsx`: fixed a pre-existing extra `(` on line 36 (`>((({` → `>(({`) that was causing the Vite build to fail. Not related to B3.
- **How the guard works**: `getCallerRole` queries `wg_project_members` with the service-role client (bypasses RLS). Returns `"Owner"` for the project's `owner_id`, otherwise returns the member's role or `null` if no accepted membership row exists. No row → `null` → 403.
- **Residual risks**: Edge functions are not yet deployed to Supabase (blocked on deploy step). These guards only take effect once `supabase functions deploy server` is run.

## 2026-05-30 — [DONE] dashboard-launchpad-onboarding (Codex)

- **Files modified**: [DashboardPage.tsx](file:///c:/Users/nikol/Projects/HybridSocialApp-run/src/components/dashboard/DashboardPage.tsx)
- **Logic added**:
  - Integrated the "WorkGraph Launch Pad" onboarding checklist banner into the main [DashboardPage](file:///c:/Users/nikol/Projects/HybridSocialApp-run/src/components/dashboard/DashboardPage.tsx) layout.
  - Dynamically switches checklist steps depending on user role/persona (`agency`, `company`, or `freelancer`) matching our Bullhorn-inspired onboarding proposal.
  - Progress checks are reactive to database stats (e.g. automatically checks off items when projects/contracts/earnings exist).
  - Saved completion states and dismiss settings in `localStorage` per `userId` to ensure seamless persistence.
  - Fixed a React Rules of Hooks violation by moving all `useState` declarations above the loading/error early return statements.
- **Residual Risk**: None.
