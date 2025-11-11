# Timesheet Architecture - Two-Level System

## Overview

WorkGraph uses a **two-level timesheet architecture** that separates weekly approval workflows from daily task tracking.

## Architecture

```
┌─────────────────────────────────────────────────┐
│         TIMESHEET_PERIODS (Weekly)              │
│  - Approval workflow (pending/approved)         │
│  - Total hours (auto-calculated)                │
│  - Status tracking                              │
│  - Links to graph version                       │
└─────────────────────────────────────────────────┘
                      ▲
                      │ has many
                      │
┌─────────────────────────────────────────────────┐
│        TIMESHEET_ENTRIES (Daily Tasks)          │
│  - Start/end times                              │
│  - Work type (regular/overtime/travel/oncall)   │
│  - Task name and description                    │
│  - Location (office/remote/client_site)         │
│  - Billable flag                                │
└─────────────────────────────────────────────────┘
```

## Why Two Tables?

### Level 1: `timesheet_periods` (Weekly Summaries)
**Purpose:** Approval workflow and billing cycles

A **period** represents one week of work that needs approval:
- Used for approval workflows (submit → approve/reject)
- Links to the graph version (temporal versioning)
- Has aggregated `total_hours` from all daily entries
- Status: `pending`, `approved`, `rejected`, `changes_requested`

**Example:**
```
Period: Oct 6-12, 2025
Total Hours: 42.5
Status: Submitted
Graph Version: v2
```

### Level 2: `timesheet_entries` (Daily Task Details)
**Purpose:** Detailed work tracking and invoicing

An **entry** represents a specific task on a specific day:
- Multiple entries can exist per day
- Tracks what work was done, when, and where
- Different work types have different billing rates
- Can specify actual start/end times (e.g., 9:00 AM - 5:00 PM)

**Example:**
```
Monday Oct 6:
  Entry 1: API Development, 9:00-12:00, 3 hours, regular work, remote
  Entry 2: Client Meeting, 13:00-17:00, 4 hours, travel, client_site

Tuesday Oct 7:
  Entry 1: Code Review, 9:00-17:00, 8 hours, regular work, office
```

## Database Schema

### `timesheet_periods` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `contract_id` | UUID | Links to project_contracts |
| `week_start_date` | DATE | Monday of the week |
| `week_end_date` | DATE | Sunday of the week |
| `total_hours` | DECIMAL(5,2) | Auto-calculated from entries |
| `status` | TEXT | pending, approved, rejected, changes_requested |
| `submitted_at` | TIMESTAMPTZ | When submitted for approval |
| `approved_at` | TIMESTAMPTZ | When approved |
| `graph_version_id` | UUID | Links to graph_versions (temporal) |
| `created_at` | TIMESTAMPTZ | Record creation time |
| `updated_at` | TIMESTAMPTZ | Last update time |

### `timesheet_entries` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `period_id` | UUID | Links to timesheet_periods |
| `contract_id` | UUID | Links to project_contracts |
| `user_id` | UUID | User who performed the work |
| `date` | DATE | Specific day (e.g., 2025-10-06) |
| `start_time` | TIME | Optional: actual start time (09:00) |
| `end_time` | TIME | Optional: actual end time (17:00) |
| `hours` | DECIMAL(4,2) | Total hours for this entry |
| `work_type` | TEXT | regular, overtime, travel, oncall |
| `task_name` | TEXT | "API Development", "Client Meeting" |
| `task_description` | TEXT | Detailed description of work |
| `notes` | TEXT | Additional notes |
| `location` | TEXT | office, remote, client_site, travel |
| `billable` | BOOLEAN | Is this billable to the client? |
| `hourly_rate` | DECIMAL(10,2) | Override contract rate (optional) |
| `status` | TEXT | draft, submitted, approved, rejected |
| `created_at` | TIMESTAMPTZ | Record creation time |
| `updated_at` | TIMESTAMPTZ | Last update time |

## Work Types & Rate Multipliers

Different work types can have different billing rates:

| Work Type | Multiplier | Example |
|-----------|------------|---------|
| `regular` | 1.0x | $150/hr → $150/hr |
| `overtime` | 1.5x | $150/hr → $225/hr |
| `travel` | 1.0x - 1.25x | $150/hr → $150-187.50/hr |
| `oncall` | 1.5x - 2.0x | $150/hr → $225-300/hr |

## Auto-Calculation Trigger

When you add/update/delete a `timesheet_entry`, the parent period's `total_hours` is automatically updated:

```sql
-- Trigger function
CREATE OR REPLACE FUNCTION update_period_total_hours()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE timesheet_periods
  SET total_hours = (
    SELECT COALESCE(SUM(hours), 0)
    FROM timesheet_entries
    WHERE period_id = COALESCE(NEW.period_id, OLD.period_id)
  )
  WHERE id = COALESCE(NEW.period_id, OLD.period_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

**Example:**
```
Before:
  Period total_hours: 0

Add entries:
  Monday: 8 hours
  Tuesday: 8 hours
  Wednesday: 7.5 hours

After:
  Period total_hours: 23.5 (auto-calculated)
```

## Real-World Example

### Scenario: A contractor's week with varied work

**Period:**
- Week: Oct 6-12, 2025
- Status: Submitted
- Total Hours: 42.5 (calculated)

**Daily Entries:**

**Monday Oct 6:**
```json
{
  "date": "2025-10-06",
  "entries": [
    {
      "task_name": "API Development",
      "start_time": "09:00",
      "end_time": "17:00",
      "hours": 8.0,
      "work_type": "regular",
      "location": "remote",
      "billable": true
    }
  ]
}
```

**Tuesday Oct 7:**
```json
{
  "date": "2025-10-07",
  "entries": [
    {
      "task_name": "Frontend Components",
      "start_time": "09:00",
      "end_time": "17:00",
      "hours": 8.0,
      "work_type": "regular",
      "location": "office",
      "billable": true
    }
  ]
}
```

**Wednesday Oct 8:**
```json
{
  "date": "2025-10-08",
  "entries": [
    {
      "task_name": "Code Review",
      "start_time": "09:00",
      "end_time": "12:00",
      "hours": 3.0,
      "work_type": "regular",
      "location": "remote",
      "billable": true
    },
    {
      "task_name": "Client Meeting in SF",
      "start_time": "13:00",
      "end_time": "17:00",
      "hours": 4.0,
      "work_type": "travel",
      "location": "client_site",
      "billable": true,
      "notes": "In-person strategy session"
    }
  ]
}
```

**Thursday Oct 9:**
```json
{
  "date": "2025-10-09",
  "entries": [
    {
      "task_name": "Database Migration",
      "start_time": "09:00",
      "end_time": "18:00",
      "hours": 8.5,
      "work_type": "regular",
      "location": "office",
      "billable": true
    },
    {
      "task_name": "Production Hotfix",
      "start_time": "20:00",
      "end_time": "21:00",
      "hours": 1.0,
      "work_type": "overtime",
      "location": "remote",
      "billable": true,
      "notes": "Emergency fix for payment processing"
    }
  ]
}
```

**Friday Oct 10:**
```json
{
  "date": "2025-10-10",
  "entries": [
    {
      "task_name": "Testing & QA",
      "start_time": "09:00",
      "end_time": "17:00",
      "hours": 8.0,
      "work_type": "regular",
      "location": "remote",
      "billable": true
    }
  ]
}
```

**Saturday Oct 11:**
```json
{
  "date": "2025-10-11",
  "entries": [
    {
      "task_name": "Weekend Support",
      "hours": 2.0,
      "work_type": "oncall",
      "location": "remote",
      "billable": true,
      "notes": "Monitoring and incident response"
    }
  ]
}
```

**Total: 42.5 hours**
- Regular: 35.5 hours @ $150/hr = $5,325
- Travel: 4.0 hours @ $187.50/hr = $750
- Overtime: 1.0 hour @ $225/hr = $225
- Oncall: 2.0 hours @ $225/hr = $450
- **Grand Total: $6,750**

## Benefits of Two-Level Architecture

### ✅ Separation of Concerns
- **Periods** = Business workflow (approval, billing cycles)
- **Entries** = Work tracking (what was done, when, where)

### ✅ Flexible Detail Level
- Some users just track daily hours (one entry per day)
- Others track multiple tasks per day with precise times
- Both use the same schema

### ✅ Audit Trail
- Complete history of what work was performed
- Can reconstruct exact timeline of work
- Required for compliance and legal requirements

### ✅ Invoice Generation
- Weekly period = One line item on invoice
- Daily entries = Detailed breakdown for client review
- Different billing rates properly calculated

### ✅ Performance
- Approval queries only touch `timesheet_periods` table (fast)
- Detailed reports query `timesheet_entries` (more data, slower, but only when needed)

## UI Flow

### 1. Contractor View (Timesheet Entry)
```
Week of Oct 6-12, 2025
┌─────────────────────────────────────────┐
│ Monday Oct 6                            │
│ ┌─────────────────────────────────────┐ │
│ │ Task: API Development               │ │
│ │ Time: 9:00 AM - 5:00 PM (8h)        │ │
│ │ Type: Regular Work                  │ │
│ │ Location: Remote                    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Tuesday Oct 7                           │
│ ┌─────────────────────────────────────┐ │
│ │ Task: Frontend Components           │ │
│ │ Time: 9:00 AM - 5:00 PM (8h)        │ │
│ │ Type: Regular Work                  │ │
│ │ Location: Office                    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Total: 16 hours                         │
│ [Submit for Approval]                   │
└─────────────────────────────────────────┘
```

### 2. Approver View (Period Summary)
```
Pending Timesheets
┌─────────────────────────────────────────┐
│ Sarah Johnson - Week of Oct 6-12        │
│ Total: 42.5 hours                       │
│ Status: Submitted                       │
│ [View Details] [Approve] [Reject]       │
└─────────────────────────────────────────┘
```

### 3. Detail View (Daily Breakdown)
```
Sarah Johnson - Oct 6-12, 2025
┌─────────────────────────────────────────┐
│ Monday Oct 6: 8h                        │
│   • API Development (8h, regular)       │
│                                         │
│ Tuesday Oct 7: 8h                       │
│   • Frontend Components (8h, regular)   │
│                                         │
│ Wednesday Oct 8: 7h                     │
│   • Code Review (3h, regular)           │
│   • Client Meeting (4h, travel)         │
│                                         │
│ Thursday Oct 9: 9.5h                    │
│   • Database Migration (8.5h, regular)  │
│   • Production Hotfix (1h, overtime)    │
│                                         │
│ Friday Oct 10: 8h                       │
│   • Testing & QA (8h, regular)          │
│                                         │
│ Saturday Oct 11: 2h                     │
│   • Weekend Support (2h, oncall)        │
│                                         │
│ Total: 42.5 hours                       │
│ Breakdown:                              │
│   Regular: 35.5h @ $150/hr = $5,325     │
│   Travel: 4h @ $187.50/hr = $750        │
│   Overtime: 1h @ $225/hr = $225         │
│   Oncall: 2h @ $225/hr = $450           │
│ Grand Total: $6,750                     │
└─────────────────────────────────────────┘
```

## Migration Path

If you already have `timesheet_periods` without detailed entries:

1. **Keep existing periods** - They work fine as summaries
2. **Add `timesheet_entries` table** - New detailed tracking
3. **Gradually populate entries** - Users can add details over time
4. **Backward compatible** - Old periods without entries still work

## API Examples

### Create a period with entries
```typescript
// 1. Create the period
const period = await createPeriod({
  contract_id: 'abc-123',
  week_start_date: '2025-10-06',
  week_end_date: '2025-10-12',
  status: 'draft'
});

// 2. Add daily entries
await createEntry({
  period_id: period.id,
  date: '2025-10-06',
  hours: 8.0,
  work_type: 'regular',
  task_name: 'API Development',
  location: 'remote'
});

// 3. Period total_hours automatically updates to 8.0
```

### Query a period with all entries
```typescript
const period = await supabase
  .from('timesheet_periods')
  .select(`
    *,
    entries:timesheet_entries(*)
  `)
  .eq('id', periodId)
  .single();

console.log(period.total_hours); // 42.5
console.log(period.entries.length); // 8 entries across the week
```

## Next Steps

1. **Implement entry creation UI** - Daily task entry form
2. **Add work type selector** - Regular/Overtime/Travel/Oncall
3. **Location tracking** - Office/Remote/Client Site
4. **Time pickers** - Actual start/end times (optional)
5. **Auto-save drafts** - Save as user types
6. **Weekly summary view** - Show breakdown by work type
7. **Invoice generation** - PDF with daily details
