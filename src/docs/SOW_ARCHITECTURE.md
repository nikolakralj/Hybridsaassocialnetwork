# 📋 Statement of Work (SOW) Architecture

**Last Updated:** 2025-11-12  
**Status:** Phase 6-7 Feature  
**Priority:** HIGH - Foundation for expense management, billing, and AI contract analysis

---

## 🎯 What is a Statement of Work (SOW)?

A **Statement of Work** sits under (or alongside) a master agreement (MSA) and defines the specific work, deliverables, timeline, and commercials for a project or phase. Think of it as the **"scope + rules for this slice of work."**

### SOW vs Contract (MSA) vs PO

| Document | Purpose | Contains |
|----------|---------|----------|
| **MSA/Contract** | Umbrella legal terms | IP, liability, confidentiality, termination, general terms |
| **SOW** | Scope of work | Deliverables, milestones, acceptance criteria, rates/fees, schedule, SLAs/KPIs, change control |
| **PO (Purchase Order)** | Client's funding instrument | Budget number, accounting codes, references SOW |

---

## 🔗 Where SOW Fits in the Project Graph

SOW is **its own node type** in the WorkGraph. It connects to other entities through these edges:

### Edge Types

```
Solid Edges (Relationships):
- governs       MSA → SOW              (SOW inherits legal terms)
- fundedBy      SOW → PO               (budget comes from one/many POs)
- covers        SOW → Contract(s)      (rate tables / roles / work packages)
- paysFor       SOW → Milestone        (milestones tied to acceptance & invoicing)
- belongsTo     SOW → Budget           (cap, burn-down tracking)
- deliveredBy   SOW → Party/Team       (who executes the work)

Dashed Edges (Approval Routing):
- approvedBy    Party → SOW            (scope changes, milestones, expense thresholds)
```

### Key Insight: Expenses are NOT nodes

**Expenses reference `contractId` and optionally `sowId`/`sowLineId`**. They flow along the `approvedBy` edges defined at SOW/Contract level.

---

## 📊 Data Model

### Core SOW Table

```typescript
// types/sow.ts
export interface SOW {
  id: string;
  projectId: string;
  code: string;                 // e.g., SOW-2025-001
  title: string;
  startDate: string;            // YYYY-MM-DD
  endDate?: string;             // YYYY-MM-DD
  pricingModel: 'T&M' | 'Fixed' | 'Milestone' | 'Capped T&M' | 'Retainer';
  currency: string;             // USD, EUR, GBP
  capAmount?: number;           // for capped T&M / fixed
  rateTableId?: string;         // links to role/rate matrix
  acceptanceCriteria: string;   // markdown
  scopeSummary: string;         // markdown
  status: 'draft' | 'active' | 'closed' | 'superseded';
  version: number;              // SOW v1, v2 (amendments)
  parentSowId?: string;         // chain for amendments/change orders
  createdAt: string;
  updatedAt: string;
}
```

### SQL Schema

```sql
create table sow (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  code text not null,
  title text not null,
  start_date date not null,
  end_date date,
  pricing_model text not null check (pricing_model in ('T&M','Fixed','Milestone','Capped T&M','Retainer')),
  currency text not null default 'USD',
  cap_amount numeric(14,2),
  rate_table_id uuid references rate_tables(id),
  acceptance_criteria text,
  scope_summary text,
  status text not null check (status in ('draft','active','closed','superseded')) default 'draft',
  version int not null default 1,
  parent_sow_id uuid references sow(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(project_id, code)
);

create index idx_sow_project on sow(project_id);
create index idx_sow_status on sow(status);
create index idx_sow_parent on sow(parent_sow_id);
```

---

### SOW Lines (Granular Scope)

SOW lines break down the work into:
- **Roles** (developer, QA, PM) with rates
- **Milestones** (deliverables) with fixed amounts
- **Expense buckets** (travel, materials) with caps

```typescript
export interface SOWLine {
  id: string;
  sowId: string;
  kind: 'role' | 'milestone' | 'expense_bucket';
  code?: string;              // e.g., "DEV-SR", "M1", "TRAVEL"
  description: string;
  unit?: string;              // 'hour', 'deliverable', 'each', 'km'
  rate?: number;              // for role lines or unitized fees
  qty?: number;               // estimated quantity
  amount?: number;            // fixed/milestone amount
  cap?: number;               // per-line cap
  glAccount?: string;         // accounting code
  billable: boolean;
}
```

```sql
create table sow_line (
  id uuid primary key default gen_random_uuid(),
  sow_id uuid not null references sow(id) on delete cascade,
  kind text not null check (kind in ('role','milestone','expense_bucket')),
  code text,
  description text not null,
  unit text,                    -- 'hour','deliverable','each','km'
  rate numeric(12,2),
  qty numeric(12,2),
  amount numeric(14,2),         -- fixed/milestone amount
  cap numeric(14,2),            -- per-line cap
  gl_account text,
  billable boolean default true,
  created_at timestamptz default now()
);

create index idx_sow_line_sow on sow_line(sow_id);
create index idx_sow_line_kind on sow_line(kind);
```

---

## 💰 Pricing Models & Billing Behavior

### 1. Time & Materials (T&M)
- **Billing**: Hours × Rate from timesheets
- **Expenses**: Pass-through (if billable per SOW)
- **Budget**: Optional warning threshold
- **Invoicing**: Weekly/monthly based on approved hours + expenses

### 2. Capped T&M
- Same as T&M, but **stop billing after `capAmount`**
- Show burn-down progress (consumed / cap)
- Warn when 80% consumed

### 3. Fixed Fee
- **Billing**: By milestones, not hours
- **Timesheets**: Tracked for effort/utilization, not priced
- **Invoicing**: When milestone accepted (e.g., 30% on design, 70% on delivery)
- **Internal costing**: Track actual hours vs. estimated

### 4. Milestone-Based
- Explicit SOW lines with acceptance criteria
- Approval of milestone = invoice trigger
- Example: "Design phase complete → invoice $50k"

### 5. Retainer
- **Billing**: Fixed monthly amount
- **Timesheets**: For utilization tracking, not billing
- **Cap**: Included hours per month (e.g., 40h included)
- **Overage**: Bill excess hours at agreed rate

---

## 🔗 Linking Data to SOW

### Timesheets
```typescript
timesheet_entry {
  sow_id?: string;           // optional SOW reference
  contract_id: string;       // primary link
  // Resolve via contract_id → sow_line(role) mapping
}
```

### Expenses
```typescript
expense_line {
  sow_id?: string;           // links to SOW
  sow_line_id?: string;      // links to expense_bucket line
  contract_id: string;       // always required
  // Used to enforce category caps & billability
}
```

### Invoices
```typescript
invoice_line {
  source_kind: 'timesheet' | 'expense' | 'milestone';
  source_id: string;         // ID of timesheet/expense/milestone
  sow_line_id?: string;      // for auditability
  // Links invoice back to SOW scope
}
```

---

## 💸 Expense Approvals with Industry Rules

SOW (and PO) define **policy + funding** for expenses:

### Policy Rules Stored in SOW

1. **Allowed categories** by SOW  
   Example: Travel, lodging, meals allowed; software licenses excluded

2. **Per diem vs actuals**  
   - Per diem: $75/day for meals (no receipts needed)
   - Actuals: Submit receipts, reimburse exact amount

3. **Daily/transaction caps**  
   - Hotel: max $200/night
   - Meals: max $75/day
   - Mileage: IRS rate ($0.67/mile in 2024)

4. **Receipt thresholds**  
   Example: Receipts required for expenses ≥ $25

5. **Pre-approval requirements**  
   Example: Airfare or hardware purchases need pre-approval

6. **Tax handling**  
   - VAT reclaimability per country/category
   - Auto-populate tax codes by location + category

7. **Client-billable toggle**  
   - Pass-through only (client pays exact amount)
   - Markup (agency adds % to expense)

### Approval Chain

```
Line Manager / Vendor Approver
  ↓ (policy compliance: receipt exists? within caps?)
Finance / AP
  ↓ (tax codes, GL, duplicate detection)
Client (only if billable pass-through per SOW/PO)
  ↓
Approved → Ready to invoice
```

---

## 🎛️ How the Project Graph "Drives" Routing

1. **Compile dashed `approvedBy` edges** into an executable policy artifact (already exists for timesheets)

2. **Each expense/timesheet carries**:
   - `projectId`
   - `contractId`
   - `sowId` (optional)

3. **Engine picks the active SOW policy** for that submission and routes to the next party

4. **Mask rates/markups** using contract-scoped visibility:
   - Client sees pass-through amounts only
   - Agency sees full markup
   - Freelancer sees their rate only

---

## 🔄 Change Control & Versioning

### Representing Change Orders

- **Change Orders** = `sow.version++` with `parent_sow_id`
- Only **one active SOW** for a scope at a time
- Earlier versions become `status: 'superseded'`

### UI Display

- Graph shows a **single SOW node** with a version chip (e.g., "v3")
- Click to view **version history** and compare deltas

### Example Flow

```
SOW-2025-001 v1 (active)
  ↓ (client requests scope change)
SOW-2025-001 v2 (draft) → approved
  ↓ (v1 becomes 'superseded', v2 becomes 'active')
SOW-2025-001 v2 (active)
```

---

## 🛡️ Guardrails & Validations

### Budget Enforcement
- **Block submission** or **warn** when SOW/PO budget is exceeded
- Surface burn-down in timesheet/expense drawer:
  ```
  SOW-2025-001 Budget: $50,000
  Consumed: $42,000 (84%)
  Remaining: $8,000
  ```

### Cross-Document Validation
- **Require active SOW + valid PO** before generating invoice
- Prevent invoicing against expired SOW

### Country Awareness
- Expense **location drives tax code defaults**
- Example: UK expense → VAT standard rate (20%)

### Duplicate Detection
- Hash receipts (image perceptual hash)
- Collision check: amount + date + merchant

### RLS/Visibility
- **Client** can see:
  - Billable expense totals + receipts
  - NOT internal markups or non-billable lines
- **Agency** can see:
  - All expenses, full markup detail
- **Freelancer** can see:
  - Their submitted expenses only

---

## 🤖 AI Contract Analysis Integration

### What AI Extracts from SOW PDFs

1. **Parties**: Client, vendor, subcontractors
2. **Rates**: Role-based rate table
3. **Dates**: Start, end, milestones
4. **Approval limits**: Thresholds, escalation paths
5. **Expense policies**: Allowed categories, caps, per diem
6. **Milestones**: Deliverables, acceptance criteria, amounts
7. **Budget caps**: Total SOW value, PO references
8. **Pricing model**: T&M, Fixed, Milestone, etc.

### Multi-Doc Parsing with Precedence

| Document | Governs | Precedence |
|----------|---------|------------|
| MSA | Legal terms (IP, liability, termination) | 1 (highest) |
| SOW | Scope, deliverables, milestones, rates | 2 |
| PO | Funding, budget number | 3 |

**Rule**: If MSA says NET 30 but SOW says NET 45, **MSA wins** (unless SOW explicitly overrides).

### Confidence Gating

- **Block auto-activate** if any critical field < 85% confidence
- Critical fields:
  - Party names
  - Start/end dates
  - Pricing model
  - Budget cap
  - Approval thresholds

### Structured Schema Output

AI returns:
```json
{
  "parties": [...],
  "pricingModel": "Capped T&M",
  "capAmount": 250000,
  "currency": "USD",
  "rateTable": [
    { "role": "Senior Dev", "rate": 125, "unit": "hour" }
  ],
  "milestones": [...],
  "expensePolicy": {
    "allowedCategories": ["travel", "meals", "lodging"],
    "receiptThreshold": 75,
    "perDiem": { "meals": 75 },
    "caps": { "hotel": 200 }
  },
  "approvalLimits": [
    { "party": "Manager", "maxAmount": 5000 },
    { "party": "Finance", "maxAmount": 25000 }
  ]
}
```

### Redline Anchoring

- Store **exact source snippets + page coordinates**
- User can click to see where AI extracted each field
- Example: "Rate: $125/hr" → highlights PDF text on page 3

### Diff on Amendments

- Compare **SOW v1 vs v2**
- Show deltas:
  - ✅ Added: Milestone 4 ($10k)
  - ❌ Removed: Travel expense cap
  - ✏️ Changed: End date moved from June 30 → July 31

---

## 📦 Implementation Phasing

### Phase 6: SOW Data Model + Basic UI
- ✅ Create `sow` and `sow_line` tables
- ✅ Basic SOW CRUD (create, read, update)
- ✅ SOW node in Project Graph
- ✅ Link contracts to SOW
- ✅ Version chaining for amendments

### Phase 7: Expense Integration
- ✅ Link expenses to `sow_id` / `sow_line_id`
- ✅ Expense policy rules (caps, receipts, billability)
- ✅ Budget enforcement and burn-down
- ✅ Approval routing via SOW policy

### Phase 11: AI Contract Analysis
- ✅ PDF upload and OCR
- ✅ AI extraction with confidence scoring
- ✅ Auto-generate SOW nodes from PDF
- ✅ Human review pane with corrections
- ✅ Multi-doc parsing (MSA + SOW + PO)

---

## ✅ Exit Criteria

### Phase 6 (SOW Foundation):
- [ ] Can create SOW with pricing model, cap, rate table
- [ ] SOW versioning works (v1 → v2 with parent link)
- [ ] SOW node appears in Project Graph
- [ ] Contracts can reference SOW
- [ ] Budget burn-down displays correctly

### Phase 7 (Expense Integration):
- [ ] Expenses link to SOW and respect policy rules
- [ ] Receipt requirements enforced (block submission if missing)
- [ ] Budget caps prevent over-spending
- [ ] Approval routing uses SOW-defined chains
- [ ] Client sees billable totals only, not markups

### Phase 11 (AI Analysis):
- [ ] AI extracts all key fields with >90% accuracy
- [ ] Confidence scoring prevents bad auto-activation
- [ ] User can correct extractions and re-run
- [ ] Multi-doc parsing works (MSA + SOW)
- [ ] Zero hallucinations in 100 test contracts

---

## 📚 Related Documentation

- **Project Graph**: `/docs/PROJECT_GRAPH_EXPLAINED.md`
- **Expense Management**: `/docs/EXPENSE_MANAGEMENT_ARCHITECTURE.md`
- **Multi-Party Approvals**: `/docs/MULTI_PARTY_APPROVAL_ARCHITECTURE.md`
- **AI Contract Analysis**: Phase 11 in `/docs/roadmap/MASTER_ROADMAP.md`
- **Contract Visibility**: `/docs/CONTRACT_SCOPED_RATE_VISIBILITY.md`

---

**Status**: Ready for Phase 6 implementation
