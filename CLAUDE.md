# CLAUDE.md — WorkGraph Project Context

**Last updated: 2026-07-08**

## What This Is
WorkGraph: graph-aware operational workflow for agencies/consulting firms.
Core loop: **project → timesheet → approval → invoice**
Multi-tenant supply chain: Global Corp → Agency → DevShop → Contractor

## Tech Stack
- **Frontend**: React SPA + Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Supabase Edge Functions (Hono framework, Deno runtime) — **NOT YET DEPLOYED**
- **Database**: Supabase Postgres (Frankfurt, project `gcdtimasyknakdojiufl`)
- **Auth**: Supabase Auth (email/password), wired via `src/contexts/AuthContext.tsx`

## Current Phase: Phase 4 — Invoice Money Loop

Tier 0 (Security) and Tier 1 (Dead Code Purge) are complete. **Phase 4 — invoice generation —
is now the active priority** (approved timesheet → invoice → cash). Sprint A approvals polish
(A2/A3) is deferred behind it. The social/network surface is gated off behind
`VITE_SHOW_SOCIAL_FEATURES` (see ROADMAP Phase 9) — this ships as WorkGraph, not a social app.

**⚖️ STRATEGY DECISION 2026-07-15 — `src/docs/PRODUCT_STRATEGY_DECISION.md` is canonical.**
Verdict: **GO, narrowed** — trust-aware pay-and-bill for multi-party staffing chains;
agent layer ("the Chaser") evidence-gated after M3. North star: orgs closing their
month in WorkGraph + invoiced volume. Social/marketplace killed as goals (18 mo).

**Priority order (STRICT — only these three milestones are authorized):**
1. **M1 — Identity chain complete (C2 minimum):** invite → accept → verified org
   membership → project roster → graph person mapping → scoped workspace.
   Exit: real second account runs submit → approve → invoice, no persona switching,
   no SQL repair, no "Graph identity not mapped". (Migrations 018–021 applied;
   UI + wiring incomplete.)
2. **M2 — Trust boundary is server truth:** reads through 019–021 ACL paths; client
   masks presentation-only; exports leak-checked; adversarial 2-account checklist.
3. **M3 — Month-end close kit:** missing-timesheets board, P4-9 expenses, P4-3 PDF,
   consolidated-invoice polish, readiness warnings. Exit: customer zero (Nikola's
   own chain) closes a real month end-to-end.

Deploy note (permanent): **always deploy `make-server-f8b491be`, NOT `server`** — via
shim `supabase/functions/make-server-f8b491be/index.ts`; a `server`-slug deploy is
unreachable (client URLs + internal Hono prefixes use the legacy slug).

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

### Git workflow — ALL agents (adopted 2026-10-09)
- Never commit directly to `codex/c3-trust-revenue` or `main`; they change only by merged PR.
- One task = one branch (`claude/…`, `codex/…`, `grok/…`/`cursor/…`) cut from latest
  `origin/codex/c3-trust-revenue`; one agent per folder (own clone or `git worktree`).
- Push → PR into `codex/c3-trust-revenue` with: what changed, how verified, assumptions,
  residual risks, worklog entry. Small PRs, one backlog item each.
- Claude reviews the diff → GO merges; changes requested → fix on the same PR.
- Migrations in a PR are drafts, applied only after merge. Full rules: `AGENT_ONBOARDING.md` §3a.

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

## Database State (as of 2026-07-08)

**ALL migrations 001–016 applied and verified.** Highlights:
- `010` — `wg_invoices`, `wg_invoice_templates` + project-scoped RLS (verified live 2026-07-08)
- `012` — `submitter_user_id` + DB-level self-approval trigger
- `014` — `approval_records` project-scoped RLS (replaced wide-open policies)
- `015` — legacy pre-`wg_` tables purged
- `016` — `wg_project_members` RLS recursion fix (SECURITY DEFINER `wg_user_can_read_project_member`)

**Nothing pending in SQL Editor.**

**Note on 011 filename collision:** `011_approval_snapshot.sql` and `011_fix_rls_recursion.sql` both exist. Only `011_fix_rls_recursion.sql` matters — it replaces recursive policies. Do not re-apply `011_approval_snapshot.sql` if already done.

**⚠️ Free-tier auto-pause:** Supabase pauses the project after ~1 week of inactivity
(status `INACTIVE`, all queries time out). Restore from the dashboard or via MCP
`restore_project` before debugging "broken" DB access.

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
supabase/functions/server/ # Edge function APIs (STALE build deployed — fresh deploy pending; new code uses direct Supabase JS client)
supabase/migrations/       # SQL migrations 001–016 (all applied)
src/docs/                  # OPERATIONS.md, ROADMAP.md, TASK_BACKLOG.md, AGENT_WORKLOG.md, specs/
```

## Known Security Issues (track resolution here)

| Issue | Severity | Status | Fix |
|---|---|---|---|
| `approval_records` RLS wide open (`USING (true)`) | CRITICAL | ✅ RESOLVED — 014 applied + verified | — |
| HMAC secret hardcoded in client bundle (`approval-tokens.ts`) | HIGH | ✅ RESOLVED — S2 done; `APPROVAL_TOKEN_SECRET` in edge secrets; takes full effect on deploy | — |
| Self-approval guard is client-side only | MEDIUM | ✅ RESOLVED — 012 trigger live | — |
| **Stale edge build deployed** (`make-server-f8b491be`) | HIGH | ✅ RESOLVED — fresh build live 2026-07-14 (B3 guards, approval tokens, invitations API) | — |
| `wg_invoices` SELECT RLS: any accepted project member reads all project invoices | MEDIUM | Open — fine under single-account personas; fix before real worker accounts | DOC-1: signatory-org scoping (needs C1 org membership) |

## Things That Bite You

1. **Supabase `.update().eq()` silently succeeds on 0-row matches** — use `.select('id')` and check `updatedRows.length > 0`.

2. **`mapSupabaseProjectRow()` must include `graph` + `parties`** — dropping either = empty canvas.

3. **Never use `isUuid()` as the Supabase gate** — use `!isLocalOnlyProjectId(id)`.

4. **Name/approval directories in sessionStorage** — not always set. `WorkGraphContext` hydrates from DB if missing. Don't assume.

5. **Demo seed data stripped on login** — `user-sarah`, `user-james`, etc. never mix with real UUIDs.

6. **`cachedApprovalParties` is removed** — module-level cache caused staleness. Always read fresh from sessionStorage.

7. **PersonaContext is dead** — killed in Phase 2. Never re-introduce it.

8. **`approval_records` RLS not yet fixed** — migration 014 pending apply. Until then, any authenticated user can read all approval records.
