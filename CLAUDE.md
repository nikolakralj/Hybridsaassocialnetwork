# CLAUDE.md — WorkGraph Project Context

## What This Is
WorkGraph: graph-aware operational workflow for agencies/consulting firms.
Core loop: **project → timesheet → approval → invoice**
Multi-tenant supply chain: Global Corp → Agency → DevShop → Contractor

## Tech Stack
- **Frontend**: React SPA + Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Supabase Edge Functions (Hono framework, Deno runtime)
- **Database**: Supabase Postgres (Frankfurt, project `gcdtimasyknakdojiufl`)
- **Auth**: Supabase Auth (email/password), wired via `src/contexts/AuthContext.tsx`

## Critical Architecture
- **Graph topology IS the permission model** (ReBAC — Relationship-Based Access Control)
- `WorkGraphBuilder.tsx` writes to sessionStorage: `workgraph-viewer-meta:${projectId}`, `workgraph-name-dir:${projectId}`, `workgraph-approval-dir:${projectId}`
- Other tabs (Timesheets, Approvals) read from sessionStorage — they depend on Graph tab being visited first
- `buildViewerOptions()` in `graph-visibility.ts` produces viewer types: `admin`, `client`, `agency`, `company`, `freelancer` — NOT `person`
- People in the name directory have `orgId` set; orgs do not

## Database State (as of March 25, 2026)
- **Live tables**: `kv_store_f8b491be` (legacy), `wg_projects`, `wg_project_members`, `wg_project_invitations`, `wg_contracts`, `wg_timesheet_weeks`, `approval_records`
- **Migration files exist but were run manually via SQL Editor** — do NOT use `supabase db push`
- Edge functions NOT yet deployed (SUPABASE_ACCESS_TOKEN missing on dev machine)

## Current Phase: Phase 3 (NO-GO for Phase 4)
See `src/docs/ROADMAP.md` for full roadmap. Phase 3 = Production Auth + Invites + Incremental Supply Chains.
Phase 3 gate blockers:
1. Viewer dropdown in Timesheets broken (type mismatch: checks `person` but data has `company`/`freelancer`)
2. Timesheet data lost on refresh (localStorage persistence added but needs verification)
3. Approval queue empty (approval_records table needs 007 migration run in Supabase)
4. Edge functions not deployed

## Multi-Agent Setup & Roles

### Claude (this agent) — Lead Architect, Researcher, Code Reviewer
- **Senior developer**: reviews and criticizes all Codex agent output before merge. Codex agents report progress to Claude for approval.
- **Researcher**: brings PhD-level depth to product strategy — finds non-obvious market gaps, academic patterns (graph theory, mechanism design, ReBAC formalization), and revolutionary ideas that redefine what WorkGraph can become.
- **Creative mind**: generates game-changing feature concepts that go beyond incremental improvement — thinks in terms of platform dynamics, network effects, and category creation.
- **Development**: when necessary, implements complex fixes and architectural changes directly. Owns the hardest cross-cutting work (auth wiring, approval chain logic, data persistence architecture).
- **Gate authority**: no Phase transition happens without Claude's honest GO/NO-GO assessment.

### Codex (OpenAI) — Implementation Workforce
- 6 specialized subagents via `.codex/agents/` — see `src/docs/CODEX_SUBAGENT_PLAYBOOK.md`
- Agents: backend-developer, frontend-developer, postgres-pro, api-designer, security-auditor, reviewer
- **Report to Claude**: progress updates, blockers, and completed work are reviewed by Claude before being declared done
- Work must pass `npm run build` and update `AGENT_WORKLOG.md`

### Antigravity — UI/UX Polish
- Wizard styling, component visual refinement
- Works from Figma designs when available

### Coordination
- **Sync doc**: `src/docs/AGENT_WORKLOG.md` — all agents read/write this
- **Conflict prevention**: disjoint file ownership per cycle (see CODEX_SUBAGENT_PLAYBOOK.md §4)

## File Ownership Rules
- Never edit files another agent is actively modifying in the same cycle
- Always update `AGENT_WORKLOG.md` after making changes
- Always run `npm run build` before declaring work done

## Commands
```bash
npm run dev          # Vite dev server
npm run edge:serve   # Supabase edge functions locally
npm run dev:all      # Both via concurrently
npm run build        # Production build check
```

## Key Directories
```
src/contexts/          # AuthContext, TimesheetDataContext, NotificationContext
src/components/workgraph/  # WorkGraphBuilder, graph-visibility, auto-generate
src/components/timesheets/ # ProjectTimesheetsView (main timesheet UI)
src/components/approvals/  # ApprovalsWorkbench, ProjectApprovalsTab
src/components/invoices/   # InvoicesWorkspace (Phase 4 scaffold)
src/utils/graph/           # approval-fallback.ts, auto-generate.ts
src/utils/api/             # timesheets-api.ts, timesheets-approval-hooks.ts
supabase/functions/server/ # Edge function APIs (projects, timesheets, contracts)
supabase/migrations/       # SQL migrations (005-007+)
src/docs/                  # ROADMAP, ARCHITECTURE, AGENT_WORKLOG, etc.
```

## Things That Bite You
1. `PersonaContext` was killed but some residual references may exist — never re-introduce it
2. Timesheet persist only saves UUID-format person IDs to API (`/^[0-9a-f-]{36}$/`). Graph node IDs like `person-nikola` silently skip. localStorage fallback covers this gap.
3. The "YOU" badge in the graph shows for all orgs when viewing as Admin — this is correct, not a bug
4. `cachedApprovalParties` was a module-level cache that caused staleness — it was removed, always read fresh from sessionStorage
5. The name directory and approval directory in sessionStorage are only populated when the Graph tab is visited
6. Demo seed data (`user-sarah`, `user-mike`, etc.) is stripped when authenticated — don't mix demo IDs with real data
