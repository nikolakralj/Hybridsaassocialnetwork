# WorkGraph - Master Reference

**Last Updated:** 2026-03-11
**Single source of truth. All other doc files have been consolidated here.**

---

## What Is WorkGraph?

A hybrid SaaS + social work network for technical freelancers. Three pillars:

1. **Work Management** - Timesheets, contracts, invoices, multi-party approvals
2. **Social Network** - Profiles, endorsements, job matching, community feed
3. **Visual Policy Engine** - Graph-based approval flows with ReBAC (Relationship-Based Access Control)

**Design philosophy:** Apple-inspired, minimal, functional.

---

## Core Architecture

### Multi-Tenant Identity

```
Personal Profile (Sarah)
  |- Worker Record @ TechStaff Agency (projects, timesheets as agency employee)
  |- Worker Record @ DevShop Inc (projects, timesheets as contractor)
  '- Freelance Profile (direct client work)
```

**Key:** Personal identity is separate from work relationships. One person, many work contexts.

### Multi-Party Project Model

Real-world contractor supply chains:

```
Global Corp (Client) -- pays $175/hr --> TechStaff Agency -- pays $150/hr --> DevShop Inc -- pays $50/hr --> John Smith
```

Each link = separate contract, different rate, rate privacy between tiers.

### Three Contractor Types

| Type | Example | Team Views? | Aggregate Views? |
|------|---------|-------------|-----------------|
| **Solo Freelancer** | Sarah, freelance dev | No (just their own timesheet) | No |
| **Agency/Company Team Lead** | Mike, managing 3 devs | Yes (browse team) | Yes (team calendar, list) |
| **Company Manager** | Lisa, project owner | Yes (all contractors) | Yes (full project view) |

### Contract-Scoped Rate Visibility

```
John sees: $50/hr (his contract with DevShop)
DevShop sees: $50/hr (pays John) + $150/hr (bills TechStaff)
TechStaff sees: $150/hr (pays DevShop) + $175/hr (bills Global)
Global sees: $175/hr (pays TechStaff)

Nobody sees rates outside their direct contracts.
```

### Local Scope Visibility

Each organization sees ONLY their 1st-degree contract neighbors. Like LinkedIn connections:
- 1st degree: Your direct contracts (visible)
- 2nd degree: "Someone via Agency" (context only)
- 3rd degree: Invisible

No complex masking/projection. Simple: "Show me my contracts + counterparties."

---

## Data Architecture

### WorkGraph = POLICY (Structure & Rules)

The visual graph represents organizational structure and approval policies ONLY:
- Companies/Parties, People, Contracts
- Approval chains, Rate visibility rules
- SOW nodes, PO nodes (future)

### Transactions Live Separately

Timesheets, invoices, expenses are NOT graph nodes. They reference the graph but live in their own tables. This prevents graph pollution (50 people x 52 weeks = 2,600+ nodes/year).

### Temporal Graph Versioning

Every graph edit creates a new version snapshot. Historical timesheets reference the graph version active at submission time. Handles: companies leaving mid-month, contractor changes, org restructuring.

```sql
graph_versions (id, project_id, version_number, effective_from_date, effective_to_date, graph_data JSONB)
timesheet_periods.graph_version_id -> graph_versions.id
```

### Timesheet Architecture (Two-Level)

```
TIMESHEET_PERIODS (Weekly) - Approval workflow, status tracking, links to graph version
  '- has many -> TIMESHEET_ENTRIES (Daily) - Start/end times, work type, task, location, billable flag
```

Weekly periods for approval flow. Daily entries for detailed tracking.

### Multi-Party Approval Flow

```
Level 1: Internal (within org)
  - Freelancer -> direct to project owner
  - Company employee -> company lead -> batch to project owner
  - Agency contractor -> agency lead -> batch to project owner

Level 2: Project (cross-org chain)
  - DevShop approves -> TechStaff approves -> Global approves (final)
```

### Approval Chain Templates

Contracts reference pre-defined templates (Simple, Standard, Enterprise) instead of hardcoded logic. Templates define ordered steps with roles, scopes, and conditions.

---

## Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS v4 + Shadcn UI
- **Routing:** React Router (data mode with RouterProvider)
- **State:** React Context (PersonaContext, WorkGraphContext, TimesheetDataContext, NotificationContext, MonthContext, AuthContext)
- **Backend:** Supabase (Edge Functions via Hono, Postgres, Auth, Storage)
- **Charts:** Recharts
- **Icons:** Lucide React
- **Animation:** Motion (framer-motion successor)

---

## Route Map

```
/                          Landing page (public)
/onboarding/personal       Personal profile setup
/onboarding/freelancer     Freelancer onboarding
/onboarding/company        Company onboarding
/onboarding/agency         Agency onboarding
/app                       Dashboard (authenticated)
/app/feed                  Social feed
/app/projects              Projects list
/app/project-workspace     Project detail (timesheets, graph, approvals tabs)
/app/approvals             Global approvals workbench
/app/contracts             Contracts management
/app/company-profile       Company profile (public + private views)
/app/notifications         Activity feed (full page)
/app/profile               Personal profile (view/edit)
/app/settings              Settings - account, notifications, privacy, appearance
/app/approve               Deep-link approval handler
/app/reject                Deep-link rejection handler
```

---

## Component Map

```
/components/
  AppHeader.tsx             Main nav header
  AppLayout.tsx             Authenticated layout wrapper (header + outlet)
  Landing.tsx               Public landing page
  FeedHome.tsx              Social feed with post composer
  CompanyProfilePage.tsx    Company profile (public/private toggle)
  CompanyPublicProfile.tsx  Public company view
  CompanyPrivateWorkspace.tsx  Internal company dashboard
  ProjectWorkspace.tsx      Project detail with tabs

  /approvals/               Global approvals workbench, deep-link handler, email preview
  /contracts/               Contract cards, invitations, disclosure requests
  /dashboard/               Dashboard page, stat cards, earnings chart, network feed
  /notifications/           Bell, dropdown, items, preferences panel, activity feed, approval chain tracker
  /onboarding/              Personal, freelancer, company, agency flows
  /projects/                Projects list, configuration drawer
  /social/                  Profile cards, post cards, community metrics, spotlights
  /timesheets/              Calendar views, entry forms, approval views, drag-drop, modals, tables
  /widgets/                 AI insights, active projects, inbox, my week, quick actions, deadlines
  /workgraph/               Visual graph builder, nodes, edges, policy simulator, templates
  /ui/                      Shadcn UI primitives
```

---

## Completed Phases

### Phase 1: Unified Calendar Grid View
Multi-person timesheet calendar, drag-and-drop entry, weekly table to monthly drawer workflow, contract-based time entry, status indicators.

### Phase 1A-1C: Drag-and-Drop Multi-Person Timesheet
Basic drag-drop between days, multi-person support, enhanced design system.

### Phase 2: 3-Layer Approval System
Contract-based visual grouping, weekly granularity with monthly invoicing, PDF generation, batch approval, multi-party chains.

### Phase 3: Multi-Party Project Architecture
Real-world multi-company scenarios, multiple contracts per project, different rates per contract, hierarchical approval flows, contract-scoped rate visibility.

### Phase 3.5: Database Integration & Data Consistency
Pure Supabase architecture, real-time data sync, timezone bug fix (UTC vs local), verified data consistency across views.

### Phase 4: WorkGraph Visual Builder
Node-based approval flow designer (Party, Contract, Person nodes), edge configuration, policy compilation, policy simulation with rate visibility testing.

### Phase 5 (Days 1-7): Integration & Real Data
Policy versioning + storage, global approvals workbench, graph overlay integration, keyboard shortcuts, project approvals tab, deep-links + email templates.

### Phase 5 Day 8 (Partial): Notification System
In-app notification center, approval chain tracker, notification context store, user preference settings UI (NotificationPreferencesPanel). Email templates and batch digest still pending.

---

## Current Roadmap

### Phase 0.5: Platform Foundation (NEW - BLOCKER)

**Why:** Can't onboard real users without auth, profiles, and settings. These were never in the original roadmap.

- [x] **Auth** - Supabase sign-up/sign-in, session persistence, auth guards on /app/* (AuthContext, AuthModal, server signup route)
- [x] **Personal Profile Page** - /app/profile, view/edit own profile with skills, bio, location, website
- [x] **Settings Page** - /app/settings with 4 tabs: account, notifications (wired to NotificationPreferencesPanel), privacy, appearance
- [x] **User State Wiring** - Header shows real user name/initials, dropdown links to profile/settings, real sign-out
- [x] **Onboarding saves to DB** - All 4 onboarding flows persist data via Supabase Auth metadata + KV store
- [ ] **Public profile view** - /app/profile/:userId for viewing other users' profiles

### Phase 5 Remaining: Email & Digest

- [ ] Email templates for 4 notification types (first approval, middle digest, final approval, rejection)
- [ ] Batch digest job for middle-node approvals
- [x] Wire NotificationPreferencesPanel into settings (now at /app/settings > Notifications tab)

### Phase 6: SOW Foundation + Enhanced Project Creation

**Week 1-2: SOW Data Model**
- SOW as first-class graph node (governs, fundedBy, covers edges)
- Pricing models: T&M, Fixed, Milestone, Capped T&M, Retainer
- Version chaining (v1 -> v2 with parent_sow_id, change orders)
- Budget burn-down linked to timesheets

**Week 1: Enhanced Project Creation**
- Quick Start mode (60s: project + parties + approval template)
- Advanced mode (3-5min: + SOW + contracts + PO + rate tables)
- Graph templates (Solo->Client, Vendor->Agency->Client, Internal)
- Demo data toggle for sandbox projects

### Phase 7: AI + Automation Foundation

- AI-powered approval routing (shadow -> assist -> auto progression)
- Event-driven architecture (outbox pattern, webhooks)
- Integration layer for external services (Slack, email, QuickBooks)
- Observability & compliance (audit logs, metrics, kill switches)
- SLA breach detection + escalation

### Phase 8: Expense Management & Document Capture

- Expense entry with categories, receipt management (mobile camera capture)
- Scanned timesheet verification (split-screen comparison)
- Policy compliance engine (receipt requirements, amount limits)
- Combined time + expense approval, reporting & export

### Phase 9: Visual Builder UX & Quality

- Overlay modes (approvals, money flow, people, access)
- Explainability ("Why?" for every AI/manual decision)
- Templates & guided setup
- Policy fuzzer & golden fixtures, scenario library, performance testing

### Phase 10: Security, Governance & Backend

- Policy versioning + pinning (immutable versions, in-flight items stay on vN)
- Graph structure versioning (temporal tracking)
- Field-level encryption, access reviews, data residency
- Workflow outbox + idempotency, SLA & escalation, observability

### Phase 11: AI Agents

- Validator agent (proposes blocks/warnings, human-in-loop)
- Summarizer agent (timesheet/expense summaries, approval rationales)
- Auto-approve under thresholds (with full audit trail)
- Personal AI agents for profile/company/project management (future vision)

### Phase 12: AI Contract Intelligence

- PDF upload -> OCR -> AI structured extraction (parties, dates, rates, terms)
- Auto-generate project graph from contract
- Confidence scoring & human review (side-by-side PDF vs graph)
- Expense policy extraction, approval flow intelligence

### Phase 13: Admin & UX Excellence

- Approvals workbench (bulk approve, delegate, keyboard shortcuts)
- "Preview as..." everywhere, offline & mobile capture, PWA

### Phase 14: Platform & Integrations

- Event webhooks + AsyncAPI, REST/GraphQL API, rate limiting
- Accounting connectors (QuickBooks, Xero, NetSuite)
- HRIS connectors (BambooHR, HiBob)

### Phase 15: Packaging & Pricing

- Tiers: Core (free), Pro ($49/user/mo), Enterprise (custom)
- Feature flags, trial defaults, graceful degradation

### Phase 16: Social Features

- Public profiles, work history visibility, endorsements/recommendations
- Job matching, network discovery

---

## Key Architectural Decisions

1. **Graph = Policy, not Transactions** - Timesheets/invoices reference the graph but don't create nodes
2. **Local Scope Visibility** - 1st-degree neighbors only, no complex masking
3. **Temporal Versioning** - Graph snapshots tied to timesheet periods
4. **Two-Level Timesheets** - Weekly periods (approval) + daily entries (tracking)
5. **ReBAC over RBAC** - Permissions derived from graph relationships, not role tables
6. **PersonaContext** - Perspective-switching drives what users see across all views
7. **Progressive AI Trust** - Shadow -> Assist -> Auto with kill switches

---

## Database Schema (Key Tables)

```
-- Core KV store (current)
kv_store_f8b491be (key, value, created_at, updated_at)

-- Target schema (when migrated to full Supabase)
projects, project_contracts, project_participants, project_role_assignments
graph_versions (temporal snapshots)
timesheet_periods (weekly approval units)
timesheet_entries (daily task details)
approval_policies (versioned, compiled JSON)
approval_history (immutable audit log)
approval_chain_templates (reusable approval flows)
sow, sow_line (future: statement of work)
expenses, expense_categories, expense_approvals (future)
```

---

## Success Metrics

- **MVP:** Monthly timesheet upload, weekly tracking, multi-party approvals, rate privacy, visual builder, policy simulation
- **Phase 5:** Policy versioning, compiled policy execution, outbox pattern, email notifications, full audit trail
- **Production SLOs:** p95 approval page < 200ms, p95 compile < 500ms, 99.9% uptime, zero data-leak defects
- **Business:** Time to first approval < 5min, automation rate > 60%, NPS > 50

---

*This is the only documentation file. If it's not here, it's in code comments or doesn't exist yet.*