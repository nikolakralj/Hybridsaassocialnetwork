# 🔐 Local Scope Visibility Architecture

**Date:** November 14, 2024  
**Status:** ✅ Approved - Replacing complex projection model  
**Priority:** CRITICAL - Foundation for multi-tenant project graphs

---

## 🎯 Core Principle

**"Each company sees ONLY their direct contracts (1st-degree neighbors)"**

No complex masking. No projection. No viewer scopes.  
Just simple: **"Show me my contracts + counterparties."**

---

## 🧠 Mental Model

Think **LinkedIn connections**, not **Facebook graph search**:
- ✅ **1st degree**: Your direct contracts (visible)
- ⚠️ **2nd degree**: "Someone via Agency" (context only)
- ❌ **3rd degree**: Invisible (not your business)

### Example: 3-Tier Supply Chain

```
Client View (Acme Inc):
┌─────────────────────┐
│  Acme Inc (Client)  │ ← Me
└─────────────────────┘
          │
          ↓ I can see this contract
┌─────────────────────┐
│  TechCorp Agency    │ ← My vendor
└─────────────────────┘
          │
          ↓ Hidden (not my contract)
       (???)

Agency View (TechCorp):
┌─────────────────────┐
│  Acme Inc (Client)  │ ← My customer
└─────────────────────┘
          │
          ↓ I can see both contracts
┌─────────────────────┐
│  TechCorp Agency    │ ← Me
└─────────────────────┘
          │
          ↓ I can see this contract
┌─────────────────────┐
│  DevShop Sub        │ ← My vendor
└─────────────────────┘

Sub View (DevShop):
┌─────────────────────┐
│  TechCorp Agency    │ ← My customer
└─────────────────────┘
          │
          ↓ I can see this contract
┌─────────────────────┐
│  DevShop Sub        │ ← Me
└─────────────────────┘
```

---

## 🔧 What Each Org Sees

### **Client (Acme Inc)**

**Visible:**
- ✅ Project basics (name, dates, currency)
- ✅ Their contract with Agency
- ✅ Agency org (counterparty)
- ✅ Their own approvers (Bob, Carol)
- ✅ Workers assigned to them (in approval context: "Alice via Agency")

**Hidden:**
- ❌ Sub org (DevShop)
- ❌ Agency→Sub contract
- ❌ Sub's rates
- ❌ Sub's internal structure

---

### **Agency (TechCorp)**

**Visible:**
- ✅ Project basics
- ✅ Client contract (Agency→Client at $150/hr)
- ✅ Sub contract (Agency→Sub at $85/hr)
- ✅ Client org
- ✅ Sub org
- ✅ All workers (theirs + sub's) assigned to project
- ✅ Both approval chains
- ✅ Margin calculations ($150 - $85 = $65/hr profit)

**Hidden:**
- ❌ Client's other vendors (if any)
- ❌ Sub's other customers (if any)

---

### **Sub (DevShop)**

**Visible:**
- ✅ Project basics (limited: name, dates)
- ✅ Their contract with Agency
- ✅ Agency org (counterparty)
- ✅ Their workers assigned to project
- ✅ Their portion of approval chain

**Hidden:**
- ❌ Client org (Acme) - "upstream customer" is opaque
- ❌ Agency→Client contract
- ❌ Client's rate ($150/hr)
- ❌ Other subs Agency might have

---

## 🗄️ Database Schema

### **Core Tables**

```sql
-- Projects (multi-tenant shells)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  project_code TEXT,
  currency VARCHAR(3) DEFAULT 'USD',
  start_date DATE,
  end_date DATE,
  
  -- Who created the shell (not "owner" - multi-tenant!)
  created_by_org_id UUID REFERENCES organizations(id),
  created_by_user_id UUID REFERENCES users(id),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active' -- active, archived, cancelled
);

-- Organizations (already exists, enhance)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type VARCHAR(50), -- client, agency, vendor, freelancer
  logo TEXT,
  email_domain TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Contracts (the KEY table for visibility)
CREATE TABLE project_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  
  -- The two parties (directed edge)
  from_org_id UUID NOT NULL REFERENCES organizations(id), -- Vendor/Worker
  to_org_id UUID NOT NULL REFERENCES organizations(id),   -- Client/Customer
  
  -- Contract details
  contract_type VARCHAR(50), -- tm, fixed, milestone, capped_tm
  rate DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, active, terminated
  
  -- Invitation tracking
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES users(id),
  
  -- OPTIONAL: Disclosure to 3rd party (advanced feature)
  disclosed_to_org_id UUID REFERENCES organizations(id), -- NULL by default
  disclosure_requested_at TIMESTAMPTZ,
  disclosure_requested_by UUID REFERENCES users(id),
  disclosure_approved_at TIMESTAMPTZ,
  disclosure_approved_by UUID REFERENCES users(id),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT different_orgs CHECK (from_org_id != to_org_id),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'terminated'))
);

-- Indexes for fast viewer queries
CREATE INDEX idx_contracts_project ON project_contracts(project_id);
CREATE INDEX idx_contracts_from_org ON project_contracts(from_org_id);
CREATE INDEX idx_contracts_to_org ON project_contracts(to_org_id);
CREATE INDEX idx_contracts_disclosed ON project_contracts(disclosed_to_org_id) WHERE disclosed_to_org_id IS NOT NULL;
CREATE INDEX idx_contracts_status ON project_contracts(status);

-- Project Participants (lightweight membership)
CREATE TABLE project_participants (
  project_id UUID NOT NULL REFERENCES projects(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  role VARCHAR(50), -- creator, vendor, client, subcontractor
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (project_id, org_id)
);

-- Role Assignments (who works on what)
CREATE TABLE project_role_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role VARCHAR(50), -- contractor, approver, manager, observer
  
  -- Optional: Linked to specific contract
  contract_id UUID REFERENCES project_contracts(id),
  
  -- Validity period
  valid_from DATE,
  valid_to DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(project_id, user_id, role)
);
```

---

## 🔍 Graph Projection Service

### **The Beautiful Part: It's SIMPLE!**

```typescript
// /utils/api/projectGraph.ts

interface ProjectGraphNode {
  id: string;
  type: 'party' | 'contract' | 'person';
  data: any;
}

interface ProjectGraphEdge {
  id: string;
  from: string;
  to: string;
  type: 'contract' | 'employs' | 'approves';
  data: any;
}

interface ProjectGraph {
  nodes: ProjectGraphNode[];
  edges: ProjectGraphEdge[];
}

/**
 * Get project graph scoped to viewer's organization.
 * 
 * SIMPLE RULE: Return only contracts where viewer is a party
 * (or has explicit disclosure grant).
 */
export async function getProjectGraph(
  projectId: string, 
  viewerOrgId: string
): Promise<ProjectGraph> {
  const supabase = createClient(/* ... */);
  
  // 1. Get contracts where viewer is involved
  const { data: contracts } = await supabase
    .from('project_contracts')
    .select(`
      *,
      from_org:organizations!from_org_id(*),
      to_org:organizations!to_org_id(*)
    `)
    .eq('project_id', projectId)
    .eq('status', 'active') // Only show active contracts
    .or(`from_org_id.eq.${viewerOrgId},to_org_id.eq.${viewerOrgId},disclosed_to_org_id.eq.${viewerOrgId}`);
  
  if (!contracts) return { nodes: [], edges: [] };
  
  // 2. Extract unique orgs from contracts
  const orgIds = new Set<string>();
  contracts.forEach(c => {
    orgIds.add(c.from_org_id);
    orgIds.add(c.to_org_id);
  });
  
  const { data: orgs } = await supabase
    .from('organizations')
    .select('*')
    .in('id', Array.from(orgIds));
  
  // 3. Get people assigned to this project from viewer's scope
  const { data: people } = await supabase
    .from('project_role_assignments')
    .select(`
      *,
      user:users(*)
    `)
    .eq('project_id', projectId)
    .in('org_id', Array.from(orgIds)); // Only people from visible orgs
  
  // 4. Build graph nodes
  const nodes: ProjectGraphNode[] = [
    // Organization nodes
    ...(orgs || []).map(org => ({
      id: org.id,
      type: 'party' as const,
      data: {
        name: org.name,
        logo: org.logo,
        type: org.type,
        // Mark if this is viewer's org
        isViewer: org.id === viewerOrgId,
      },
    })),
    
    // Person nodes
    ...(people || []).map(p => ({
      id: p.user_id,
      type: 'person' as const,
      data: {
        name: p.user.name,
        email: p.user.email,
        role: p.role,
        org_id: p.org_id,
      },
    })),
  ];
  
  // 5. Build edges
  const edges: ProjectGraphEdge[] = [
    // Contract edges
    ...contracts.map(c => ({
      id: c.id,
      from: c.from_org_id,
      to: c.to_org_id,
      type: 'contract' as const,
      data: {
        rate: c.rate,
        currency: c.currency,
        contract_type: c.contract_type,
        status: c.status,
        // Mark if disclosed (viewer sees via disclosure grant)
        isDisclosed: c.disclosed_to_org_id === viewerOrgId,
      },
    })),
    
    // Employment edges (org → person)
    ...(people || []).map(p => ({
      id: `employ-${p.org_id}-${p.user_id}`,
      from: p.org_id,
      to: p.user_id,
      type: 'employs' as const,
      data: {
        role: p.role,
      },
    })),
  ];
  
  return { nodes, edges };
}
```

**That's it! No masking. No projection. No viewer scopes.**  
Just: **"Show contracts where I'm a party."**

---

## 🎨 UI Implications

### **WorkGraph Component**

```typescript
// /components/workgraph/WorkGraphBuilder.tsx

function WorkGraphBuilder({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [graph, setGraph] = useState<ProjectGraph | null>(null);
  
  useEffect(() => {
    async function loadGraph() {
      // Automatically scoped to user's org!
      const data = await getProjectGraph(projectId, user.org_id);
      setGraph(data);
    }
    loadGraph();
  }, [projectId, user.org_id]);
  
  // Render graph...
  // Agency sees: Client + Sub
  // Client sees: Agency only
  // Sub sees: Agency only
}
```

### **Contract List (Viewer's Scope)**

```tsx
// What each org sees in "My Contracts" panel

// CLIENT VIEW:
┌──────────────────────────────────────┐
│ My Contracts                         │
├──────────────────────────────────────┤
│ ↑ Vendor: TechCorp Agency            │
│   Rate: $150/hr (T&M)                │
│   Status: Active                     │
│   Workers: 3 active                  │
│   [View Details]                     │
└──────────────────────────────────────┘

// AGENCY VIEW:
┌──────────────────────────────────────┐
│ My Contracts                         │
├──────────────────────────────────────┤
│ ↑ Customer: Acme Inc (Client)        │
│   Selling at: $150/hr                │
│   Approver: Bob Martinez             │
│   [Manage]                           │
├──────────────────────────────────────┤
│ ↓ Vendor: DevShop Sub                │
│   Buying at: $85/hr                  │
│   Workers: Alice, Mark (2)           │
│   Margin: $65/hr (43%)  💰          │
│   [Manage]                           │
└──────────────────────────────────────┘

// SUB VIEW:
┌──────────────────────────────────────┐
│ My Contracts                         │
├──────────────────────────────────────┤
│ ↑ Customer: TechCorp Agency          │
│   Rate: $85/hr                       │
│   My Workers: Alice, Mark            │
│   [Assign Workers] [Timesheets]      │
└──────────────────────────────────────┘
```

---

## 🔄 Workflow: Invitation & Acceptance

### **Step 1: Agency Invites Sub**

```typescript
// Agency creates pending contract
await supabase.from('project_contracts').insert({
  project_id: 'proj-123',
  from_org_id: 'sub-xyz', // DevShop
  to_org_id: 'agency-abc', // TechCorp
  rate: 85.00,
  currency: 'USD',
  contract_type: 'tm',
  status: 'pending', // ← Not visible to anyone yet
  invited_by: agencyUserId,
});

// Send email invitation
await sendEmail({
  to: 'admin@devshop.com',
  subject: 'Invitation: Join Project "Acme Website"',
  body: `
    TechCorp Agency has invited DevShop to join project "Acme Website".
    
    Contract Details:
    - Type: Time & Materials
    - Rate: $85/hr
    - Currency: USD
    
    [Accept Invitation] [Decline]
  `,
});
```

### **Step 2: Sub Accepts**

```typescript
// Sub admin clicks "Accept"
await supabase
  .from('project_contracts')
  .update({
    status: 'active', // ← NOW visible to both parties
    accepted_at: new Date().toISOString(),
    accepted_by: subAdminUserId,
  })
  .eq('id', contractId);

// Add sub to project participants
await supabase.from('project_participants').insert({
  project_id: 'proj-123',
  org_id: 'sub-xyz',
  role: 'subcontractor',
});
```

### **Step 3: Now Both See It**

```
Agency's graph: [Client] ← Agency → [Sub] ✅
Sub's graph: Agency → [Sub] ✅
Client's graph: [Client] ← Agency (Sub still hidden) ❌
```

---

## 🔓 Optional: Disclosure Request Flow

Sometimes Client NEEDS to know about subs (compliance, security clearance).

### **Flow:**

1. **Client Request:**
   ```typescript
   // Client clicks "Request Vendor Details"
   await supabase.from('project_contracts').update({
     disclosure_requested_at: new Date().toISOString(),
     disclosure_requested_by: clientUserId,
   }).eq('id', agencyToSubContractId);
   
   // Notify agency
   await sendEmail({
     to: 'agency@techcorp.com',
     subject: 'Disclosure Request from Client',
     body: 'Acme Inc has requested visibility to your subcontractors...',
   });
   ```

2. **Agency Approves + Asks Sub:**
   ```typescript
   // Agency admin approves in principle
   // Then asks sub for consent (two-sided)
   
   await sendEmail({
     to: 'admin@devshop.com',
     subject: 'Client Visibility Request',
     body: 'Our client Acme Inc wants to see your org details. Allow?',
   });
   ```

3. **Sub Accepts:**
   ```typescript
   // Sub admin clicks "Allow"
   await supabase.from('project_contracts').update({
     disclosed_to_org_id: clientOrgId, // ← Grant disclosure
     disclosure_approved_at: new Date().toISOString(),
     disclosure_approved_by: subAdminUserId,
   }).eq('id', agencyToSubContractId);
   ```

4. **Client Now Sees:**
   ```
   Client's graph:
   [Client] ← Agency → [DevShop Sub] ✅ (now visible via disclosure)
   
   Note: Still only sees org name, not rates
   ```

---

## 🎯 Benefits Recap

| Feature | Complex Projection | Local Scope Only |
|---------|-------------------|------------------|
| **Query Complexity** | O(all nodes × masking rules) | O(viewer's contracts) |
| **User Confusion** | "Why see Alice but not her company?" | "I see my vendors" ✅ |
| **Privacy** | Configured (many toggles) | Automatic (can't see what's not yours) ✅ |
| **Scalability** | Degrades with graph size | Constant (filter at DB) ✅ |
| **Real-world Accuracy** | Low | High ✅ |
| **Implementation Time** | 2-3 weeks | 2-3 days ✅ |
| **Audit Trail** | Complex (why visible?) | Simple (they have a contract) ✅ |

---

## ✅ Exit Criteria

### **Phase 1: Core Visibility** (This Implementation)
- [ ] Each org sees only their direct contracts
- [ ] Pending contracts hidden until accepted
- [ ] Graph projection service filters by `viewer_org_id`
- [ ] UI shows "My Contracts" (upstream + downstream)
- [ ] Workers appear with "via Agency" context in approvals

### **Phase 2: Invitations** (Next)
- [ ] Invite flow (send → pending → accept → active)
- [ ] Email notifications
- [ ] Invitation inbox UI

### **Phase 3: Disclosure** (Optional Advanced)
- [ ] Client can request vendor visibility
- [ ] Two-sided approval (Agency + Sub)
- [ ] Disclosed contracts show in client's graph
- [ ] Audit log for disclosure events

---

## 🚀 Migration Notes

**Existing Projects:**
- If you have projects with "full graph" data, migration script will:
  1. Identify actual contract relationships (who-pays-who)
  2. Create `project_contracts` records
  3. Mark all as `active` (skip invitation flow for legacy)
  4. Preserve disclosure settings if they existed

**No Data Loss:**
- Timesheets, approvals, invoices unchanged
- Only graph visibility model changes
- Users see fewer nodes (which is the goal!)

---

**Status:** ✅ Ready for implementation  
**Next Steps:** Build backend services → UI components → Testing
