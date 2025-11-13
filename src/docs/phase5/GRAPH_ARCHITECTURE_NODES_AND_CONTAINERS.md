# Graph Architecture: Nodes, Containers, and Properties

## Overview
This document defines how timesheets, expenses, contractors, and companies are represented in the ProjectGraph, including grouping strategies and node property schemas.

---

## 1. The Container Question: Individual vs. Group Connections

### Question: Should timesheets connect to individual contractors or company containers?

**Answer: BOTH (Hybrid Approach)** ✅

### Why Hybrid?

Different queries need different traversal paths:

| Query | Best Path |
|-------|-----------|
| "Who submitted this timesheet?" | Timesheet → Contractor (direct) |
| "Show all timesheets from Agency A" | Company → Contractors → Timesheets (grouped) |
| "What's Alice's approval rate?" | Contractor → Timesheets → Status (individual) |
| "Which company has most pending timesheets?" | Company → (aggregate) → Count (container-level) |

---

## 2. Connection Architecture (The Correct Way)

### Approach: Multi-Edge Relationships

```
🏢 Company: Agency Alpha
  │
  ├─ EMPLOYS ──→ 👤 Contractor: Alice
  │                 │
  │                 ├─ SUBMITTED_BY ←── 📊 Timesheet Week 1
  │                 │                       │
  │                 │                       ├─ FOR_PROJECT ──→ 📁 Project X
  │                 │                       │
  │                 │                       └─ UNDER_CONTRACT ──→ 📄 Contract MSA
  │                 │
  │                 └─ SUBMITTED_BY ←── 📊 Timesheet Week 2
  │
  └─ EMPLOYS ──→ 👤 Contractor: Bob
                    │
                    └─ SUBMITTED_BY ←── 📊 Timesheet Week 1
```

**Key Edges:**
1. **Company → Contractor**: `EMPLOYS` (establishes organizational grouping)
2. **Contractor → Timesheet**: `SUBMITTED_BY` (establishes ownership)
3. **Timesheet → Project**: `FOR_PROJECT` (establishes work context)
4. **Timesheet → Contract**: `UNDER_CONTRACT` (establishes billing rules & approval chain)

### Why NOT connect Timesheet directly to Company?

```
❌ BAD: Company ←── Timesheet (loses individual accountability)
✅ GOOD: Company → Contractor → Timesheet (preserves ownership chain)
```

**Reasoning:**
- Timesheets are **personal work records** (submitted by individuals)
- Companies are **organizational containers** (aggregate relationships)
- Direct Company←→Timesheet edge would create ambiguity: "Whose timesheet is this?"

### But what about fast queries like "Show all timesheets from Company A"?

**Answer: Graph traversal + caching**

```typescript
// Query: All timesheets from Agency Alpha
const timesheets = await graph.query(`
  MATCH (c:Company {id: 'agency-alpha'})-[:EMPLOYS]->(u:User)-[:SUBMITTED_BY]-(t:TimesheetPeriod)
  WHERE t.status != 'archived'
  RETURN t, u
`);

// Performance: O(contractors × timesheets_per_contractor)
// For 10 contractors with 10 timesheets each = 100 traversals (fast!)
```

**Optimization: Add denormalized aggregates to Company node properties**

```typescript
{
  nodeType: "Company",
  nodeId: "agency-alpha",
  properties: {
    name: "Agency Alpha",
    // Denormalized stats (updated periodically)
    stats: {
      activeContractors: 10,
      pendingTimesheets: 5,
      pendingExpenses: 2,
      lastUpdated: "2025-11-13T10:00:00Z"
    }
  }
}
```

---

## 3. Container Grouping Strategy

### Visual Representation (UI Layer Only)

```
┌─ 🏢 Agency Alpha (Container) ─────────────────────┐
│  📊 Stats: 5 pending timesheets, 2 expenses       │
│                                                   │
│  👥 Contractors (10)  [Collapse ▼]               │
│  ├─ 👤 Alice Chen                                │
│  │   └─ 📊 3 pending timesheets                  │
│  ├─ 👤 Bob Smith                                 │
│  │   └─ 📊 1 pending timesheet                   │
│  ├─ 👤 Carol Lee                                 │
│  │   └─ ✅ All approved                          │
│  └─ ▶ +7 more contractors...                     │
└───────────────────────────────────────────────────┘
```

**Key Point:** Container is a **UI grouping concept**, not a graph node type!

### Implementation:

```typescript
// Container = Derived from graph traversal
interface ContractorContainer {
  company: CompanyNode;
  contractors: UserNode[];
  aggregatedStats: {
    totalTimesheets: number;
    pendingTimesheets: number;
    totalExpenses: number;
  };
  collapsed: boolean; // UI state only
}

// Build container from graph
async function buildContractorContainer(companyId: string): Promise<ContractorContainer> {
  const company = await graph.getNode(companyId);
  
  const contractors = await graph.traverse({
    start: companyId,
    outgoing: { type: "EMPLOYS" },
    nodeType: "User"
  });
  
  // Aggregate stats from all contractors
  const timesheets = await graph.traverse({
    start: contractors.map(c => c.nodeId),
    outgoing: { type: "SUBMITTED_BY" },
    nodeType: "TimesheetPeriod",
    filter: { status: "pending" }
  });
  
  return {
    company,
    contractors,
    aggregatedStats: {
      totalTimesheets: timesheets.length,
      pendingTimesheets: timesheets.filter(t => t.status === "pending").length,
      // ...
    },
    collapsed: false // UI manages this
  };
}
```

---

## 4. Node Properties Schema

### 4.1 TimesheetPeriod Node

```typescript
interface TimesheetPeriodNode {
  nodeType: "TimesheetPeriod";
  nodeId: string; // e.g., "ts-2025-11-w1-alice-chen"
  
  properties: {
    // === Temporal Properties ===
    weekStart: string;          // "2025-11-03" (ISO date)
    weekEnd: string;            // "2025-11-09"
    submittedAt?: string;       // "2025-11-10T14:30:00Z" (ISO timestamp)
    approvedAt?: string;        // When fully approved
    lastModifiedAt: string;     // Latest change
    
    // === Status & Workflow ===
    status: "draft" | "submitted" | "in_review" | "rejected" | "approved" | "locked";
    currentStep: number;        // Which step in approval chain (1-based)
    totalSteps: number;         // How many approval steps total
    version: number;            // Resubmission counter (starts at 1)
    
    // === Aggregated Work Data ===
    totalHours: number;         // Sum of all entries (e.g., 40.5)
    billableHours: number;      // Billable hours only
    overtimeHours: number;      // Hours beyond standard (e.g., > 40)
    daysWorked: number;         // Number of days with entries (e.g., 5)
    
    // === Financial ===
    totalAmount?: number;       // Calculated: hours × rate (if rate visible)
    currency?: string;          // "USD", "EUR", etc.
    hourlyRate?: number;        // May be hidden for some users
    
    // === Data References ===
    postgresEntriesRef: string; // Link to detailed entries table
                                 // e.g., "WHERE period_id = 'abc123'"
    
    // === Metadata ===
    contractorNotes?: string;   // Optional notes from contractor
    trackingMode: "hours" | "time"; // How hours were tracked
    hasBreaks: boolean;         // Whether break times were logged
    
    // === Flags ===
    hasOvertimeFlag: boolean;   // Auto-flagged if > 40h
    hasWeekendWorkFlag: boolean; // Worked on Sat/Sun
    requiresClientApproval: boolean; // Based on contract
    
    // === Archive ===
    archivedAt?: string;        // When moved to cold storage
    archiveReason?: string;     // "aged_out", "project_closed", etc.
  }
}
```

### Example:

```json
{
  "nodeType": "TimesheetPeriod",
  "nodeId": "ts-2025-11-w1-alice-chen",
  "properties": {
    "weekStart": "2025-11-03",
    "weekEnd": "2025-11-09",
    "submittedAt": "2025-11-10T14:30:00Z",
    "status": "in_review",
    "currentStep": 2,
    "totalSteps": 2,
    "version": 1,
    "totalHours": 42.5,
    "billableHours": 40,
    "overtimeHours": 2.5,
    "daysWorked": 5,
    "totalAmount": 3187.50,
    "currency": "USD",
    "hourlyRate": 75,
    "postgresEntriesRef": "period_id = 'abc123'",
    "trackingMode": "time",
    "hasBreaks": true,
    "hasOvertimeFlag": true,
    "hasWeekendWorkFlag": false,
    "requiresClientApproval": true
  }
}
```

---

### 4.2 ExpenseReport Node

```typescript
interface ExpenseReportNode {
  nodeType: "ExpenseReport";
  nodeId: string; // e.g., "expense-2025-11-alice-chen"
  
  properties: {
    // === Temporal Properties ===
    reportMonth: string;        // "2025-11" (month-level aggregation)
    reportStartDate: string;    // "2025-11-01"
    reportEndDate: string;      // "2025-11-30"
    submittedAt?: string;
    approvedAt?: string;
    lastModifiedAt: string;
    
    // === Status & Workflow ===
    status: "draft" | "submitted" | "in_review" | "rejected" | "approved" | "reimbursed";
    currentStep: number;
    totalSteps: number;
    version: number;
    
    // === Financial ===
    totalAmount: number;        // Sum of all line items
    reimbursableAmount: number; // Amount contractor will receive
    nonReimbursableAmount: number; // Company-paid expenses (e.g., software)
    currency: string;
    
    // === Expense Breakdown ===
    categoryBreakdown: {        // Aggregated by category
      "Travel": number,
      "Meals": number,
      "Software": number,
      // ...
    };
    lineItemCount: number;      // Total number of expenses
    
    // === Compliance ===
    hasAllReceipts: boolean;    // All items have receipt images
    missingReceiptsCount: number;
    requiresJustification: boolean; // Flagged for review (large amounts)
    
    // === Data References ===
    postgresLineItemsRef: string; // "WHERE report_id = 'xyz789'"
    
    // === Metadata ===
    contractorNotes?: string;
    reimbursementMethod?: "bank_transfer" | "payroll" | "check";
    reimbursedAt?: string;      // When payment was made
    
    // === Flags ===
    hasHighValueItemsFlag: boolean; // Any item > $500
    hasForeignCurrencyFlag: boolean; // Expenses in non-default currency
    requiresClientApproval: boolean;
    
    // === Archive ===
    archivedAt?: string;
    archiveReason?: string;
  }
}
```

### Example:

```json
{
  "nodeType": "ExpenseReport",
  "nodeId": "expense-2025-11-alice-chen",
  "properties": {
    "reportMonth": "2025-11",
    "reportStartDate": "2025-11-01",
    "reportEndDate": "2025-11-30",
    "submittedAt": "2025-12-01T10:00:00Z",
    "status": "in_review",
    "currentStep": 1,
    "totalSteps": 2,
    "version": 1,
    "totalAmount": 1250.00,
    "reimbursableAmount": 950.00,
    "nonReimbursableAmount": 300.00,
    "currency": "USD",
    "categoryBreakdown": {
      "Travel": 600.00,
      "Meals": 350.00,
      "Software": 300.00
    },
    "lineItemCount": 8,
    "hasAllReceipts": true,
    "missingReceiptsCount": 0,
    "requiresJustification": false,
    "postgresLineItemsRef": "report_id = 'xyz789'",
    "hasHighValueItemsFlag": true,
    "hasForeignCurrencyFlag": false,
    "requiresClientApproval": false
  }
}
```

---

### 4.3 Company Node (with Container Stats)

```typescript
interface CompanyNode {
  nodeType: "Company";
  nodeId: string;
  
  properties: {
    // === Core Identity ===
    name: string;
    legalName?: string;
    companyType: "agency" | "client" | "freelancer" | "vendor";
    
    // === Contact ===
    primaryContact?: string;    // User ID
    email?: string;
    website?: string;
    
    // === Denormalized Stats (for fast container queries) ===
    stats: {
      // Contractors
      totalContractors: number;
      activeContractors: number; // Currently working
      
      // Timesheets
      pendingTimesheets: number;
      awaitingMyApproval: number; // If this company is approver
      
      // Expenses
      pendingExpenses: number;
      pendingExpenseAmount: number;
      
      // Financial
      totalMonthlyBillable: number; // Current month billable hours
      averageHourlyRate: number;
      
      // Timestamps
      lastUpdated: string;         // When stats were last recalculated
    };
    
    // === Settings ===
    requiresTimesheetApproval: boolean;
    requiresExpenseApproval: boolean;
    defaultCurrency: string;
    fiscalYearStart: string;     // "01-01" or "07-01"
    
    // === Metadata ===
    createdAt: string;
    isActive: boolean;
  }
}
```

---

### 4.4 User/Contractor Node

```typescript
interface UserNode {
  nodeType: "User";
  nodeId: string;
  
  properties: {
    // === Identity ===
    name: string;
    email: string;
    initials: string;
    avatarUrl?: string;
    
    // === Role & Type ===
    userType: "contractor" | "employee" | "manager" | "client" | "admin";
    role?: string;               // Job title (e.g., "Senior Developer")
    
    // === Employment ===
    defaultHourlyRate?: number;
    defaultCurrency: string;
    workSchedule?: {
      hoursPerWeek: number;      // e.g., 40
      daysPerWeek: number;       // e.g., 5
    };
    
    // === Stats (Denormalized) ===
    stats: {
      totalTimesheetsSubmitted: number;
      currentMonthHours: number;
      approvalRate: number;      // % of timesheets approved on first submission
      averageWeeklyHours: number;
      lastSubmittedAt?: string;
      lastUpdated: string;
    };
    
    // === Preferences ===
    preferences: {
      timesheetTrackingMode: "hours" | "time";
      weekStartDay: "monday" | "sunday";
      notifications: {
        email: boolean;
        inApp: boolean;
      };
    };
    
    // === Status ===
    isActive: boolean;
    createdAt: string;
    lastLoginAt?: string;
  }
}
```

---

## 5. Edge Types and Metadata

### 5.1 Core Relationship Edges

```typescript
// Company → User (Employment)
{
  type: "EMPLOYS",
  from: "company-agency-alpha",
  to: "user-alice-chen",
  metadata: {
    startDate: "2024-01-15",
    endDate?: "2025-06-30",      // If contract ended
    employmentType: "contractor" | "employee" | "consultant",
    isActive: true
  }
}

// User → TimesheetPeriod (Ownership)
{
  type: "SUBMITTED_BY",
  from: "ts-2025-11-w1-alice",
  to: "user-alice-chen",
  metadata: {
    submittedAt: "2025-11-10T14:30:00Z",
    submittedFrom: "web" | "mobile" | "api"
  }
}

// TimesheetPeriod → Project (Work Context)
{
  type: "FOR_PROJECT",
  from: "ts-2025-11-w1-alice",
  to: "project-acme-website",
  metadata: {
    percentage: 100,             // If split across projects
    primaryProject: true
  }
}

// TimesheetPeriod → Contract (Billing Rules)
{
  type: "UNDER_CONTRACT",
  from: "ts-2025-11-w1-alice",
  to: "contract-msa-001",
  metadata: {
    appliedRate: 75,             // Rate at time of submission
    appliedCurrency: "USD"
  }
}
```

---

### 5.2 Approval Chain Edges

```typescript
// TimesheetPeriod → User (Approval Required)
{
  type: "REQUIRES_APPROVAL",
  from: "ts-2025-11-w1-alice",
  to: "user-manager-bob",
  metadata: {
    step: 1,                     // Order in approval chain
    status: "pending" | "approved" | "rejected",
    
    // If approved
    approvedAt?: "2025-11-11T09:00:00Z",
    approvalComment?: "LGTM",
    
    // If rejected
    rejectedAt?: "2025-11-11T09:00:00Z",
    rejectionReason?: "Missing task descriptions for Nov 5-6",
    
    // Audit
    reviewedFrom?: "web" | "mobile" | "email",
    notifiedAt: "2025-11-10T14:31:00Z",
    remindersSent: 1
  }
}
```

---

### 5.3 Visibility Edges

```typescript
// Company → TimesheetPeriod (Access Control)
{
  type: "CAN_VIEW",
  from: "company-client-corp",
  to: "ts-2025-11-w1-alice",
  metadata: {
    grantedAt: "2025-11-11T09:00:00Z",  // When internal approved
    grantedBy: "approval_chain",        // How access was granted
    accessLevel: "read_only" | "approve_reject",
    expiresAt?: "2026-05-01T00:00:00Z"  // Optional expiry
  }
}
```

---

## 6. Query Patterns

### 6.1 Container-Level Queries

```typescript
// "Show all contractors from Agency Alpha with pending timesheets"
const result = await graph.query(`
  MATCH (c:Company {id: $companyId})-[:EMPLOYS]->(u:User)
  MATCH (u)-[:SUBMITTED_BY]-(t:TimesheetPeriod)
  WHERE t.status IN ['submitted', 'in_review']
  RETURN u, count(t) as pendingCount
  ORDER BY pendingCount DESC
`, { companyId: 'agency-alpha' });

// Output:
[
  { user: "Alice Chen", pendingCount: 3 },
  { user: "Bob Smith", pendingCount: 1 },
  { user: "Carol Lee", pendingCount: 0 }
]
```

---

### 6.2 Individual-Level Queries

```typescript
// "Show Alice's timesheet approval history"
const result = await graph.query(`
  MATCH (u:User {id: $userId})-[:SUBMITTED_BY]-(t:TimesheetPeriod)
  MATCH (t)-[r:REQUIRES_APPROVAL]->()
  RETURN t, collect(r) as approvalChain
  ORDER BY t.weekStart DESC
  LIMIT 10
`, { userId: 'user-alice-chen' });
```

---

### 6.3 Cross-Container Queries

```typescript
// "Which company has the most pending approvals?"
const result = await graph.query(`
  MATCH (c:Company)-[:EMPLOYS]->(u:User)
  MATCH (u)-[:SUBMITTED_BY]-(t:TimesheetPeriod)
  WHERE t.status = 'in_review'
  RETURN c.name, count(t) as pendingCount
  ORDER BY pendingCount DESC
`);

// Output:
[
  { company: "Agency Alpha", pendingCount: 12 },
  { company: "Freelance Collective", pendingCount: 5 }
]
```

---

## 7. Performance Optimization

### 7.1 Denormalized Stats (Update Strategy)

```typescript
// Update Company.stats when timesheets change
async function updateCompanyStats(companyId: string) {
  const stats = await graph.query(`
    MATCH (c:Company {id: $companyId})-[:EMPLOYS]->(u:User)
    OPTIONAL MATCH (u)-[:SUBMITTED_BY]-(t:TimesheetPeriod)
    WHERE t.status IN ['submitted', 'in_review']
    RETURN 
      count(DISTINCT u) as activeContractors,
      count(t) as pendingTimesheets,
      sum(t.totalAmount) as pendingAmount
  `, { companyId });
  
  await graph.updateNode(companyId, {
    'stats.activeContractors': stats.activeContractors,
    'stats.pendingTimesheets': stats.pendingTimesheets,
    'stats.lastUpdated': new Date().toISOString()
  });
}

// Trigger update on timesheet state change
async function submitTimesheet(timesheetId: string) {
  // ... submission logic ...
  
  // Update company stats asynchronously
  const contractor = await getContractorForTimesheet(timesheetId);
  const company = await getCompanyForUser(contractor.id);
  await updateCompanyStats(company.id);
}
```

---

### 7.2 Caching Strategy

```typescript
// Cache container aggregations (Redis/KV Store)
const cacheKey = `company-stats:${companyId}`;
const ttl = 300; // 5 minutes

async function getCompanyStats(companyId: string) {
  // Try cache first
  const cached = await kv.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Query graph
  const stats = await calculateCompanyStats(companyId);
  
  // Cache result
  await kv.set(cacheKey, JSON.stringify(stats), { ttl });
  
  return stats;
}
```

---

## 8. Implementation Checklist

### Phase 5B: Core Graph Architecture
- [ ] Create TimesheetPeriod nodes (only when submitted)
- [ ] Create ExpenseReport nodes (only when submitted)
- [ ] Implement EMPLOYS edges (Company → User)
- [ ] Implement SUBMITTED_BY edges (Timesheet/Expense → User)
- [ ] Implement FOR_PROJECT edges (Timesheet → Project)
- [ ] Implement UNDER_CONTRACT edges (Timesheet → Contract)
- [ ] Implement REQUIRES_APPROVAL edges (with step metadata)

### Phase 5C: Container Queries
- [ ] Add denormalized stats to Company nodes
- [ ] Build container aggregation queries
- [ ] Implement stats update triggers
- [ ] Add caching layer for container stats

### Phase 6: Advanced Queries
- [ ] Cross-container reporting
- [ ] Historical trend analysis
- [ ] Approval rate analytics
- [ ] Financial rollups

---

## 9. Summary

### ✅ Key Decisions:

1. **Connection Strategy**: Hybrid
   - Timesheets connect to individual contractors (ownership)
   - Containers are UI groupings (derived from Company → Contractor traversal)
   - NO direct Company ←→ Timesheet edges

2. **Node Properties**: Rich metadata
   - Aggregated stats (hours, amounts)
   - Workflow state (status, currentStep)
   - Denormalized data for performance
   - References to Postgres for detailed data

3. **Container Stats**: Denormalized + Cached
   - Store aggregates in Company.stats
   - Update on timesheet state changes
   - Cache for 5 minutes (adjustable)

4. **Graph Visibility**: Layered
   - Structure always visible (Companies, Projects)
   - Work items filtered by time/status
   - Archived items hidden from graph

### 🎯 Next Steps:

1. Implement node creation on timesheet submission
2. Add denormalized stats to Company nodes
3. Build container query API
4. Add graph filtering UI

**Should I now create the implementation code for creating TimesheetPeriod nodes and connecting them properly?**
