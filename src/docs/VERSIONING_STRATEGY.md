# 📋 WorkGraph Versioning Strategy

**Last Updated:** November 12, 2025  
**Status:** Documented, not yet implemented

---

## 🎯 Overview

WorkGraph requires **TWO DISTINCT types of versioning** to maintain historical accuracy and compliance:

1. **Policy Versioning** - Tracks changes to approval RULES/LOGIC
2. **Graph Structure Versioning** - Tracks changes to project ORGANIZATION/PARTICIPANTS

Both are CRITICAL for enterprise deployments and financial auditing.

---

## 🔄 Type 1: Policy Versioning

### **What It Tracks:**
Changes to the **approval flow logic/rules** for a project:
- Approval thresholds (e.g., $5000 → $7500)
- Required approvers at each step
- Approval routing logic
- Rate visibility rules
- Overtime approval policies
- Budget constraints

### **Why It's Needed:**
```
❌ Problem: Change approval rules → old in-flight timesheets break
✅ Solution: In-flight timesheets stay on old rules (vN), new use vN+1
```

### **Example Scenario:**
```
Oct 1-15:  Policy v1 - Manager approves all overtime
Oct 16-31: Policy v2 - VP must approve overtime over 40h

Timesheet submitted Oct 10 (45h overtime):
  → Uses Policy v1 → Manager approves → Done ✅

Timesheet submitted Oct 20 (45h overtime):
  → Uses Policy v2 → VP approval required → Routed correctly ✅
```

### **Database Schema:**
```sql
-- Stores immutable policy versions
CREATE TABLE approval_policies (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  compiled_json JSONB NOT NULL,        -- Executable policy rules
  is_active BOOLEAN DEFAULT false,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(project_id, version_number)
);

-- Timesheets reference which policy version was active
CREATE TABLE timesheet_periods (
  id UUID PRIMARY KEY,
  contract_id UUID NOT NULL,
  week_start_date DATE NOT NULL,
  status TEXT,
  policy_version_id UUID REFERENCES approval_policies(id),  -- ✅ KEY FIELD
  submitted_at TIMESTAMPTZ
);
```

### **UI Features:**
- "Pinned to v3" badge on each timesheet
- One-click rebind wizard to migrate to new policy
- Policy diff viewer (v3 vs v4 changes)
- Rollback capability (reactivate old version)

### **Roadmap Location:**
- **Phase 5 Day 1-2:** Initial implementation
- **Phase 8:** Production hardening + security

---

## 🏢 Type 2: Graph Structure Versioning

### **What It Tracks:**
Changes to the **organizational structure** of a project:
- Companies joining/leaving the project
- Contractors changing companies/agencies
- New parties added, old parties removed
- Organizational hierarchy changes
- Contract assignments

### **Why It's Needed:**
```
❌ Problem: Company leaves mid-month → historical timesheets show wrong org chart
✅ Solution: Historical timesheets show org structure that existed at that time
```

### **Example Scenario:**
```
Oct 1-15:  Acme Dev Studio is part of project (Graph v1)
Oct 16:    Acme leaves project (Graph v2 created)

View timesheet from Oct 10:
  → Load Graph v1
  → Show Acme as part of org chart
  → Show Sarah as "Acme employee"
  → Approval path includes Acme manager ✅

View timesheet from Oct 20:
  → Load Graph v2
  → Acme not shown
  → Sarah now under BrightWorks
  → Approval path changed ✅
```

### **Database Schema:**
```sql
-- Stores complete graph snapshots
CREATE TABLE graph_versions (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  effective_from_date DATE NOT NULL,
  effective_to_date DATE,              -- NULL = currently active
  graph_data JSONB NOT NULL,           -- Complete nodes + edges snapshot
  change_summary TEXT,                 -- "Removed Acme Dev Studio"
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(project_id, version_number)
);

-- Timesheets reference which graph structure was active
CREATE TABLE timesheet_periods (
  id UUID PRIMARY KEY,
  contract_id UUID NOT NULL,
  week_start_date DATE NOT NULL,
  graph_version_id UUID REFERENCES graph_versions(id),  -- ✅ KEY FIELD
  policy_version_id UUID REFERENCES approval_policies(id),
  status TEXT
);
```

### **Graph Data Structure:**
The `graph_data` JSONB stores a complete snapshot:
```json
{
  "nodes": [
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
      "target": "company-acme",
      "type": "billsTo"
    }
  ],
  "metadata": {
    "contractCount": 10,
    "organizationCount": 4
  }
}
```

### **UI Features:**
- "Graph v2 (Oct 16+)" indicator
- Version history panel showing all structural changes
- Visual diff viewer (show added/removed nodes)
- "View as it was on Oct 10" time-travel feature

### **Roadmap Location:**
- **Phase 8:** Graph structure versioning (CRITICAL - MISSING!)
- **Documentation:** `/docs/TEMPORAL_GRAPH_VERSIONING.md`

---

## 🔗 How They Work Together

Both versioning systems work **independently** but are **referenced together**:

```sql
-- Each timesheet period references BOTH versions
SELECT 
  tp.id,
  tp.week_start_date,
  tp.status,
  ap.version_number as policy_version,
  gv.version_number as graph_version
FROM timesheet_periods tp
JOIN approval_policies ap ON tp.policy_version_id = ap.id
JOIN graph_versions gv ON tp.graph_version_id = gv.id
WHERE tp.week_start_date = '2025-10-15';

-- Result:
-- id: uuid-123
-- week_start_date: 2025-10-15
-- status: pending_approval
-- policy_version: 2 (new overtime rules)
-- graph_version: 1 (Acme still in project)
```

### **Example: Both Change in Same Week**

```
Oct 1-15:  Graph v1 + Policy v1
Oct 16:    Graph v2 (Acme leaves) + Policy v2 (new overtime rules)

Timesheet from Oct 10 (submitted Oct 12):
  → Graph v1 → Shows Acme in org chart
  → Policy v1 → Old overtime rules apply
  
Timesheet from Oct 16 (submitted Oct 18):
  → Graph v2 → Acme not shown
  → Policy v2 → New overtime rules apply
```

---

## 📊 Comparison Matrix

| Aspect | Policy Versioning | Graph Structure Versioning |
|--------|-------------------|----------------------------|
| **What changes?** | Approval rules/logic | Companies/people/org structure |
| **Why version?** | In-flight approvals can't change mid-process | Historical accuracy (audit trail) |
| **What's stored?** | Compiled approval flow JSON | Complete node/edge graph snapshot |
| **Trigger?** | Edit approval rules in builder | Add/remove parties from project |
| **UI indicator?** | "Pinned to v3" badge | "Graph v2 (Oct 16+)" indicator |
| **Frequency?** | Low (quarterly?) | Medium (monthly or per project change) |
| **Database table?** | `approval_policies` | `graph_versions` |
| **Foreign key?** | `policy_version_id` | `graph_version_id` |
| **Compliance need?** | SOX, financial audits | SOX, employment law, contracts |
| **Roadmap phase?** | Phase 5 + Phase 8 | **Phase 8 (MISSING!)** |

---

## 🎯 Critical Use Cases

### **Use Case 1: Company Leaves Mid-Month**
**Without Graph Versioning:**
```
Oct 1-15:  View timesheet → ERROR: Acme not found
Oct 16+:   View timesheet → Shows wrong org structure
```

**With Graph Versioning:**
```
Oct 1-15:  View timesheet → Load Graph v1 → Acme shown ✅
Oct 16+:   View timesheet → Load Graph v2 → Acme not shown ✅
```

### **Use Case 2: Policy Rules Change**
**Without Policy Versioning:**
```
In-flight timesheet: Old rules → NEW rules applied → BREAKS ❌
```

**With Policy Versioning:**
```
In-flight timesheet: Old rules (v1) → Continues on v1 → Works ✅
New timesheet: New rules (v2) → Uses v2 from submission ✅
```

### **Use Case 3: Financial Audit**
**Question:** "Show me who was in the approval chain for this $50k timesheet from August"

**Without Versioning:**
```
Current org chart → Wrong people shown → Audit fail ❌
```

**With Both Versioning Types:**
```
Load Graph v3 (active in August) → Correct org structure
Load Policy v2 (active in August) → Correct approval rules
Show exact approval path that was used → Audit pass ✅
```

---

## 🚀 Implementation Priority

### **CRITICAL for Enterprise Deployment:**

1. **Phase 5 (Current):**
   - ✅ Implement Policy Versioning
   - ✅ Add `policy_version_id` to timesheets
   - ✅ "Pinned to vN" badge
   - ✅ Version switching logic

2. **Phase 8 (MUST ADD):**
   - ⚠️ **Graph Structure Versioning** (MISSING FROM ROADMAP!)
   - Add `graph_version_id` to timesheets
   - Create `graph_versions` table
   - Auto-snapshot on graph edits
   - Time-travel UI ("View as of Oct 10")

### **Why Phase 8 for Graph Versioning:**
- Requires mature data model (Closure Table for 20+ orgs)
- Needs comprehensive audit trail
- Must coordinate with compliance features
- Critical for SOC 2 certification

---

## 📋 Implementation Checklist

### **Policy Versioning (Phase 5):**
- [ ] Create `approval_policies` table
- [ ] Add `policy_version_id` to `timesheet_periods`
- [ ] Auto-create v1 on project creation
- [ ] Auto-increment version on policy edit
- [ ] UI: "Pinned to vN" badge
- [ ] UI: Version history panel
- [ ] UI: One-click rebind wizard
- [ ] Test: In-flight timesheets stay on old version

### **Graph Structure Versioning (Phase 8):**
- [ ] Create `graph_versions` table
- [ ] Add `graph_version_id` to `timesheet_periods`
- [ ] Auto-create v1 on project creation
- [ ] Auto-snapshot on graph edit (add/remove node)
- [ ] Store complete graph JSON snapshot
- [ ] UI: "Graph vN (effective from DATE)" indicator
- [ ] UI: Version history with visual diff
- [ ] UI: Time-travel view ("As of Oct 10")
- [ ] Test: Historical timesheets show correct org structure

---

## 🔍 Technical Details

### **When to Create New Version:**

**Policy Version:**
- ✅ Edit approval thresholds
- ✅ Change required approvers
- ✅ Modify routing logic
- ✅ Update rate visibility rules
- ❌ Visual layout changes (position, colors)
- ❌ Node labels/descriptions

**Graph Version:**
- ✅ Add/remove company node
- ✅ Add/remove person node
- ✅ Change contract assignments
- ✅ Modify party relationships
- ❌ Visual layout changes (position, zoom)
- ❌ Node colors/styling

### **Automatic vs Manual Versioning:**

**Automatic (Recommended):**
```typescript
// On graph save
const saveGraph = async (graphData: GraphData) => {
  const hasStructuralChange = detectStructuralChange(graphData);
  
  if (hasStructuralChange) {
    // Auto-create new version
    await createGraphVersion({
      projectId,
      graphData,
      changeSummary: generateChangeSummary(graphData),
    });
  } else {
    // Just update visual layout
    await updateGraphLayout(graphData);
  }
};
```

**Manual (Alternative):**
```typescript
// User clicks "Publish New Version"
<Button onClick={publishNewVersion}>
  Publish New Version
</Button>
```

---

## 📚 Related Documentation

### **Policy Versioning:**
- Implementation: Phase 5 Day 1-2 (in progress)
- Security: Phase 8 hardening
- Roadmap: `/docs/roadmap/MASTER_ROADMAP.md` Phase 5

### **Graph Structure Versioning:**
- **Full Spec:** `/docs/TEMPORAL_GRAPH_VERSIONING.md` ⭐
- **Roadmap:** `/docs/roadmap/MASTER_ROADMAP.md` Phase 8 (JUST ADDED!)
- Database Schema: In `/docs/TEMPORAL_GRAPH_VERSIONING.md`
- Use Cases: Company leaves, contractor changes companies

### **Architecture:**
- Multi-Party: `/docs/architecture/MULTI_PARTY_ARCHITECTURE.md`
- System Design: `/docs/architecture/SYSTEM_ARCHITECTURE.md`

---

## ✅ Summary

**You asked:** "Do we have project graph history in case project structure changes (companies leaving)?"

**Answer:** 
✅ **YES** - Fully documented in `/docs/TEMPORAL_GRAPH_VERSIONING.md`  
⚠️ **BUT** - Was NOT in the roadmap (just added to Phase 8!)

**What I did:**
1. ✅ Found existing documentation for graph structure versioning
2. ✅ Added it to Phase 8 roadmap as CRITICAL priority
3. ✅ Created this strategy doc to explain BOTH versioning types
4. ✅ Clarified the difference between policy vs graph versioning

**Next Steps:**
- Continue with Policy Versioning (Phase 5)
- Implement Graph Structure Versioning in Phase 8
- Both are CRITICAL for enterprise/audit compliance

---

**Created:** November 12, 2025  
**Status:** ✅ Complete - Both versioning strategies documented and roadmapped  
**Priority:** CRITICAL for Phase 8 (Graph Structure) and Phase 5 (Policy)
