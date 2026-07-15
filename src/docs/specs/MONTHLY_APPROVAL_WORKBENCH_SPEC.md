# Monthly Approval Workbench (exceptions-first)

**Status:** DECIDED — M3 scope. Build only after the trust-core review clears.
**Owner:** Claude (design ruling) → Codex (implementation)
**Date:** 2026-07-15
**Supersedes:** G2-2 `missing-timesheets-dashboard` (this is that board, grown up).
**Origin:** Nikola's 20-workers test ("easier to have a simple Excel table and click
approve") + Codex's monthly-matrix proposal, refined.

## The ruling that shapes everything

"The approver only cares whether the hours match" is half-true. **Each approval
layer answers a different question, therefore each layer gets a different summary
of the same underlying weekly records:**

| Layer | Question they answer | Their summary shows |
|---|---|---|
| Internal (Nikola, employer) | "Is this complete and plausible, and what does it cost me?" | All categories incl. pay-relevant (overtime ×1.5, travel policy), missing weeks, vs expected calendar |
| Upstream (G2, agency) | "Are these billable hours within our contract/PO?" | Billable totals + billable categories only; Rodman's pay-relevant internals collapsed; never pay rates |
| Finance (either org) | "Does the invoice equal the approved work?" | Approved totals → invoice lines reconciliation |

This is the privity rule expressed as UX — and the honest answer to "why not
Excel": a spreadsheet can show ONE view; it cannot show three truthful,
differently-masked views of the same records with per-week audit underneath.

## Default approver surface (per project)

One **card per worker per month** (not one row per week):

```
Rodman · June 2026                          168h          [Approve 3 clean weeks]
Regular 160h · Overtime 6h ⚠ · Travel 2h ⚠
4/5 weeks submitted · 2 exceptions

Week        Mon      Tue           Wed     Thu           Fri     Total
Jun 1–5     8        8             8       8             8       40h   ✓ clean
Jun 8–12    8        8 +2 OT ⚠     8       8 +1 Tr ⚠     8       43h   review
Jun 15–19   8        8             8       8             8       40h   ✓ clean
Jun 22–26   — missing week ⚠                                     [Nudge]
Jun 29–J3   8        8             8       8             8       40h   ✓ clean
```

- Day cell: total + category markers. Click day → read-only drill-down of the
  worker's entries (tasks, notes, billable flags). Approvers never edit.
- Exception weeks require explicit expand-and-decide; clean weeks batch.
- Missing week → "Nudge" action (today: notification; Phase A: the Chaser drafts it).
- The A2/A3 weekly queue remains for cross-project/mixed-subject use and audit
  drill-down. The big daily-entry modal remains investigation-only, never the
  approval path.

## What "Approve N clean weeks" actually does (accountability semantics)

- Batch approval approves the **underlying weekly approval_records for the
  caller's layer only** — one decision event, N records, each stamped with a
  shared `batch_id` in its snapshot. No monthly super-record exists or ever will.
- Button wording is always "Approve N weekly submissions" — the approver attests
  to specific weeks, not to "June".
- Reject/return always targets a single week (with reason); one reopened week
  never disturbs its batch siblings.
- Self-approval guards (012/019) apply per record exactly as today.

## Exceptions v1 (deterministic — no AI)

Flag a week/day when: missing week or missing workday vs baseline; hours >
expected (day or week); any overtime / travel / on-call category present; entries
outside placement start/end dates; resubmission after rejection. (Later:
edited-after-submit, overlapping ranges, billable inconsistencies.)

## Baseline v1 (deliberately tiny)

Two fields on the roster/placement row: `expected_weekly_hours` (default 40) and
`workdays` mask (default Mon–Fri). That is the whole "work calendar" for M3 —
no holiday engine, no overtime-rules engine. Holidays/policies come post-pilot.

## Rendering rules per layer

- Internal approver: full category breakdown; amounts only per org role.
- Upstream approver: billable hours/categories only; pay-side categories that
  don't change billing are collapsed into totals; **no "Rate masked" labels —
  fields an approver isn't entitled to simply do not render** (don't advertise
  what's hidden), and post-M2 they aren't even in the payload.
- Columns that are constant in context (project, organization inside one
  project's workbench) are shown once in the header, never per row.

## Non-goals

- No new timesheet data model (`TimeEntry` categories/multipliers already exist).
- No monthly approval record replacing weekly records.
- No auto-approval of anything, clean or not.
- No polishing of the current weekly table beyond what exists today.

## Exit test (ties to M3 / customer zero)

Nikola approves a simulated 20-worker month: clean workers in **≤ 2 clicks
each** (or one select-all-clean batch), exceptions individually decided, total
time **under 5 minutes**, and every resulting approval_record individually
auditable and reopenable. G2's view of the same month shows billable summaries
and nothing else.

## Phase A note

This surface is deliberately the Chaser's future workplace: the system already
computes clean batches, exceptions, and missing weeks; the agent later adds
drafted nudges and a prepared readiness report. Building this workbench IS
building the agent's operating table.
