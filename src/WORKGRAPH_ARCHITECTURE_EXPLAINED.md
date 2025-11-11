# 🏗️ WorkGraph Database Architecture

## How WorkGraph Data is Stored

### Two-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: VISUAL GRAPH STATE (graph_versions table)         │
│ - Stores nodes, edges, positions                            │
│ - JSON format with x/y coordinates                          │
│ - Temporal versioning (history of graph changes)            │
└─────────────────────────────────────────────────────────────┘
                          ↓ references ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: BUSINESS DATA (organizations, contracts, etc.)     │
│ - Organizations (companies, agencies, freelancers)          │
│ - Project Contracts (rates, terms)                          │
│ - Timesheet Periods (weekly submissions)                    │
│ - Timesheet Entries (daily hours/tasks)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## The graph_versions Table

**Purpose:** Stores the visual WorkGraph state (nodes, edges, positions)

```sql
CREATE TABLE graph_versions (
  id TEXT PRIMARY KEY,
  version INTEGER,           -- Version number (1, 2, 3...)
  project_id TEXT,           -- Which project this graph is for
  graph_data JSONB,          -- The actual graph: {nodes: [], edges: []}
  created_by TEXT,           -- Who created this version
  created_at TIMESTAMPTZ,    -- When
  is_current BOOLEAN         -- Is this the active version?
);
```

### What's in graph_data?

```json
{
  "nodes": [
    {
      "id": "user-sarah",
      "type": "person",
      "position": {"x": 100, "y": 200},
      "data": {
        "name": "Sarah Johnson",
        "userId": "user-sarah",        // Links to project_contracts.user_id
        "role": "company_employee",
        "company": "Acme Dev Studio"
      }
    },
    {
      "id": "org-acme",
      "type": "party",
      "position": {"x": 400, "y": 200},
      "data": {
        "name": "Acme Dev Studio",
        "organizationId": "org-acme",  // Links to organizations.id
        "type": "company"
      }
    }
  ],
  "edges": [
    {
      "id": "employs-sarah",
      "source": "org-acme",
      "target": "user-sarah",
      "type": "employs",
      "data": {"edgeType": "employs"}
    }
  ]
}
```

---

## How Data Flows

### When you view the WorkGraph:

1. **Load graph state** from `graph_versions` (WHERE is_current = true)
2. **Parse nodes/edges** from the JSONB graph_data
3. **Fetch live stats** by joining:
   - `node.data.userId` → `project_contracts.user_id`
   - `project_contracts.id` → `timesheet_periods.contract_id`
   - Filter by selected month

### When you edit the WorkGraph:

1. **Update graph_data** JSONB with new positions/nodes/edges
2. **Create new version** (optional - for history)
3. **Mark as current** (is_current = true)

### When you submit timesheets:

1. **Data goes to** `timesheet_periods` and `timesheet_entries`
2. **Stats automatically update** (triggers recalculate totals)
3. **WorkGraph reflects changes** when you click on nodes

---

## Month-by-Month Data

**Q: How do we store data for each month?**

**A: Through date filtering, not separate tables!**

```sql
-- Get October 2024 data
SELECT * FROM timesheet_periods
WHERE week_start_date >= '2024-10-01' 
  AND week_start_date < '2024-11-01';

-- Get November 2024 data
SELECT * FROM timesheet_periods
WHERE week_start_date >= '2024-11-01' 
  AND week_start_date < '2024-12-01';
```

**The WorkGraph state stays the same**, but the **stats change** based on which month you're viewing:

```typescript
// In useNodeStats hook
const { selectedMonth } = useMonthContext();

// Fetch stats filtered by month
const stats = await fetchPersonStats(node, selectedMonth);
// This queries timesheet_periods WHERE month = selectedMonth
```

---

## Key Points

### ✅ DO:
- Store **visual graph** in `graph_versions.graph_data` (JSONB)
- Store **business data** in normalized tables
- Use **date filtering** to show month-specific stats
- Link nodes to data via IDs (`userId`, `organizationId`, `contractId`)

### ❌ DON'T:
- Create separate graph tables for each month
- Duplicate contract/organization data
- Store stats in the graph (calculate on-demand)

---

## Example Query

**"Show me Sarah Johnson's hours for October 2024"**

```sql
SELECT 
  pc.user_name,
  tp.week_start_date,
  tp.total_hours,
  tp.status
FROM timesheet_periods tp
JOIN project_contracts pc ON tp.contract_id = pc.id
WHERE pc.user_id = 'user-sarah'
  AND tp.week_start_date >= '2024-10-01'
  AND tp.week_start_date < '2024-11-01';
```

**Result:**
```
user_name      | week_start_date | total_hours | status
---------------|-----------------|-------------|--------
Sarah Johnson  | 2024-10-07      | 40.0        | pending
```

This data powers the **stats badge** on Sarah's node in the WorkGraph!

---

## Next Steps

1. ✅ Run `/COMPLETE_SETUP_WITH_GRAPH.sql`
2. ✅ Verify data appears
3. ✅ Refresh app
4. ✅ Click on person nodes to see stats
5. ✅ Change month selector to see stats update

The graph structure stays the same, but the numbers change based on the selected month! 📊
