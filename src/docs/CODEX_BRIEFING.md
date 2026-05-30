# WorkGraph — Codex Agent Briefing

**Last updated: 2026-05-30**
**Read this file completely before writing a single line of code.**

---

## Project Path

```
C:\Users\nikol\Projects\HybridSocialApp-run
```

---

## What to Read First (in order)

1. `CLAUDE.md` (root) — project context, architecture, critical gotchas
2. `src/docs/TASK_BACKLOG.md` — pick the top `[READY]` task in tier order; do not skip tiers
3. `src/docs/AGENT_WORKLOG.md` — what changed last session, residual risks
4. The spec file referenced in the task card you picked (in `src/docs/specs/`)

Do not start coding until you have read all four.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Routing | React Router (data mode, RouterProvider) |
| State | React Context (AuthContext, TimesheetDataContext, WorkGraphContext, NotificationContext) |
| Backend | Supabase Edge Functions (Hono framework, Deno runtime) — NOT YET DEPLOYED |
| Database | Supabase Postgres — Frankfurt, project `gcdtimasyknakdojiufl` |
| Auth | Supabase Auth (email/password), wired via `src/contexts/AuthContext.tsx` |

---

## Current Sprint Status

### Completed (all done, do not redo)

- **Tier 0 — Security**: S1 (approval_records RLS fix, migration 014 applied), S2 (HMAC token signing moved server-side)
- **Tier 1 — Dead code purge**: D1 (dead timesheet views), D2 (dead approval APIs), D3 (local-only project mode)
- Migrations 012, 013, 014 applied. Supabase CLI linked. `APPROVAL_TOKEN_SECRET` set in Supabase secrets.

### Pending (pick from top of backlog)

**Tier 2 — Sprint A (Approvals UX)** — pick these next, in order:
- `A1` — submit-timesheet-project-picker (modal when 2+ projects)
- `A2` — approval-queue-chain-visualization (mini chain in queue rows)
- `A3` — approval-queue-ux-polish (headers, org name, chips, empty state)

**Tier 3 — Sprint B (Graph + Permissions)** — after Sprint A:
- `B1` — project-creation-wizard-redesign (remove currency/region from Step 1)
- `B2` — graph-empty-state-investigation (read-only investigation, no code without Claude sign-off)
- `B3` — server-side-role-enforcement (PUT/DELETE 403 enforcement in edge functions)

**Tier 4 — Sprint C (Invitation Flow)**:
- `C1` — invitation-acceptance-ui

**Phase 4 — Invoice Generation** — deprioritized until Sprint A–C done:
- P4-1 through P4-4 (invoice orchestrator, list view, PDF, migration 010)

**Pending manual step**:
- `M4` — migration `015_purge_dead_legacy_tables.sql` — Nikola applies in SQL Editor, marked `[READY]`

---

## Rules Codex Must Follow

### File ownership — never touch these without explicit clearance

| File | Owner | Rule |
|---|---|---|
| `CLAUDE.md` | Claude | Never touched by Codex |
| `src/docs/OPERATIONS.md` | Claude | Never touched by Codex |
| `src/docs/ROADMAP.md` | Claude | Never touched by Codex |
| `src/docs/TASK_BACKLOG.md` | Claude writes, Codex updates status | Status updates only; no structural edits |
| `src/docs/AGENT_WORKLOG.md` | All agents append | Append only — never edit prior entries |
| `src/utils/api/approvals-supabase.ts` | Claude | Read-only unless task gives explicit clearance |
| `src/utils/api/timesheets-api.ts` | Claude | Same |
| All other `src/` files | Codex | Claude reviews output |
| `supabase/migrations/` | Codex drafts, Nikola applies | Never `supabase db push` — SQL Editor only |

### Build gate

Run `npm run build` before marking any task `[REVIEW]` or `[DONE]`. Zero TypeScript errors required. Circular chunk warnings are OK.

### Worklog rule

Append an entry to `src/docs/AGENT_WORKLOG.md` after every completed task. Format:
```
## YYYY-MM-DD — [DONE/IN PROGRESS] task-name (Codex)
- Bullet of what changed
- Residual risks
```
Never edit prior entries.

### Migrations

Never run `supabase db push`. Write the SQL file in `supabase/migrations/` and note in the worklog that Nikola must apply it via SQL Editor.

### No new `any` casts without a comment explaining why.

---

## Key Architecture Gotchas (read these before touching any data path)

### 1. Project ID discrimination — CRITICAL

```
isLocalOnlyProjectId(id)  → true only for `proj_local_*`  (dead, being removed)
proj_1776…  TEXT IDs without `_local_`  → cloud-backed → use Supabase
UUID format  → also cloud-backed
```

**The Supabase gate is `!isLocalOnlyProjectId(id)`, NOT `isUuid(id)`.**
Using `isUuid()` as the gate wrongly excludes TEXT IDs like `proj_1776…` and breaks cloud persistence.

### 2. Project mapper must include `graph` + `parties`

`mapSupabaseProjectRow()` in `src/utils/api/projects-api.ts` MUST return both `graph` and `parties` fields.
Dropping either causes an empty graph canvas on load. Verify the mapper whenever you add DB columns.

### 3. Graph directories live in sessionStorage — not always present

`WorkGraphContext` hydrates name/approval directories from sessionStorage or DB on demand. Do not assume these are set. Never assume the Graph tab has been visited before Timesheets or Approvals.

### 4. `cachedApprovalParties` was removed

Module-level approval party cache caused staleness. Always read fresh from sessionStorage. Do not re-introduce module-level caches for approval data.

### 5. Supabase `.update().eq()` silently succeeds on 0-row matches

Always append `.select('id')` and check `updatedRows.length > 0` to confirm the row existed.

### 6. buildViewerOptions() produces these viewer roles

`admin`, `client`, `agency`, `company`, `freelancer` — NOT `person`. People in the name directory have `orgId` set; org nodes do not.

### 7. PersonaContext is dead

Killed in Phase 2. Never re-introduce it. Real auth identity via `AuthContext` is the operating model.

### 8. Demo seed users never mix with real UUIDs

`user-sarah`, `user-james`, etc. are stripped on login. Do not reference them in new code paths.

---

## How to Run the Build (Windows PowerShell)

```powershell
cd C:\Users\nikol\Projects\HybridSocialApp-run
npm run build
```

Other commands:
```powershell
npm run dev          # Vite dev server (port 5173)
npm run edge:serve   # Supabase edge functions locally (requires SUPABASE_ACCESS_TOKEN in env)
npm run dev:all      # Both via concurrently
```

Build must pass (zero errors) before any task is marked `[REVIEW]`.

---

## Key Directories

```
src/contexts/              AuthContext, TimesheetDataContext, WorkGraphContext, NotificationContext
src/components/workgraph/  WorkGraphBuilder, graph-visibility, auto-generate, ProjectCreateWizard
src/components/timesheets/ ProjectTimesheetsView (ONLY live timesheet UI)
src/components/approvals/  ApprovalsWorkbench, ProjectApprovalsTab, SubmissionsView, ApprovalTimeline
src/components/invoices/   InvoicesWorkspace (Phase 4 — not yet built out)
src/components/dashboard/  DashboardPage (role-based onboarding launchpad added 2026-05-30)
src/utils/api/             projects-api.ts, approvals-supabase.ts, timesheets-api.ts
supabase/functions/server/ Edge function APIs (NOT deployed — direct Supabase JS client used in frontend)
supabase/migrations/       SQL migrations 005–015
src/docs/                  OPERATIONS.md, ROADMAP.md, TASK_BACKLOG.md, AGENT_WORKLOG.md, specs/
```

---

## Supabase Project

- **Project ID**: `gcdtimasyknakdojiufl`
- **Region**: Frankfurt (eu-central-1)
- **CLI**: Supabase CLI v2.102.0 installed globally, linked to project
- **Secrets set**: `APPROVAL_TOKEN_SECRET` in Edge Function secrets
- **Edge functions**: NOT yet deployed — all data access goes through Supabase JS client directly

---

## Approval Chain Architecture (brief)

- `buildApprovalPartyRoute()` resolves the multi-party route from sessionStorage/DB
- `createNextApprovalLayerIfNeeded()` spawns the next `approval_records` row after each approval
- Self-approval guard: DB trigger in migration 012 enforces server-side
- Approver resolved to `wg_project_members.user_id` UUID, stored in `currentApproverUserRef`
- ReBAC model: permissions derived from graph relationships, not role tables

---

*End of Codex Briefing — last updated 2026-05-30*
