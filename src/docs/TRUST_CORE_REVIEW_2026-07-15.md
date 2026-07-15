# Trust-Core Review — Migrations 018–023

**Reviewer:** Claude (Lead Architect)
**Date:** 2026-07-15
**Scope:** All applied trust-core migrations (018 org membership/roster, 019
self-approval guard, 020 private rates + invoice ACL, 021 signatory contracts,
022 onboarding RPC, 023 routing repair) + live-DB verification + Supabase
security advisors. **App/server code diff NOT covered** (in active development
by Codex at review time — see "Deferred" below).

## Verdict

**APPROVED with fixes applied (migration 024) and three assigned follow-ups.**
The schema work is well above prototype grade: SECURITY DEFINER used correctly
(search_path pinned everywhere in 018–022), recursion-safe RLS helpers, strict
partial unique indexes, self-claim correctly powerless until admin verification,
row-locked atomic RPC, least-privilege worker onboarding, careful scoped data
repair in 023. Codex's trust instincts are sound.

## Findings

| # | Severity | Status | Finding |
|---|---|---|---|
| F-6 | **HIGH (live)** | ✅ fixed in 024 | Legacy views `v_contracts_with_orgs`, `v_periods_full` (from 001, supposedly dropped in 015) alive in prod as SECURITY DEFINER — bypassed ALL RLS for any authenticated PostgREST reader. Dropped; zero code references. |
| F-5 | **HIGH (latent)** | ✅ fixed in 024 | `wg_contract_signatories` INSERT allowed any authenticated user to attach a party-node signatory to ANY contract (`organization_id IS NULL` branch), granting their own org contract read access via 021's party branch. Now requires existing admin/finance access to the contract. |
| F-1 | MEDIUM (latent) | ✅ fixed in 024 | `wg_contract_rates` SELECT let the subject read rows of ANY scope; a bill-scope row with `subject_user_id` set would leak the bill rate (margin) to the worker. Subject self-read now scoped to `rate_scope='pay'`. |
| Hygiene | WARN | ✅ fixed in 024 | SECURITY DEFINER helpers + onboarding RPC executable by `anon`/PUBLIC via `/rest/v1/rpc/` (internally guarded, still wrong surface). Revoked; `authenticated` retained where RLS policies need it; trigger function revoked from all. |
| F-3 | MEDIUM | ⏳ **assigned: Codex** | 022 RPC: if the owner's graph identity points at a party already mapped to an org the caller does NOT own, the RPC renames that org and activates its mapping. Add guard: when `v_organization_id` resolves and `wg_organizations.owner_user_id` is neither NULL nor `v_actor` → raise. |
| F-2 | MEDIUM | ⏳ **assigned: Codex (M2)** | `wg_invoices` UPDATE policy permits editing issued/paid invoices (creator or from-party finance). Issued invoices must be immutable — corrections via credit note/cancel. Add status-transition trigger (draft→issued→paid/cancelled only; content frozen after issue). |
| F-4 | LOW | ⏳ backlog (C2/M1) | No person-level signatory branch: a worker cannot read their OWN employment contract via 021 (org roles exclude workers; spec says "worker sees own agreed terms"). Add `subject_user_id`-style branch or explicit person signatory. |
| Note | LOW | ⏳ M2 checklist | `wg_timesheet_weeks` cross-user UPDATE surface not conclusively verified (019 trigger guards self-approval; cross-user writes rely on RLS + edge route — verify with the adversarial two-account checklist). |
| Note | INFO | dashboard task (Nikola) | Auth hardening before pilots: enable leaked-password protection + add MFA options (Supabase dashboard toggles). Also delete the orphan `server` edge function. |

## Live-DB verification performed

- RLS enabled on every `wg_*` table ✓ (zero tables with RLS off)
- No bill-scope rate rows with `subject_user_id` (F-1 latent, never exploited) ✓
- No orphan signatory rows (F-5 latent, never exploited) ✓
- Trust-core data at review time: 1 organization, 1 roster row (Rodman), 0 rate
  rows — fixes landed before any real data existed.
- Supabase security advisors re-run after 024: expect F-6/0028-class lints
  cleared (verify on next advisor run).

## Deferred (explicitly NOT reviewed)

Codex's uncommitted app/server diff (timesheets/contracts/invoices edge
hardening, TimesheetDataContext routing, AuthContext cleanup, ~1,000 lines) was
in active development during this review. It gets its own line review before
commit. Nothing in this report blesses that code.

## Standing rule reaffirmed

Migrations 018–024 are now the trust boundary of record. Schema changes to
these tables/policies require a review entry in this file (append-only) before
apply.

---

## Addendum (same day): M2 scoped graph projection SHIPPED + adversarially verified

Migration **025** applied: `wg_project_roster.visibility_scope`
(company_only default | counterparty | named_chain) + `visible_org_node_ids`,
and **`wg_get_scoped_graph(project_id)`** — the Privity Rule computed server-side
(SECURITY DEFINER, search_path pinned, anon/PUBLIC revoked). Client wrapper:
`src/utils/api/scoped-graph-api.ts` (not yet wired into UI — M2-WIRE).

**Adversarial tests executed against live production data (JWT impersonation):**

| Caller | Scope | Result |
|---|---|---|
| Rodman (worker) | `company_only` (default) | 3 nodes; strings "G2"/"NAS" absent from entire payload; externalStages=2 ✅ spec scenario 8 |
| Rodman (worker) | `counterparty` | G2 façade appears (5 nodes); NAS absent; **zero rate fields anywhere in payload** (James's 8/hr stripped) ✅ scenario 9 |
| Nikola (owner + org_admin) | full topology | Sees all parties; **James's cross-org rate ABSENT from the owner's payload** — ownership ≠ commercial omniscience, now server-enforced ✅ |

Rodman's assignment set to `counterparty` (he genuinely works the G2 placement);
column default for future workers remains `company_only`.

**Remaining for M2 exit (M2-WIRE):** switch WorkGraphContext/Builder viewer loads
to `fetchScopedGraph()` (client filter becomes defense-in-depth), leak-check
export/print paths, then run the DevTools test (scenario 12) through the real UI.
