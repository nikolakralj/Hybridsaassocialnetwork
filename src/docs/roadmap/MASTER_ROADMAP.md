# 🗺️ WorkGraph Master Roadmap

**Last Updated:** 2025-11-06

---

## 📊 Project Overview

WorkGraph is a hybrid SaaS + social work network for technical freelancers with:
- **Apple-inspired design**
- **Multi-tenant architecture** (Personal Profiles ↔ Worker Records)
- **Core work management** (timesheets, contracts, project docs)
- **Three contractor types** with role-based rate visibility
- **Multi-party approval architecture** (multiple companies/agencies/freelancers)

---

## ✅ Completed Phases

### **Phase 1: Unified Calendar Grid View** ✅
- Multi-person timesheet calendar
- Drag-and-drop time entry
- Weekly table → monthly drawer workflow
- Contract-based time entry
- Status indicators (approval states)

**Location:** `/components/timesheets/`  
**Docs:** `/docs/PHASE_1_COMPLETE_SUMMARY.md`

---

### **Phase 1A-1C: Drag-and-Drop Multi-Person Timesheet** ✅
- **1A:** Basic drag-drop between days
- **1B:** Multi-person support
- **1C:** Enhanced design system (Warp-inspired)

**Location:** `/components/timesheets/drag-drop/`  
**Docs:** `/docs/PHASE_1C_COMPLETE.md`, `/docs/DRAG_DROP_COMPLETE_SUMMARY.md`

---

### **Phase 2: 3-Layer Approval System** ✅
- Contract-based visual grouping
- Weekly granularity with monthly invoicing
- PDF invoice generation
- Batch approval workflows
- Multi-party approval chains

**Location:** `/components/timesheets/approval-v2/`  
**Docs:** `/docs/COMPREHENSIVE_APPROVAL_SYSTEM.md`, `/docs/UNIFIED_MONTHLY_APPROVAL_SYSTEM.md`

---

### **Phase 3: Multi-Party Project Architecture** ✅
- Real-world multi-company scenarios
- Multiple contracts per project
- Different rates per contract
- Hierarchical approval flows
- Contract-scoped rate visibility

**Location:** `/types/contracts.ts`, `/components/workgraph/`  
**Docs:** `/docs/MULTI_PARTY_APPROVAL_ARCHITECTURE.md`, `/docs/CONTRACT_SCOPED_RATE_VISIBILITY.md`

---

### **Phase 4: WorkGraph Visual Builder** ✅
- Node-based approval flow designer
- Party nodes, Contract nodes, Person nodes
- Edge configuration (approval routes)
- Policy compilation
- Policy simulation with rate visibility testing

**Location:** `/components/workgraph/`  
**Docs:** `/docs/WORKGRAPH_VISUAL_BUILDER_IMPLEMENTATION.md`, `/docs/POLICY_SIMULATOR_COMPLETE.md`

---

## 🎯 Current Status (2025-10-31)

### **✅ Just Completed (Today - 2 Hours):**
1. **M5.1 Minimal (80% Complete)** - Project creation system ready!
   - ✅ Database schema (`004_project_collaboration.sql`)
   - ✅ Permission system (`/utils/collaboration/permissions.ts`)
   - ✅ Projects API (`/utils/api/projects.ts`)
   - ✅ ProjectCreateWizard wired to database
   - ✅ ProjectsListView opens wizard

### **Previous Completions:**
1. **Phase 5 Day 1-2** - Policy Versioning + Storage ✅
2. **Documentation cleanup** - Reorganized 36+ files
3. **Roadmap expansion** - Enterprise requirements for Phases 5-13

**Status:** M5.1 Minimal foundation complete, ready for builder integration!  
**Next:** Tomorrow - Wire WorkGraph Builder + Publish button  
**Then:** M5.5 Network Graph (THE MOAT) 🎯

---

## 🚀 Next Phases

### **Phase 5: Integration & Real Data** 🔄 IN PROGRESS

**Duration:** 2 weeks (10 working days)  
**Status:** Days 1-5 complete (36%) | 13/13 features complete (100% of Days 1-5)  
**Started:** November 3, 2025

**Goals:**
- Replace mock data with real Supabase database
- Build global approvals workbench
- Create graph overlay integration
- Enable project creation with multi-party support

**Milestones:**
- **M5.1: Project Creation System** ✅ Complete (Day 1)
- **M5.2: Policy Versioning** ✅ Complete (Day 2)
- **M5.3: Global Approvals Workbench** ✅ Complete (Day 3)
- **M5.4: Graph Overlay Integration** ✅ Complete (Day 4)
- **M5.5: Keyboard Shortcuts + Enhancements** ✅ Complete (Day 5)
- **M5.6: Project Approvals Tab** ⏳ Day 6
- **M5.7: Deep-Links + Email Templates** ⏳ Day 7
- **M5.8-M5.13: Database Integration** ⏳ Days 8-14

**Exit Criteria:** [11/11 items in `/docs/roadmap/PHASE_5_SPRINT_GUIDE.md`]

**Location:** `/docs/guides/PHASE_5_DAY_5_COMPLETE.md`

---

### **Phase 6: AI + Automation Foundation** 📋 PLANNED

**Duration:** 6-8 weeks  
**Status:** Documented, ready after Phase 5  
**Dependencies:** Phase 5 complete (real database integration)

**Goals:**
- AI-powered approval routing (shadow → assist → auto)
- n8n workflow automation (Slack, email, QuickBooks)
- Event-driven architecture (outbox pattern, webhooks)
- Observability & compliance (audit logs, metrics, kill switches)

**Key Features:**
- **Week 1:** Event infrastructure + signed webhooks
- **Week 2:** AI shadow mode (rule engine + anomaly detection)
- **Week 3:** AI assist mode (human in loop)
- **Week 4:** AI auto mode (supervised automation)
- **Week 5:** n8n template library (5+ ready-to-use workflows)
- **Week 6:** Observability + hardening (metrics, DLQ, audit UI)
- **Weeks 7-8:** Polish (graph versioning, GBDT model training)

**Exit Criteria:**
- ✅ At least 1 n8n workflow live in production
- ✅ AI auto-approves ≥10% of submitted items
- ✅ Zero incorrect auto-approvals in 7 days
- ✅ SLA breach escalation working
- ✅ 5+ n8n templates ready to use
- ✅ Webhook delivery success rate ≥99%
- ✅ Kill switch tested and documented
- ✅ Security review passed

**Architecture:**
```
WorkGraph → Rules/AI Service → Integration Broker → n8n
              ↓                      ↓                ↓
         Auto-approve            Webhooks      External APIs
         Smart routing           Callbacks     (Slack, QB, etc.)
         Anomaly flags           Retries
```

**Documentation:**
- **Full Spec:** `/docs/roadmap/PHASE_6_AI_AUTOMATION.md`
- **AI Architecture:** `/docs/architecture/AI_DECISION_ARCHITECTURE.md`
- **n8n Patterns:** `/docs/architecture/N8N_INTEGRATION_PATTERNS.md`
- **Safety Guidelines:** `/docs/guides/AI_SAFETY_GUIDELINES.md`
- **Database Migrations:** `/docs/database/PHASE_6_MIGRATIONS.sql`
- **API Contracts:** `/docs/api/PHASE_6_API_CONTRACTS.yaml`

**Business Impact:**
- Reduce manual approval time by 60%
- Auto-generate invoices in QuickBooks
- Real-time Slack notifications
- Automated SLA breach escalation
- 100% audit compliance maintained

---

### **Phase 7: Visual Builder UX & Quality**
**Goal:** Make builder easier, more powerful, and production-quality

#### **Builder Improvements:**
- [ ] **Overlay Modes (operational)**
  - Approvals overlay (step numbers)
  - Money Flow overlay (BillsTo/PO/Invoice totals)
  - People overlay (utilization)
  - Access overlay (who sees what)
  - "View path on graph" links from Simulator steps
- [ ] **Explainability ("Why?")**
  - Every auto/manual decision shows conditions that fired
  - Amount thresholds, contract validity, budget remaining
  - Trace from decision back to rule
- [ ] **Templates & Guided Setup**
  - One-click: "Staff-Aug 4-Party", "Freelancer Direct", "MSA + Multiple SOWs"
  - Wizard that attaches existing company profiles
  - Prewires default roles/permissions
- [ ] **More node types**
  - BudgetNode, ConditionNode, EscalationNode
  - MSA/SOW relationship nodes
- [ ] **Better edge routing**
  - Auto-layout algorithms
  - Smart snapping and alignment
  - Validation rules (prevent cycles, ensure connectivity)

#### **Quality at Graph Scale:**
- [ ] **Policy Fuzzer & Golden Fixtures**
  - Generate random multi-party graphs
  - Assert invariants (e.g., Agency never sees Company↔Contractor rates)
  - Golden snapshot tests for compiled JSON
  - PRs show policy diffs
- [ ] **Scenario Library in Simulator**
  - Presets: overtime, contract expired, PO overspend, weekend/holiday, multi-currency
  - Export simulation reports (JSON/PDF) for UAT
  - Batch scenario testing
- [ ] **Performance testing**
  - 20+ orgs, 1k people graphs
  - Compile time < 500ms p95
  - Render performance for large graphs

#### **DoD:**
- ✅ One-click templates create valid, executable policies
- ✅ Fuzzer finds no invariant violations in 1000 random graphs
- ✅ Simulator presets cover all edge cases
- ✅ p95 compile time < 500ms on complex graphs

**Priority:** HIGH  
**Benefit:** Production-quality builder with enterprise confidence

---

### **Phase 8: Security, Governance & Backend**
**Goal:** Enterprise-grade security, compliance, and full production system

#### **Security & Governance (Hard Requirements):**
- [ ] **Policy Versioning + Pinning** ⭐ (moved from Phase 5)
  - Immutable policy versions
  - In-flight items stay on vN, new items use vN+1
  - UI: "Pinned to vN" badge on each open timesheet
  - One-click rebind wizard
  - **DoD:** Rollback in <1s; audit shows who changed what/when; 100% masked fields honored across versions
  
- [ ] **Field-level encryption (rates, bank data)**
  - Envelope encryption with KMS
  - Rotate keys quarterly
  - **DoD:** Rotation without downtime; access paths logged
  
- [ ] **Access reviews & attestations**
  - Quarterly "who can approve what" report per project
  - SOC 2 compliance ready
  - **DoD:** Export (CSV/PDF) signed by system, audit-logged
  
- [ ] **Data residency & DLP**
  - Region pin per project (US/EU/UK)
  - DLP scan on uploads (auto-redact PII patterns)
  - **DoD:** Residency enforced by policy; blocked cross-region exports tested

#### **Execution Engine & Reliability:**
- [ ] **Workflow Outbox + Idempotency** ⭐
  - All approval transitions emitted via outbox table
  - Handlers are idempotent with dedupe keys
  - **DoD:** Exactly-once effect for external side-effects (emails, webhooks) under retries
  
- [ ] **SLA & Escalation**
  - Per-step SLA timers
  - Auto-escalate to delegate
  - Holiday calendars per region
  - **DoD:** p95 notification latency < 2 min; missed SLA visible in "Aging Approvals"
  
- [ ] **Observability & SLOs**
  - Traces for submit→final approval
  - Dashboards for automation rate, SLA, error rate
  - **SLOs:** p95 approval page load < 200ms; p95 compile < 500ms; 0 data-leak defects

#### **Backend Integration:**
- [ ] Supabase integration for policy storage
- [ ] Real-time approval notifications (WebSockets)
- [ ] Approval history tracking (immutable log)
- [ ] Comprehensive audit logs
- [ ] Role-based access control (RBAC)
- [ ] **Data Model Enhancements:**
  - Closure Table / Materialized Path for fast ancestry queries (20+ orgs, 1k people)
  - Precompute visibility joins
  - Cache compiled policies by (projectId, version)
  - Optional commanded subledger for invoices/payments reconciliation

**Priority:** CRITICAL  
**Benefit:** Enterprise-ready with security, compliance, and reliability

---

### **Phase 9: AI Agents (Opt-in, Safe)**
**Goal:** Intelligent automation with human oversight

#### **AI Features:**
- [ ] **Validator Agent (Phase 6)**
  - Observes Submitted events
  - Proposes blocks/warnings (expired MSA, overtime, PO near limit)
  - Human-in-loop; proposals in "Action Inbox"
  - Never auto-blocks without confirmation
  
- [ ] **Summarizer Agent**
  - Drafts timesheet/expense summaries
  - Auto-generates approval rationales
  - Masked fields remain masked in AI output
  
- [ ] **Auto-approve Under Thresholds**
  - Policy flag (hours/amount caps)
  - Executed by agent, requires confirm initially
  - Can become fully autonomous under governance
  - Full audit trail of all auto-approvals

#### **Safety Guarantees:**
- ✅ Human-in-loop required for initial training
- ✅ All AI decisions logged and explainable
- ✅ Rate masking preserved in AI-generated content
- ✅ Opt-in per project, can be disabled
- ✅ SOC 2 compliant audit trail

**Priority:** MEDIUM (post Phase 8)  
**Benefit:** Reduces manual work while maintaining control

---

### **Phase 10: Admin & UX Excellence**
**Goal:** Best-in-class approver and admin experience

#### **Approvals Workbench:**
- [ ] One page to bulk approve, delegate, and resolve holds
- [ ] Filters by party/project/step
- [ ] Keyboard shortcuts (j/k navigation, x select, a approve)
- [ ] Batch actions with undo
- [ ] "Aging Approvals" view for SLA tracking

#### **"Preview as..." Everywhere:**
- [ ] Header toggle that applies to all views
- [ ] Builder, simulator, approvals, invoices
- [ ] Verify masking and visibility quickly
- [ ] Test mode for admins

#### **Offline & Mobile Capture:**
- [ ] Local queue for timesheets/expenses
- [ ] Conflict resolution on sync
- [ ] Field-friendly mobile capture
- [ ] Progressive Web App (PWA)

**Priority:** HIGH  
**Benefit:** Power users can work 10x faster

---

### **Phase 11: Platform & Integrations**
**Goal:** API-first platform with enterprise connectors

#### **Event Webhooks + AsyncAPI:**
- [ ] Events: Submitted/Approved/Rejected/Posted/Paid
- [ ] Signed deliveries with replay
- [ ] Publish AsyncAPI spec
- [ ] Webhook management UI
- [ ] Event filtering and routing

#### **API Surface:**
- [ ] REST/GraphQL with viewer argument
- [ ] Responses pre-masked server-side
- [ ] Rate limiting and quotas
- [ ] API key management
- [ ] SDKs: TypeScript first, Python second

#### **Accounting/HRIS Connectors (post-Phase 8):**
- [ ] **Accounting:** QuickBooks, Xero, NetSuite
  - Map GL accounts and cost centers
  - Auto-post approved invoices
  - Reconciliation dashboard
- [ ] **HRIS:** BambooHR, HiBob
  - Sync employee data
  - Time off integration
  - Org chart sync

**Priority:** HIGH (post Phase 8)  
**Benefit:** Seamless integration with existing systems

---

### **Phase 12: Packaging & Pricing**
**Goal:** Clear tiering and go-to-market strategy

#### **Tiers:**
- **Core** (Free/Starter)
  - Builder + Approvals
  - Basic policies
  - Up to 10 users
  
- **Pro** ($49/user/mo)
  - Budgets/PO/Invoices
  - Simulator Advanced
  - Multi-currency
  - Up to 100 users
  
- **Enterprise** (Custom)
  - Governance & Security
  - Data Residency
  - SSO/SCIM
  - Webhooks & API
  - Unlimited users
  - Dedicated support

#### **Feature Flags:**
- Feature flags back these SKUs
- Trial defaults to Pro for 30 days
- Graceful degradation on downgrade

**Priority:** MEDIUM (business strategy)  
**Benefit:** Clear value proposition and revenue model

---

### **Phase 13: Social Features**
**Goal:** LinkedIn-style network for freelancers

#### Tasks:
- [ ] Public profiles
- [ ] Work history visibility controls
- [ ] Endorsements/recommendations
- [ ] Job matching
- [ ] Network discovery

**Priority:** LOW (future)  
**Benefit:** Differentiates from competitors

---

## 📋 Feature Completion Matrix

| Feature | Status | Phase | Location | Priority |
|---------|--------|-------|----------|----------|
| **Calendar Grid View** | ✅ Complete | Phase 1 | `/components/timesheets/` | - |
| **Drag-Drop Entry** | ✅ Complete | Phase 1A-C | `/components/timesheets/drag-drop/` | - |
| **Multi-Person Timesheets** | ✅ Complete | Phase 1 | `/components/timesheets/` | - |
| **3-Layer Approvals** | ✅ Complete | Phase 2 | `/components/timesheets/approval-v2/` | - |
| **Multi-Party Architecture** | ✅ Complete | Phase 3 | `/types/`, `/components/workgraph/` | - |
| **Visual Builder** | ✅ Complete | Phase 4 | `/components/workgraph/` | - |
| **Policy Simulator** | ✅ Complete | Phase 4 | `/components/workgraph/PolicySimulator.tsx` | - |
| **Rate Visibility** | ✅ Complete | Phase 4 | `/components/workgraph/` | - |
| **Policy Versioning** | ⏳ Next | Phase 5 W1 | - | CRITICAL |
| **Approval Engine** | ⏳ Next | Phase 5 W1-2 | - | CRITICAL |
| **Real Data Integration** | ⏳ Next | Phase 5 W2 | - | CRITICAL |
| **Outbox Pattern** | 📋 Planned | Phase 5 W1 | - | CRITICAL |
| **SLA & Escalation** | 📋 Planned | Phase 5 W2 | - | HIGH |
| **Framework Contracts** | 📋 Planned | Phase 6 | - | HIGH |
| **Budgets & POs** | 📋 Planned | Phase 6 | - | HIGH |
| **Multi-Currency** | 📋 Planned | Phase 6 | - | HIGH |
| **Overlay Modes** | 📋 Planned | Phase 7 | - | HIGH |
| **Policy Fuzzer** | 📋 Planned | Phase 7 | - | MEDIUM |
| **Field Encryption** | 📋 Planned | Phase 8 | - | CRITICAL |
| **Data Residency** | 📋 Planned | Phase 8 | - | CRITICAL |
| **Event Webhooks** | 📋 Planned | Phase 11 | - | HIGH |
| **AI Agents** | 📋 Planned | Phase 9 | - | MEDIUM |

---

## 🎯 Success Metrics & SLOs

### **MVP Requirements (Completed ✅)**
- [x] Monthly PDF timesheet upload
- [x] Weekly granularity tracking
- [x] Multi-party approval flows
- [x] Contract-based rate privacy
- [x] Visual approval flow designer
- [x] Policy simulation/testing

### **Phase 5 Requirements (2 Week Sprint)**
- [ ] Policy versioning with immutable versions
- [ ] Execute compiled policies on real timesheets
- [ ] Outbox pattern for exactly-once events
- [ ] Approvals workbench (read-only)
- [ ] Email notifications on state transitions
- [ ] Full audit trail (who/what/when)

### **Production SLOs (Phase 8)**
- [ ] **Performance:**
  - p95 approval page load < 200ms
  - p95 policy compile < 500ms
  - p95 queue fetch < 200ms on 5k items
  - Policy rollback < 1s
  
- [ ] **Reliability:**
  - 99.9% uptime for approval engine
  - Exactly-once event delivery
  - Zero data-leak defects
  
- [ ] **Security:**
  - 100% rate masking across all API/export paths
  - Field-level encryption for sensitive data
  - Quarterly key rotation without downtime
  
- [ ] **Compliance:**
  - SOC 2 ready audit trails
  - Data residency enforcement
  - Access attestation reports

### **Business Metrics (Phase 12)**
- [ ] Time to first approval < 5 minutes
- [ ] Approval automation rate > 60%
- [ ] User NPS > 50
- [ ] Contract to production < 2 weeks

---

## 📚 Key Documentation

### **Getting Started:**
- `/docs/QUICK_START.md` - Project overview
- `/docs/guides/QUICK_START_GUIDE.md` - Setup and first steps

### **Architecture:**
- `/docs/architecture/SYSTEM_ARCHITECTURE.md` - Overall system design
- `/docs/architecture/MULTI_PARTY_ARCHITECTURE.md` - Multi-party approval system
- `/docs/architecture/CONTRACT_SCOPED_RATE_VISIBILITY.md` - Rate privacy system

### **Guides:**
- `/docs/guides/VISUAL_BUILDER_GUIDE.md` - How to use WorkGraph Builder
- `/docs/guides/APPROVAL_SYSTEM_GUIDE.md` - How approvals work
- `/docs/guides/TIMESHEET_GUIDE.md` - Timesheet entry and management

### **Progress:**
- `/docs/roadmap/MASTER_ROADMAP.md` - This file
- `/docs/changelog/RECENT_FIXES.md` - Latest bug fixes and updates

---

## 🔗 Quick Navigation

- **Current Work:** Phase 5 - Integration & Real Data
- **Latest Fixes:** `/docs/changelog/RECENT_FIXES.md`
- **Architecture Docs:** `/docs/architecture/`
- **How-To Guides:** `/docs/guides/`
- **Component READMEs:** Throughout `/components/`

---

## 🚀 Detailed Phase 5 Sprint Plan (2 Weeks)

### **Sprint Goal:**
End-to-end approval execution with policy versioning and real data integration.

---

### **Week 1: Foundation & Engine**

#### **Day 1-2: Policy Versioning + Storage**
- [ ] Create `approval_policies` table with version column
- [ ] Add `policy_version_id` to timesheet_entries
- [ ] Implement "Pinned to vN" badge UI
- [ ] Build one-click rebind wizard
- [ ] **Test:** Switch policy version, verify in-flight items stay on old version

#### **Day 3-4: Approval Engine Core**
- [ ] Parse compiled JSON into executable steps
- [ ] Route timesheet to correct approvers per step
- [ ] Store approval actions in `approval_history` table
- [ ] **Test:** Submit timesheet, verify it routes to Step 1 approver

#### **Day 5: Outbox Pattern**
- [ ] Create `event_outbox` table
- [ ] Emit approval transitions to outbox
- [ ] Implement idempotent handlers with dedupe keys
- [ ] Email webhook stub (console.log for now)
- [ ] **Test:** Retry event, verify exactly-once delivery

---

### **Week 2: Integration & Workbench**

#### **Day 6-7: Real Data Path**
- [ ] Wire UnifiedTimesheetView submit button to engine
- [ ] Create real timesheet entry → execute compiled policy
- [ ] Log all actions to audit table
- [ ] Policy version switching (vN+1)
- [ ] **Test:** Full flow from submit to final approval

#### **Day 8: Notifications**
- [ ] Email on Submitted/Approved/Rejected events
- [ ] Template system for emails
- [ ] Include approval action links
- [ ] **Test:** Receive email on each step transition

#### **Day 9: Approvals Workbench**
- [ ] Read-only list of pending approvals
- [ ] Filter by party/project/step
- [ ] Bulk select UI (checkboxes)
- [ ] Sort by urgency/date/amount
- [ ] **Test:** Filter 5k items in < 200ms

#### **Day 10: Simulator Enhancements**
- [ ] Presets: overtime, expired contract, PO overspend
- [ ] "View on graph" link from simulation steps
- [ ] Export simulation report (JSON/PDF)
- [ ] **Test:** Run all presets, verify correct behavior

---

### **Exit Criteria Checklist:**

- [ ] ✅ Submit timesheet → auto-routes through 3-party chain
- [ ] ✅ Each step executes compiled policy vN correctly
- [ ] ✅ Switching to vN+1 leaves in-flight on vN
- [ ] ✅ New timesheets use vN+1 automatically
- [ ] ✅ Rate masking works via API (not just UI)
- [ ] ✅ p95 approval queue fetch < 200ms on 5k items
- [ ] ✅ Zero validation errors in 10 demo flows
- [ ] ✅ Rollback policy version in < 1s
- [ ] ✅ Audit shows who changed what/when
- [ ] ✅ 100% masked fields honored across all versions
- [ ] ✅ Exactly-once email delivery under retries

---

### **Risks & Mitigation:**

| Risk | Mitigation |
|------|------------|
| Policy compilation bugs | Extensive testing with golden fixtures |
| Performance on 5k items | Add indexes, precompute visibility |
| Email delivery failures | Outbox pattern with retry logic |
| Version migration issues | Rollback capability, thorough testing |
| Rate leakage via API | Server-side masking, API integration tests |

---

## 💡 Immediate Next Steps

### **Today (2025-10-31):**
1. ✅ Review updated roadmap
2. ⏳ Create `/docs/guides/PHASE_5_SPRINT_GUIDE.md` with detailed tasks
3. ⏳ Set up project board (GitHub Issues or similar)
4. ⏳ Create data model for policy versioning

### **This Week:**
1. Implement policy versioning
2. Build approval engine core
3. Set up outbox pattern

### **Next Week:**
1. Real data integration
2. Notifications
3. Approvals workbench

---

**Status:** ✅ All MVP features complete  
**Focus:** Starting Phase 5 - 2 Week Sprint  
**Last Major Update:** 2025-10-31 (Roadmap updated with detailed requirements)  
**Next Milestone:** Phase 5 completion (2 weeks from start)