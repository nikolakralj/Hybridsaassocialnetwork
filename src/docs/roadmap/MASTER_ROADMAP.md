# 🗺️ WorkGraph Master Roadmap

**Last Updated:** 2025-11-12  
**Latest Changes:** 
- ✅ Added **Email Notification Strategy** to Phase 5 Day 8 (progressive notifications with user preferences)
- ✅ Added **SOW (Statement of Work) Foundation** to Phase 6 Week 1-2 (critical for expense management)
- ✅ Added **Enhanced Project Creation** to Phase 6 Week 1 (Quick Start + Advanced modes)
- ✅ Updated Phase 7 Expense Management to integrate with SOW architecture
- ✅ Created comprehensive documentation: `/docs/SOW_ARCHITECTURE.md`, `/docs/ENHANCED_PROJECT_CREATION.md`

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
**Status:** ✅ Complete and production-ready

---

### **Phase 1A-1C: Drag-and-Drop Multi-Person Timesheet** ✅
- **1A:** Basic drag-drop between days
- **1B:** Multi-person support
- **1C:** Enhanced design system (Warp-inspired)

**Location:** `/components/timesheets/drag-drop/`  
**Status:** ✅ Complete

---

### **Phase 2: 3-Layer Approval System** ✅
- Contract-based visual grouping
- Weekly granularity with monthly invoicing
- PDF invoice generation
- Batch approval workflows
- Multi-party approval chains

**Location:** `/components/timesheets/approval-v2/`  
**Docs:** `/docs/COMPREHENSIVE_APPROVAL_SYSTEM.md`  
**Status:** ✅ Complete and production-ready

---

### **Phase 3: Multi-Party Project Architecture** ✅
- Real-world multi-company scenarios
- Multiple contracts per project
- Different rates per contract
- Hierarchical approval flows
- Contract-scoped rate visibility

**Location:** `/types/contracts.ts`, `/components/workgraph/`  
**Docs:** `/docs/MULTI_PARTY_APPROVAL_ARCHITECTURE.md`, `/docs/CONTRACT_SCOPED_RATE_VISIBILITY.md`  
**Status:** ✅ Complete and production-ready

---

### **Phase 3.5: Database Integration & Data Consistency** ✅ **JUST COMPLETED!**
- ✅ Migrated from hybrid KV + Supabase to **pure Supabase architecture**
- ✅ Real-time data synchronization across all tabs (WorkGraph ↔ Timesheets)
- ✅ Fixed critical timezone bug (UTC vs local time parsing)
- ✅ Verified data consistency: WorkGraph and Timesheets now show **identical hour totals**
- ✅ Timezone-aware date filtering for accurate month calculations

**Key Fix:** October 1st was being counted as September due to UTC timezone conversion.  
**Solution:** Parse dates in local timezone using manual splitting instead of `new Date()` constructor.  
**Impact:** All views now accurately count hours within the selected month boundaries.

**Status:** ✅ Complete - Data layer is stable and production-ready

---

### **Phase 4: WorkGraph Visual Builder** ✅
- Node-based approval flow designer
- Party nodes, Contract nodes, Person nodes
- Edge configuration (approval routes)
- Policy compilation
- Policy simulation with rate visibility testing

**Location:** `/components/workgraph/`  
**Status:** ✅ Complete

---

## 🎯 Current Status (2025-11-12)

### **✅ Just Completed (November 14):**
1. **Local Scope Visibility Architecture** - Critical multi-tenant scalability feature ✅
   - ✅ Replaced complex projection model with simple "show my contracts only" approach
   - ✅ Each org sees only their direct contracts (1st-degree neighbors)
   - ✅ Database schema: `project_contracts`, `project_participants`, `project_role_assignments`
   - ✅ API service with graph projection (no masking needed!)
   - ✅ TypeScript types and React hooks (`useProjectContracts`)
   - ✅ Documentation: `/docs/architecture/LOCAL_SCOPE_VISIBILITY.md`
   - ✅ Impact: Scales to any project size, clear privacy model, matches real business workflows

2. **WorkGraph Transaction Separation** - Scalability fix ✅
   - ✅ Removed timesheet nodes from WorkGraph (prevented 2,600+ nodes/year pollution)
   - ✅ WorkGraph = POLICY (structure, contracts, approval rules)
   - ✅ Approvals Tab = TRANSACTIONS (timesheet submissions, invoices)
   - ✅ Documentation: `/docs/architecture/WORKGRAPH_TRANSACTION_SEPARATION.md`

### **Previously Completed (November 12):**
1. **Database Timezone Bug Fix** - Critical data sync issue resolved
   - ✅ Fixed WorkGraph showing 229.5h vs Timesheets showing 228.0h for same month
   - ✅ Root cause: UTC vs local timezone parsing in date filters
   - ✅ Solution: Custom date parsing in both `useNodeStats` and `MonthlyTimesheetDrawer`
   - ✅ Verified: Both views now show identical totals

2. **Documentation Cleanup** - Major reorganization complete
   - ✅ Deleted 26 outdated files (fix guides, implementation logs, duplicates)
   - ✅ Consolidated roadmap into single source of truth
   - ✅ Created `/docs/DOCUMENTATION_CLEANUP_LOG.md` for audit trail
   - ✅ Updated `/docs/README.md` with clean navigation structure
   - ✅ 56% reduction in doc files (46 → 20)

### **Earlier Completions:**
1. **Phase 5 Day 1-2** - Policy Versioning + Storage ✅
2. **M5.1 Minimal (80% Complete)** - Project creation system
3. **Roadmap expansion** - Enterprise requirements for Phases 5-13

**Status:** Core features (Phases 1-4) are production-ready. Local scope visibility implemented. Documentation is clean and organized.  
**Next:** Build UI components for contract management and invitations  
**Priority:** Finish Phase 5 with email notifications, then move to Enhanced Project Creation

---

## 🚀 Next Phases

### **Phase 5: Integration & Real Data** 🔄 IN PROGRESS

**Duration:** 2 weeks (10 working days)  
**Status:** Days 1-7 complete (70%) | 17/17 features complete (100% of Days 1-7)  
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
- **M5.6: Project Approvals Tab** ✅ Complete (Day 6)
- **M5.7: Deep-Links + Email Templates** ✅ Complete (Day 7)
- **M5.8-M5.10: Database Integration + Email Notification Strategy** ⏳ Days 8-10

#### **Day 8 Focus: Email Notification Strategy** ⏳ IN PROGRESS

**Progressive Notification System**:

Real-time status in app (always visible):
```
Timesheet #2024-W47
├─ ✅ Approved by TechCorp (You) – 2 hours ago
├─ ⏳ Pending with DevShop Agency  
└─ ⏺️ Awaiting BigClient LLC
```

**Email notification rules**:

| Event | Notify Contractor? | Template | Why |
|-------|-------------------|----------|-----|
| **First node approves** | ✅ **YES (immediate)** | "✅ Approved by {Party}" | Reassurance – "Your work is validated, progress is happening" |
| **Middle nodes approve** | ⚠️ **Optional (digest)** | Daily/weekly summary | Reduce noise, but show in app status |
| **Final approval** | ✅ **YES (immediate)** | "🎉 Fully approved – ready to invoice" | Critical – "You can invoice / get paid" |
| **ANY rejection** | ✅ **YES (immediate)** | "⚠️ Action needed: Rejected by {Party}" | Urgent – needs action, resubmit |

**Psychology**: The contractor just submitted work and is anxious. Getting **any** positive signal within hours builds trust. Without it, contractors wait days in limbo, wondering if their timesheet disappeared.

**User preference config** (in settings):
- ☑️ Notify me at each approval step (default)
- ☐ Only notify on final approval or rejection (quiet mode)

**Implementation**:
- [ ] Email templates for each notification type (4 templates)
- [ ] User preference settings UI
- [ ] Batch digest job for middle-node approvals
- [ ] In-app notification center (real-time status)

**See**: `/docs/guides/EMAIL_NOTIFICATION_STRATEGY.md` (to be created in Phase 5 Day 8)

**Exit Criteria:** [11/11 items in `/docs/roadmap/PHASE_5_SPRINT_GUIDE.md`]

**Location:** `/docs/guides/PHASE_5_DAY_7_COMPLETE.md`

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
- **🆕 SOW (Statement of Work) Foundation**
- **🆕 Enhanced Project Creation (Quick Start + Advanced modes)**

**Key Features:**
- **Week 1:** SOW data model + Enhanced Project Creation wizard
- **Week 2:** Event infrastructure + signed webhooks + SOW integration
- **Week 3:** AI shadow mode (rule engine + anomaly detection)
- **Week 4:** AI assist mode (human in loop)
- **Week 5:** n8n template library (5+ ready-to-use workflows)
- **Week 6-7:** Observability + hardening (metrics, DLQ, audit UI)
- **Week 8:** Polish (graph versioning, GBDT model training)

#### **🆕 SOW Foundation (Week 1-2)** ⭐ **NEW - CRITICAL**

**Goal:** Establish Statement of Work as first-class entity in the system

**Why Now?** SOW is the foundation for:
- Expense management (Phase 7)
- AI contract analysis (Phase 11)
- Budget enforcement and billing
- Multi-doc workflows (MSA + SOW + PO)

**Week 1 Tasks:**
- [ ] **Data Model**
  - Create `sow` table (pricing_model, cap_amount, currency, version, status)
  - Create `sow_line` table (roles, milestones, expense_buckets)
  - Migration scripts for Supabase
  
- [ ] **SOW Node in WorkGraph**
  - Add SOW node type to visual builder
  - Wire solid edges: governs (MSA→SOW), fundedBy (SOW→PO), covers (SOW→Contract)
  - Wire dashed edges: approvedBy (for scope changes, milestones)
  
- [ ] **Basic CRUD UI**
  - Create/edit SOW form
  - Pricing model selector (T&M, Fixed, Milestone, Capped T&M, Retainer)
  - Rate table editor (role → rate grid)
  - Milestone builder (name, date, amount)

**Week 2 Tasks:**
- [ ] **Version Chaining**
  - SOW v1 → v2 with `parent_sow_id`
  - Status transitions: draft → active → superseded
  - Change order workflow
  
- [ ] **Budget & Burn-Down**
  - Link timesheets to SOW
  - Calculate burn-down (consumed / cap)
  - Warn when 80% consumed
  - Prevent over-spending (configurable)
  
- [ ] **Contract Integration**
  - Link contracts to SOW
  - Pull rates from SOW rate table
  - Validate contract dates within SOW period

**Exit Criteria:**
- ✅ Can create SOW with pricing model, cap, rate table
- ✅ SOW versioning works (v1 → v2 with parent link)
- ✅ SOW node appears in Project Graph with correct edges
- ✅ Contracts can reference SOW and pull rates
- ✅ Budget burn-down displays correctly in timesheet drawer
- ✅ Version chip shows "v2" and allows viewing history

**See:** `/docs/SOW_ARCHITECTURE.md` for complete specification

---

#### **🆕 Enhanced Project Creation (Week 1)** ⭐ **NEW - HIGH PRIORITY**

**Goal:** Reduce friction for new users while supporting enterprise complexity

**Current Problem:** 
- M5.1 created "minimal" project creation (80% complete)
- No scaffolding for SOW/Contracts/PO
- No templates or guided setup
- Users forced to configure everything manually

**Solution:** Two-mode wizard

| Mode | Time | Creates | Best for |
|------|------|---------|----------|
| **Quick Start** ✨ | 60s | Project + Parties + Approval template | New freelancers, internal teams, rapid prototyping |
| **Advanced** 🔧 | 3-5min | + SOW + Contracts + PO + Rate tables | Agencies, multi-party projects, enterprise |

**Week 1 Tasks:**
- [ ] **Quick Start Mode (3 steps)**
  - Step 1: Basics (name, region, currency, work week, visibility)
  - Step 2: Parties (your company, client, vendors, people)
  - Step 3: Approval template (Solo→Client, Vendor→Agency→Client, Internal)
  - Smart domain detection (first external = client, others = vendor)
  - "Demo Data" toggle for sandbox projects
  
- [ ] **Advanced Mode (+2 steps)**
  - Step 4: SOW/Scope (pricing model, cap, rate table, milestones)
  - Step 5: Contracts & PO (auto-generate from SOW, PO number/amount)
  - "Upload SOW PDF → AI prefill" toggle (placeholder for Phase 11)
  
- [ ] **Post-Creation Experience**
  - Land on Project Overview with "Open Project Graph" CTA
  - Setup checklist for incomplete items (Add SOW, Generate Contracts, etc.)
  - AI extract review pane (if PDF uploaded)

**Exit Criteria:**
- ✅ Quick Start mode creates project in <60 seconds
- ✅ Advanced mode supports SOW + Contract + PO scaffolding
- ✅ Demo data toggle generates realistic sandbox data (2 weeks timesheets, 5 expenses, 1 invoice)
- ✅ Approval templates work (Solo, Vendor→Agency→Client, Internal)
- ✅ Post-creation checklist guides incomplete setups
- ✅ "Open Project Graph" lands on valid, editable graph
- ✅ Rate visibility defaults are correct (contract parties only)
- ✅ Zero duplicate parties created (smart domain detection works)

**See:** `/docs/ENHANCED_PROJECT_CREATION.md` for complete specification

---

**Exit Criteria (Phase 6 Overall):**
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

### **Phase 7: Expense Management & Document Capture** ⭐ **NEW**
**Goal:** Enable contractors to submit expenses with receipts and support scanned timesheet verification  
**Duration:** 2 weeks  
**Priority:** HIGH - Critical contractor workflow

#### **Core Features:**
- [ ] **Expense Entry & Categories**
  - Create expense line items (meals, travel, mileage, materials)
  - Link expenses to timesheet periods
  - Mileage calculator (distance → $ using IRS rate)
  - Per diem support
  - Billable vs reimbursable tracking

- [ ] **Receipt Management**
  - Mobile camera capture (PWA)
  - File upload (PDF, images)
  - Multiple receipts per expense
  - Supabase Storage integration (private bucket)
  - Inline PDF/image viewer with zoom
  
- [ ] **Scanned Timesheet Verification** ⭐
  - Upload scanned paper timesheet (phone photo)
  - Split-screen comparison view (scanned vs digital)
  - Discrepancy detection
  - One-click correction (use scanned value)
  - Audit trail (original scan + digital entry)

- [ ] **Policy Compliance Engine**
  - Receipt requirement rules (e.g., required over $75)
  - Amount limits per transaction/week
  - Real-time validation in UI
  - Policy violation flags (missing receipt, over limit)
  - Business rules (e.g., alcohol not billable)

- [ ] **Approval Workflows**
  - Combined time + expense approval screen
  - Split approval paths (different approvers for expenses)
  - Finance approval for high-value expenses
  - Expense-specific comments/rejection reasons
  - Policy violations shown in approval queue

- [ ] **Reporting & Export**
  - Expense summary by category
  - Tax-ready expense reports
  - QuickBooks export (CSV)
  - Contractor reimbursement reports
  - Billable vs non-billable breakdown

- [ ] **Mobile-First Features**
  - GPS mileage tracking
  - PWA shortcut for quick receipt capture
  - Offline expense queue
  - Background sync when online
  - Lock-screen camera access

#### **Industry Standards Applied:**
- 📊 **Concur (SAP)**: Policy compliance, approval routing, multi-currency
- 📱 **Expensify**: SmartScan OCR, real-time tracking, inline viewers
- 🚗 **Rydoo**: Mobile-first capture, expense categorization
- 💼 **QuickBooks**: Billable expense tracking, accounting export

#### **Database Schema:**
```sql
expenses (id, project_id, contract_id, timesheet_period_id, 
          expense_category_id, contractor_id, expense_date, amount,
          description, merchant_name, receipt_urls[], scanned_timesheet_url,
          is_billable, is_reimbursable, status, policy_violation_flags[])
          
expense_categories (id, project_id, name, code, is_billable, is_taxable,
                    requires_receipt, max_amount_without_receipt,
                    reimbursement_rate, tax_category)
                    
expense_approvals (id, expense_id, step_number, approver_id, status,
                   decision_at, comments)
                   
combined_submissions (id, project_id, contractor_id, period_start_date,
                      timesheet_period_id, expense_ids[], total_hours,
                      total_expenses, total_amount_due, status)
```

#### **Week 1 Tasks:**
**Day 1-2:** Data model, basic expense entry, file upload  
**Day 3-4:** Receipt management, mobile capture, PDF viewer  
**Day 5:** Categories, mileage tracking, policy engine

#### **Week 2 Tasks:**
**Day 6-7:** Approval workflows, scanned timesheet comparison  
**Day 8-9:** Reporting, export, QuickBooks integration  
**Day 10:** Mobile PWA, GPS tracking, offline mode

#### **Exit Criteria:**
- ✅ Contractor can submit expenses with receipts
- ✅ Manager can approve/reject expenses
- ✅ All receipts stored securely in Supabase Storage
- ✅ Policy violations flagged before submission
- ✅ Mobile receipt capture works on iOS/Android
- ✅ Scanned timesheet comparison view functional
- ✅ Export to accounting system (CSV)
- ✅ Zero data loss with offline mode

**See:** `/docs/EXPENSE_MANAGEMENT_ARCHITECTURE.md` for complete specification

---

### **Phase 8: Visual Builder UX & Quality** (Previously Phase 7)
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

### **Phase 9: Security, Governance & Backend**
**Goal:** Enterprise-grade security, compliance, and full production system

#### **Security & Governance (Hard Requirements):**
- [ ] **Policy Versioning + Pinning** ⭐ (moved from Phase 5)
  - Immutable policy versions
  - In-flight items stay on vN, new items use vN+1
  - UI: "Pinned to vN" badge on each open timesheet
  - One-click rebind wizard
  - **DoD:** Rollback in <1s; audit shows who changed what/when; 100% masked fields honored across versions
  
- [ ] **Graph Structure Versioning** ⭐ **CRITICAL - MISSING FROM ROADMAP!**
  - Temporal tracking of project structure changes (companies joining/leaving)
  - Each graph edit creates a new version snapshot
  - Historical timesheets reference the graph structure that was active at that time
  - Database: `graph_versions` table with `effective_from_date` and `effective_to_date`
  - Use cases: Company leaves mid-month, contractor changes companies, org restructuring
  - **DoD:** Can view any historical timesheet with the exact org structure that existed then; complete audit trail of all structural changes
  - **See:** `/docs/TEMPORAL_GRAPH_VERSIONING.md` for complete spec
  
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

### **Phase 10: AI Agents (Opt-in, Safe)**
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

### **Phase 11: AI Contract Intelligence** ⭐ **NEW - HIGH VALUE**
**Goal:** AI-powered contract analysis and automatic graph generation  
**Duration:** 3 weeks  
**Priority:** HIGH - Massive time saver for onboarding

#### **Core Features:**

- [ ] **PDF Contract Upload & OCR**
  - Drag-and-drop contract PDF
  - OCR text extraction (Google Cloud Vision / AWS Textract)
  - Support MSA, SOW, Fixed Price, T&M contracts
  - Multi-page document handling
  - Extract tables, clauses, signatures

- [ ] **AI Structured Extraction (GPT-4 / Claude)**
  - Extract party names (client, vendor, agency, subcontractors)
  - Identify contract type (MSA, SOW, T&M, Fixed Price)
  - Parse dates (start, end, renewal, payment milestones)
  - Extract rates (hourly, daily, monthly, fixed)
  - Parse payment terms (NET 30, NET 60, milestone-based)
  - Identify approval requirements
  - Extract expense reimbursement rules
  - Detect budget/PO references
  - Identify deliverables and milestones

- [ ] **Auto-Generate Project Graph**
  - Create Party/Org nodes for each company
  - Create Contract nodes with extracted terms
  - Create Person nodes (if named in contract)
  - Create SOW nodes (if sub-scopes identified)
  - Create PO nodes (if purchase orders referenced)
  - Wire billsTo edges between parties
  - Wire hasContract edges
  - Generate approval flow edges (based on approval clauses)
  - Position nodes intelligently (auto-layout)

- [ ] **Confidence Scoring & Review**
  - AI confidence per field (95% parties, 78% approval flow)
  - Highlight low-confidence extractions for review
  - Side-by-side: PDF (left) vs Generated Graph (right)
  - Click to correct: "AI said NET 30, actually NET 45"
  - Learn from corrections (fine-tune model)

- [ ] **Expense Policy Extraction**
  - Parse reimbursable expense categories
  - Extract per-diem rates
  - Find mileage reimbursement rate
  - Identify receipt requirements
  - Detect non-billable items (alcohol, etc.)
  - Auto-populate expense policy rules

- [ ] **Approval Flow Intelligence**
  - Detect approval hierarchy from contract language
  - Extract approval thresholds ("manager up to $5000")
  - Identify escalation paths
  - Parse SLA requirements ("approve within 48 hours")
  - Auto-wire approval edges with conditions

#### **UI Workflow:**

```
Step 1: Upload Contract
┌────────────────────────────────┐
│ 📄 New Project from Contract  │
├────────────────────────────────┤
│ Drag PDF contract here or      │
│ [Browse Files]                 │
│                                │
│ Supported: MSA, SOW, T&M       │
└────────────────────────────────┘

Step 2: AI Analysis (15-30 seconds)
┌────────────────────────────────┐
│ 🤖 Analyzing contract...       │
├────────────────────────────────┤
│ ✅ Extracted parties (2 found) │
│ ✅ Found contract dates        │
│ ✅ Parsed rate: $125/hr        │
│ ⏳ Analyzing approval flow...  │
└────────────────────────────────┘

Step 3: Review & Confirm
┌─────────────────────────────────────────────┐
│ PDF Preview          │  Generated Graph     │
├──────────────────────┼──────────────────────┤
│ [Contract PDF]       │  [Enterprise Client] │
│                      │         │            │
│ Page 1/8            │         ↓ billsTo    │
│ Zoom: [+ -]         │  [Acme Dev Studio]   │
│                      │         │            │
│ Highlighted:         │         ↓ hasContract│
│ "Rate: $125/hr"     │  [MSA-2025-001]      │
│                      │   Rate: $125/hr ✅   │
│                      │   NET 30 ✅          │
│                      │                      │
│ ⚠️  Low confidence:  │  Approval Flow: 78%  │
│ "Approval by PM"     │  [Review Required]   │
└─────────────────────────────────────────────┘

Confidence Scores:
✅ Parties: 95%
✅ Dates: 98%
✅ Rate: 92%
⚠️  Approval flow: 78%  ← Click to review
✅ Payment terms: 90%

[Re-analyze]  [Edit Manually]  [Create Project]

Step 4: Project Created!
✅ Project "Enterprise Client - Q4 2025" created
✅ 2 parties added
✅ 1 contract configured
✅ Approval flow wired
✅ Expense policy applied

[Open Project] [Add Team Members]
```

#### **Database Schema:**

```sql
-- Store AI analysis results
CREATE TABLE contract_analysis (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  contract_pdf_url TEXT NOT NULL,
  extracted_text TEXT,
  ai_model TEXT,                        -- "gpt-4-turbo", "claude-3"
  ai_response JSONB,                    -- Structured extraction
  confidence_scores JSONB,              -- Per-field confidence
  reviewed BOOLEAN DEFAULT false,
  corrections JSONB,                    -- User corrections for learning
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI model training data (for fine-tuning)
CREATE TABLE contract_corrections (
  id UUID PRIMARY KEY,
  contract_analysis_id UUID REFERENCES contract_analysis(id),
  field_name TEXT,                      -- "rate", "approval_flow"
  ai_extracted_value TEXT,
  user_corrected_value TEXT,
  contract_excerpt TEXT,                -- The relevant text from PDF
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **AI Prompt Engineering:**

```typescript
const analyzeContractPrompt = (contractText: string) => `
You are a contract analysis expert. Analyze this contract and extract structured data.

Contract text:
${contractText}

Extract the following in valid JSON format:

{
  "parties": [
    {
      "name": "Company name",
      "role": "client | vendor | agency | subcontractor",
      "confidence": 0.95
    }
  ],
  "contractType": "MSA | SOW | T&M | Fixed Price",
  "dates": {
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "renewalDate": "YYYY-MM-DD or null",
    "confidence": 0.98
  },
  "rate": {
    "amount": 125.00,
    "unit": "hourly | daily | monthly | fixed",
    "currency": "USD",
    "confidence": 0.92
  },
  "paymentTerms": {
    "net": 30,
    "milestones": [],
    "confidence": 0.90
  },
  "approvalFlow": {
    "steps": [
      {
        "role": "manager",
        "threshold": 5000,
        "description": "Manager approves up to $5000"
      }
    ],
    "sla": "48 hours",
    "confidence": 0.78
  },
  "expensePolicy": {
    "reimbursableCategories": ["travel", "materials"],
    "receiptsRequiredOver": 75,
    "mileageRate": 0.67,
    "perDiem": null,
    "nonBillableItems": ["alcohol"],
    "confidence": 0.85
  },
  "budgets": {
    "totalAmount": 50000,
    "poNumber": "PO-2025-Q4-0042",
    "confidence": 0.88
  }
}

IMPORTANT:
- Provide confidence score (0-1) for each section
- If unsure, set confidence < 0.8
- Extract exact text for key fields
- Return valid JSON only
`;
```

#### **Week 1 Tasks:**
**Day 1-2:** PDF upload, OCR extraction, basic AI integration  
**Day 3-4:** Structured extraction, confidence scoring  
**Day 5:** Auto-generate graph nodes/edges from AI data

#### **Week 2 Tasks:**
**Day 6-7:** Review UI, side-by-side comparison, corrections  
**Day 8-9:** Expense policy extraction, approval flow intelligence  
**Day 10:** User testing, prompt refinement

#### **Week 3 Tasks:**
**Day 11-13:** Fine-tuning with corrections, model learning  
**Day 14-15:** Production hardening, error handling, polish

#### **Exit Criteria:**
- ✅ Upload PDF contract → Auto-generates graph
- ✅ Accuracy ≥90% for parties, dates, rates
- ✅ Accuracy ≥75% for approval flows (with review)
- ✅ User can review and correct extractions
- ✅ Corrections improve future extractions (learning)
- ✅ Side-by-side PDF comparison works
- ✅ Supports MSA, SOW, T&M, Fixed Price contracts
- ✅ Zero hallucinations (confidence scoring prevents)

**See:** `/docs/PROJECT_GRAPH_EXPLAINED.md` for AI contract analysis workflow

**Priority:** HIGH - Can reduce project setup from 2 hours → 5 minutes!  
**ROI:** Massive time savings, fewer setup errors, better compliance

---

### **Phase 12: Admin & UX Excellence** (Previously Phase 11)
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

### **Phase 13: Platform & Integrations**
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

### **Phase 14: Packaging & Pricing**
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

### **Phase 15: Social Features**
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

### **Today (2025-11-12):**
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
**Last Major Update:** 2025-11-12 (Roadmap updated with detailed requirements)  
**Next Milestone:** Phase 5 completion (2 weeks from start)