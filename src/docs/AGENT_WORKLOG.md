# WorkGraph Agent Worklog

**Owner:** Nikola + Claude + Codex
**Rule:** Append only. Never edit prior entries. Older entries: `archive/AGENT_WORKLOG_ARCHIVE.md`.

---

## Current State (2026-04-24)

- **Security audit complete.** Critical findings: `approval_records` RLS wide open, HMAC secret hardcoded in client bundle. See CLAUDE.md security table.
- **Migration 014 written** (`supabase/migrations/014_approval_records_rls_fix.sql`) — awaiting Nikola apply.
- **Migrations 012 + 013** also pending apply (Nikola).
- **Phase order reset:** Security (S1, S2) → Dead Code Purge (D1, D2, D3) → Sprint A → B → C → Phase 4.
- **Edge functions** still not deployed (`SUPABASE_ACCESS_TOKEN` missing).

## Current Blockers

| # | Blocker | Owner | Status |
|---|---|---|---|
| 1 | Migration 014 not applied — RLS wide open | Nikola | Pending |
| 2 | Migration 012 not applied — self-approval trigger missing | Nikola | Pending |
| 3 | Migration 013 not applied — blocks B3 | Nikola | Pending |
| 4 | `SUPABASE_ACCESS_TOKEN` not set — edge functions cannot deploy | Nikola | Pending |

---

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
