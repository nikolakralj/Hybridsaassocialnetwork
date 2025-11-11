# Project Graph Configuration Guide

**Last Updated:** November 7, 2025  
**Status:** Revised with Phase Roadmap Alignment  
**Related:** [Roadmap Alignment Analysis](/docs/project-graph/ROADMAP-ALIGNMENT-ANALYSIS.md)

---

## 📋 Overview

This guide explains **what properties each node and edge should have** and **what information should be displayed** when you click on them in the Project Graph Builder.

### 🎯 **Phase Labels:**
- **[Phase 4 ✅]** - Already implemented and working
- **[Phase 5 🔄]** - Currently in progress (database integration)
- **[Phase 7 ⏳]** - Planned for future (builder UX enhancements)
- **[Phase 8 ⏳]** - Planned for future (security & governance)
- **[Phase 9 ⏳]** - Planned for future (AI agents)
- **[Phase 10 ⏳]** - Planned for future (admin excellence)

---

## 🎯 Company-to-Company Relationships **[Phase 4 ✅]**

### ❓ Your Question: "If I have 2 companies with a contract between them, should it be: `node(company) → node(contract) → node(second company)`?"

### ✅ Answer: YES, but with nuance:

There are **TWO valid patterns** depending on the relationship type:

#### **Pattern 1: Commercial Contract Between Companies**
```
[Company A] ──(contract node)──→ [Company B]
```
**When to use:** Master Service Agreement (MSA), vendor contracts, subcontracting agreements

**Example:**
```
[Acme Corp] ──(MSA Contract: $150/hr, 1000hr cap)──→ [Global Corp]
```

**How to create:**
1. Add `Party` node → Name: "Acme Corp", Type: "Company"
2. Add `Party` node → Name: "Global Corp", Type: "Client"
3. Add `Contract` node → Set "Party A" = Acme Corp, "Party B" = Global Corp
4. Set hourly rate: $150/hr
5. Connect: `Acme Corp` → `Contract` → `Global Corp`

---

#### **Pattern 2: Approval Flow (No Contract Node)**
```
[Company A] ──(approves edge)──→ [Company B]
```
**When to use:** Hierarchical approval chains, managerial sign-off

**Example:**
```
[Acme Corp] ──(approves: order=2)──→ [Global Corp]
```

**How to create:**
1. Add `Party` node → Name: "Acme Corp", Type: "Company"
2. Add `Party` node → Name: "Global Corp", Type: "Client"
3. **Draw edge from Acme to Global**
4. Click edge → Set "Edge Type" = "Approves"
5. Set "Approval Order" = 2
6. Check "Required Approval"

---

## 📦 Node Types & Properties

### 1️⃣ **PERSON NODE** 👤

#### **When to use:**
- Individual workers (freelancers, contractors, employees)
- People who submit timesheets
- People in approval chains

---

#### **✅ Currently Available (Phase 4)**

##### **Basic Properties:**
| Property | Type | Required | Example | Phase | Notes |
|----------|------|----------|---------|-------|-------|
| **Name** | Text | ✅ Yes | "Sarah Chen" | Phase 4 ✅ | Full name of person |
| **Email** | Email | ❌ No | "sarah@acme.com" | Phase 4 ✅ | For notifications |
| **Role** | Text | ❌ No | "Senior Engineer" | Phase 4 ✅ | Job title/role |
| **Company** | Text | ❌ No | "Acme Corp" | Phase 4 ✅ | Which company employs them |

##### **Permissions (Checkboxes):**
| Permission | Phase | Description | Typical For |
|------------|-------|-------------|-------------|
| **Can Approve** | Phase 4 ✅ | Can approve others' timesheets | Managers, Team Leads |
| **Can View Rates** | Phase 4 ✅ | Can see hourly/daily rates | Contractors (see own rate) |
| **Can Edit Timesheets** | Phase 4 ✅ | Can modify timesheet entries | All workers |

---

#### **🔄 Coming in Phase 5 (Database Integration)**

These features will be added when we connect to the real database:

##### **Activity Stats (from Timesheet Database):**
| Property | Type | Example | Phase | Implementation |
|----------|------|---------|-------|----------------|
| **Total Hours Worked** | Number | 1,650 hrs | Phase 5 🔄 | `SUM(timesheet_entries.hours) WHERE userId = ?` |
| **Total Hours This Month** | Number | 128 hrs | Phase 5 🔄 | `SUM(hours) WHERE month = current AND userId = ?` |
| **Last Timesheet Submitted** | Timestamp | "2 hours ago" | Phase 5 🔄 | `MAX(submitted_at) WHERE userId = ?` |
| **Pending Timesheets** | Count | 2 | Phase 5 🔄 | `COUNT(*) WHERE status = 'pending' AND userId = ?` |
| **Current Week Hours** | Progress | 32 / 40 hrs | Phase 5 🔄 | Week aggregation query |
| **Current Month Hours** | Progress | 128 / 160 hrs | Phase 5 🔄 | Month aggregation query |

##### **Graph Relationships (from WorkGraph):**
| Property | Type | Example | Phase | Implementation |
|----------|------|---------|-------|----------------|
| **Employed By** | Link | "Acme Corp" | Phase 5 🔄 | Traverse "employs" edges |
| **Works On Contracts** | Count | 2 active | Phase 5 🔄 | Count contract nodes connected |
| **Approves To** | Chain | "Acme → Global (2-step)" | Phase 5 🔄 | Traverse "approves" edges |

---

#### **⏳ Future Enhancements (Phase 7+)**

These are planned but NOT implemented yet:

##### **Contract Details [Phase 7 ⏳]**
- Contract References (which contracts person works under)
- Hourly Rate (if direct contractor)
- Start Date / End Date (contract duration)
- Weekly/Monthly Hour Limits (from contract)

##### **Advanced Stats [Phase 8 ⏳]**
- Average Weekly Hours (12-week rolling)
- Utilization Rate (billable vs total hours)
- Overtime Hours (above contract limits)
- Revenue Generated (hours × rate)

##### **Approvals Metrics [Phase 10 ⏳]**
- Pending Approvals Awaiting This Person
- Average Approval Time
- Approval SLA Compliance

---

### 2️⃣ **PARTY NODE (Company/Agency/Client)** 🏢

#### **When to use:**
- Companies employing workers
- Staffing agencies
- End clients
- Contracting firms

---

#### **✅ Currently Available (Phase 4)**

##### **Basic Properties:**
| Property | Type | Required | Example | Phase | Notes |
|----------|------|----------|---------|-------|-------|
| **Name** | Text | ✅ Yes | "Acme Corp" | Phase 4 ✅ | Company name |
| **Party Type** | Dropdown | ✅ Yes | Company / Agency / Client | Phase 4 ✅ | Organization type |
| **Role/Title** | Text | ❌ No | "Prime Vendor" | Phase 4 ✅ | Relationship to project |
| **Organization ID** | System | Auto | "org-acme-123" | Phase 4 ✅ | If linked to real company |
| **Logo** | Emoji | Auto | "🏢" | Phase 4 ✅ | Visual identifier |

##### **Permissions (Checkboxes):**
| Permission | Phase | Description | Typical For |
|------------|-------|-------------|-------------|
| **Can Approve** | Phase 4 ✅ | Company can approve timesheets | Vendors, Clients |
| **Can View Rates** | Phase 4 ✅ | Company can see billing rates | Direct contract parties |
| **Can Edit Timesheets** | Phase 4 ✅ | Company can modify entries | Employers only |

---

#### **🔄 Coming in Phase 5 (Database Integration)**

##### **People Stats (from Graph):**
| Property | Type | Example | Phase | Implementation |
|----------|------|---------|-------|----------------|
| **Total Employees on Project** | Count | 5 people | Phase 5 🔄 | Count "employs" edges from this party |
| **Active Workers** | Count | 5 | Phase 5 🔄 | Filter by active status |
| **Employee List** | Names | "Sarah, Ian, Lisa..." | Phase 5 🔄 | List connected person nodes |

##### **Contract Stats (from Graph):**
| Property | Type | Example | Phase | Implementation |
|----------|------|---------|-------|----------------|
| **Total Active Contracts** | Count | 3 | Phase 5 🔄 | Count contract nodes where party is A or B |
| **Contract List** | Names | "MSA with Global..." | Phase 5 🔄 | List connected contracts |

##### **Activity Stats (from Database):**
| Property | Type | Example | Phase | Implementation |
|----------|------|---------|-------|----------------|
| **Total Hours This Month** | Number | 640 hrs | Phase 5 🔄 | Sum hours for all employees |
| **Last Activity** | Timestamp | "5 min ago" | Phase 5 🔄 | Max timestamp from employees |

---

#### **⏳ Future Enhancements (Phase 7+)**

##### **Contact Information [Phase 7 ⏳]**
- Primary Contact Name
- Contact Email / Phone
- Business Address
- Website

##### **Financial Details [Phase 8 ⏳]**
- Total Contract Value
- Budget Used / Remaining
- Total Monthly Spend
- Average Hourly Rate
- Payment Terms (Net 30, Net 60)
- Currency (USD, EUR, GBP)

##### **Compliance [Phase 8 ⏳]**
- Tax ID / VAT Number
- Legal Entity Name
- Data Residency (US/EU/UK)

---

### 3️⃣ **CONTRACT NODE** 📄

#### **When to use:**
- Define financial terms between two parties
- Set rate/visibility rules
- Establish hour limits

---

#### **✅ Currently Available (Phase 4)**

##### **Basic Properties:**
| Property | Type | Required | Example | Phase | Notes |
|----------|------|----------|---------|-------|-------|
| **Name** | Text | ✅ Yes | "MSA: Acme ↔ Global" | Phase 4 ✅ | Contract title |
| **Contract Type** | Dropdown | ✅ Yes | Hourly / Daily / Fixed / Custom | Phase 4 ✅ | Billing model |
| **Hourly Rate** | Number | Conditional | $150.00 | Phase 4 ✅ | If type = Hourly |
| **Daily Rate** | Number | Conditional | $1200.00 | Phase 4 ✅ | If type = Daily |
| **Fixed Amount** | Number | Conditional | $50,000 | Phase 4 ✅ | If type = Fixed |
| **Party A** | Dropdown | ✅ Yes | "Acme Corp" | Phase 4 ✅ | Vendor/Worker |
| **Party B** | Dropdown | ✅ Yes | "Global Corp" | Phase 4 ✅ | Client/Agency |
| **Weekly Hour Limit** | Number | ❌ No | 40 | Phase 4 ✅ | Max hours/week |
| **Monthly Hour Limit** | Number | ❌ No | 160 | Phase 4 ✅ | Max hours/month |

##### **Rate Visibility:**
| Property | Phase | Description |
|----------|-------|-------------|
| **Hide Rate From** | Phase 4 ✅ | Checkboxes for additional parties to hide rate from |
| **Visible To** | Phase 4 ✅ | Automatically Party A and Party B only |

---

#### **🔄 Coming in Phase 5 (Database Integration)**

##### **Usage Stats (from Timesheet Database):**
| Property | Type | Example | Phase | Implementation |
|----------|------|---------|-------|----------------|
| **Total Hours Worked** | Number | 1,650 hrs | Phase 5 🔄 | Sum hours where contractId = ? |
| **Total Amount Billed** | Money | $247,500 | Phase 5 🔄 | hours × hourly_rate |
| **Current Week Hours** | Progress | 32 / 40 hrs | Phase 5 🔄 | Week aggregation |
| **Current Month Hours** | Progress | 128 / 160 hrs | Phase 5 🔄 | Month aggregation |
| **Budget Utilization** | Percentage | 82.5% | Phase 5 🔄 | (used / limit) × 100 |

##### **Worker Stats (from Graph):**
| Property | Type | Example | Phase | Implementation |
|----------|------|---------|-------|----------------|
| **Workers on Contract** | Count | 3 people | Phase 5 🔄 | Count person nodes connected via this contract |
| **Worker List** | Names | "Sarah, Ian, Lisa" | Phase 5 🔄 | List connected person nodes |

---

#### **⏳ Future Enhancements (Phase 7+)**

##### **Contract Lifecycle [Phase 7 ⏳]**
- Contract Status (Active / Pending / Expired / Terminated)
- Start Date / End Date
- Contract Duration
- Auto-Renew (Yes/No)
- Notice Period (days)
- SOW Reference (link to document)
- Contract ID (external reference)

##### **Financial Tracking [Phase 8 ⏳]**
- Total Budget Cap
- Budget Remaining
- Burn Rate ($/month)
- Projected Completion Date
- Overtime Multiplier (1.5x after X hours)
- Payment Schedule (Bi-weekly / Monthly)
- Invoice Frequency
- Payment Terms (Net 30, etc.)

##### **Advanced Features [Phase 8 ⏳]**
- Currency (USD, EUR, GBP)
- Multi-currency conversion
- Approved By (signatures)
- Compliance attachments

---

## 🔗 Edge Types & Properties

### 1️⃣ **APPROVES EDGE** ✅ **[Phase 4 ✅]**

#### **Visual:** Green arrow with number badge

#### **When to use:**
- Hierarchical approval chains
- Timesheet sign-off flows
- Manager → Employee relationships

---

#### **✅ Currently Available (Phase 4)**

| Property | Type | Required | Example | Phase | Notes |
|----------|------|----------|---------|-------|-------|
| **Edge Type** | Dropdown | ✅ Yes | "Approves" | Phase 4 ✅ | Locked to this type |
| **Approval Order** | Number | ✅ Yes | 1, 2, 3 | Phase 4 ✅ | Sequence in chain |
| **Required** | Checkbox | ✅ Yes | ✓ | Phase 4 ✅ | Can skip? |

#### **Flow Example:**
```
[Sarah Chen] ──(approves: order=1)──→ [Acme Corp] ──(approves: order=2)──→ [Global Corp]
```
**Meaning:** Sarah submits → Acme approves (step 1) → Global approves (step 2)

---

#### **🔄 Coming in Phase 5 (Database Integration)**

##### **Approval Metrics:**
| Property | Type | Example | Phase | Implementation |
|----------|------|---------|-------|----------------|
| **Total Approvals** | Count | 127 | Phase 5 🔄 | Count from approvals table |
| **Approved** | Count | 120 (94%) | Phase 5 🔄 | WHERE status = 'approved' |
| **Rejected** | Count | 7 (6%) | Phase 5 🔄 | WHERE status = 'rejected' |
| **Average Approval Time** | Duration | 6 hours | Phase 5 🔄 | AVG(approved_at - submitted_at) |

---

#### **⏳ Future Enhancements (Phase 10)**

##### **SLA & Escalation [Phase 10 ⏳]**
- Approval SLA (48 hours)
- Auto-Approve After (7 days)
- Approver Name (specific person)
- Approver Email
- Delegate To (backup)
- Approval Threshold (auto-approve if < $X)
- Requires Comment (on rejection)

---

### 2️⃣ **EMPLOYS EDGE** 🤝 **[Phase 4 ✅]**

#### **Visual:** Blue arrow (employment relationship)

#### **When to use:**
- Company employs a person
- Agency staffs a contractor
- Indicates employer-employee relationship

---

#### **✅ Currently Available (Phase 4)**

| Property | Type | Example | Phase | Notes |
|----------|------|---------|-------|-------|
| **Edge Type** | Dropdown | "Employs" | Phase 4 ✅ | Locked to this type |

#### **Flow Example:**
```
[Acme Corp] ──(employs)──→ [Sarah Chen]
```
**Meaning:** Sarah is employed by Acme

---

#### **⏳ Future Enhancements (Phase 7)**

##### **Employment Details [Phase 7 ⏳]**
- Employment Type (Full-time / Part-time / Contract / Temp)
- Start Date / End Date
- Department (Engineering, Design, QA)
- Manager (who manages this person)
- Billable (is time billable?)

---

### 3️⃣ **FUNDS EDGE** 💰 **[Phase 4 ✅]**

#### **Visual:** Purple arrow with dollar sign

#### **When to use:**
- Client funds a project
- Budget allocation flows
- Payment relationships

---

#### **✅ Currently Available (Phase 4)**

| Property | Type | Required | Example | Phase | Notes |
|----------|------|----------|---------|-------|-------|
| **Edge Type** | Dropdown | ✅ Yes | "Funds" | Phase 4 ✅ | Locked to this type |
| **Amount** | Number | ❌ No | $250,000 | Phase 4 ✅ | Funding amount |
| **Funding Type** | Dropdown | ❌ No | Direct / Escrow / Milestone / Retainer | Phase 4 ✅ | Payment model |
| **Currency** | Dropdown | ❌ No | USD / EUR / GBP | Phase 4 ✅ | Money type |

#### **Flow Example:**
```
[Global Corp] ──(funds: $250k, Direct)──→ [Acme Corp]
```
**Meaning:** Global Corp pays Acme Corp $250k directly

---

#### **⏳ Future Enhancements (Phase 8)**

##### **Payment Tracking [Phase 8 ⏳]**
- Amount Paid (disbursed so far)
- Amount Remaining (outstanding balance)
- Payment Schedule (when payments made)
- Payment Method (ACH / Wire / Check / Card)
- Payment Terms (Net 30, Net 60)
- Late Fee (penalty %)

---

### 4️⃣ **SUBCONTRACTS EDGE** 📋 **[Phase 4 ✅]**

#### **Visual:** Orange arrow (delegation)

#### **When to use:**
- Agency subcontracts to another agency
- Company delegates work to vendor
- Multi-tier contracting

---

#### **✅ Currently Available (Phase 4)**

| Property | Type | Example | Phase | Notes |
|----------|------|---------|-------|-------|
| **Edge Type** | Dropdown | "Subcontracts" | Phase 4 ✅ | Locked to this type |

#### **Flow Example:**
```
[Agency A] ──(subcontracts)──→ [Agency B]
```
**Meaning:** Agency A hires Agency B as subcontractor

---

#### **⏳ Future Enhancements (Phase 8)**

##### **Subcontract Terms [Phase 8 ⏳]**
- Markup Percentage (A's markup on B's rate)
- Pass-through (direct cost?)
- Subcontract Agreement (legal doc reference)

---

### 5️⃣ **BILLS TO EDGE** 💸 **[Phase 4 ✅]**

#### **Visual:** Red arrow (invoicing)

#### **When to use:**
- Define who invoices whom
- Billing relationships
- Payment flow direction

---

#### **✅ Currently Available (Phase 4)**

| Property | Type | Example | Phase | Notes |
|----------|------|---------|-------|-------|
| **Edge Type** | Dropdown | "Bills To" | Phase 4 ✅ | Locked to this type |

#### **Flow Example:**
```
[Acme Corp] ──(bills to)──→ [Global Corp]
```
**Meaning:** Acme sends invoices to Global

---

#### **⏳ Future Enhancements (Phase 8)**

##### **Billing Details [Phase 8 ⏳]**
- Billing Frequency (Weekly / Bi-weekly / Monthly)
- Invoice Template (format)
- PO Required (Yes/No)
- PO Number (reference)
- Billing Contact (name)
- Billing Email (invoice destination)

---

### 6️⃣ **WORKS ON EDGE** 🛠️ **[Phase 7 ⏳]**

#### **Planned for Phase 7 - Not implemented yet**

#### **When to use:**
- Person works on a project
- Contractor assigned to task
- Team membership

**Status:** Design phase only

---

## 🎯 Implementation Priority

### **✅ Phase 4 - COMPLETE**
All core node types, edge types, and basic properties are working.

### **🔄 Phase 5 - IN PROGRESS (Implement NOW)**

#### **Week 1: Database Query Hooks**
1. Create `useNodeStats(nodeId)` hook
2. Query timesheet database for hours
3. Show total hours, last activity
4. Add Stats & Activity section to PropertyPanel

#### **Week 2: Graph Relationships**
1. Traverse graph edges to find relationships
2. Show "Employed by: X" for person nodes
3. Show "Employs: 5 people" for party nodes
4. Show "Workers on contract: 3" for contract nodes
5. Add clickable links to related nodes

**DoD (Phase 5):**
- ✅ All nodes show real database stats (no mock data)
- ✅ Stats update when graph changes
- ✅ Graph relationships displayed correctly
- ✅ All data queries use Supabase

---

### **⏳ Phase 7 - FUTURE**
- New node types (Budget, Condition, Escalation)
- Contract lifecycle fields
- Employment details
- Advanced templates

### **⏳ Phase 8 - FUTURE**
- Financial tracking (burn rates, projections)
- Tax/compliance fields
- Payment tracking
- Multi-currency support

### **⏳ Phase 9 - FUTURE**
- AI auto-approve thresholds
- Anomaly detection
- Smart routing

### **⏳ Phase 10 - FUTURE**
- SLA tracking
- Escalation rules
- Approval aging

---

## 📚 Related Documentation

- **[Roadmap Alignment Analysis](/docs/project-graph/ROADMAP-ALIGNMENT-ANALYSIS.md)** - How this guide aligns with the Master Roadmap
- **[Master Roadmap](/docs/roadmap/MASTER_ROADMAP.md)** - Complete project roadmap
- **[WorkGraph Builder Implementation](/docs/WORKGRAPH_VISUAL_BUILDER_IMPLEMENTATION.md)** - Technical implementation details
- **[Phase 5 Sprint Guide](/docs/roadmap/PHASE_5_SPRINT_GUIDE.md)** - Current sprint details

---

## 🤔 Summary

**Currently Available (Phase 4):** Basic node/edge properties, permissions, rate visibility  
**Coming Soon (Phase 5):** Database stats, graph relationships, activity metrics  
**Future (Phase 7+):** Advanced tracking, compliance, AI features

The guide now clearly marks what's available NOW vs what's coming LATER. All future features are documented but marked as "not implemented yet" to prevent confusion.
