# CLAUDE.md — WorkGraph Project Context

**Last updated: 2026-04-22**

## What This Is
WorkGraph: graph-aware operational workflow for agencies/consulting firms.
Core loop: **project → timesheet → approval → invoice**
Multi-tenant supply chain: Global Corp → Agency → DevShop → Contractor

## Tech Stack
- **Frontend**: React SPA + Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Supabase Edge Functions (Hono framework, Deno runtime)
- **Database**: Supabase Postgres (Frankfurt, project `gcdtimasyknakdojiufl`)
- **Auth**: Supabase Auth (email/password), wired via `src/contexts/AuthContext.tsx`

## Current Phase: Phase 4 (Invoice Generation) — Phase 3 is GO ✅

Phase 3 gate was closed on 2026-04-21. All blockers resolved:
- ✅ Viewer dropdown type mismatch fixed (orgId-based detection)
- ✅ Timesheet persistence across refresh (localStorage + Supabase fallback)
- ✅ Approval queue wired to `approval_records` table
- ✅ Self-approval guard implemented
- ✅ Multi-layer approval chain progression working

Phase 4 active work: see `src/docs/TASK_BACKLOG.md` for Sprint A/B/C tasks.

## Critical Architecture

### Graph = Permission Model (ReBAC)
- `WorkGraphBuilder.tsx` writes to sessionStorage: `workgraph-viewer-meta:${projectId}`, `workgraph-name-dir:${projectId}`, `workgraph-approval-dir:${projectId}`
- Other tabs (Timesheets, Approvals) read from sessionStorage — context: `WorkGraphContext.tsx` provides fallback hydration so Graph tab no longer must be visited first
- `buildViewerOptions()` in `graph-visibility.ts` produces viewer types: `admin`, `client`, `agency`, `company`, `freelancer` — NOT `person`
- People in the name directory have `orgId` set; orgs do not

### Project ID Discrimination — CRITICAL
- `isLocalOnlyProjectId(id)` → true only for `proj_local_*` prefix — these are browser-only
- `proj_1776...` (TEXT IDs without `_local_`) are **cloud-backed** — go through Supabase direct paths
- `isUuid(id)` → only UUID format (36-char hex) — these are also cloud-backed
- **Never use `isUuid()` as the gate for "should this use Supabase?"** — it wrongly excludes TEXT IDs
- The correct gate is: `!isLocalOnlyProjectId(id)` → use Supabase

### Project Mapper — CRITICAL
- `mapSupabaseProjectRow()` in `projects-api.ts` MUST include `graph` and `parties` fields
- Dropping these causes empty graph canvas on every cloud project load
- Always check the mapper when adding new DB columns

### sessionStorage → localStorage Fallback
- `readSessionJson()` in `approvals-supabase.ts` now falls back to `localStorage` for approval directory
- This means approval directory survives browser refresh even when Graph tab has not been revisited

### Approval Chain Routing
- `buildApprovalPartyRoute()` resolves the multi-party approval path from sessionStorage/DB
- `createNextApprovalLayerIfNeeded()` spawns the next `approval_records` row after each approval
- Self-approval guard: rejects approval if `submitter_user_id === approvedBy`
- Approver is resolved to `wg_project_members.user_id` UUID, stored in `currentApproverUserRef`

## Database State (as of 2026-04-22)

**Applied migrations** (all run manually via Supabase SQL Editor):
- `005_workgraph_core.sql` — core tables: `wg_projects`, `wg_project_members`, etc.
- `006` through `011` — various schema additions (approval snapshots, state triggers, etc.)
- `010_phase4_invoice_schema.sql` — `wg_invoices`, `wg_invoice_templates` (run ✅)

**Pending migrations** (Nikola must apply manually in Supabase SQL Editor):
- `012_approval_submitter_id.sql` — adds `submitter_user_id` + self-approval trigger
- `013_graph_node_id_and_invite_link.sql` — adds capability flags to `wg_project_members`

**Rule:** Do NOT use `supabase db push`. Run migrations manually in SQL Editor.

**Edge functions:** NOT yet deployed. `SUPABASE_ACCESS_TOKEN` missing on dev machine.
All API calls use the direct Supabase JS client path (no edge function dependency for core flows).

## Multi-Agent Setup & Roles

See `src/docs/OPERATIONS.md` for full roles, memory protocol, and coordination.

### Claude (this agent) — Lead Architect, Researcher, Code Reviewer
- Reviews all Codex output before it ships. Reads actual diffs. Runs builds.
- Implements hardest cross-cutting work: auth wiring, approval chain logic, data persistence
- Gate authority: no phase transition without Claude's honest GO/NO-GO

### Codex (OpenAI) — Implementation Workforce
- 6 specialized subagents via `.codex/agents/`
- Agents: backend-developer, frontend-developer, postgres-pro, api-designer, security-auditor, reviewer
- Picks tasks from `src/docs/TASK_BACKLOG.md` in order
- Must: read CLAUDE.md + OPERATIONS.md + TASK_BACKLOG.md + AGENT_WORKLOG.md at start of every run
- Must: run `npm run build` and update `AGENT_WORKLOG.md` before marking any task [REVIEW]

### Antigravity — UI/UX Polish
- Works from Figma designs or Claude's written specs with exact Tailwind classes
- Does NOT make UX decisions or touch business logic
- Output reviewed by Claude before merge

## File Ownership Rules

| File | Owner | Rule |
|---|---|---|
| `CLAUDE.md` | Claude | Never touched by Codex |
| `src/docs/OPERATIONS.md` | Claude | Never touched by Codex |
| `src/docs/ROADMAP.md` | Claude | Never touched by Codex |
| `src/docs/TASK_BACKLOG.md` | Claude writes, Codex updates status | No structural edits by Codex |
| `src/docs/AGENT_WORKLOG.md` | All agents append | Append only |
| `src/utils/api/approvals-supabase.ts` | Claude (active fixes) | Codex: read only without explicit clearance |
| `src/utils/api/timesheets-api.ts` | Claude (active fixes) | Same |
| All other `src/` files | Codex | Claude reviews output |
| `supabase/migrations/` | Codex drafts, Claude approves | Claude reviews before Nikola applies |

## Commands
```bash
npm run dev          # Vite dev server
npm run edge:serve   # Supabase edge functions locally
npm run dev:all      # Both via concurrently
npm run build        # Production build check — REQUIRED before any REVIEW/DONE
```

## Key Directories
```
src/contexts/          # AuthContext, TimesheetDataContext, WorkGraphContext, NotificationContext
src/components/workgraph/  # WorkGraphBuilder, graph-visibility, auto-generate, ProjectCreateWizard
src/components/timesheets/ # ProjectTimesheetsView (main timesheet UI)
src/components/approvals/  # ApprovalsWorkbench, ProjectApprovalsTab, SubmissionsView, ApprovalTimeline
src/components/invoices/   # InvoicesWorkspace (Phase 4 active)
src/utils/graph/           # approval-fallback.ts, auto-generate.ts
src/utils/api/             # timesheets-api.ts, timesheets-approval-hooks.ts, approvals-supabase.ts
supabase/functions/server/ # Edge function APIs (projects, timesheets, contracts, invoices)
supabase/migrations/       # SQL migrations (005-013)
src/docs/                  # ROADMAP, AGENT_WORKLOG, TASK_BACKLOG, OPERATIONS, specs/
```

## Things That Bite You

1. **PersonaContext is dead** — killed in Phase 2. Never re-introduce it. Some residual references may remain; ignore them.

2. **Timesheet API only saves UUID-format person IDs** — Graph node IDs like `person-nikola` silently skip the API (`/^[0-9a-f-]{36}$/` check). localStorage fallback covers this gap.

3. **"YOU" badge in graph shows for all orgs when viewing as Admin** — this is correct, not a bug.

4. **`cachedApprovalParties` was removed** — it was a module-level cache that caused staleness. Always read fresh from sessionStorage.

5. **Name directory + approval directory in sessionStorage** — populated when Graph tab is visited OR via `WorkGraphContext` hydration from DB fallback. Don't assume they're always set.

6. **Demo seed data stripped when authenticated** — `user-sarah`, `user-mike`, etc. are stripped on login. Never mix demo IDs with real UUIDs.

7. **`isLocalOnlyProjectId()` vs `isUuid()`** — `proj_*` TEXT IDs are cloud-backed. Never use `isUuid()` as the "use Supabase" gate. Use `!isLocalOnlyProjectId(id)`.

8. **`mapSupabaseProjectRow()` must include `graph` and `parties`** — if these fields are dropped, the graph canvas is empty on load. Always verify the mapper when touching `projects-api.ts`.

9. **Supabase `.update().eq()` returns `error: null` on 0-row matches** — it does NOT error when no rows were updated. Always use `.select('id')` and check `updatedRows.length > 0` to detect 0-row updates.

10. **sessionStorage approval directory falls back to localStorage** — `readSessionJson()` in `approvals-supabase.ts` uses this fallback so approval chain survives refresh. Don't break this pattern.

11. **Edge functions not deployed** — `SUPABASE_ACCESS_TOKEN` missing. All `getProject`, `createProject`, `listProjects` calls use the direct Supabase JS client path. Edge function routes exist but are unused in dev.
