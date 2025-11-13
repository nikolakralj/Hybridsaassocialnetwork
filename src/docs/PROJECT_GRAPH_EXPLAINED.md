# 🕸️ Project Graph Architecture - Complete Explanation

**Last Updated:** November 12, 2025  
**Status:** Architecture clarification  
**Purpose:** Explain what goes IN the graph vs what's DATA attached to the graph

---

## 🎯 Core Concept: Graph vs Data

### **Critical Distinction:**

```
PROJECT GRAPH = Organizational Structure & Relationships
  ├─ WHO is involved (companies, people)
  ├─ HOW they're connected (employs, contracts with, reports to)
  └─ APPROVAL FLOWS (who approves what)

DATA = Work artifacts that flow THROUGH the graph
  ├─ Timesheets (hours worked)
  ├─ Expenses (receipts, mileage)
  ├─ Invoices (bills generated)
  └─ Approvals (decisions made)
```

### **Visual Analogy:**

```
Think of it like a city:

GRAPH = Roads, buildings, intersections (static infrastructure)
  - Company HQ building
  - Agency office building
  - Roads connecting them
  - Traffic signals (approval points)

DATA = Cars, packages, people moving through (dynamic flow)
  - Timesheets = Delivery trucks
  - Expenses = Packages being shipped
  - Approvals = Traffic signals turning green
  - Invoices = Bills arriving at destination
```

---

## 🏗️ What Goes IN the Project Graph?

### **Node Types (The "Buildings"):**

#### **1. Party/Org Node** 🏢
```typescript
{
  type: "party",
  label: "Acme Dev Studio",
  organizationId: "org-123",
  role: "company" | "agency" | "client"
}
```
**Purpose:** Represents a company, agency, or client organization  
**Why in graph:** Defines WHO is part of the project structure  
**Example:** "Enterprise ClientCorp", "Acme Dev Studio", "Martinez Agency"

#### **2. Team Node** 👥
```typescript
{
  type: "team",
  label: "Frontend Team",
  organizationId: "org-123",
  managerId: "person-456"
}
```
**Purpose:** Group of people within an organization  
**Why in graph:** Defines organizational hierarchy  
**Example:** "Design Team", "Backend Team", "QA Team"

#### **3. Person Node** 👤
```typescript
{
  type: "person",
  label: "Sarah Martinez",
  userId: "user-789",
  contractorType: "company_employee" | "agency_contractor" | "individual_contributor"
}
```
**Purpose:** Individual worker/approver  
**Why in graph:** The actual people doing work and approving  
**Example:** "Mike Chen", "Emily Davis", "Robert Garcia"

#### **4. Contract Node** 📄
```typescript
{
  type: "contract",
  label: "MSA-2025-001",
  contractId: "contract-123",
  startDate: "2025-01-01",
  endDate: "2025-12-31",
  rate: 125.00,
  billingType: "hourly" | "fixed" | "milestone",
  hideRateFrom: ["party-client"]  // Rate visibility rules
}
```
**Purpose:** Legal agreement between parties  
**Why in graph:** Defines TERMS of engagement (rate, dates, scope)  
**Example:** "MSA with Acme Dev", "SOW for Q4 Project"

#### **5. SOW Node** 📋 (Statement of Work)
```typescript
{
  type: "sow",
  label: "Q4 Platform Redesign",
  sowId: "sow-456",
  parentContractId: "contract-123",  // Links to MSA
  budget: 50000,
  startDate: "2025-10-01",
  endDate: "2025-12-31"
}
```
**Purpose:** Specific project scope under a master contract  
**Why in graph:** Defines WHAT work is being done  
**Example:** "Mobile App Development", "API Integration Phase 2"

#### **6. PO Node** 🧾 (Purchase Order)
```typescript
{
  type: "po",
  label: "PO-2025-Q4-0042",
  poNumber: "PO-2025-Q4-0042",
  amount: 50000,
  issuedBy: "party-client",
  status: "active" | "depleted" | "expired"
}
```
**Purpose:** Client's budget allocation  
**Why in graph:** Tracks spending limits and budget burn  
**Example:** "PO-2025-Q4-0042 ($50k for development)"

#### **7. Budget Node** 💰
```typescript
{
  type: "budget",
  label: "Q4 Development Budget",
  amount: 250000,
  spent: 125000,
  remaining: 125000,
  period: "2025-Q4"
}
```
**Purpose:** Financial tracking and limits  
**Why in graph:** Controls spending and triggers warnings  
**Example:** "Annual IT Services Budget"

#### **8. Milestone Node** 🎯
```typescript
{
  type: "milestone",
  label: "Phase 1 Complete",
  dueDate: "2025-11-30",
  paymentTrigger: 25000,  // Pay $25k when milestone hit
  status: "pending" | "complete" | "overdue"
}
```
**Purpose:** Key deliverable or payment trigger  
**Why in graph:** Ties approval flows to project progress  
**Example:** "MVP Launch", "Design Approval Gate"

---

## 🔗 Edge Types (The "Roads")

### **Relationship Edges (Solid Lines):**

#### **1. "employs" Edge**
```typescript
{
  type: "employs",
  source: "party-acme",       // Company
  target: "person-sarah"      // Employee
}
```
**Meaning:** Company employs person  
**Visual:** Gray solid line  
**Example:** Acme Dev Studio → Sarah Martinez

#### **2. "billsTo" Edge**
```typescript
{
  type: "billsTo",
  source: "party-agency",     // Service provider
  target: "party-client",     // Client
  via: "contract-123"         // Through this contract
}
```
**Meaning:** Agency bills client  
**Visual:** Solid line (colored by relationship)  
**Example:** Martinez Agency → Enterprise ClientCorp (via MSA-2025-001)

#### **3. "hasContract" Edge**
```typescript
{
  type: "hasContract",
  source: "person-sarah",
  target: "contract-123"
}
```
**Meaning:** Person works under this contract  
**Visual:** Solid line connecting person to contract  
**Example:** Sarah Martinez → MSA-2025-001

#### **4. "reportsTo" Edge**
```typescript
{
  type: "reportsTo",
  source: "person-junior",
  target: "person-manager"
}
```
**Meaning:** Organizational hierarchy  
**Visual:** Solid line with arrow  
**Example:** Junior Dev → Tech Lead

### **Approval Flow Edges (Dashed Lines):**

#### **5. "approves" Edge** ⭐ **MOST IMPORTANT**
```typescript
{
  type: "approves",
  source: "person-manager",
  target: "person-contractor",
  step: 1,                    // Which approval step
  conditions: {
    maxAmount: 5000,          // Auto-approve if under $5k
    requiresReceipt: true
  }
}
```
**Meaning:** Manager approves contractor's work  
**Visual:** Blue dashed line  
**Example:** Tech Lead → Sarah (approves timesheets)

#### **6. "fundedBy" Edge**
```typescript
{
  type: "fundedBy",
  source: "sow-456",
  target: "po-789"
}
```
**Meaning:** This SOW is paid from this PO  
**Visual:** Solid line  
**Example:** Q4 Platform Redesign → PO-2025-Q4-0042

---

## 📊 Complete Graph Example

### **Scenario: Client → Agency → Contractor**

```
[Enterprise ClientCorp]  (Client - Party/Org Node)
         |
         | billsTo (edge)
         ↓
[Martinez Agency]  (Agency - Party/Org Node)
         |
         | employs (edge)
         ↓
[Sarah Martinez]  (Person Node)
         |
         | hasContract (edge)
         ↓
[MSA-2025-001]  (Contract Node)
   rate: $125/hr
   hideRateFrom: ["party-client"]

Approval Flow (dashed edges):
[Sarah Martinez] 
         ↑ approves (step 1)
[Agency Manager]
         ↑ approves (step 2)
[Client PM]
```

### **Where Expenses Fit:**

```
Sarah Martinez (Person Node)
  ├─ HAS contracts → [MSA-2025-001]
  │
  └─ SUBMITS data (not in graph!):
      ├─ Timesheet: 40 hours (week of Nov 4-10)
      ├─ Expense #1: Parking $15 (links to timesheet)
      ├─ Expense #2: Mileage 60mi $40.20 (links to timesheet)
      └─ Expense #3: Client lunch $65 (links to timesheet)

These flow THROUGH the approval edges:
  Step 1: Agency Manager sees → Timesheet + Expenses
  Step 2: Client PM sees → Timesheet only (expenses hidden)
```

---

## ❌ What Does NOT Go in the Graph?

### **These are DATA, not NODES:**

#### **1. Timesheets** ⏰
```sql
-- Database table, NOT a graph node
CREATE TABLE timesheet_entries (
  id UUID,
  person_id TEXT,           -- Links to Person node
  contract_id UUID,         -- Links to Contract node
  date DATE,
  hours DECIMAL,
  status TEXT
);
```
**Why not in graph:** Changes daily, too dynamic  
**Where it lives:** Database table  
**How it uses graph:** Flows through "approves" edges

#### **2. Expenses** 💰
```sql
-- Database table, NOT a graph node
CREATE TABLE expenses (
  id UUID,
  person_id TEXT,           -- Links to Person node
  contract_id UUID,         -- Links to Contract node
  timesheet_period_id UUID, -- Links to timesheet week
  amount DECIMAL,
  receipt_urls TEXT[],
  status TEXT
);
```
**Why not in graph:** Too many, too frequent  
**Where it lives:** Database table  
**How it uses graph:** Follows same approval path as timesheets

#### **3. Invoices** 🧾
```sql
-- Database table, NOT a graph node
CREATE TABLE invoices (
  id UUID,
  from_party_id TEXT,       -- Links to Party node (agency)
  to_party_id TEXT,         -- Links to Party node (client)
  contract_id UUID,         -- Links to Contract node
  amount DECIMAL,
  status TEXT
);
```
**Why not in graph:** Generated output  
**Where it lives:** Database table  
**How it uses graph:** Aggregates approved timesheets/expenses

---

## 🔄 How Expenses Flow Through the Graph

### **Step-by-Step Workflow:**

#### **1. Sarah (Contractor) Submits Expense:**

```typescript
// Frontend: Expense entry form
const submitExpense = async () => {
  const expense = {
    personId: "sarah-martinez",       // Links to Person node
    contractId: "msa-2025-001",       // Links to Contract node
    timesheetPeriodId: "week-nov-4",  // Links to timesheet
    amount: 65.00,
    category: "meals",
    description: "Client lunch",
    receiptUrls: ["receipt-123.jpg"], // Uploaded to Supabase Storage
    date: "2025-11-05",
  };
  
  await api.createExpense(expense);
};
```

**WHERE DOES IT GO?**
- ✅ Saved to `expenses` table in database
- ❌ NOT added as a node to the graph
- ✅ Links to Sarah's Person node via `personId`
- ✅ Links to her Contract node via `contractId`

#### **2. System Determines Approval Flow:**

```typescript
// Backend: Query the graph for approval path
const getApprovalPath = (personId: string, graphVersion: GraphData) => {
  // Find all "approves" edges pointing to this person
  const approvalEdges = graphVersion.edges.filter(edge => 
    edge.type === "approves" && 
    edge.target === personId
  );
  
  // Sort by step number
  return approvalEdges
    .sort((a, b) => a.step - a.step)
    .map(edge => ({
      step: edge.step,
      approverId: edge.source,  // Person node ID
      conditions: edge.conditions,
    }));
};

// Result for Sarah:
// [
//   { step: 1, approverId: "agency-manager-id", conditions: { ... } },
//   { step: 2, approverId: "client-pm-id", conditions: { ... } }
// ]
```

**HOW IT USES THE GRAPH:**
- ✅ Reads "approves" edges from graph
- ✅ Determines who needs to approve
- ✅ Determines approval order (step 1, 2, 3...)
- ✅ Applies conditions (rate visibility, amount limits)

#### **3. Agency Manager Approves:**

```typescript
// Manager views approval queue
const approvalQueue = await api.getMyApprovals("agency-manager-id");

// Returns:
// [
//   {
//     type: "timesheet",
//     submittedBy: "sarah-martinez",
//     hours: 40,
//     amount: 5000,        // $125/hr × 40h
//     status: "pending",
//   },
//   {
//     type: "expense",
//     submittedBy: "sarah-martinez",
//     amount: 65.00,
//     category: "meals",
//     receiptUrl: "receipt-123.jpg",
//     status: "pending",
//   }
// ]

// Manager clicks "Approve All"
await api.approveExpense(expenseId, {
  approverId: "agency-manager-id",
  step: 1,
  decision: "approved",
  comments: "Receipt looks good",
});
```

**WHAT HAPPENS:**
- ✅ Expense status → "approved_step_1"
- ✅ Moves to next step in approval path (Client PM)
- ✅ Graph NOT modified (static structure)
- ✅ Approval history saved to database

#### **4. Client PM Sees (Maybe):**

```typescript
// Check rate visibility rules from Contract node
const contract = graphVersion.nodes.find(n => 
  n.type === "contract" && 
  n.id === "msa-2025-001"
);

const canClientSeeExpenses = !contract.hideExpensesFrom?.includes("party-client");

if (canClientSeeExpenses) {
  // Client sees expense in their queue
  showExpense({
    amount: 65.00,
    category: "meals",
    receipt: "receipt-123.jpg",
  });
} else {
  // Expense hidden from client (auto-approved at agency level)
  autoApproveExpense();
}
```

---

## 🎨 UI: How User Uploads Expense

### **Option 1: From Timesheet Tab**

```
Week of Nov 4-10, 2025

TIMESHEET:
Mon Nov 4    8.0h   [$1,000]
Tue Nov 5    7.5h   [$937.50]
Wed Nov 6    8.0h   [$1,000]

EXPENSES:
Tue Nov 5    🚗 Mileage (60mi)    $40.20    [View]
Wed Nov 6    🍽️  Client Lunch      $65.00    [View Receipt]

[+ Add Expense]  ← Click here

Modal opens:
┌─────────────────────────────┐
│ Add Expense                 │
├─────────────────────────────┤
│ Date: [Nov 6 ▼]            │
│ Category: [Meals ▼]        │
│ Amount: [$65.00]           │
│ Description: [Client lunch]│
│ Receipt: [📷 Take Photo]   │
│                             │
│ [Cancel]  [Add Expense]     │
└─────────────────────────────┘

User clicks "Take Photo":
  → Camera opens (PWA)
  → Take photo of receipt
  → Auto-uploads to Supabase Storage
  → Creates expense record in database
  → Links to current timesheet period
  → Links to user's Person node
  → Links to user's Contract node
```

### **Option 2: From Mobile (Quick Capture)**

```
User on job site:
  1. Long-press WorkGraph app icon
  2. Select "Capture Receipt"
  3. Camera opens immediately
  4. Take photo
  5. Auto-fills expense form:
     - Date: Today
     - Amount: [User enters]
     - Category: [User selects]
  6. Saves to current week's timesheet
  7. Background sync when online
```

### **Option 3: From Expense Tab (Future)**

```
Navigate to "Expenses" tab:

┌────────────────────────────────────────┐
│ 💰 My Expenses - November 2025         │
├────────────────────────────────────────┤
│                                        │
│ Week of Nov 4-10    Total: $105.20    │
│   Nov 5  🚗 Mileage      $40.20       │
│   Nov 6  🍽️  Lunch        $65.00       │
│                                        │
│ Week of Nov 11-17   Total: $0.00      │
│   [+ Add Expense]                      │
│                                        │
└────────────────────────────────────────┘
```

---

## 🤖 Future: AI Contract Analysis

### **Your Idea: "AI analyzes contract and builds graph"**

**Brilliant! Here's how it would work:**

#### **Phase 1: Contract Upload**
```typescript
// User uploads PDF contract
<input type="file" accept=".pdf" onChange={uploadContract} />

// Backend OCR + AI analysis
const analyzeContract = async (contractPdf: File) => {
  // 1. Extract text with OCR
  const contractText = await extractTextFromPDF(contractPdf);
  
  // 2. AI extraction (GPT-4, Claude)
  const prompt = `
    Analyze this contract and extract:
    - Party names (client, vendor, agency)
    - Contract type (MSA, SOW, Fixed Price)
    - Start/end dates
    - Rate (hourly, daily, fixed)
    - Payment terms (NET 30, NET 60)
    - Approval requirements
    - Expense reimbursement rules
    
    Contract text:
    ${contractText}
  `;
  
  const aiResponse = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });
  
  return JSON.parse(aiResponse.choices[0].message.content);
};
```

#### **Phase 2: Auto-Generate Graph Nodes**
```typescript
// AI returns structured data:
const contractData = {
  parties: [
    { name: "Enterprise ClientCorp", role: "client" },
    { name: "Acme Dev Studio", role: "vendor" }
  ],
  contractType: "MSA",
  startDate: "2025-01-01",
  endDate: "2025-12-31",
  rate: 125.00,
  billingType: "hourly",
  paymentTerms: "NET 30",
  approvalFlow: [
    { role: "manager", threshold: 5000 },
    { role: "client_pm", threshold: null }
  ],
  expensePolicy: {
    receiptsRequiredOver: 75,
    maxMileageRate: 0.67,
    billableCategories: ["travel", "materials"],
    nonBillableCategories: ["alcohol"]
  }
};

// Auto-create graph nodes
const createGraphFromContract = (data) => {
  const nodes = [];
  const edges = [];
  
  // Create Party nodes
  data.parties.forEach((party, i) => {
    nodes.push({
      id: `party-${i}`,
      type: "party",
      label: party.name,
      role: party.role,
      position: { x: 200 + (i * 300), y: 100 }
    });
  });
  
  // Create Contract node
  nodes.push({
    id: "contract-1",
    type: "contract",
    label: `${data.contractType}-${data.startDate.substring(0,4)}`,
    rate: data.rate,
    billingType: data.billingType,
    startDate: data.startDate,
    endDate: data.endDate,
    position: { x: 400, y: 300 }
  });
  
  // Create billsTo edge
  edges.push({
    id: "e1",
    source: "party-1",  // Vendor
    target: "party-0",  // Client
    type: "billsTo",
    via: "contract-1"
  });
  
  // Create approval flow edges (from AI analysis)
  // ... auto-wire approval chain
  
  return { nodes, edges };
};
```

#### **Phase 3: User Reviews & Confirms**
```typescript
// Show AI-generated graph
<div className="ai-contract-preview">
  <Alert>
    🤖 AI analyzed contract and created this graph.
    Please review and confirm:
  </Alert>
  
  <GraphBuilder
    initialGraph={aiGeneratedGraph}
    mode="review"
  />
  
  <div className="ai-confidence">
    Confidence Scores:
    - Parties: 95% ✅
    - Dates: 98% ✅
    - Rate: 92% ✅
    - Approval flow: 78% ⚠️  (Please review)
  </div>
  
  <Button onClick={confirmAndSave}>
    Looks Good - Create Project
  </Button>
</div>
```

#### **Roadmap Addition:**

**Phase 11: AI Contract Intelligence** (Future)
- [ ] PDF contract upload
- [ ] OCR text extraction
- [ ] GPT-4 structured extraction
- [ ] Auto-generate graph nodes/edges
- [ ] Confidence scoring
- [ ] User review & correction
- [ ] Learn from corrections (fine-tuning)

---

## 🎯 Summary: Your Questions Answered

### **Q1: How does employee upload expenses?**
**A:** From timesheet tab → Click "+ Add Expense" → Fill form → Take photo of receipt → Submit. Expense is saved to database and linked to their Person node and Contract node.

### **Q2: Do we add expenses to project graph?**
**A:** ❌ NO! Expenses are DATA (database records), not NODES in the graph. The graph defines the STRUCTURE (who, relationships, approval flows). Expenses FLOW THROUGH the graph's approval edges.

### **Q3: What type of edge between company → contract → company?**
**A:** 
```
Company A (vendor) ──billsTo──> Company B (client)
     |                              ↑
     |                              |
hasContract                     fundedBy
     |                              |
     ↓                              |
Contract Node ──────────────────────┘
```

### **Q4: Edge types in graph?**
**A:** 
- **employs** (solid): Company → Person
- **billsTo** (solid): Vendor → Client
- **hasContract** (solid): Person → Contract
- **approves** (dashed): Manager → Worker (defines approval flow!)
- **fundedBy** (solid): SOW → PO
- **reportsTo** (solid): Junior → Senior

### **Q5: AI contract analysis?**
**A:** 🚀 **Brilliant idea!** Added to Phase 11 roadmap:
- Upload PDF contract
- AI extracts parties, rates, dates, terms
- Auto-generates graph nodes/edges
- User reviews and confirms
- Massive time saver for onboarding!

---

**Created:** November 12, 2025  
**Purpose:** Clarify graph architecture vs data flow  
**See Also:** `/docs/EXPENSE_MANAGEMENT_ARCHITECTURE.md` for expense workflow
