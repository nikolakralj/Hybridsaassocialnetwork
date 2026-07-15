# Claude Product Strategy Audit Brief

**Owner:** Claude
**Requested by:** Nikola
**Date:** 2026-07-15
**Status:** Ready for independent review

## Assignment

Perform a critical product and roadmap audit of WorkGraph before more product
features are built.

Do not assume that the current roadmap is correct. Do not produce a broad list of
possible features. Decide whether WorkGraph has a credible, differentiated
product thesis, identify what must be stopped, and define the smallest path to
evidence from real customers.

The central question is:

> Should WorkGraph remain a human-operated staffing SaaS, or become a
> trust-aware operating layer where organization-scoped AI agents perform the
> repetitive work required to move a placement from time to approval to invoice?

## Read Before Deciding

Read the actual documents and relevant implementation. Do not rely only on agent
summaries.

1. `CLAUDE.md`
2. `src/docs/README.md`
3. `src/docs/ROADMAP.md`
4. `src/docs/TASK_BACKLOG.md`
5. Latest entries in `src/docs/AGENT_WORKLOG.md`
6. `src/docs/specs/BULLHORN_LESSONS_STRATEGY.md`
7. `src/docs/specs/G2_INTIME_BENCHMARK.md`
8. `src/docs/specs/C2_COMPANY_MEMBERSHIP_SPEC.md`
9. `src/docs/specs/GRAPH_CONFIDENTIALITY_SPEC.md`
10. The current invitation, membership, timesheet, approval, contract, rate, and
    invoice implementation

Reconcile contradictions between older roadmap assumptions and the current code.
In particular, the roadmap still contains architecture and sequencing statements
that predate the signatory-scoped tables, private rates, and recent invitation
work.

## Current Reality To Verify

- The tested project invitation can be accepted by a real second account.
- The accepted user becomes a project Contributor but has no organization
  membership, project-roster assignment, or graph person identity.
- The workspace therefore shows `Graph identity not mapped` and hides the graph.
- Email delivery is development-only unless `RESEND_API_KEY`, a verified sender,
  and a public application URL are configured.
- C2 schema foundations exist, but the company membership and project roster UI
  are not complete.
- Sensitive rates, contracts, and invoice reads have begun moving out of shared
  graph JSON, but the complete production boundary must be verified.
- The codebase contains several partially completed product directions. Shipping
  more surface area before selecting a wedge increases execution risk.

## Candidate Thesis To Challenge

The strongest current candidate is:

> WorkGraph closes multi-party contractor work from time to invoice while each
> company keeps its private rates, contracts, employee data, and margins inside
> its own trust boundary.

The possible agentic version is:

> Each organization has a constrained operational agent. It can detect missing
> time, request evidence, validate readiness, chase the current blocker, prepare
> approvals, and assemble invoice-ready work. Agents exchange permitted proofs,
> not private contracts or rates. Humans retain authority over employment,
> contracts, approvals, invoices, and money movement.

Do not accept this language because it sounds differentiated. Test whether it is
valuable, technically coherent, commercially narrow enough, and defensible.

## Required Decisions

Answer these directly:

1. Who is the first paying customer and which named person inside that company
   feels the pain every week?
2. What job does WorkGraph complete for that person, rather than merely helping
   them perform it?
3. What measurable outcome justifies payment within 30 days?
4. Why is the multi-party trust graph necessary? If the product can be built as a
   conventional workflow table, say so.
5. Which parts require deterministic software, and which variable tasks genuinely
   benefit from an AI agent?
6. What information must each organization-scoped agent never receive?
7. Can Bullhorn, RSM InTime, Salesforce, ServiceNow, or an accounting platform
   copy the wedge easily?
8. What are the five most likely reasons this company fails within 18 months?
9. What evidence would disprove each failure hypothesis?
10. Which existing roadmap items should be deleted, deferred, or preserved?

## Product Guardrails

- Do not recommend a generic chatbot.
- Do not treat public profiles or a talent marketplace as an early growth hack.
- Do not let an AI model authorize contracts, approve its own work, expose private
  commercial data, issue final invoices, or move money without an explicit human
  or deterministic policy gate.
- Do not use AI where a rule, constraint, trigger, or SQL policy is more reliable.
- Do not call invitations complete until company membership, roster placement,
  identity mapping, delivery, and understandable first-login onboarding work.
- Do not call the product sellable until a real second-account scenario passes
  without persona switching or database repair.
- Preserve the security freeze: product strategy does not authorize new features
  before the trust boundary is sound.

## Required Deliverable

Create `src/docs/PRODUCT_STRATEGY_DECISION.md` containing:

1. `GO`, `PIVOT`, or `STOP` recommendation.
2. One-sentence product thesis.
3. First customer, buyer, operator, and beneficiary.
4. The job completed and measurable paid outcome.
5. One primary workflow, written from trigger to completed outcome.
6. Deterministic controls versus AI-agent responsibilities.
7. Defensibility argument and strongest counterargument.
8. Feature kill/defer/keep table for the existing roadmap.
9. A 90-day validation plan with customer interviews and a concierge test.
10. Explicit kill criteria that would cause Nikola to stop or pivot.
11. The next three implementation milestones only.

After writing the decision, update `ROADMAP.md` and `TASK_BACKLOG.md` only when
the recommendation is `GO` or `PIVOT`. Remove stale directions instead of adding
another parallel strategy. Do not implement product code during this audit.

## Standard Of Review

Be skeptical, specific, and commercially grounded. Avoid encouragement without
evidence. A smaller credible product is preferable to a large imaginative
platform. The goal is not to prove Nikola right; it is to prevent years of work
on a product customers will not buy.
