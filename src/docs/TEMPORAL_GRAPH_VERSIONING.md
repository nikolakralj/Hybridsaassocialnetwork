# Temporal Graph Versioning System

## Overview

WorkGraph implements **temporal versioning** to track changes to the project graph structure over time. This ensures that historical timesheet data always references the correct organizational structure and approval flows that were active at that time.

## Problem Statement

In real-world projects, the graph structure changes frequently:
- ❌ A company leaves the project mid-month
- ❌ An employee changes companies/agencies
- ❌ Approval chains are restructured  
- ❌ New contractors are added, old ones removed
- ❌ Organizational relationships change

Without temporal versioning, you lose historical context about **who reported to whom** and **what the approval flow was** when a specific timesheet was submitted.

## Solution: Versioned Graphs

Every time the graph is modified, we create a **new version** and link all new timesheet periods to that version. Old periods continue to reference their original graph version.

### Database Schema

```sql
-- Graph versions table
CREATE TABLE graph_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  effective_from_date DATE NOT NULL,
  effective_to_date DATE, -- NULL = currently active
  graph_data JSONB NOT NULL, -- Complete graph snapshot (nodes + edges)
  change_summary TEXT, -- Human-readable description of changes
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Timesheet periods reference the graph version
CREATE TABLE timesheet_periods (
  id UUID PRIMARY KEY,
  contract_id UUID NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_hours DECIMAL,
  status TEXT,
  graph_version_id UUID REFERENCES graph_versions(id), -- ✅ KEY FIELD
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ
);
```

### Graph Data Structure

The `graph_data` JSONB field stores a complete snapshot of the graph:

```json
{
  "nodes": [
    {
      "id": "client-1",
      "type": "client",
      "label": "Enterprise ClientCorp",
      "organizationId": "uuid-123",
      "position": { "x": 400, "y": 50 }
    },
    {
      "id": "company-acme",
      "type": "company",
      "label": "Acme Dev Studio",
      "organizationId": "uuid-456",
      "position": { "x": 200, "y": 200 }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "client-1",
      "target": "company-acme"
    }
  ],
  "metadata": {
    "description": "Initial project structure",
    "contractCount": 10,
    "organizationCount": 4
  }
}
```

## How It Works

### 1. Initial Setup
When a project is created, version 1 of the graph is created:
```json
{
  "version_number": 1,
  "effective_from_date": "2025-10-01",
  "effective_to_date": null,  // Currently active
  "graph_data": { /* nodes and edges */ }
}
```

### 2. Creating Timesheet Periods
All new timesheet periods reference the **active graph version**:
```sql
INSERT INTO timesheet_periods (
  contract_id,
  week_start_date,
  week_end_date,
  graph_version_id  -- Links to active version
) VALUES (
  'contract-123',
  '2025-10-01',
  '2025-10-07',
  'version-1-uuid'
);
```

### 3. Editing the Graph
When the graph is modified (e.g., company leaves project):

**Step 1:** Close the current version
```sql
UPDATE graph_versions
SET effective_to_date = '2025-10-15'
WHERE id = 'version-1-uuid';
```

**Step 2:** Create new version
```sql
INSERT INTO graph_versions (
  project_id,
  version_number,
  effective_from_date,
  effective_to_date,
  graph_data,
  change_summary
) VALUES (
  'project-123',
  2,
  '2025-10-15',
  NULL,  -- New active version
  '{ /* updated graph */ }',
  'Removed Acme Dev Studio from project'
);
```

**Step 3:** All new periods use version 2
```sql
-- This period uses version 2 (Acme is gone)
INSERT INTO timesheet_periods (
  contract_id,
  week_start_date,
  week_end_date,
  graph_version_id  -- Now points to version 2
) VALUES (
  'contract-456',
  '2025-10-15',
  '2025-10-21',
  'version-2-uuid'
);
```

### 4. Viewing Historical Data
When viewing a timesheet period from October 1st, we load version 1 of the graph:

```typescript
// Fetch the period
const period = await fetchPeriodById(periodId);

// Fetch the graph that was active at that time
const graphVersion = await fetchGraphVersionById(period.graph_version_id);

// Render the graph as it looked then
renderGraph(graphVersion.graph_data);
```

## API Endpoints

### Get Active Version
```
GET /graph-versions/active?projectId={uuid}
Returns the currently active graph version (effective_to_date = null)
```

### Get Version by ID
```
GET /graph-versions/{versionId}
Returns a specific graph version (for historical views)
```

### Get Version History
```
GET /graph-versions?projectId={uuid}
Returns all versions for a project, ordered by version_number DESC
```

### Create New Version
```
POST /graph-versions
Body: {
  projectId: "uuid",
  graphData: { nodes: [...], edges: [...] },
  changeSummary: "Removed company X",
  createdBy: "user-id"
}
```

This automatically:
1. Closes the current active version
2. Increments the version number
3. Creates the new version as active

## Use Cases

### Scenario 1: Company Leaves Mid-Month
**Oct 1-15:** Acme Dev Studio is part of the project (Version 1)
**Oct 16-31:** Acme leaves, new structure (Version 2)

**Timesheets:**
- Week of Oct 1-7: References Version 1 (shows Acme)
- Week of Oct 8-14: References Version 1 (shows Acme)
- Week of Oct 15-21: References Version 2 (Acme removed)
- Week of Oct 22-28: References Version 2 (Acme removed)

### Scenario 2: Contractor Changes Companies
**Before:** Sarah works for Acme Dev Studio (Version 1)
**After:** Sarah moves to BrightWorks Design (Version 2)

Her historical timesheets still show her under Acme (using Version 1), but new timesheets show her under BrightWorks (using Version 2).

### Scenario 3: Approval Flow Changes
**Version 1:** Client → Company → Manager → Worker
**Version 2:** Client → Manager → Worker (company removed from flow)

Old approvals follow the old flow, new approvals follow the new flow.

## Benefits

✅ **Historical Accuracy:** Always know what the structure looked like at any point in time
✅ **Audit Trail:** Complete version history with change summaries
✅ **Data Integrity:** Old data never becomes invalid when structure changes
✅ **Compliance:** Required for financial audits and legal requirements
✅ **Debugging:** Can see exactly what the graph looked like when issues occurred

## Frontend Implementation

### WorkGraphBuilder
When saving changes to the graph:
```typescript
const saveGraph = async (graphData: GraphData) => {
  const response = await fetch(`${API_URL}/graph-versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: currentProjectId,
      graphData,
      changeSummary: 'User description of changes',
      createdBy: currentUserId,
    }),
  });
  
  const { graphVersion } = await response.json();
  console.log(`Created version ${graphVersion.version_number}`);
};
```

### Viewing Historical Timesheets
```typescript
const loadPeriodWithGraph = async (periodId: string) => {
  // 1. Fetch the period
  const period = await fetchPeriodById(periodId);
  
  // 2. Fetch the graph version that was active
  const graphVersion = await fetch(
    `${API_URL}/graph-versions/${period.graph_version_id}`
  ).then(r => r.json());
  
  // 3. Render with historical graph
  return {
    period,
    graph: graphVersion.graph_data,
    versionInfo: {
      number: graphVersion.version_number,
      effectiveFrom: graphVersion.effective_from_date,
      effectiveTo: graphVersion.effective_to_date,
      changeSummary: graphVersion.change_summary,
    }
  };
};
```

### Version History Panel
```typescript
const VersionHistory = ({ projectId }: { projectId: string }) => {
  const { data: versions } = useQuery({
    queryKey: ['graph-versions', projectId],
    queryFn: () => fetch(`${API_URL}/graph-versions?projectId=${projectId}`)
      .then(r => r.json())
      .then(d => d.graphVersions),
  });
  
  return (
    <div>
      <h3>Graph Version History</h3>
      {versions?.map(v => (
        <div key={v.id}>
          <div>Version {v.version_number}</div>
          <div>{v.effective_from_date} - {v.effective_to_date || 'Current'}</div>
          <div>{v.change_summary}</div>
        </div>
      ))}
    </div>
  );
};
```

## Migration Strategy

For existing projects without versioning:
1. Create a "Version 1" snapshot of the current graph
2. Set `effective_from_date` to project start date
3. Set `effective_to_date` to `null` (currently active)
4. Update all existing timesheet periods to reference this version

## Best Practices

1. **Descriptive Change Summaries:** Always provide clear descriptions of what changed
2. **Version Before Editing:** Never edit the active version in-place
3. **Atomic Operations:** Version creation should be transactional
4. **Backup Old Versions:** Never delete historical versions
5. **Display Version Info:** Show users which version they're viewing
6. **Date Alignment:** Version effective dates should align with billing periods

## Future Enhancements

- **Diff Viewer:** Visual comparison between versions
- **Rollback:** Restore a previous version as the active version
- **Branch & Merge:** Test structural changes before applying
- **Change Approval:** Require approval before creating new versions
- **Automated Versioning:** Auto-create versions on schedule changes
