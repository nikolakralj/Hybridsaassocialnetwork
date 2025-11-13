# 💰 Expense Management Architecture

**Last Updated:** November 12, 2025  
**Status:** 📋 Planned - Not yet implemented  
**Priority:** HIGH - Critical for contractor workflow  
**Roadmap Phase:** Phase 7

---

## 🎯 Problem Statement

### **Current Gap:**
Contractors need to submit:
1. ✅ **Time worked** (hours) - Already supported
2. ❌ **Expenses incurred** (receipts, mileage, travel) - **NOT SUPPORTED**

### **Real-World Scenarios:**

**Scenario 1: Field Technician**
```
Sarah drives to 3 client sites in one day:
  - 9am: Office → Client A (25 miles)
  - 12pm: Client A → Client B (15 miles)
  - 3pm: Client B → Office (20 miles)
  
She needs to:
  ✅ Log 8 hours of work (timesheet)
  ❌ Log 60 miles of mileage ($36 reimbursement) - NO SYSTEM!
  ❌ Attach parking receipt ($15) - NO SYSTEM!
```

**Scenario 2: Consultant with Travel**
```
John travels to client workshop:
  ✅ Log 8 hours consulting time (timesheet)
  ❌ Attach hotel receipt ($250)
  ❌ Attach meal receipts ($75)
  ❌ Attach taxi receipts ($40)
  ❌ Total: $365 in expenses - NO SYSTEM!
```

**Scenario 3: Scanned Timesheet Verification**
```
Legacy paper timesheet workflow:
  1. Fill paper timesheet at job site
  2. Take photo with phone
  3. Manually re-enter data into digital system
  4. ❌ Can't attach scanned timesheet for verification
  5. ❌ Can't do side-by-side comparison (scanned vs digital)
```

---

## 🏢 Industry Standards

### **Best-in-Class Platforms:**

#### **Concur (SAP)** - Enterprise Standard
- ✅ Receipt capture (photo → OCR)
- ✅ Per diem automation
- ✅ Mileage tracking (GPS integration)
- ✅ Policy compliance checks (over limit warnings)
- ✅ Approval routing (different approvers for expenses vs time)
- ✅ Credit card reconciliation
- ✅ Multi-currency support

#### **Expensify** - SMB/Freelancer Favorite
- ✅ SmartScan (receipt photo → automatic expense creation)
- ✅ Real-time expense tracking
- ✅ Mileage capture (GPS-based)
- ✅ Inline PDF viewer (receipt preview)
- ✅ Per diem calculator
- ✅ Approval workflows with comments

#### **Rydoo** - Modern Cloud Platform
- ✅ Mobile-first receipt capture
- ✅ Expense categorization (meals, travel, materials)
- ✅ Policy engine (auto-flag violations)
- ✅ Integration with accounting systems

#### **QuickBooks Online** - Accounting Integration
- ✅ Receipt matching to expenses
- ✅ Billable vs non-billable expense tracking
- ✅ Client reimbursement tracking
- ✅ Tax category assignment

---

## 📊 Data Model

### **Core Tables:**

```sql
-- Expense categories (customizable per project/client)
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,                    -- "Travel", "Meals", "Materials"
  code TEXT,                             -- "TRV", "MEL", "MAT" (for accounting)
  is_billable BOOLEAN DEFAULT true,      -- Can be billed to client?
  is_taxable BOOLEAN DEFAULT true,       -- Subject to tax?
  requires_receipt BOOLEAN DEFAULT true, -- Receipt required?
  max_amount_without_receipt DECIMAL,    -- E.g., $75 for meals
  reimbursement_rate DECIMAL,            -- For mileage: $0.67/mile
  tax_category TEXT,                     -- "Meals & Entertainment", "Travel"
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense line items
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Linking
  project_id UUID NOT NULL REFERENCES projects(id),
  contract_id UUID NOT NULL REFERENCES contracts(id),
  timesheet_period_id UUID REFERENCES timesheet_periods(id), -- Link to week
  expense_category_id UUID NOT NULL REFERENCES expense_categories(id),
  
  -- Who & When
  contractor_id TEXT NOT NULL,           -- Who incurred the expense
  expense_date DATE NOT NULL,            -- When it was incurred
  
  -- Amount
  amount DECIMAL(10,2) NOT NULL,         -- $125.50
  currency TEXT DEFAULT 'USD',
  tax_amount DECIMAL(10,2),              -- Sales tax included
  
  -- Details
  description TEXT NOT NULL,             -- "Taxi to client site"
  merchant_name TEXT,                    -- "Uber", "Marriott"
  payment_method TEXT,                   -- "Personal Credit Card", "Cash"
  
  -- Mileage-specific
  mileage_distance DECIMAL(6,2),         -- 45.50 miles
  mileage_start_location TEXT,           -- "Office"
  mileage_end_location TEXT,             -- "Client Site A"
  
  -- Billable tracking
  is_billable BOOLEAN DEFAULT true,
  is_reimbursable BOOLEAN DEFAULT true,  -- Can contractor claim reimbursement?
  billable_to_client_id UUID,            -- Which client gets billed?
  
  -- Receipts & Attachments
  receipt_urls TEXT[],                   -- Array of file URLs in Supabase Storage
  scanned_timesheet_url TEXT,            -- For scanned paper timesheet comparison
  
  -- Approval workflow
  status TEXT DEFAULT 'draft',           -- draft, submitted, approved, rejected, paid
  submitted_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Compliance
  policy_violation_flags TEXT[],         -- ["over_limit", "missing_receipt"]
  notes TEXT
);

-- Expense approval history (separate from timesheet approvals)
CREATE TABLE expense_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id),
  
  -- Approval step
  step_number INTEGER NOT NULL,          -- 1 = Manager, 2 = Finance, 3 = Client
  approver_id TEXT NOT NULL,
  approver_role TEXT,                    -- "manager", "finance", "client"
  
  -- Decision
  status TEXT NOT NULL,                  -- pending, approved, rejected
  decision_at TIMESTAMPTZ,
  comments TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Combined timesheet + expense submissions
CREATE TABLE combined_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  project_id UUID NOT NULL REFERENCES projects(id),
  contractor_id TEXT NOT NULL,
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  
  -- What's included
  timesheet_period_id UUID REFERENCES timesheet_periods(id),
  expense_ids UUID[],                    -- Array of expense IDs
  
  -- Totals
  total_hours DECIMAL(5,2),
  total_expenses DECIMAL(10,2),
  total_amount_due DECIMAL(10,2),        -- (hours * rate) + expenses
  
  -- Submission
  submitted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft',           -- draft, submitted, approved, rejected, paid
  
  -- Approval tracking
  current_approval_step INTEGER DEFAULT 1,
  requires_expense_approval BOOLEAN DEFAULT false,
  requires_timesheet_approval BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🎨 UI/UX Design

### **1. Expense Entry Screen**

```
┌─────────────────────────────────────────────────────────┐
│ 📅 Week of Nov 4-10, 2025 - John Smith                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ⏰ TIMESHEET               📁 EXPENSES                  │
│ ────────────────────────────────────────────────────   │
│                                                         │
│ Mon Nov 4   8.0h          🧾 Parking        $15.00     │
│ Tue Nov 5   7.5h          🚗 Mileage (60mi) $40.20     │
│ Wed Nov 6   8.0h          🍽️  Client Lunch  $65.00     │
│ Thu Nov 7   8.0h                                        │
│ Fri Nov 8   6.5h          📷 Hotel          $250.00    │
│                                                         │
│ ──────────────────────────────────────────────────────  │
│ Total:      38.0h         Total Expenses:   $370.20    │
│                                                         │
│ [+ Add Expense]                                         │
│                                                         │
│           [Save Draft]  [Submit for Approval]           │
└─────────────────────────────────────────────────────────┘
```

### **2. Add Expense Modal**

```
┌─────────────────────────────────────────────────────────┐
│ ✖️  Add Expense                                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Date *                                                  │
│ [Nov 5, 2025 ▼]                                        │
│                                                         │
│ Category *                                              │
│ [🚗 Mileage ▼]                                          │
│   Options: Travel, Meals, Materials, Parking, Other    │
│                                                         │
│ ┌─ Mileage Details ────────────────────────────────┐  │
│ │ Start Location: [Office              ]           │  │
│ │ End Location:   [Client Site A       ]           │  │
│ │ Distance:       [60     ] miles                  │  │
│ │ Rate:           $0.67/mile (IRS 2025)            │  │
│ │ Total:          $40.20               (calculated)│  │
│ └──────────────────────────────────────────────────┘  │
│                                                         │
│ Description                                             │
│ [Travel to client workshop                    ]        │
│                                                         │
│ Receipt / Proof                                         │
│ ┌───────────────────────────────────────────────────┐ │
│ │  📷 Take Photo    📁 Upload File    📍 Use GPS   │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ Billable to client?  [✓] Yes  [ ] No                   │
│ Reimbursable?        [✓] Yes  [ ] No                   │
│                                                         │
│                        [Cancel]  [Add Expense]          │
└─────────────────────────────────────────────────────────┘
```

### **3. Scanned Timesheet Comparison View**

```
┌─────────────────────────────────────────────────────────┐
│ 📄 Timesheet Verification - Split View                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  SCANNED TIMESHEET          │  DIGITAL ENTRY            │
│  (Original)                 │  (System)                 │
│ ────────────────────────────┼────────────────────────── │
│                             │                           │
│  [PDF Preview]              │  Mon Nov 4   8.0h ✓       │
│                             │  Tue Nov 5   7.5h ✓       │
│  📷 Uploaded 11/10/25       │  Wed Nov 6   8.0h ✓       │
│  📎 scan_timesheet.pdf      │  Thu Nov 7   8.0h ✓       │
│                             │  Fri Nov 8   6.5h ⚠️       │
│  Zoom: [+ -]                │                           │
│  Page: 1/1                  │  ⚠️  Scanned shows 7.0h   │
│                             │                           │
│  [Rotate] [Download]        │  Total: 38.0h             │
│                             │                           │
│ ────────────────────────────┴────────────────────────── │
│                                                         │
│ ⚠️  Discrepancy Detected: Friday hours mismatch         │
│    Scanned: 7.0h  |  Digital: 6.5h                     │
│                                                         │
│    [Use Scanned Value]  [Keep Digital Value]           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### **4. Approval Screen (Combined Time + Expenses)**

```
┌─────────────────────────────────────────────────────────┐
│ ✓ Approve Submission - Sarah Martinez                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Week: Nov 4-10, 2025  |  Project: Enterprise ClientCo  │
│                                                         │
│ ⏰ TIMESHEET HOURS                                       │
│ ──────────────────────────────────────────────────────  │
│ Total Hours:    42.5 hours                              │
│ Regular:        40.0h @ $125/hr  =  $5,000.00          │
│ Overtime:        2.5h @ $187/hr  =    $467.50          │
│                                  ─────────────          │
│ Time Subtotal:                      $5,467.50          │
│                                                         │
│ 💰 EXPENSES                                             │
│ ──────────────────────────────────────────────────────  │
│ Nov 4  🧾 Parking              $15.00  [View Receipt]   │
│ Nov 5  🚗 Mileage (60mi)       $40.20  [View Details]   │
│ Nov 6  🍽️  Client Lunch         $65.00  [View Receipt]   │
│ Nov 8  📷 Hotel                $250.00  [View Receipt]   │
│                                  ─────────────          │
│ Expense Subtotal:                   $370.20            │
│                                                         │
│ ⚠️  POLICY CHECKS                                        │
│ ──────────────────────────────────────────────────────  │
│ ✓ All receipts attached                                │
│ ⚠️  Hotel ($250) exceeds policy limit ($200)           │
│ ✓ Mileage rate matches IRS standard                    │
│                                                         │
│ ═══════════════════════════════════════════════════════ │
│ TOTAL AMOUNT DUE:                      $5,837.70        │
│ ═══════════════════════════════════════════════════════ │
│                                                         │
│ Comments (optional)                                     │
│ [Hotel overage justified - client requested           ]│
│  specific property for early meeting                   │
│                                                         │
│         [Reject] [Request Changes] [Approve All]        │
│                                                         │
│ [ ] Approve time only (hold expenses for review)       │
│ [ ] Approve expenses only (hold time for review)       │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Approval Workflows

### **Option 1: Unified Approval (Time + Expenses Together)**

```
Contractor submits week:
  ├─ 40 hours
  └─ $370 in expenses

        ↓
        
Step 1: Manager Approval
  ├─ Approves/rejects BOTH time and expenses
  └─ Can approve one, hold the other
  
        ↓
        
Step 2: Finance Approval (if expenses > $500)
  ├─ Reviews expense policy compliance
  └─ Approves reimbursement
  
        ↓
        
Step 3: Client Approval (if billable)
  ├─ Reviews billable hours
  └─ Reviews billable expenses
  
        ↓
        
✓ Approved → Generate invoice ($5,467.50 time + $370.20 expenses)
```

### **Option 2: Split Approval (Different Paths)**

```
Contractor submits week:
  ├─ 40 hours      → Timesheet approval path
  └─ $370 expenses → Expense approval path

Timesheet Path:          Expense Path:
    ↓                        ↓
Manager                  Finance Manager
    ↓                        ↓
Client                   VP Finance (if > $1000)
    ↓                        ↓
✓ Approved               ✓ Approved
```

**Benefits:**
- Faster approval (parallel processing)
- Different approvers for different concerns
- Finance team only sees expenses

**Drawbacks:**
- More complex to track
- Risk of partial payment (time approved, expenses stuck)

---

## 📸 Receipt Management

### **Upload Methods:**

#### **1. Mobile Photo Capture**
```typescript
// Mobile-optimized receipt capture
<Button onClick={captureReceipt}>
  📷 Take Photo of Receipt
</Button>

// Uses device camera API
navigator.mediaDevices.getUserMedia({ 
  video: { facingMode: 'environment' } // Back camera
})

// Auto-compress and upload to Supabase Storage
// bucket: project-receipts-f8b491be
// path: /{projectId}/{contractorId}/{expenseId}/receipt-{timestamp}.jpg
```

#### **2. File Upload**
```typescript
// Desktop file picker
<input 
  type="file" 
  accept="image/*,application/pdf"
  onChange={handleFileUpload}
/>

// Supported formats:
// - Images: JPG, PNG, HEIC
// - Documents: PDF
// - Max size: 10MB per file
```

#### **3. Email Forward** (Future)
```
User emails receipt to: receipts+{projectId}@workgraph.app
  → Auto-creates expense
  → OCR extracts: date, amount, merchant
  → Assigns to current week
```

### **Storage Architecture:**

```sql
-- Supabase Storage Buckets
CREATE BUCKET receipts_f8b491be (
  public: false,  -- Private bucket
  file_size_limit: 10485760,  -- 10MB
  allowed_mime_types: ['image/jpeg', 'image/png', 'application/pdf']
);

-- Storage path structure:
/{projectId}/{contractorId}/{expenseId}/receipt-{timestamp}.{ext}

-- Example:
/proj-123/contractor-456/exp-789/receipt-1699564800.jpg
```

### **Receipt Preview:**

```typescript
// Inline PDF/image viewer
<Dialog>
  <DialogTrigger>
    <Button variant="ghost" size="sm">
      [View Receipt]
    </Button>
  </DialogTrigger>
  <DialogContent className="max-w-4xl">
    <div className="grid grid-cols-2 gap-4">
      {/* Left: Receipt preview */}
      <div className="border rounded">
        {fileType === 'pdf' ? (
          <PDFViewer url={receiptUrl} />
        ) : (
          <img src={receiptUrl} alt="Receipt" />
        )}
      </div>
      
      {/* Right: Expense details */}
      <div>
        <h3>Expense Details</h3>
        <dl>
          <dt>Date:</dt><dd>Nov 5, 2025</dd>
          <dt>Amount:</dt><dd>$65.00</dd>
          <dt>Category:</dt><dd>Meals</dd>
          <dt>Merchant:</dt><dd>Olive Garden</dd>
        </dl>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

---

## 🔍 OCR & Automation (Phase 7+)

### **Receipt OCR (Optical Character Recognition):**

```typescript
// Integration with OCR service
import { extractReceiptData } from './utils/ocr';

const processReceipt = async (imageFile: File) => {
  // Upload to Supabase Storage
  const { url } = await uploadToStorage(imageFile);
  
  // OCR extraction
  const extractedData = await extractReceiptData(url);
  
  // Auto-populate expense form
  return {
    date: extractedData.date,           // "2025-11-05"
    amount: extractedData.total,        // 65.00
    merchant: extractedData.merchant,   // "Olive Garden"
    category: inferCategory(extractedData.merchant), // "Meals"
    taxAmount: extractedData.tax,       // 5.20
  };
};
```

**OCR Providers:**
- **Google Cloud Vision API** - Best accuracy, $1.50 per 1000 images
- **AWS Textract** - Good for receipts, $1.50 per 1000 pages
- **Mindee** - Receipt-specific API, $0.50 per 1000 docs
- **Taggun** - Specialized in receipt OCR

### **Smart Categorization:**

```typescript
// ML-based category prediction
const inferCategory = (merchant: string, description: string) => {
  // Pattern matching
  if (/uber|lyft|taxi/i.test(merchant)) return 'Transportation';
  if (/marriott|hilton|hotel/i.test(merchant)) return 'Lodging';
  if (/restaurant|cafe|lunch/i.test(description)) return 'Meals';
  
  // Future: ML model trained on historical data
  // return mlModel.predict({ merchant, description });
};
```

---

## 🚨 Policy Compliance Engine

### **Policy Rules:**

```typescript
interface ExpensePolicy {
  categoryId: string;
  maxAmountWithoutReceipt: number;     // $75 for meals
  maxAmountPerTransaction: number;      // $500 for any single expense
  maxAmountPerWeek: number;             // $2000 total expenses per week
  requiresManagerApproval: boolean;
  requiresFinanceApproval: boolean;     // If > $1000
  requiresClientApproval: boolean;      // If billable
  allowedPaymentMethods: string[];      // ['corporate_card', 'personal']
  businessRuleViolations: string[];     // ['alcohol_not_billable']
}

// Real-time policy check
const checkPolicyCompliance = (expense: Expense, policy: ExpensePolicy) => {
  const violations = [];
  
  // Receipt requirement
  if (expense.amount > policy.maxAmountWithoutReceipt && !expense.receiptUrls.length) {
    violations.push({
      code: 'missing_receipt',
      message: `Receipt required for expenses over $${policy.maxAmountWithoutReceipt}`,
      severity: 'error',
    });
  }
  
  // Amount limits
  if (expense.amount > policy.maxAmountPerTransaction) {
    violations.push({
      code: 'over_limit',
      message: `Exceeds max transaction limit of $${policy.maxAmountPerTransaction}`,
      severity: 'warning',
    });
  }
  
  // Business rules
  if (expense.description.toLowerCase().includes('alcohol') && expense.isBillable) {
    violations.push({
      code: 'non_billable_item',
      message: 'Alcohol cannot be billed to client per company policy',
      severity: 'error',
    });
  }
  
  return violations;
};
```

### **UI Policy Indicators:**

```tsx
// Real-time validation as user types
<div className="expense-form">
  <Input
    type="number"
    value={amount}
    onChange={(e) => {
      setAmount(e.target.value);
      const violations = checkPolicyCompliance({ amount: e.target.value }, policy);
      setViolations(violations);
    }}
  />
  
  {violations.map(v => (
    <Alert variant={v.severity === 'error' ? 'destructive' : 'warning'}>
      {v.severity === 'error' ? '🚫' : '⚠️'} {v.message}
    </Alert>
  ))}
</div>
```

---

## 📱 Mobile-First Features

### **1. GPS Mileage Tracking**

```typescript
// Auto-calculate mileage from GPS
const trackMileage = () => {
  // Start tracking
  const startLocation = getCurrentPosition();
  
  // Background tracking during drive
  watchPosition((position) => {
    updateRoute(position);
  });
  
  // End tracking
  const endLocation = getCurrentPosition();
  const distance = calculateDistance(startLocation, endLocation);
  
  // Create expense
  createExpense({
    category: 'mileage',
    amount: distance * IRS_MILEAGE_RATE,
    mileageDistance: distance,
    mileageStartLocation: geocode(startLocation),
    mileageEndLocation: geocode(endLocation),
  });
};
```

### **2. Quick Capture from Lock Screen** (PWA)

```typescript
// PWA shortcut for instant receipt capture
{
  "shortcuts": [
    {
      "name": "Capture Receipt",
      "url": "/expenses/capture",
      "icons": [{ "src": "/icon-camera.png", "sizes": "192x192" }]
    }
  ]
}

// User can long-press app icon → "Capture Receipt" → Camera opens
```

### **3. Offline Queue**

```typescript
// Save expenses offline, sync when online
const saveExpense = async (expense: Expense) => {
  if (navigator.onLine) {
    await api.createExpense(expense);
  } else {
    // Store in IndexedDB
    await localDB.expenses.add({
      ...expense,
      _syncStatus: 'pending',
    });
    
    // Show toast
    toast.info('Saved offline. Will sync when online.');
  }
};

// Auto-sync when connection restored
window.addEventListener('online', async () => {
  const pendingExpenses = await localDB.expenses
    .where('_syncStatus').equals('pending')
    .toArray();
  
  for (const expense of pendingExpenses) {
    await api.createExpense(expense);
    await localDB.expenses.update(expense.id, { _syncStatus: 'synced' });
  }
  
  toast.success(`Synced ${pendingExpenses.length} expenses`);
});
```

---

## 🔗 Integration Points

### **1. Accounting System Integration**

```typescript
// Export to QuickBooks Online
const exportToQBO = async (approvedExpenses: Expense[]) => {
  const qboExpenses = approvedExpenses.map(exp => ({
    TxnDate: exp.expenseDate,
    AccountRef: { value: exp.qboAccountId }, // "Travel Expense"
    PaymentType: "Cash",
    EntityRef: { value: exp.contractorId },
    Line: [{
      Amount: exp.amount,
      DetailType: "AccountBasedExpenseLineDetail",
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: exp.categoryCode },
        TaxCodeRef: { value: exp.taxCategory },
      }
    }],
    AttachableRef: exp.receiptUrls.map(url => ({ 
      AttachableRef: { value: uploadToQBO(url) }
    })),
  }));
  
  await qboAPI.batchCreateExpenses(qboExpenses);
};
```

### **2. Payroll Integration**

```typescript
// Export for payroll reimbursement
const generateReimbursementFile = (contractorId: string, month: string) => {
  const expenses = await getApprovedExpenses({ contractorId, month });
  
  const reimbursementTotal = expenses
    .filter(e => e.isReimbursable)
    .reduce((sum, e) => sum + e.amount, 0);
  
  // CSV for payroll system
  return {
    employeeId: contractorId,
    period: month,
    reimbursementAmount: reimbursementTotal,
    expenses: expenses.map(e => ({
      date: e.expenseDate,
      category: e.category,
      amount: e.amount,
      receiptUrl: e.receiptUrls[0],
    })),
  };
};
```

---

## 📋 Roadmap Addition

### **Phase 7: Expense Management** (NEW - 2 Week Sprint)

#### **Week 1: Core Expense Features**

**Day 1-2: Data Model + Basic Entry**
- [ ] Create `expenses`, `expense_categories`, `expense_approvals` tables
- [ ] Add expense entry form with category selection
- [ ] File upload to Supabase Storage (receipts bucket)
- [ ] Link expenses to timesheet periods
- [ ] **Test:** Create expense with receipt, verify storage

**Day 3-4: Receipt Management**
- [ ] Mobile camera capture (PWA)
- [ ] Inline PDF/image viewer
- [ ] Multiple receipt attachment per expense
- [ ] Scanned timesheet upload + comparison view
- [ ] **Test:** Upload receipt via phone, view on desktop

**Day 5: Expense Categories + Policy Engine**
- [ ] Mileage tracking (distance → amount calculation)
- [ ] Per diem support
- [ ] Policy compliance checks (receipt requirements, limits)
- [ ] Real-time validation in UI
- [ ] **Test:** Exceed policy limit, verify warning shown

#### **Week 2: Approval Workflows + Reporting**

**Day 6-7: Approval Integration**
- [ ] Combined time + expense approval screen
- [ ] Separate approval paths (optional)
- [ ] Policy violation flags in approval queue
- [ ] Expense-specific approval routing
- [ ] **Test:** Submit time + expenses, approve both

**Day 8-9: Reporting + Export**
- [ ] Expense summary by category
- [ ] Tax-ready expense reports
- [ ] QuickBooks export (CSV)
- [ ] Contractor reimbursement report
- [ ] **Test:** Export month of expenses to CSV

**Day 10: Mobile + Offline**
- [ ] PWA receipt capture shortcut
- [ ] GPS mileage tracking
- [ ] Offline expense queue
- [ ] Background sync
- [ ] **Test:** Create expense offline, verify sync when online

#### **Exit Criteria:**
- ✅ Contractor can submit expenses with receipts
- ✅ Manager can approve/reject expenses
- ✅ All receipts stored securely in Supabase Storage
- ✅ Policy violations flagged before submission
- ✅ Mobile receipt capture works on iOS/Android
- ✅ Scanned timesheet comparison view functional
- ✅ Export to accounting system (CSV)
- ✅ Zero data loss with offline mode

---

## 🎯 Summary

**You asked about:**
1. ✅ Attaching scanned timesheets (phone photos) for verification
2. ✅ PDF comparison (scanned vs digital)
3. ✅ Expense attachment workflow
4. ✅ Expense approval chains
5. ✅ Industry standards

**What I provided:**
1. Complete data model (expenses, categories, approvals, combined submissions)
2. UI/UX mockups (expense entry, receipt upload, approval screens)
3. Scanned timesheet comparison view (split-screen PDF viewer)
4. Industry standards (Concur, Expensify, Rydoo patterns)
5. Receipt management (mobile capture, storage, OCR)
6. Policy compliance engine (real-time validation)
7. Approval workflows (unified vs split paths)
8. Mobile features (GPS, offline, PWA shortcuts)
9. Integration patterns (QuickBooks, payroll)
10. **Complete Phase 7 roadmap** (2-week sprint)

**Next Steps:**
- Add Phase 7 to master roadmap
- Prioritize after current phase completion
- Consider early prototype for mobile receipt capture (high user value)

---

**Created:** November 12, 2025  
**Status:** 📋 Planned for Phase 7  
**Priority:** HIGH - Critical contractor workflow feature  
**See Also:** `/docs/roadmap/MASTER_ROADMAP.md` for phase sequencing
