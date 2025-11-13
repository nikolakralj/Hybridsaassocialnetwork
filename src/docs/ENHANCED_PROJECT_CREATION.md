# 🚀 Enhanced Project Creation Wizard

**Last Updated:** 2025-11-12  
**Status:** Phase 5-6 Feature  
**Priority:** HIGH - Critical for user onboarding and adoption

---

## 🎯 Goals

1. **Reduce friction**: Get users working in ≤60 seconds
2. **Support complexity**: Allow power users to set up full SOW/Contract scaffolding
3. **Prevent bad data**: Smart defaults, validation, and "skip for now" options
4. **Enable demos**: One-click sandbox projects with realistic data

---

## 🔀 Two-Mode Approach

### Mode Comparison

| Mode | Time | Creates | Best for |
|------|------|---------|----------|
| **Quick Start** ✨ | 60s | Project + Parties + Approval template | New freelancers, internal teams, rapid prototyping |
| **Advanced** 🔧 | 3-5min | + SOW + Contracts + PO + Rate tables | Agencies, multi-party projects, enterprise |

### Why Two Modes?

**Problem**: Contracts/SOW/PO details are often **unknown during project creation**. Forcing them causes:
- ❌ Friction and drop-off
- ❌ Incomplete/inaccurate data
- ❌ Users abandon setup mid-flow

**Solution**: 
- ✅ **Quick Start**: Create project immediately, defer details
- ✅ **Advanced**: Optional scaffolding if you already have contracts
- ✅ **In-project setup**: Finish configuration inside the project (better context)

---

## 🎨 UI Entry Point

### Modal/Wizard Header

```
┌────────────────────────────────────────────────┐
│  Create New Project                       [×]  │
├────────────────────────────────────────────────┤
│                                                │
│  Choose setup mode:                            │
│                                                │
│  ○ Quick Start (recommended)                   │
│    60-second setup, creates project and stubs  │
│    Perfect for: Freelancers, internal teams    │
│                                                │
│  ○ Advanced                                    │
│    Include SOW/PO/Contracts scaffolding        │
│    Perfect for: Agencies, multi-party work     │
│                                                │
│  [Continue →]                                  │
└────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Mode (3 Steps)

### Step 1: Basics

**UI Layout**: Left form | Right preview card

**Fields**:
- **Project name** (required)  
  Example: "Acme Website Redesign"

- **Region / Locale** (dropdown)  
  Drives date format, tax presets, default currency  
  Options: US, EU, UK, Canada, Australia, etc.

- **Currency** (dropdown)  
  Auto-filled from region, can override  
  Options: USD, EUR, GBP, CAD, AUD

- **Work week** (checkbox grid)  
  Default: Mon-Fri  
  Options: Mon, Tue, Wed, Thu, Fri, Sat, Sun

- **Start date** (date picker, optional)  
  Default: Today

- **Visibility** (radio)  
  - ○ Private to my organization  
  - ○ Shared with partners (default)

- **☑ Create "Demo Data"** (toggle)  
  Generates sample timesheets, expenses for sandbox testing

**Result**: Creates `project` record with defaults

---

### Step 2: Parties (Who's Involved)

**UI**: Chips + "Add" buttons

**Pre-selected**:
- ✅ **Your company** (current user's org)

**Add Buttons**:
- **+ Add Client** (name, email domain, auto-detect type)
- **+ Add Vendor / Agency** (multi-select)
- **+ Add People** (email addresses, optional)

**Smart Detection**:
- First external domain → tagged as "Client" (default)
- Additional domains → let user pick "Vendor" or "Partner"
- Same domain as yours → "Your company" (prevent duplicates)

**Example**:
```
Your Company:
  [TechCorp]  (you)

Client:
  [Acme Inc.]  (client@acme.com)  [×]

Vendors:
  [DevShop Agency]  (contact@devshop.io)  [×]
  
People (optional):
  john@acme.com, sarah@devshop.io  [Clear]
```

**Invite Toggle** (per party):
- ☑ Send invite email after creation

**Result**: Creates `project_party` rows and `user→party` links

---

### Step 3: Approval Skeleton

**UI**: Template picker + approver assignment

**Choose Template**:
```
○ Solo freelancer → Client
  Simple: You submit, client approves
  
○ Vendor → Agency → Client
  Standard staffing: Vendor approves, then agency, then client
  
○ Internal team only
  Manager approval, no external parties
  
○ Custom (build from scratch)
```

**Assign Approvers** (based on template):
```
Step 1: Line Manager
  [Select person...] ▼  (dropdown of people from Step 2)
  
Step 2: Client Approval
  [Select person...] ▼
```

**Toggle**:
- ☑ **Auto-compile policy after creation**  
  (Recommended: ON)

**Result**: Creates draft `approval_policy` (version 1)

---

### Final Buttons

```
[← Back]  [Create Project]  [Create & Open Project Graph]
```

---

## 🔧 Advanced Mode (+2 Optional Steps)

**Same as Quick Start Steps 1-3**, plus:

---

### Step 4: SOW / Scope (Optional)

**UI**: Form with "Upload SOW PDF" toggle

**Pricing Model** (dropdown):
- Time & Materials (T&M)
- Fixed Fee
- Milestone-Based
- Capped T&M
- Retainer

**Conditional Fields**:

If **T&M** or **Capped T&M**:
- **Budget cap** (optional)  
  Example: $50,000
- **Rate table** (role → rate grid)  
  Example:  
  ```
  Senior Developer: $125/hr
  Junior Developer: $85/hr
  Project Manager: $150/hr
  ```

If **Fixed Fee** or **Milestone**:
- **Total amount**  
  Example: $100,000
- **Milestones** (repeating section)  
  - Name: "Design Phase"
  - Target date: 2025-12-31
  - Amount: $30,000

**AI Toggle**:
- ☑ **Upload SOW PDF → AI prefill** (experimental)  
  Drag-and-drop PDF → AI extracts pricing model, rates, milestones

**Result**: Creates `sow` (+ `sow_line`), stores uploaded PDF, prepopulates rate table

---

### Step 5: Contracts & Funding (Optional)

**Toggle** (ON by default in Advanced):
- ☑ **Generate draft contracts from SOW**

**For each relationship** in Parties (Step 2):
```
TechCorp ↔ Acme Inc.
  Contract type: Time & Materials
  Rate visibility: Contract parties only ▼
  Status: Draft
  
  [Edit Terms]  [Remove]
```

**PO / Funding** (optional):
```
+ Add Purchase Order
  PO number: PO-2025-12345
  Amount: $50,000
  Currency: USD
  Issued by: Acme Inc.
```

**Result**: Creates `contract` rows tied to parties (+ `po` if captured). All set to **Draft** with rate visibility defaults.

---

## 🎁 What Gets Created

### Quick Start

| Entity | Created | Status |
|--------|---------|--------|
| `project` | ✅ Yes | Active |
| `project_party` | ✅ Yes (your org + client + vendors) | Active |
| `approval_policy` | ✅ Yes (from template, v1) | Draft |
| `sow` | ❌ No (placeholder only) | - |
| `contract` | ❌ No | - |
| `po` | ❌ No | - |

**Post-creation checklist** shown:
```
Finish Setup:
  ☐ Add SOW details
  ☐ Generate contracts
  ☐ Add PO / budget
  ☐ Compile policy
  
[Finish Setup →]
```

---

### Advanced (with SOW + Contracts enabled)

| Entity | Created | Status |
|--------|---------|--------|
| `project` | ✅ Yes | Active |
| `project_party` | ✅ Yes | Active |
| `approval_policy` | ✅ Yes (v1) | Draft |
| `sow` | ✅ Yes (with pricing model, rates) | Draft |
| `sow_line` | ✅ Yes (roles/milestones) | - |
| `contract` | ✅ Yes (stubs for each party relationship) | Draft |
| `po` | ✅ Yes (if provided) | Active |

**Post-creation**: Land on **Project Overview** with "Open Project Graph" CTA

---

## 🛡️ Smart Defaults & Safeguards

### If Quick Start is used:
- ✅ Create **one draft SOW placeholder** (no rates)
- ✅ Create **no contracts by default**
- ✅ Show "Finish setup" checklist in Project Overview
- ✅ Allow "Skip for now" on all advanced fields

### If user toggles "Generate draft contracts":
- ✅ Create **stubs** (no amounts unless provided)
- ✅ Set rate visibility: **Contract parties only**; everyone else **masked**

### If currency ≠ home region:
- ✅ Pre-enable **FX conversion** in billing

### If "Demo Data" is checked:
- ✅ Generate:
  - 2 weeks of timesheets (3 people, 120h total)
  - 5 expenses with receipts ($1,200 total)
  - 1 pending approval
  - 1 approved invoice ($9,000)

---

## 🎨 UI Wire (Concise)

```
┌─────────────────────────────────────────────────────────┐
│  New Project → Wizard                              [×]  │
├──────────────────────────┬──────────────────────────────┤
│  1. Basics               │  Preview Card                │
│  ┌────────────────────┐  │  ┌────────────────────────┐  │
│  │ Project name       │  │  │ Acme Website Redesign  │  │
│  │ Region: US         │  │  │ US | USD | Mon-Fri     │  │
│  │ Currency: USD      │  │  │ Shared | No demo data  │  │
│  │ Work week: M-F     │  │  └────────────────────────┘  │
│  │ Start: 2025-11-12  │  │                              │
│  │ ☑ Demo data        │  │                              │
│  └────────────────────┘  │                              │
│                          │                              │
│  2. Parties              │                              │
│  Your: [TechCorp]        │                              │
│  Client: [Acme Inc.] [×] │                              │
│  + Add vendor/agency     │                              │
│                          │                              │
│  3. Approval             │                              │
│  Template: Vendor→Client │                              │
│  Approvers: [Select...] │                              │
│                          │                              │
├──────────────────────────┴──────────────────────────────┤
│  ──── Advanced (optional) ────                          │
│                                                         │
│  4. SOW (pricing model, cap, rate table)                │
│     or "Upload SOW PDF (AI)" 🤖                         │
│                                                         │
│  5. Contracts & PO                                      │
│     ☑ Generate from SOW                                 │
│     PO fields (optional)                                │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [← Back]  [Create Project]  [Create & Open Graph]     │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 First-Run Experience

### Landing Page: Project Overview

**Primary CTA**:
```
[Open Project Graph]  (large, primary button)
```

**Secondary CTAs** (if setup incomplete):
```
Setup Checklist:
  ☐ Add SOW details        [Add →]
  ☐ Generate contracts     [Generate →]
  ☐ Invite approvers       [Invite →]
  ☐ Configure expenses     [Configure →]
```

**If AI prefill was used**:
```
⚠️ Review AI Extract
  AI extracted 12 fields from your SOW PDF.
  Please review for accuracy.
  
  [Review Now]
  
  Confidence:
    ✅ Parties (95%)
    ✅ Rates (92%)
    ⚠️ Approval flow (78%)  ← needs review
```

---

## 📊 Success Metrics

### Adoption
- **Time to first timesheet**: < 5 minutes (from project creation)
- **Quick Start usage**: ≥70% of new projects
- **Setup completion**: ≥60% finish post-creation checklist

### Data Quality
- **Incomplete projects**: < 15% (missing SOW or contracts)
- **Demo data usage**: ≥40% (indicates sandbox testing)
- **AI prefill accuracy**: ≥90% (for extracted fields)

---

## 🔗 Integration Points

### Project Graph
- After creation, open **Graph Builder** with:
  - Party nodes (positioned automatically)
  - Contract nodes (if created)
  - SOW nodes (if created)
  - Dashed approval edges (from template)

### Timesheets
- Pre-populate **contract dropdown** from generated contracts
- Link to SOW for rate lookup

### Approvals
- Pre-compiled **policy v1** from approval template
- Show "Policy active" badge in Approvals tab

---

## ✅ Exit Criteria

### Phase 5-6 (Enhanced Project Creation):
- [ ] Quick Start mode creates project in <60 seconds
- [ ] Advanced mode supports SOW + Contract + PO scaffolding
- [ ] Demo data toggle generates realistic sandbox data
- [ ] Approval templates work (Solo, Vendor→Agency→Client, Internal)
- [ ] AI prefill extracts ≥5 key fields from SOW PDF
- [ ] Post-creation checklist guides incomplete setups
- [ ] "Open Project Graph" lands on valid, editable graph
- [ ] Rate visibility defaults are correct (contract parties only)
- [ ] Zero duplicate parties created (smart domain detection works)

---

## 📚 Related Documentation

- **SOW Architecture**: `/docs/SOW_ARCHITECTURE.md`
- **Project Graph**: `/docs/PROJECT_GRAPH_EXPLAINED.md`
- **Multi-Party Approvals**: `/docs/MULTI_PARTY_APPROVAL_ARCHITECTURE.md`
- **AI Contract Analysis**: Phase 11 in `/docs/roadmap/MASTER_ROADMAP.md`

---

## 📝 Implementation Notes

### Phase Placement
- **Quick Start (Steps 1-3)**: Phase 5 Day 9-10 or Phase 6 Week 1
- **Advanced (Steps 4-5)**: Phase 6 Week 2 (requires SOW data model)
- **AI prefill**: Phase 11 (AI Contract Analysis)

### Technical Stack
- **UI**: Multi-step wizard (shadcn Dialog + Tabs)
- **State**: Zustand store for wizard state
- **Validation**: Zod schemas per step
- **API**: Single POST `/api/projects` with full payload

---

**Status**: Specification complete, ready for Phase 5-6 implementation
