# 🤝 Contracts Components - Local Scope Visibility

**Implementation Date:** November 14, 2024  
**Architecture:** Local scope "show only my contracts" model  
**Status:** ✅ Complete and ready for use

---

## 📦 Components

### **1. ContractCard**
Display individual contracts with relationship context (selling/buying/disclosed).

```tsx
import { ContractCard } from './components/contracts';

<ContractCard
  contract={viewerContract}
  onViewDetails={(id) => console.log('View', id)}
  onRequestDisclosure={(id) => handleDisclosure(id)}
  showMargin={true}
/>
```

**Features:**
- Direction indicator (↑ selling, ↓ buying, 👁️ disclosed)
- Rate display (if visible)
- Worker count
- Contract type badge
- Margin calculation for agencies

---

### **2. MyContractsPanel**
Main contract dashboard showing all viewer's contracts.

```tsx
import { MyContractsPanel } from './components/contracts';

<MyContractsPanel
  projectId="proj-123"
  viewerOrgId={user.org_id}
  onCreateContract={() => setShowDialog(true)}
  onViewDetails={(id) => navigate(`/contracts/${id}`)}
/>
```

**Features:**
- Tabs: All / Vendors / Customers
- Pending invitations banner
- Margin analysis (for agencies)
- Empty states
- Local scope explanation

---

### **3. InvitationInbox**
Display and manage pending contract invitations.

```tsx
import { InvitationInbox } from './components/contracts';

<InvitationInbox
  invitations={pendingInvitations}
  onAccept={acceptInvitation}
  onDecline={declineInvitation}
/>
```

**Features:**
- Expandable invitation cards
- Accept/Decline actions
- Contract details preview
- Two-sided approval notice
- Time since invited

---

### **4. DisclosureRequestDialog**
Request visibility to vendor's subcontractors.

```tsx
import { DisclosureRequestDialog } from './components/contracts';

<DisclosureRequestDialog
  contract={contract}
  onRequest={(id, notes) => requestDisclosure(id, notes)}
/>
```

**Features:**
- Before/after visualization
- Reason text area
- Two-sided approval workflow
- Success confirmation

---

### **5. ContractsDemoPage**
Interactive demo showing how local scope works for different organizations.

```tsx
import { ContractsDemoPage } from './components/contracts';

<ContractsDemoPage />
```

**Features:**
- View as: Client / Agency / Sub
- Side-by-side visibility comparison
- Contract chain visualization
- Educational explanations

---

## 🎯 Usage with Hooks

### **Basic Usage**

```tsx
import { useProjectContracts } from '@/hooks/useProjectContracts';
import { MyContractsPanel } from '@/components/contracts';

function ProjectDashboard({ projectId, user }) {
  const {
    contracts,
    invitations,
    loading,
    acceptInvitation,
  } = useProjectContracts({
    projectId,
    viewerOrgId: user.org_id,
  });

  return (
    <div>
      <MyContractsPanel
        projectId={projectId}
        viewerOrgId={user.org_id}
      />
    </div>
  );
}
```

---

### **Advanced: Margin Calculation**

```tsx
import { 
  useProjectContracts,
  useContractMargin,
} from '@/hooks/useProjectContracts';

function AgencyDashboard({ projectId, agencyOrgId }) {
  const { contracts } = useProjectContracts({
    projectId,
    viewerOrgId: agencyOrgId,
  });

  const margin = useContractMargin(contracts);

  if (margin) {
    return (
      <div>
        <p>Selling: ${margin.selling_rate}/hr</p>
        <p>Buying: ${margin.buying_rate}/hr</p>
        <p>Margin: ${margin.margin_amount}/hr ({margin.margin_percentage}%)</p>
      </div>
    );
  }

  return <p>No margin data available</p>;
}
```

---

### **Advanced: Categorized Contracts**

```tsx
import { 
  useProjectContracts,
  useCategorizedContracts,
} from '@/hooks/useProjectContracts';

function ContractsSummary({ projectId, viewerOrgId }) {
  const { contracts } = useProjectContracts({ projectId, viewerOrgId });
  const { upstream, downstream, disclosed } = useCategorizedContracts(contracts);

  return (
    <div>
      <h3>Vendors (I buy from): {upstream.length}</h3>
      <h3>Customers (I sell to): {downstream.length}</h3>
      <h3>Disclosed: {disclosed.length}</h3>
    </div>
  );
}
```

---

## 🗂️ File Structure

```
/components/contracts/
├── ContractCard.tsx           # Individual contract display
├── MyContractsPanel.tsx       # Main dashboard
├── InvitationInbox.tsx        # Pending invitations
├── DisclosureRequestDialog.tsx # Request vendor visibility
├── ContractsDemoPage.tsx      # Interactive demo
├── index.ts                   # Exports
└── README.md                  # This file

/hooks/
└── useProjectContracts.ts     # Main hook

/utils/api/
└── project-contracts.ts       # API service

/types/
└── project-contracts.ts       # TypeScript types
```

---

## 🔑 Key Concepts

### **Local Scope = 1st-Degree Neighbors Only**

Each organization sees only their direct contracts:

```
Client View:
  ✅ Agency contract
  ❌ Sub (hidden)

Agency View:
  ✅ Client contract
  ✅ Sub contract
  💰 Margin calculation

Sub View:
  ✅ Agency contract
  ❌ Client (hidden)
```

---

### **Relationship Types**

```typescript
type Relationship = 'selling' | 'buying' | 'disclosed';

// 'selling' = I'm the vendor (from_org)
// 'buying' = I'm the client (to_org)
// 'disclosed' = Visible via disclosure grant
```

---

### **Disclosure Flow**

```
1. Client requests disclosure
   ↓
2. Request sent to Agency
   ↓
3. Agency approves + asks Sub for consent
   ↓
4. Sub accepts
   ↓
5. Client can now see Sub org
```

---

## 🎨 Styling

All components use shadcn/ui and Tailwind:

- **Colors:** Blue (vendors), Green (customers), Purple (disclosed)
- **Icons:** Lucide React
- **Layout:** Responsive grid/flex
- **States:** Loading spinners, empty states, error handling

---

## ✅ Testing

Navigate to: `#/contracts` in dev mode

**Try:**
1. Switch between Client / Agency / Sub views
2. See different contracts for each org
3. Check margin calculation (Agency only)
4. View contract chain visualization

---

## 📚 Next Steps

1. **Wire to real data:**
   - Run database migration (see `/docs/database/PHASE_5_LOCAL_SCOPE_MIGRATIONS.sql`)
   - Update `useProjectContracts` with real Supabase queries

2. **Add features:**
   - Contract creation dialog
   - Worker assignment
   - Timesheet integration

3. **Integrate with WorkGraph:**
   - Update graph viewer to use scoped projection
   - Add contract edges to visual builder

---

**Status:** ✅ UI Complete  
**Next:** Database integration + real data  
**Priority:** HIGH - Foundation for multi-tenant visibility
