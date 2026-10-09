# Agent Onboarding — read this FIRST (Grok, Codex, or any new agent)

You are joining a multi-agent project. Nikola is the founder/operator. Claude is
the lead architect + reviewer. Codex has been the implementation workforce.
Read this whole file before touching anything.

## 0. Canonical workspace — do not get this wrong
- The ONLY source of truth is this repository on branch **`codex/c3-trust-revenue`**
  (being merged toward `main`). Work from the latest pushed commit.
- IGNORE any older "Google Drive" checkout — it has stale April docs and damaged
  git metadata. Implementing against it corrupts reality.
- Supabase project ref: `gcdtimasyknakdojiufl` (Frankfurt). Migrations are applied
  to this live DB. Your local `supabase/migrations/` files MUST match what's applied.

## 1. Read these, in order, before proposing anything
1. `CLAUDE.md` — architecture, file ownership, "things that bite you"
2. `src/docs/PRODUCT_STRATEGY_DECISION.md` — the GO decision, thesis, kill criteria (canonical)
3. `src/docs/AGENT_WORKLOG.md` — append-only history; the last ~15 entries are current reality
4. `src/docs/TASK_BACKLOG.md` — task cards; pick the top `[READY]`
5. Specs: `IDENTITY_AUTHORITY_MODEL.md`, `GRAPH_CONFIDENTIALITY_SPEC.md`,
   `TRUST_CORE_REVIEW_2026-07-15.md`, `MONTHLY_APPROVAL_WORKBENCH_SPEC.md`

## 2. Where the project actually is (as of 2026-07-20)
DONE + verified: the money loop (project→timesheet→approval→invoice) runs on real
accounts; C3 (real cross-company approver linking, migration 029); trust findings
F-2/F-3/F-4 closed (030); M2 server-side scoped graph wired into real UI reads;
graph-write authority (C3a) server-enforced; landing/pricing repositioned honestly.

BLOCKED ON HUMAN INPUT (do NOT fabricate): Rodman's real billing rate; James's real
email + James personally accepting/approving G2's layer. These finish the real proof.

NOT a code problem: recruiting 3 paying pilot agencies. That is the real green light.

## 3. The non-negotiable discipline rules (this project broke repeatedly without them)
- **Commit small and often.** Never leave a large uncommitted pile — another agent
  (or a crash) loses it. The worst bugs this project hit came from giant uncommitted diffs.
- **`npm run build` must pass** before you mark anything done. (It is allowed here —
  if your own instructions forbid builds, say so and let a build-capable agent gate it.)
- **Do not edit a file another agent is actively editing.** Coordinate. Two agents on
  one file = corruption. If you must, check `git status` first and keep changes isolated.
- **File ownership (from CLAUDE.md):** `approvals-supabase.ts`, `timesheets-api.ts`,
  and the Claude-owned docs are review-gated. Everything else under `src/` is fair game
  but Claude reviews output.
- **Migrations: never `supabase db push`.** Draft the SQL; it is applied deliberately.
  Keep migration files in sync with the live DB.
- **Claude has GO/NO-GO gate authority.** No phase advances without review.

## 4. Gotchas that will waste your day (see CLAUDE.md "Things That Bite You")
- `.update().eq()` silently succeeds on 0 rows → use `.select('id')` and check length,
  or `.maybeSingle()` + null check (the "Cannot coerce" error = RLS blocked, 0 rows).
- Never gate "use Supabase?" on `isUuid()` — use `!isLocalOnlyProjectId(id)`.
- `mapSupabaseProjectRow()` must include `graph` + `parties` or the canvas is empty.
- Graph writes now route through the scoped Edge Function (028) and require a COMPLETE
  `graph + parties` snapshot — partial `{graph}` payloads are rejected.
- Deploy the edge function as slug **`make-server-f8b491be`**, never `server`.
- Supabase free tier auto-pauses after ~1 week → restore before debugging "broken" DB.

## 5. Next tasks (top of backlog)
1. **Close-Readiness Gate** — one screen: missing hours / pending approver / missing
   rate / missing PO → "invoice-ready ✅". The coordinator's daily cockpit.
2. **Regression tests** for the 3-account chain (financial + cross-tenant auth).
3. **eRačun via ONE approved Croatian intermediary** — own the approval→compliant-invoice
   handoff; do NOT rebuild the whole compliance stack or claim certification.

## 6. Never do
- Never reintroduce `PersonaContext` (dead since Phase 2).
- Never invent rates, impersonate a counterparty, or send a real external invoice/invite
  without the human confirming the recipient.
- Never add unsubstantiated compliance claims (SOC 2 / GDPR / eRačun certified) to the UI.
- Never return to the social-feed / marketplace vision — killed as a goal for 18 months.
