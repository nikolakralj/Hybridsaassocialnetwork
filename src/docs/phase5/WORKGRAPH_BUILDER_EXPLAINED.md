# WorkGraph Builder Explained

## What You Saw in That Screenshot

The graph with "15 Nodes, 20 Edges" showing **Acme Dev Studio**, **BrightWorks Design**, and **Enterprise ClientCorp** is:

❌ **NOT your timesheet data**  
❌ **NOT in the database**  
✅ **A project planning template**

---

## 🎯 What is WorkGraph Builder?

It's a **visual project planning tool** that lets you:

1. **Design project structures** - Who works for whom
2. **Model approval chains** - How timesheets flow through approvals
3. **Configure multi-party relationships** - Agencies, clients, freelancers
4. **Simulate workflows** - Test before implementation

**Think of it like:**
- Figma for project architecture
- A whiteboard for planning contracts
- A blueprint for your approval system

---

## 📊 Two Separate Systems

### System 1: WorkGraph Builder (What You Saw)
- **Purpose:** Planning & design tool
- **Data:** Template/mock data
- **Storage:** Local state or template files
- **Usage:** Design workflows before building
- **Nodes:** Party/Org, Team, Person, Contract, SOW, etc.

### System 2: Timesheet Approval System (Your Actual Data)
- **Purpose:** Real timesheet submission & approval
- **Data:** Alice's actual hours worked
- **Storage:** Postgres + KV store
- **Usage:** Production workflow
- **Nodes:** TimesheetPeriod, ExpenseReport

---

## 🔍 Why The Confusion?

Both systems use **graph nodes**, but for different purposes:

### WorkGraph Builder Nodes
```typescript
{
  nodeType: 'Company',
  id: 'company-acme-dev',
  properties: {
    name: 'Acme Dev Studio',
    type: 'Vendor Company',
    ...
  }
}
```

### Timesheet Graph Nodes (Your Data)
```typescript
{
  nodeType: 'TimesheetPeriod',
  id: 'ts-2025-11-04-alice',
  properties: {
    weekStart: '2025-11-04',
    totalHours: 40,
    status: 'submitted',
    ...
  }
}
```

**They're both graphs, but completely different!**

---

## 🗺️ Where Each System Lives

### WorkGraph Builder
```
📁 /components/workgraph/
   ├── WorkGraphBuilder.tsx ← The component you saw
   ├── PropertyPanel.tsx
   └── node-types/
       ├── PartyOrgNode.tsx
       ├── TeamNode.tsx
       ├── PersonNode.tsx
       └── ContractNode.tsx

📁 /templates/
   └── default-project-template.json ← The 15 nodes you saw
```

### Timesheet Approval System
```
📁 /components/timesheets/
   ├── MultiPersonTimesheetCalendar.tsx ← Where Alice logs hours
   └── approval-v2/
       └── ApprovalsV2Tab.tsx ← Where Bob approves

📁 /supabase/functions/server/
   └── timesheet-approvals.ts ← Creates ts-* graph nodes

🗄️ Database:
   - Postgres: timesheet_periods, timesheet_entries
   - KV Store: graph:node:ts-*, graph:edge:ts-*
```

---

## 🎨 The Template You Saw

That "15 Nodes" graph is probably a **default template** showing:

```
🏢 Company Nodes (Acme Dev Studio, BrightWorks Design)
   ↓ employs
👤 Person Nodes (contractors, employees)
   ↓ works on
📄 Contract Nodes (MSAs, SOWs)
   ↓ approves
🏢 Client Nodes (Enterprise ClientCorp)
   ↓ governs
💰 Budget Nodes
📅 Milestone Nodes
```

**Purpose:** Show you how to model complex multi-party projects

---

## 🚀 How to Use WorkGraph Builder

### Use Case 1: Design Before Building
```
1. Open WorkGraph Builder
2. Add your companies/agencies
3. Add contractors
4. Connect with contracts
5. Define approval chains
6. Export as JSON
7. Use as blueprint for database schema
```

### Use Case 2: Visualize Existing Projects
```
1. Load project data from DB
2. Render as graph
3. See relationships visually
4. Identify bottlenecks
5. Redesign if needed
```

### Use Case 3: Test Approval Flows
```
1. Create mock project structure
2. Simulate timesheet submission
3. Follow approval path visually
4. Validate business logic
5. Implement in code
```

---

## 📋 When to Use Each System

### Use WorkGraph Builder When:
- ✅ Designing a new project structure
- ✅ Planning approval chains
- ✅ Documenting complex relationships
- ✅ Presenting to stakeholders
- ✅ Prototyping workflows

### Use Timesheet System When:
- ✅ Logging actual work hours
- ✅ Submitting timesheets for payment
- ✅ Approving/rejecting timesheets
- ✅ Generating invoices
- ✅ Tracking billing

---

## 🔄 How They Connect (Future)

Eventually, you might:

1. **Design in WorkGraph Builder:**
   ```
   Create approval chain template:
   Contractor → Manager → Finance → Client
   ```

2. **Export to Config:**
   ```json
   {
     "approvalChain": [
       { "role": "manager", "scope": "contractor_company" },
       { "role": "finance", "scope": "contractor_company" },
       { "role": "client", "scope": "client_company" }
     ]
   }
   ```

3. **Apply to Contracts:**
   ```sql
   UPDATE project_contracts 
   SET approval_chain_template_id = 'template-enterprise'
   WHERE project_id = 'proj-xyz';
   ```

4. **Use at Runtime:**
   ```typescript
   // When timesheet submitted
   const chain = buildApprovalChain(contract);
   // Uses the template you designed!
   ```

---

## 💡 Real-World Example

### Scenario: Agency with Multiple Clients

**In WorkGraph Builder (Design Phase):**
```
🏢 BrightWorks Design (Agency)
   ├── 👤 Alice (Designer)
   ├── 👤 Bob (Manager)
   └── 👤 Eve (Finance)

📄 Contract: BrightWorks → Client A
   ├── Approval: Bob → Client A's PM
   └── Rate: $800/day

📄 Contract: BrightWorks → Client B
   ├── Approval: Bob → Eve → Client B's Procurement
   └── Rate: $150/hr
```

**In Timesheet System (Runtime):**
```
Alice submits timesheet for Client A:
   → Graph node created: ts-2025-11-04-alice-clientA
   → Approval edge: Bob → Client A's PM
   → Email sent to Bob

Alice submits timesheet for Client B:
   → Graph node created: ts-2025-11-04-alice-clientB
   → Approval edges: Bob → Eve → Client B's Procurement
   → Emails sent
```

**Same approval logic, different chains!**

---

## 🧹 How to Clear the Graph (If You Want)

The graph you saw is just a **React component state**. To clear it:

### Option 1: Refresh the Page
- Graph resets to default template
- Your timesheet data is unaffected

### Option 2: Clear Template
- In WorkGraph Builder, click "New Project"
- Starts with empty canvas

### Option 3: Load Different Template
- Click "Load Template"
- Select different project structure

**None of these affect your actual timesheet data!**

---

## ✅ Key Takeaways

1. **WorkGraph Builder = Planning Tool**
   - Not your real data
   - Just templates and designs

2. **Timesheet System = Production System**
   - Real hours, real approvals
   - Lives in Postgres + KV

3. **Both Use Graphs**
   - But for different purposes
   - Completely separate

4. **The 15 Nodes You Saw**
   - Example project structure
   - Shows how to model complex scenarios
   - Not in your database

5. **Your Actual Timesheet**
   - Go to Timesheets tab
   - See Alice's 40 hours
   - That's your real data

---

## 🎯 Quick Reference

| Feature | WorkGraph Builder | Timesheet System |
|---------|-------------------|------------------|
| **Purpose** | Design tool | Production system |
| **Data** | Templates | Real timesheets |
| **Storage** | React state | Postgres + KV |
| **Nodes** | 15+ types | TimesheetPeriod, ExpenseReport |
| **Where** | Builder tab | Timesheets/Approvals tabs |
| **Changes** | Don't persist | Saved to DB |

---

**Bottom Line:** The graph you saw is a **design tool**, not your data. Your timesheet data is in the **Timesheets tab**. They're separate systems! 🎉
