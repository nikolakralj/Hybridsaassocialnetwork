# CLAUDE.md — WorkGraph Project Context

**Last updated: 2026-04-24**

## What This Is
WorkGraph: graph-aware operational workflow for agencies/consulting firms.
Core loop: **project → timesheet → approval → invoice**
Multi-tenant supply chain: Global Corp → Agency → DevShop → Contractor

## Tech Stack
- **Frontend**: React SPA + Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Supabase Edge Functions (Hono framework, Deno runtime) — **NOT YET DEPLOYED**
- **Database**: Supabase Postgres (Frankfurt, project `gcdtimasyknakdojiufl`)
- **Auth**: Supabase Auth (email/password), wired via `src/contexts/AuthContext.tsx`

## Current Phase: Security Hardening → Dead Code Purge → Phase 4 Invoice

**Priority order (STRICT):**
1. **Tier 0 — Security** (S1 apply migration 014, S2 move token signing server-side)
2. **Tier 1 — Dead Code Purge** (D1 delete dead timesheet views, D2 dead approval APIs, D3 kill local-only project mode)
3. **Tier 2 — Sprint A** (approvals UX)
4. **Tier 3 — Sprint B** (graph + permissions)
5. **Tier 4 — Sprint C** (invitation UI)
6. **Phase 4** (invoice generation)

See `src/docs/TASK_BACKLOG.md` for full task cards.

## Multi-Agent Roles

### Claude — Lead Architect + Reviewer
- Reviews ALL Codex output before merge. Reads diffs, does not trust summaries.
- Implements cross-cutting security fixes and data-model decisions.
- Gate authority: no phase advance without Claude GO/NO-GO.

### Codex (OpenAI) — Implementation Workforce
- Reads `CLAUDE.md` + `OPERATIONS.md` + `TASK_BACKLOG.md` + `AGENT_WORKLOG.md` at start of EVERY run.
- Picks the top `[READY]` task in order. No skipping tiers.
- Runs `npm run build` before marking any task `[REVIEW]`.
- Updates `AGENT_WORKLOG.md` with what changed + residual risks.

## File Ownership

| File | Owner | Rule |
|---|---|---|
| `CLAUDE.md` | Claude | Codex never touches |
| `src/docs/OPERATIONS.md` | Claude | Codex never touches |
| `src/docs/ROADMAP.md` | Claude | Codex never touches |
| `src/docs/TASK_BACKLOG.md` | Claude writes, Codex updates status | Codex: status updates only, no structural edits |
| `src/docs/AGENT_WORKLOG.md` | All agents append | Append only — never edit prior entries |
| `src/utils/api/approvals-supabase.ts` | Claude | Codex: read-only unless explicit clearance per task |
| `src/utils/api/timesheets-api.ts` | Claude | Same |
| All other `src/` files | Codex | Claude reviews output |
| `supabase/migrations/` | Codex drafts, Nikola applies | Never `supabase db push` — SQL Editor only |

## Database State (as of 2026-04-24)

**Applied:**
- `005` — core tables (`wg_projects`, `wg_project_members`, `wg_timesheet_weeks`, etc.)
- `006–009` — schema additions, state triggers, approval snapshots
- `010` — `wg_invoices`, `wg_invoice_templates`
- `011_fix_rls_recursion.sql` — SECURITY DEFINER helpers for RLS (`wg_user_owns_project`, `wg_user_is_project_member`)

**Pending — Nikola must apply in SQL Editor:**
- `012_approval_submitter_id.sql` — adds `submitter_user_id` + DB-level self-approval trigger
- `013_graph_node_id_and_invite_link.sql` — adds capability flags to `wg_project_members`
- **`014_approval_records_rls_fix.sql` — CRITICAL. Wide-open policies replaced with project-scoped ones.**

**Note on 011 filename collision:** `011_approval_snapshot.sql` and `011_fix_rls_recursion.sql` both exist. Only `011_fix_rls_recursion.sql` matters — it replaces recursive policies. Do not re-apply `011_approval_snapshot.sql` if already done.

## Critical Architecture

### Graph = Permission Model (ReBAC)
- `WorkGraphBuilder.tsx` writes to sessionStorage: `workgraph-viewer-meta:${projectId}`, `workgraph-name-dir:${projectId}`, `workgraph-approval-dir:${projectId}`
- `WorkGraphContext.tsx` provides fallback hydration — Graph tab no longer must be visited first
- `buildViewerOptions()` in `graph-visibility.ts` produces: `admin`, `client`, `agency`, `company`, `freelancer` — NOT `person`
- People in the name directory have `orgId` set; org nodes do not

### Project ID Discrimination — CRITICAL
- `isLocalOnlyProjectId(id)` → true only for `proj_local_*` — browser-only (being deleted in D3)
- `proj_1776...` TEXT IDs without `_local_` → cloud-backed → use Supabase direct paths
- `isUuid(id)` → UUID format only → also cloud-backed
- **Never use `isUuid()` as the "should I use Supabase?" gate** — it wrongly excludes TEXT IDs
- Correct gate: `!isLocalOnlyProjectId(id)` → use Supabase

### Project Mapper — CRITICAL
- `mapSupabaseProjectRow()` in `projects-api.ts` MUST include `graph` and `parties` fields
- Dropping either causes an empty graph canvas on load
- Always verify the mapper when adding new DB columns

### Approval Chain Routing
- `buildApprovalPartyRoute()` resolves the multi-party route from sessionStorage/DB
- `createNextApprovalLayerIfNeeded()` spawns the next `approval_records` row after each approval
- Self-approval guard in client code (read-then-update) — DB trigger in 012 enforces server-side once applied
- Approver resolved to `wg_project_members.user_id` UUID, stored in `currentApproverUserRef`

## Commands
```bash
npm run dev          # Vite dev server
npm run edge:serve   # Supabase edge functions locally (requires SUPABASE_ACCESS_TOKEN)
npm run dev:all      # Both via concurrently
npm run build        # REQUIRED before any task is marked [REVIEW] or [DONE]
```

## Key Directories
```
src/contexts/              # AuthContext, TimesheetDataContext, WorkGraphContext, NotificationContext
src/components/workgraph/  # WorkGraphBuilder, graph-visibility, auto-generate, ProjectCreateWizard
src/components/timesheets/ # ProjectTimesheetsView (ONLY live timesheet UI — rest is dead code being deleted)
src/components/approvals/  # ApprovalsWorkbench, ProjectApprovalsTab, SubmissionsView, ApprovalTimeline
src/components/invoices/   # InvoicesWorkspace (Phase 4)
src/utils/api/             # projects-api.ts, approvals-supabase.ts, timesheets-api.ts
supabase/functions/server/ # Edge function APIs (NOT deployed — direct Supabase JS client used instead)
supabase/migrations/       # SQL migrations 005–014
src/docs/                  # OPERATIONS.md, ROADMAP.md, TASK_BACKLOG.md, AGENT_WORKLOG.md, specs/
```

## Known Security Issues (track resolution here)

| Issue | Severity | Status | Fix |
|---|---|---|---|
| `approval_records` RLS wide open (`USING (true)`) | CRITICAL | ⚠️ Migration 014 written, pending apply | Nikola applies 014 in SQL Editor |
| HMAC secret hardcoded in client bundle (`approval-tokens.ts`) | HIGH | Open | Task S2 — move signing to edge function |
| Self-approval guard is client-side only | MEDIUM | Partial — DB trigger in 012, pending apply | Apply 012 migration |
| Edge functions not deployed — no server-side role enforcement | HIGH | Open | Task B3 (blocked on M2) |

## Things That Bite You

1. **Supabase `.update().eq()` silently succeeds on 0-row matches** — use `.select('id')` and check `updatedRows.length > 0`.

2. **`mapSupabaseProjectRow()` must include `graph` + `parties`** — dropping either = empty canvas.

3. **Never use `isUuid()` as the Supabase gate** — use `!isLocalOnlyProjectId(id)`.

4. **Name/approval directories in sessionStorage** — not always set. `WorkGraphContext` hydrates from DB if missing. Don't assume.

5. **Demo seed data stripped on login** — `user-sarah`, `user-james`, etc. never mix with real UUIDs.

6. **`cachedApprovalParties` is removed** — module-level cache caused staleness. Always read fresh from sessionStorage.

7. **PersonaContext is dead** — killed in Phase 2. Never re-introduce it.

8. **`approval_records` RLS not yet fixed** — migration 014 pending apply. Until then, any authenticated user can read all approval records.
