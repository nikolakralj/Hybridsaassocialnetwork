# WorkGraph: Product-First Roadmap

**Version 3.0 | March 20, 2026**
**Canonical roadmap for product, design, engineering, and AI agents**

---

## Table Of Contents

1. Executive Summary
2. Current State
3. Ideal First Customer
4. Product Principles
5. What We Are Deliberately Not Optimizing Yet
6. Revised Roadmap Overview
7. Phase 3: Production Auth, Invites, And Incremental Supply Chains
8. Phase 4: Invoice Generation From Approved Timesheets
9. Phase 5: CSV Import And PDF Export
10. Phase 6: Multi-Project Unified Dashboard
11. Phase 7: Supply Chain Assistant (AI Agent 1)
12. Phase 8: Stripe And Money Movement
13. Phase 9: Public Profiles And Matchmaker (AI Agent 2)
14. Phase 10: Analytics And Reporting
15. Phase 11: Collaboration, Mobile, And Public API
16. Phase 12: Enterprise Features
17. Success Metrics And Phase Gates
18. Implementation Constraints That Still Apply
19. Code Touchpoints By Phase
20. Migration Notes From The Old Roadmap

---

## 1. Executive Summary

The previous roadmap was technically ambitious but commercially upside down. It optimized for
future scale problems before fully solving the first user's day-to-day workflow.

This roadmap resets WorkGraph around one simple thesis:

**Win first with small staffing and consulting firms that manage contractors across client
approval chains, then expand outward.**

That means the near-term product is not:
- a social network for freelancers first
- an enterprise governance platform first
- a real-time collaborative graph editor first

It is:
- a graph-aware operational workflow for agencies and consulting firms
- built around the core loop of **project -> timesheet -> approval -> invoice**
- with invite-based expansion that naturally pulls contractors and clients into the platform

The most important consequence of this rewrite:

**Production auth, real invites, incremental supply-chain onboarding, and invoice generation now
come before collaboration, mobile, SSO, and other scale features.**

---

## 2. Current State

### What is already real

- Public landing page and onboarding flows
- Supabase Auth basics and session handling
- KV-backed CRUD APIs for projects, contracts, and timesheets
- A working graph model with:
  - connection-based DAG topology
  - ReBAC-style visibility rules
  - pure SVG rendering
  - graph generation from the project wizard
- A substantial timesheet and approvals UI foundation

### What is still missing for real customer adoption

- Production-grade invite and identity model
- A clean way to onboard an incomplete supply chain and add parties later
- Invoice generation at the end of the approval flow
- Import/export paths that reduce migration friction
- A unified cross-project view for the people actually doing the work
- Actual money movement

### The biggest product risk today

The app can model complexity, but it does not yet fully close the money loop for a real agency.

That is the wrong place to stall.

---

## 3. Ideal First Customer

### Primary ICP

**A small staffing or consulting company with 10-50 people**

Typical profile:
- places contractors into enterprise client engagements
- manages multiple active projects at once
- coordinates approvals both upward to clients and downward to contractors
- deals with rate opacity daily
- runs on spreadsheets, shared drives, and email threads

### Why this customer fits WorkGraph first

- They sit in the middle of the supply chain and feel both sides of the problem.
- They regularly manage different rates between client, agency, and contractor.
- They need the graph because the workflow is genuinely multi-party.
- They are small enough to adopt a focused new tool.
- They can invite both contractors and clients into the same workflow, creating organic expansion.

### Who should not be first

**Solo freelancers**

They usually have one client, one contract, and a much simpler workflow. They can survive with
time tracking plus invoicing tools.

**Large enterprises**

They already have heavy internal systems, procurement processes, and integration expectations.
They are not the right first proof point.

### Go-to-market motion

Land one agency or consulting firm, solve its timesheet-to-approval-to-invoice flow end-to-end,
and let the contractor and client invitations expand usage around that nucleus.

---

## 4. Product Principles

### 4.1 Reach the money moment fast

The most important user outcome is not "the graph looks correct." It is:

**approved work becomes billable work without friction**

### 4.2 Model real life incrementally

Real supply chains do not appear fully formed on day one. A team should be able to start with
an agency and a client, then add the contractor, subcontractor, or second agency later.

### 4.3 Reduce adoption friction before adding sophistication

CSV imports and PDF exports are boring, but they are often the difference between
"interesting demo" and "we can actually try this next week."

### 4.4 Replace testing crutches early

`PersonaContext` was the right tool to build the graph engine. It is the wrong foundation for
real customer onboarding. Real auth and real org identity need to become the default soon.

### 4.5 Build AI as workflow assistance, not as decoration

The first useful AI here is a configuration assistant that helps a user create a viable supply
chain. The social matching story only becomes useful after there is real supply and demand on
the network.

### 4.6 Defer scale features until usage proves the need

Real-time collaboration, mobile apps, SSO, SOC 2, and a public API are good ideas later.
They are bad ideas if they outrun product-market fit.

---

## 5. What We Are Deliberately Not Optimizing Yet

These are not "bad ideas." They are just not next.

- Real-time graph collaboration
- Presence indicators and multiplayer editing
- Mobile-first graph editing
- Public API surface area
- SSO, SOC 2, white-labeling, and data residency
- Deep social network mechanics before workflow adoption

If a roadmap item mostly helps a future enterprise security review or a future 1000-seat
deployment, it belongs later.

---

## 6. Revised Roadmap Overview

| Phase | Focus | Why It Comes Here |
|------|------|------|
| 3 | Production auth + invite flow + incremental supply-chain onboarding | Can't onboard real users without it |
| 4 | Invoice generation from approved timesheets | Completes the money loop |
| 5 | CSV import + PDF export | Removes adoption friction |
| 6 | Multi-project unified dashboard | Real users work across more than one project |
| 7 | Supply Chain Assistant (AI Agent 1) | Makes setup usable for non-experts |
| 8 | Stripe integration + payments | Turns billing into actual money movement |
| 9 | Public profiles + Matchmaker (AI Agent 2) | Social layer after workflow traction |
| 10 | Analytics + reporting | Retention and operational visibility |
| 11 | Collaboration + mobile + public API | Expansion features after core loop works |
| 12 | Enterprise features | Upmarket features after customer validation |

---

## 7. Phase 3: Production Auth, Invites, And Incremental Supply Chains

### Goal

Make WorkGraph usable by a real agency with real identities, real org membership, and a graph
that can start incomplete and evolve over time.

### Why now

This is the real onboarding phase. Until this exists, the graph is still partly a demo shell.

### Scope

- Replace `PersonaContext` as the primary operating model with real identity-aware behavior
- Add organization invitations and membership acceptance flows
- Support project creation with only 2 parties initially
- Support adding a third or fourth party later without rebuilding the project from scratch
- Support "pending invited party" states in the graph
- Add real project roles:
  - owner
  - editor
  - contributor
  - viewer
- Ensure graph visibility and workspace navigation derive from the signed-in user and org
- Make top-level workspace controls functional:
  - `Team` opens real member management (list + invite + role visibility)
  - `Settings` opens project configuration and saves per-project preferences

### Critical workflow to support

1. Agency owner creates organization
2. Agency owner creates project with client only
3. Work begins before subcontract structure is fully known
4. Contractor or subcontractor is invited later
5. Graph, permissions, rates, and approvals update without destroying history

### Explicit non-goals

- Multi-provider SSO
- Deep enterprise identity federation
- Real-time collaboration

### Exit gate

A small agency can onboard itself and at least one client into a real project without relying on
test personas or pre-baked graph assumptions.

---

## 8. Phase 4: Invoice Generation From Approved Timesheets

### Goal

Turn approved time into invoiceable output inside the product.

### Why now

This is the money moment. If approvals do not end in billing, WorkGraph stops short of the
highest-value step in the workflow.

### Scope

- Generate invoices from approved timesheets
- Respect graph-defined billing routes and contract rates
- Generate one invoice per billable relationship when needed
- Support invoice states:
  - draft
  - issued
  - paid
  - partially paid
  - overdue
- Provide invoice preview and exportable customer-facing document output
- Show invoice readiness from the approvals flow

### Product outcome

An agency user should be able to say:

"The client approved the week. Now I can invoice from the same system."

### Explicit non-goals

- Full payment processor integration
- Advanced tax engine
- Full accounting ERP replacement

### Exit gate

Approved timesheets can reliably produce invoices that a real agency could send.

---

## 9. Phase 5: CSV Import And PDF Export

### Goal

Lower the switching cost enough that teams can pilot WorkGraph without re-entering everything.

### Why now

This is the adoption-friction phase. It is less exciting than AI or collaboration, but more
important for real usage.

### Scope

- CSV import for timesheets
- CSV import for roster or contractor assignment data where useful
- PDF export for invoices
- PDF export for key contract views and project artifacts
- CSV export for timesheet and invoice data

### Product outcome

A team should be able to import existing work into WorkGraph and export artifacts back out
without feeling trapped.

### Exit gate

New customers can trial the product using existing spreadsheet data instead of rebuilding their
operations from scratch.

---

## 10. Phase 6: Multi-Project Unified Dashboard

### Goal

Give users a useful "all my work" view across projects.

### Why now

The graph is per project, but real freelancers, team leads, and agency operators live across
multiple projects in the same month.

### Scope

- Unified hours view across all active projects
- Cross-project approval inbox
- Cross-project invoice and payment summary
- Personal and org-level views:
  - my hours
  - my approvals
  - my receivables
  - team utilization
- Fast filters by project, client, org, and period

### Product outcome

A freelancer or agency lead can answer:

"How many hours have I logged this month across all clients?"

without opening five project workspaces.

### Exit gate

The app provides a meaningful daily dashboard even when the user works across multiple projects.

---

## 11. Phase 7: Supply Chain Assistant (AI Agent 1)

### Goal

Make project setup less intimidating and less dependent on graph expertise.

### Why now

Once real users can onboard, bill, and operate across projects, the next bottleneck becomes
configuration quality and setup speed.

### This is the right first AI agent

The assistant lives inside the project creation and supply-chain setup workflow.

Example prompt:

"I need 3 React developers for a client in Germany for 6 months."

The assistant should help suggest:
- likely supply-chain shape
- direct versus agency-mediated structure
- rate bands
- contract type
- approval chain defaults
- likely compliance considerations

### What it is not

- not a public talent search engine
- not a generic chatbot bolted on top
- not autonomous procurement logic

### Exit gate

A non-expert user can create a sensible starting graph with assistant help and then edit it.

---

## 12. Phase 8: Stripe And Money Movement

### Goal

Move from invoice creation to actual payment flows.

### Why now

WorkGraph should not call itself a billing platform if it stops at PDF invoices forever.

### Scope

- Stripe-backed payment links or invoice collection flows
- Payment status sync back into WorkGraph
- Basic reconciliation between invoice state and payment state
- Manual payment recording when money is collected outside Stripe

### Explicit non-goals

- marketplace escrow
- international payroll product
- full treasury layer

### Exit gate

An issued invoice can be paid and tracked inside the product.

---

## 13. Phase 9: Public Profiles And Matchmaker (AI Agent 2)

### Goal

Add the social network layer only after the workflow layer has traction.

### Why now

The matchmaker is only useful when there is enough real supply and demand in the system.

### Scope

- Public freelancer and company profiles
- Availability, skills, rate expectations, and location preferences
- Agency-side search for matching talent
- Freelancer-side discovery of matching opportunities
- Controlled profile visibility and privacy settings

### This is the second AI agent

Examples:
- Agency: "Find an available senior React developer in the EU timezone under $100/hr"
- Freelancer: "Show me open roles that match my skills and pay above my target rate"

### Exit gate

There is enough profile and opportunity data in the system that matching produces useful results.

---

## 14. Phase 10: Analytics And Reporting

### Goal

Make WorkGraph sticky by helping customers understand utilization, margins, billing velocity,
approval bottlenecks, and project health.

### Scope

- Utilization dashboards
- Margin and markup analysis
- Approval-cycle timing
- Budget versus actual reporting
- Exportable operational reports

### Exit gate

Customers use WorkGraph not only to run the workflow, but also to understand and improve it.

---

## 15. Phase 11: Collaboration, Mobile, And Public API

### Goal

Expand the platform after the core operational loop is proven.

### Scope

- Real-time graph collaboration
- Cursor presence and comments
- Mobile-friendly timesheet workflows
- Public API and webhooks
- Integration-ready extension points

### Why later

These are expansion and scale features. They matter more after multiple customers are already
relying on the core workflow.

---

## 16. Phase 12: Enterprise Features

### Goal

Support upmarket sales once there is clear product-market fit in the initial segment.

### Scope

- SSO
- audit and governance tooling
- data residency controls
- white-labeling
- compliance-oriented packaging

### Why last

These features help close larger accounts. They do not help discover whether the product solves
the first customer's problem well enough.

---

## 17. Success Metrics And Phase Gates

### Customer-level success metrics

- Time from project setup to first submitted timesheet
- Time from submitted timesheet to approved invoice
- Number of projects launched without spreadsheet fallback
- Number of invited external participants per customer
- Repeat usage across multiple monthly cycles

### Phase gates

**Before moving past Phase 3**
- At least one real team can onboard without test personas

**Before moving past Phase 4**
- Approved time reliably becomes invoice output

**Before moving past Phase 5**
- Customers can migrate in and export out without custom engineering help

**Before moving past Phase 8**
- The platform can trace work through approval to payment

**Before moving heavily into Phase 9**
- There is real user and opportunity density to support matching

---

## 18. Implementation Constraints That Still Apply

These constraints still matter even though the sequencing changed.

- Frontend: React SPA with Vite
- Backend: Supabase Edge Functions using Hono
- Database model: KV-store pattern only
- No new traditional SQL-table design assumptions
- Graph rendering remains custom SVG, not React Flow
- Server routes still use the existing Edge Function prefix
- Protected files remain protected:
  - `/supabase/functions/server/kv_store.tsx`
  - `/utils/supabase/info.tsx`

If this roadmap conflicts with current architecture details:
- `ARCHITECTURE.md` is the source of truth for how the system works today
- `ROADMAP.md` is the source of truth for what we should build next

---

## 19. Code Touchpoints By Phase

### Phase 3

- `/src/contexts/AuthContext.tsx`
- `/src/contexts/PersonaContext.tsx`
- `/src/contexts/WorkGraphContext.tsx`
- `/src/components/workgraph/ProjectCreateWizard.tsx`
- `/src/components/workgraph/WorkGraphBuilder.tsx`
- `/src/components/AppLayout.tsx`
- `/src/routes.tsx`
- new invite and org membership APIs under `/supabase/functions/server/`

### Phase 4

- `/src/components/timesheets/`
- `/src/components/approvals/`
- `/src/components/contracts/`
- new invoice types and APIs

### Phase 5

- import/export utilities
- invoice rendering
- document generation paths

### Phase 6

- `/src/components/dashboard/DashboardPage.tsx`
- `/src/utils/api/dashboard.ts`
- aggregate timesheet and invoice queries

### Phase 7

- `/src/components/workgraph/ProjectCreateWizard.tsx`
- wizard-side AI assistance utilities and prompt orchestration

### Phase 8

- invoice state management
- payment APIs and webhook handling

### Phase 9

- profile pages
- discovery surfaces
- social components
- matching APIs

### Phases 10-12

- reporting
- collaboration
- integrations
- enterprise admin surfaces

---

## 20. Migration Notes From The Old Roadmap

### What changed

- Collaboration is no longer Phase 3.
- Invoice generation is no longer delayed behind a long infrastructure sequence.
- Production auth is now an early priority, not a late cleanup task.
- Import/export is now treated as a core adoption feature.
- A unified multi-project dashboard is now explicit.
- AI is split into two agents with different timing and purpose.
- Payments are now an explicit product phase.

### What stayed true

- The graph engine is still the core differentiator.
- Policy compilation is still important.
- Enterprise, API, and collaboration features are still valuable later.
- The product can still become a social network layer over time.

### Why this rewrite is better

Because it turns the roadmap from an engineering wishlist into a customer adoption plan.

---

*End of WorkGraph Product-First Roadmap v3.0*
