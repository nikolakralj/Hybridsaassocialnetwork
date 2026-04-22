# Industry-Ready Timesheet Strategy for WorkGraph

**Version 1.0 | March 24, 2026**
**Owner: Antigravity (Strategy) → Codex (Implementation)**
**Status: Approved by Nikola**

---

## Problem Statement

The current timesheet system has several limitations that prevent real-world agency adoption:
1. **Entry types are too narrow**: Only `hours` or `startTime/endTime` per day. No way to log travel time, on-call, training, etc.
2. **Submission is week-only**: Users must submit week-by-week. No option for full-month submission.
3. **Days are hardcoded to Mon–Fri**: No support for weekend work or custom work weeks.
4. **No expense/allowance tracking**: Travel, per diem, mileage, and equipment costs cannot be attached to a timesheet.
5. **No validation layer**: No policy-based checks before submission (e.g., max daily hours, overtime thresholds).

---

## 1. Expanded Time Entry Categories

Each `StoredDay` should support multiple **typed line items** instead of a single `hours` field.

**Proposed categories:**

| Category | Billable? | Description |
|----------|-----------|-------------|
| `regular` | Yes | Standard working hours |
| `overtime` | Yes (at multiplier) | Hours exceeding daily/weekly threshold |
| `travel` | **Defined by contract** | Travel to/from client site |
| `on_call` | Configurable | Standby/on-call availability |
| `training` | No (usually) | Internal training, certifications |
| `admin` | No | Internal meetings, reporting |
| `sick` | No | Sick leave (for tracking, not billing) |
| `vacation` | No | Paid time off |
| `public_holiday` | No | National/regional holidays |

**Data model change:**

```typescript
interface TimeEntry {
  id: string;
  category: TimeCategory;  // 'regular' | 'overtime' | 'travel' | ...
  hours: number;
  description?: string;
  billable: boolean;        // Derived from category + contract config
  rate_multiplier?: number; // e.g., 1.5x for overtime
  metadata?: {              // Category-specific data
    distance_km?: number;   // For travel
    vehicle_type?: string;  // For mileage
    location?: string;      // For travel/on-site
  };
}

interface StoredDay {
  day: string;
  entries: TimeEntry[];     // ← replaces single `hours` field
  totalHours: number;       // Computed: sum of entries[].hours
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  notes?: string;
}
```

**Backward compatibility:** The existing `hours` field becomes `entries: [{ category: 'regular', hours: X, billable: true }]`. A migration utility converts legacy data on first load.

---

## 2. Flexible Submission Periods

**Three submission modes:**

| Mode | Unit | Use Case |
|------|------|----------|
| **Weekly** (default) | Mon–Fri block | Most consulting firms, weekly approval cadence |
| **Monthly** | Full calendar month | Salaried contractors, fixed-fee engagements |
| **Custom range** | User-selected date range | Ad-hoc project milestones, sprint-based billing |

**How monthly submission works:**
1. User fills in days throughout the month (saving as drafts automatically).
2. At month-end, user clicks **"Submit Month"**.
3. System bundles all draft weeks into a single `SubmissionEnvelope`.
4. Approver sees a **single consolidated view** (not expandable week-by-week — decided by Nikola).
5. Approver can approve the entire month, or reject specific weeks within it.

**Data model addition:**

```typescript
interface SubmissionEnvelope {
  id: string;
  type: 'weekly' | 'monthly' | 'custom';
  personId: string;
  projectId: string;
  period: { start: string; end: string };
  weekIds: string[];
  status: WeekStatus;
  submittedAt?: string;
  approvedBy?: string;
  totalHours: number;
  totalBillableHours: number;
}
```

---

## 3. Weekend and Custom Work Week Support

`StoredDay[]` should respect the project's `WorkWeek` configuration. If `saturday: true`, the week generates 6 day slots. If `sunday: true`, 7 slots.

---

## 4. Expense & Allowance Line Items

```typescript
interface ExpenseEntry {
  id: string;
  category: 'travel' | 'accommodation' | 'meals' | 'equipment' | 'per_diem' | 'mileage' | 'other';
  amount: number;
  currency: string;
  description: string;
  receipt_url?: string;    // Deferred to Phase 5 (approved by Nikola)
  billable: boolean;
  reimbursable: boolean;
}
```

Expenses are attached at the **week level** (not day level).

---

## 5. Pre-Submission Validation Engine

| Rule | Example | Severity |
|------|---------|----------|
| Max daily hours | ≤ 12h per day | Error (blocks submission) |
| Max weekly hours | ≤ 60h per week | Warning |
| Overtime threshold | Auto-flag entries > 8h/day as overtime | Auto-categorize |
| Missing days | Flag weekdays with 0 hours | Warning |
| Contract hour cap | Monthly limit from contract node | Error |
| Required description | Entries must have a description | Configurable |
| Future date block | Cannot log time for future dates | Error |

**Implementation:** A `validateTimesheet(week, project, contract)` pure function returning `{ errors: [], warnings: [] }`.

---

## 6. Approval Workflow Enhancements

| Feature | Description |
|---------|-------------|
| **Batch month approval** | Extend existing `batchApproveMonth` to work with `SubmissionEnvelope`. |
| **Partial rejection** | Reject individual weeks within a monthly submission. |
| **Approval delegation** | Auto-route to delegate if primary approver is unavailable. |
| **Time lock** | Lock approved periods; require unlock request to reopen. |
| **Auto-approve rules** | Auto-approve if total hours ≤ X and no overtime (configurable per contract). |

---

## Implementation Priority

| Priority | Feature | Phase | Effort |
|----------|---------|-------|--------|
| 🔴 P0 | Time entry categories (regular, overtime, travel) | Phase 3.5 | Medium |
| 🔴 P0 | Monthly submission envelope | Phase 3.5 | Medium |
| 🟡 P1 | Validation engine | Phase 4 prep | Small |
| 🟡 P1 | Custom work week (Sat/Sun support) | Phase 3.5 | Small |
| 🟢 P2 | Expense line items | Phase 5 | Medium |
| 🟢 P2 | Time lock + unlock request | Phase 4 | Small |
| 🔵 P3 | Auto-approve rules | Phase 4 | Small |
| 🔵 P3 | Approval delegation | Phase 4 | Small |
