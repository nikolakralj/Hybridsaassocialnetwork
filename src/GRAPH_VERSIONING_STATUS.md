# 🔍 WorkGraph Temporal Versioning: Current Status & Gap Analysis

## Your Question

> "When I create a graph with nodes and edges, it should be stored in database for each month... because with time the graph can change... people or companies can leave the project. Is this already integrated in software?"

## ✅ What's Already Built (Backend)

### Database Schema
The `graph_versions` table exists with proper temporal versioning:

```sql
CREATE TABLE graph_versions (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  effective_from_date DATE NOT NULL,   -- When this version becomes active
  effective_to_date DATE,               -- When this version ends (null = current)
  graph_data JSONB NOT NULL,            -- {nodes: [], edges: []}
  change_summary TEXT,                  -- "Added Alex Chen, removed old contractor"
  created_by TEXT,
  created_at TIMESTAMPTZ
);
```

### API Endpoints (All Working)
Located in `/supabase/functions/server/index.tsx`:

✅ **GET `/graph-versions/active`** - Get current active version (WHERE effective_to_date IS NULL)  
✅ **GET `/graph-versions?projectId=X`** - Get all versions (history)  
✅ **GET `/graph-versions/:versionId`** - Get specific version  
✅ **POST `/graph-versions`** - Create new version  
  - Automatically closes previous version (sets effective_to_date)
  - Increments version_number
  - Sets new version as active (effective_to_date = NULL)

### Example Flow
```typescript
// User edits graph on Nov 15, 2024
POST /graph-versions
{
  "projectId": "proj-alpha",
  "graphData": { nodes: [...], edges: [...] },
  "changeSummary": "Removed Sarah Johnson (left project)",
  "createdBy": "user-mike"
}

// Result:
// Version 1: Oct 1 - Nov 15 (closed)
// Version 2: Nov 15 - null (ACTIVE)
```

---

## ❌ What's MISSING (Frontend Integration)

### 1. **No Save Button**
The WorkGraphBuilder (`/components/workgraph/WorkGraphBuilder.tsx`) does NOT call the save API when you edit the graph.

**Current behavior:**
- Changes stored in `localStorage` (draft autosave)
- Changes lost on page refresh
- No database persistence

**What we need:**
```tsx
const handleSaveGraph = async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/make-server-f8b491be/graph-versions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId: 'proj-alpha',
      graphData: { nodes, edges },
      changeSummary: 'User edit',
      createdBy: 'current-user-id'
    })
  });
  
  const { graphVersion } = await response.json();
  toast.success(`Saved as Version ${graphVersion.version_number}`);
};
```

### 2. **No Load from Database**
On page load, the WorkGraphBuilder loads from:
- `initialConfig` prop (if provided)
- `TEMPLATES[0]` (hardcoded default)
- `localStorage` draft

**It never fetches from the database!**

**What we need:**
```tsx
useEffect(() => {
  const loadActiveGraph = async () => {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/make-server-f8b491be/graph-versions/active?projectId=proj-alpha`,
      { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
    );
    
    const { graphVersion } = await response.json();
    if (graphVersion?.graph_data) {
      setNodes(graphVersion.graph_data.nodes);
      setEdges(graphVersion.graph_data.edges);
    }
  };
  
  loadActiveGraph();
}, []);
```

### 3. **No Version History UI**
The `VersionHistoryDrawer.tsx` exists but is NOT connected to real data.

**What we need:**
- Fetch all versions: `GET /graph-versions?projectId=proj-alpha`
- Display timeline with version numbers and dates
- Allow viewing/restoring old versions

### 4. **No Month-Specific Graph Versions**
The schema supports temporal versioning (effective_from_date, effective_to_date) but the frontend doesn't use it.

**When you change months (Oct → Nov), it should:**
1. Check which graph version was active during that month
2. Load that version
3. Calculate stats for that month

---

## 🏗️ Architecture: How It SHOULD Work

### Scenario: November 2024 - Sarah Leaves Project

```
┌─────────────────────────────────────────────────────────────────┐
│ October 2024                                                     │
│ Active Graph Version: v1 (Oct 1 - Nov 1)                        │
│                                                                  │
│  [Sarah] ──→ [Acme Dev] ──→ [Project Alpha]                    │
│  [Mike]  ──→ [Acme Dev] ──→ [Project Alpha]                    │
│                                                                  │
│ Stats (October):                                                 │
│  - Sarah: 40 hours                                              │
│  - Mike: 38 hours                                               │
└─────────────────────────────────────────────────────────────────┘

            ↓ User action: Remove Sarah's node ↓

┌─────────────────────────────────────────────────────────────────┐
│ November 2024                                                    │
│ Active Graph Version: v2 (Nov 1 - null)                         │
│                                                                  │
│  [Mike]  ──→ [Acme Dev] ──→ [Project Alpha]                    │
│                                                                  │
│ Stats (November):                                                │
│  - Mike: 35 hours                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Database State After Edit

```sql
-- graph_versions table
id  | version | effective_from | effective_to | graph_data
----|---------|----------------|--------------|------------------
v1  | 1       | 2024-10-01     | 2024-11-01   | {Sarah, Mike}
v2  | 2       | 2024-11-01     | NULL         | {Mike only}
```

### When User Views October:
```typescript
// 1. Fetch graph version active during October
const graphVersion = await fetchGraphVersionForDate('2024-10-15');
// Returns v1 (effective_from <= Oct 15 AND (effective_to > Oct 15 OR effective_to IS NULL))

// 2. Load that graph
setNodes(graphVersion.graph_data.nodes); // Sarah + Mike

// 3. Fetch stats for October
const stats = await fetchTimesheetStats('2024-10', graphVersion.id);
// Sarah: 40h, Mike: 38h
```

### When User Views November:
```typescript
// 1. Fetch graph version active during November
const graphVersion = await fetchGraphVersionForDate('2024-11-15');
// Returns v2

// 2. Load that graph
setNodes(graphVersion.graph_data.nodes); // Mike only

// 3. Fetch stats for November
const stats = await fetchTimesheetStats('2024-11', graphVersion.id);
// Mike: 35h
```

---

## 🚀 Implementation Plan

### Phase 1: Basic Save/Load (High Priority)
1. Add "Save Graph" button to WorkGraphBuilder toolbar
2. Call `POST /graph-versions` on save
3. Load active version on mount with `GET /graph-versions/active`
4. Show success toast with version number

**Time estimate:** 2-3 hours

### Phase 2: Month-Aware Graph Loading (Critical)
1. When month selector changes, fetch the graph version active during that month
2. Create new endpoint: `GET /graph-versions/for-date?projectId=X&date=2024-10-15`
3. Update WorkGraphBuilder to accept `currentMonth` prop
4. Reload graph when month changes

**Time estimate:** 3-4 hours

### Phase 3: Version History UI (Nice to Have)
1. Connect VersionHistoryDrawer to real API
2. Display timeline with version numbers, dates, change summaries
3. Add "View" button to load old versions (read-only)
4. Add "Restore" button to make old version active

**Time estimate:** 4-5 hours

### Phase 4: Automatic Versioning (Future Enhancement)
1. Detect when graph changes (add/remove nodes/edges)
2. Auto-save after 30 seconds of inactivity
3. Prompt user for change summary
4. Track who made each change

**Time estimate:** 6-8 hours

---

## ⚠️ Current Workarounds

Until we implement full versioning:

### Option A: Manual Monthly Graphs (Hacky)
- Create separate projects: "Project Alpha - Oct 2024", "Project Alpha - Nov 2024"
- Each project has its own graph

**Problems:**
- Duplicates contracts, organizations
- Hard to track changes over time
- No unified view

### Option B: Keep All Nodes, Hide Inactive Ones (Better)
- Never delete nodes from the graph
- Add `isActive` property to node data
- Filter out inactive nodes when viewing

**Problems:**
- Graph gets cluttered over time
- Still need to track when people left/joined

### Option C: Wait for Proper Implementation (Best)
- Use the backend API that already exists
- Build the frontend integration

---

## ✅ Recommendation

**Build Phase 1 + Phase 2 NOW** because:

1. ✅ Backend already built (90% done)
2. ✅ Your use case is valid (people DO leave projects)
3. ✅ 6-8 hours of work for production-ready solution
4. ✅ Critical for multi-month projects

**Skip Phase 3 + Phase 4** for MVP, add later based on user feedback.

---

## 📝 Summary

**Your instinct is 100% correct!** The graph MUST be versioned by month.

**Backend:** ✅ DONE  
**Frontend:** ❌ NOT INTEGRATED

**Next step:** Implement save/load + month-aware loading (Phases 1-2).

Want me to build this now?
