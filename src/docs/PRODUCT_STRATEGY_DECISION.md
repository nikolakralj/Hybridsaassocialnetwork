# WorkGraph Product Strategy Decision

**Author:** Claude (Lead Architect) — independent audit per `CLAUDE_PRODUCT_STRATEGY_BRIEF.md`
**Date:** 2026-07-15
**Inputs read:** CLAUDE.md, ROADMAP.md, TASK_BACKLOG.md, AGENT_WORKLOG.md (full),
BULLHORN_LESSONS_STRATEGY.md, G2_INTIME_BENCHMARK.md, C2_COMPANY_MEMBERSHIP_SPEC.md,
GRAPH_CONFIDENTIALITY_SPEC.md, live DB state (migrations 001–021 applied), the
invitation/membership/timesheet/approval/rate/invoice implementation as of today.

---

## 1. Recommendation: **GO** — narrowed thesis, agent-ready architecture, staged agent surface

Not PIVOT: the trust-boundary pay-and-bill direction the last two weeks converged on
is the right wedge; what must change is discipline, not direction. Not STOP: the
product closes a loop competitors structurally cannot close, timing (mandatory
e-invoicing, agent wave) is favorable, and burn is ~zero.

**On the central question** (human SaaS vs agent operating layer): it is a false
dichotomy, and the order matters.

- An "agentic staffing platform" without deterministic rails is a chatbot demo.
  The brief's own guardrails forbid it, correctly.
- The rails without agents are sellable TODAY to a coordinator drowning in chasing.
- Therefore: **the deterministic trust layer IS the agent play.** An org-scoped agent
  can only exist on a substrate that knows, machine-checkably, what each principal
  may see and do. That substrate is exactly the "boring" work in flight (C2,
  roster, signatory scoping, private-rate ACLs, audit trail). Bullhorn/InTime
  cannot host counterparty agents at all — their architecture gives the recruiter's
  org God-view. WorkGraph's boundary model is the only shape where *each company*
  can safely deploy an agent. That is the ambitious story, and the prerequisite
  for it is the unglamorous work already scheduled.

Agents become product surface only after pilot evidence (see §11 Phase A), and the
first agent has zero authority: it detects, chases, prepares, drafts. Humans and
policies decide.

## 2. One-sentence thesis

> WorkGraph closes multi-party contractor work from time to approved, compliant
> invoice while every company in the chain keeps its rates, contracts, people, and
> margins inside its own trust boundary — a boundary strict enough that soon each
> company can let a scoped agent run the chase-approve-bill loop for it.

## 3. First customer, buyer, operator, beneficiary

- **First customer:** small staffing / consulting / dev-shop agency, 5–50
  contractors placed, EU (Croatia first for eRačun urgency; UK-style boutiques like
  G2 as the reference workflow).
- **Buyer:** agency owner / operations director.
- **Operator (feels the pain weekly, named role):** the back-office / operations
  coordinator — the person who, every Friday and every month-end, chases missing
  timesheets, nags client managers to approve, reconciles rates and POs, and
  assembles invoices.
- **Beneficiaries:** contractors (paid faster, one portal), client managers (clean
  approval queue), agency finance (correct invoices, audit trail).
- **Customer zero:** Nikola's own contracting chain — he lives this workflow as a
  G2 contractor and can run a real monthly close in-product before any sale.

## 4. Job completed and measurable paid outcome

**Job completed (not assisted): the month-end close for contractor work.**
Every placement's time collected → approved through the right chain → one correct,
consolidated, compliant invoice per counterparty — with the coordinator acting only
at decision gates, never as messenger.

**Measurable within 30 days of onboarding:**
- Days from month-end to all invoices issued: typical 5–10 → **≤ 2**
- % of weeks approved within 3 days of submission
- Chase messages written by the coordinator: → **~0** (system nags instead)
- Invoice corrections/reissues: → **0** (rates/PO validated pre-issue)

That is worth €99–299/mo per agency (coordinator day/week + faster cash);
contractors and client approvers are always free seats — they are the network.

## 5. Primary workflow, trigger → completed outcome

> **Trigger:** Friday 17:00, week W closes.
> 1. System (later: org agent) detects placements with missing/short time → nudges
>    each contractor; coordinator sees a "missing timesheets" board, not an inbox.
> 2. Contractor submits week (or month) → approval chain fires: internal company
>    approval first where configured (C2), then agency/client layers — each
>    approver sees exactly the hours/context they are entitled to, never pay rates
>    or margins that aren't theirs.
> 3. Rejections return to draft with reason; resubmission re-enters the chain.
> 4. Expenses follow the identical chain as peer subjects (P4-9).
> 5. Month-end: coordinator opens Invoices → readiness check (rates set, PO
>    present, all weeks approved) → **Generate** → one consolidated invoice per
>    organization, per-person lines, VAT/OIB/IBAN complete → PDF (later eRačun
>    XML) → issue → payment/remittance status tracked.
> **Completed outcome:** every approved hour and expense of the month is on a
> correct issued invoice, with an audit trail of who approved what — and nobody
> chased anybody by email.

## 6. Deterministic controls vs AI-agent responsibilities

**Deterministic (SQL/RLS/trigger/code — never AI):** identity & membership
verification, roster exposure, all visibility boundaries (020/021 ACLs), approval
chain routing & self-approval guards (012/019), invoice math/VAT/numbering,
e-invoice XML, payment state, immutable audit log.

**AI-agent (org-scoped, zero authority, human/policy gates):** missing-time
detection & drafted chases, approval-readiness checks (missing rate/PO/contract),
contract → rate extraction into a review form (P4-5), expense receipt
classification, hours-vs-contract anomaly flags, supply-chain drafting from a
prompt (Phase 7).

**An agent never receives:** another org's rates, margins, private contracts or
documents, coworker pay, or directory entries beyond the project roster — an agent
is a principal under the same signatory/roster scopes as its org's humans, and its
actions land in the same audit log.

## 7. Defensibility and the strongest counterargument

**Defensible because:** (a) InTime/Bullhorn are single-tenant recruiter-owned
systems — counterparties are portal guests; making every org a first-class tenant
with private boundaries is a rebuild AND a business-model conflict for them;
(b) accounting tools have no approval chains; (c) Deel serves enterprise EOR, not
10-person boutiques with sub-vendor chains; (d) compliance (eRačun/EN16931) is a
moat labs and horizontal agent startups won't build per-vertical; (e) once two+
orgs run their monthly close through the same graph, switching costs both sides.
The real competitor is **Excel + email inertia** — beaten by concierge onboarding
and the e-invoicing deadline, not by features.

**Strongest counterargument (accepted, shapes the plan):** *"A plain agency-side
portal (modern InTime clone) reaches revenue faster; the multi-party graph is
over-engineering until proven."* Response: the graph engine is already built and
already earns its keep as the confidentiality model (the 2026-07-14 rate-leak fix
was only expressible as a graph rule). But the counterargument wins on SURFACE:
daily UX must be placement lists, queues, dashboards — the canvas is setup and
explanation, never the pitch. And the kill criteria below include the honest
fallback: if counterparties won't activate, degrade to single-org mode and compete
as the modern InTime.

## 8. Roadmap kill / defer / keep

| Item | Verdict | Reason |
|---|---|---|
| Social feed, posts, Feed nav (Phase 9 surface) | **KILL as goal** (keep flag off) | Pre-PMF distraction; profiles return only as C2 identity claims |
| Matchmaker / talent marketplace (Phase 9) | **KILL for 18 months** | Needs density that doesn't exist; guardrail agrees |
| "1M users" framing | **KILL** | Wrong metric; north star = orgs closing their month + invoiced volume |
| ROADMAP "KV-store only / no SQL tables" constraint | **KILL (stale)** | Reality is Postgres + RLS through migration 021; roadmap corrected |
| Graph-versions API + `useGraphPersistence` UUID gate | **KILL (dead code)** | Unreachable for TEXT projects; delete or rebuild much later |
| Real-time collab, mobile apps, public API (Ph. 11) | **DEFER post-PMF** | Unchanged |
| Enterprise SSO/SOC2/white-label (Ph. 12) | **DEFER post-PMF** | Unchanged |
| Stripe money movement (Ph. 8) | **DEFER** until invoices flow monthly | Payment *status* tracking suffices for pilots |
| Analytics/reporting (Ph. 10) | **DEFER**, except missing-timesheets board | That one board is the coordinator's daily screen (G2-2) |
| P4-10/11/12/13 placement profile/reports/remittance | **KEEP, after M3** | Right direction (InTime benchmark), not before the close-kit |
| C2 membership + roster + identity mapping | **KEEP — top priority (M1)** | The sellable trust model; C1 alone is token acceptance |
| Server-side boundary (020/021 wiring, DOC-1) | **KEEP — M2** | Client-side masks are demo-grade; pilots need server truth |
| P4-3 PDF, P4-9 expenses, consolidated invoices | **KEEP — M3 (close kit)** | What a coordinator needs for one real month-end |
| P4-5 extraction, P4-6 overtime, P4-7 engagement type | **KEEP, post-M3** | Valuable, not blocking first close |
| eRačun EN16931 XML export | **KEEP — first post-M3 feature** | The Croatian door-opener |
| Supply Chain Assistant (Ph. 7) → **Phase A org agent** | **RESHAPE** | See §11 — after pilot evidence, chaser-first, zero authority |

## 9. 90-day validation plan

- **Weeks 1–3 — finish the floor (M1+M2).** No new surface. Identity chain +
  server boundary complete; adversarial two-account test passes; Supabase Pro the
  day a pilot starts.
- **Weeks 3–6 — customer zero + discovery.** Nikola closes his own real month in
  WorkGraph end-to-end. In parallel: 10 discovery interviews (Croatian dev/design
  shops, staffing boutiques, 2–3 knjigovođe/accountants as channel partners).
  Script: "walk me through your last month-end close" — count hours and chases.
- **Weeks 6–12 — 3 concierge pilots.** Nikola personally onboards each (builds
  their graph, imports their people, configures chains). Each pilot runs ONE full
  monthly close. Measure §4 metrics before/after. End of each close: the pay
  question — "€149/mo to keep this running next month?"
- **Day 90 — apply kill criteria.**

## 10. Kill criteria (explicit)

1. **< 3 pilots complete a full monthly close by day 90** → stop or pivot.
2. **< 30% of invited counterparties activate** during pilots → pivot to
   single-org mode (modern-InTime agency tool; graph becomes internal model only).
3. **No pilot converts to payment or signed LOI ≥ €100/mo** after a successful
   close → stop; the pain isn't purchase-grade.
4. **A pilot finds any cross-org data leak** → sales freeze until root-caused;
   two such incidents → the trust thesis is failing in our hands → stop.
5. **Customer zero (Nikola) can't run his own month in it by week 6** → the
   product isn't real yet; no external pilots until it is.

## 11. Next three implementation milestones — nothing else

- **M1 — Identity chain complete (C2 minimum).** Invite → accept → verified org
  membership → project roster → graph person mapping → correctly scoped workspace.
  *Exit test:* a real second account submits time, it is approved through the
  chain, and appears on a consolidated invoice — no persona switcher, no SQL
  repair, no "Graph identity not mapped".
- **M2 — Trust boundary is server truth.** Rates/contracts/invoices read through
  019–021 ACL paths; client masks become presentation only; export/print paths
  leak-checked; repeatable adversarial checklist committed to the repo.
  *Exit test:* hostile second account + DevTools finds nothing it shouldn't see.
- **M3 — Month-end close kit.** Missing-timesheets board (G2-2), expenses through
  the chain (P4-9), invoice PDF (P4-3), consolidated invoice polish, readiness
  warnings (missing rate/PO).
  *Exit test:* customer zero closes a real month; 3 external pilots scheduled.

**Phase A (post-M3, evidence-gated): the Chaser.** First org-scoped agent: detects
missing time and stalled approvals, drafts the nudges, produces the readiness
report, prepares the invoice run for one-click human issue. No approvals, no
issuing, no money, full audit. This is the credible first step toward the brief's
agentic operating layer — earned, not assumed.

---

*Standard of review applied: no feature earns effort before M1–M3; a smaller
credible product beats a large imaginative platform; the goal is evidence, not
encouragement.*
