# Phase 2-6: Deep Linking & Integration Implementation
## WorkGraph Project Graph Integration - Complete Spec Implementation

**Date:** 2024-01-24  
**Status:** 🚧 IN PROGRESS

---

## ✅ **PHASE 1: CORE TAB INTEGRATION** (COMPLETE)

### **What Was Built:**
- ✅ Added "Project Graph" as **core tab** in ProjectWorkspace
- ✅ Positioned between Overview and Timesheets  
- ✅ Uses Network (🕸️) icon
- ✅ Lazy loaded with Suspense for performance
- ✅ Deep linking support via URL parameters
- ✅ Removed orphaned `/visual-builder` standalone route
- ✅ Added optional "Graph Snapshot" module

### **Deep Linking Parameters:**
```typescript
?focus=<nodeId>      // Focus on specific node
?scope=approvals|money|people|access  // Filter graph view
?mode=view|edit      // Permission-based editing
?asOf=<timestamp>    // Historical snapshots
```

---

## ✅ **PHASE 2: DEEP LINKS FROM OVERVIEW CARDS** (COMPLETE)

### **Implementation:**

#### **1. Budget Card → Money Flow**
```tsx
<Card className="p-6 relative group">
  <DropdownMenu>
    <DropdownMenuItem onClick={() => handleDeepLink('money')}>
      <Network className="w-4 h-4 mr-2" />
      Show money flow in graph
    </DropdownMenuItem>
  </DropdownMenu>
  <p>Budget Progress: $12,500 of $20,000 (62%)</p>
</Card>
```

**UX:**
- Hover over Budget card
- Click kebab menu (⋯)
- Click "Show money flow in graph"
- → Opens Project Graph tab with `?scope=money`

#### **2. Pending Approvals Card → Approval Chain**
```tsx
<Card className="p-6 relative group">
  <Button 
    className="opacity-0 group-hover:opacity-100"
    onClick={() => handleDeepLink('approvals')}
  >
    View on graph →
  </Button>
  <p>Pending Approvals: 3</p>
</Card>
```

**UX:**
- Hover over Pending Approvals card
- Click "View on graph →" button
- → Opens Project Graph tab with `?scope=approvals`

#### **3. handleDeepLink Function**
```typescript
const handleDeepLink = (scope: string, focus?: string) => {
  const params = new URLSearchParams();
  params.set('scope', scope);
  if (focus) params.set('focus', focus);
  
  // Update URL without reload
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.pushState({}, '', newUrl);
  
  // Trigger tab change to project-graph
  const event = new CustomEvent('changeTab', { detail: 'project-graph' });
  window.dispatchEvent(event);
};
```

#### **4. Tab Change Event Listener**
```typescript
useEffect(() => {
  const handleTabChange = (event: CustomEvent<ModuleId>) => {
    setActiveTab(event.detail);
  };
  
  window.addEventListener('changeTab', handleTabChange as EventListener);
  return () => window.removeEventListener('changeTab', handleTabChange as EventListener);
}, []);
```

### **Files Modified:**
- `/components/ProjectWorkspace.tsx`
  - Added `DropdownMenu` import
  - Updated `OverviewModule` with deep link buttons
  - Added `useEffect` for custom event listening
  - Implemented `handleDeepLink` function

---

## 🚧 **PHASE 3: DEEP LINKS FROM TIMESHEET ROWS** (TODO)

### **Planned Implementation:**

#### **1. Add Row Action to Timesheet Cells**
```tsx
<DropdownMenu>
  <DropdownMenuItem onClick={() => handleViewInGraph(personId)}>
    <Network className="w-4 h-4 mr-2" />
    View path on graph
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => handleOpenFullGraph(personId)}>
    <ExternalLink className="w-4 h-4 mr-2" />
    Open in Project Graph
  </DropdownMenuItem>
</DropdownMenu>
```

#### **2. Deep Link Function**
```typescript
const handleViewInGraph = (personId: string) => {
  // Option A: Open drawer with graph tab
  openDrawer({
    activeTab: 'graph',
    focusNodeId: personId,
    asOf: submissionTimestamp
  });
  
  // Option B: Navigate to main graph tab
  navigateToGraph({
    focus: personId,
    scope: 'approvals',
    asOf: submissionTimestamp
  });
};
```

### **Files to Modify:**
- `/components/timesheets/ProjectTimesheetsView.tsx`
- `/components/timesheets/MonthlyTimesheetDrawer.tsx`

---

## 🚧 **PHASE 4: GRAPH SNAPSHOT CARD** (TODO)

### **Planned Implementation:**

#### **1. Create GraphSnapshotCard Component**
```tsx
// /components/project/GraphSnapshotCard.tsx
function GraphSnapshotCard({ projectId }: { projectId: string }) {
  const data = useGraphHealth(projectId);
  
  return (
    <Card className="p-6">
      <CardHeader>
        <h3>Graph Snapshot</h3>
        <p className="text-sm text-muted-foreground">
          Quick health check of project structure
        </p>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">Approvals blocked</span>
          <Badge variant={data.blocks > 0 ? "destructive" : "success"}>
            {data.blocks}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm">SLA breaches</span>
          <Badge variant={data.breaches > 0 ? "destructive" : "success"}>
            {data.breaches}
          </Badge>
        </div>
        
        <div className="border-t pt-3">
          <p className="text-sm text-muted-foreground mb-2">Budget chain</p>
          <div className="flex items-center gap-2 text-sm">
            <Avatar name="Vendor" />
            <ChevronRight className="w-4 h-4" />
            <Avatar name="Agency" />
            <ChevronRight className="w-4 h-4" />
            <Avatar name="Client" />
          </div>
        </div>
      </CardContent>
      
      <CardFooter>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigateToGraph({ scope: 'approvals' })}
        >
          <Network className="w-4 h-4 mr-2" />
          Open Project Graph
        </Button>
      </CardFooter>
    </Card>
  );
}
```

#### **2. Register as Optional Module**
```typescript
{
  id: "graph-snapshot",
  name: "Graph Snapshot",
  icon: Network,
  description: "Quick health check of project structure (adds to Overview)",
  category: "optional",
  isEnabled: false,
}
```

#### **3. Render in Overview Tab**
```tsx
<TabsContent value="overview" className="space-y-6">
  <div className="grid md:grid-cols-3 gap-6">
    {/* Existing cards */}
    <Card>Budget Progress</Card>
    <Card>Hours This Week</Card>
    <Card>Pending Approvals</Card>
    
    {/* Graph Snapshot (if enabled) */}
    {modules.find(m => m.id === 'graph-snapshot')?.isEnabled && (
      <Card className="md:col-span-3">
        <GraphSnapshotCard projectId={projectId} />
      </Card>
    )}
  </div>
</TabsContent>
```

### **Files to Create:**
- `/components/project/GraphSnapshotCard.tsx`
- `/hooks/useGraphHealth.ts`

### **Files to Modify:**
- `/components/ProjectWorkspace.tsx`

---

## 🚧 **PHASE 5: AS-OF SNAPSHOTS** (TODO)

### **Planned Implementation:**

#### **1. Version Tracking on Submissions**
```typescript
interface TimesheetSubmission {
  id: string;
  contractorId: string;
  month: string;
  entries: TimeEntry[];
  graphVersion: string;  // ⬅️ NEW: Snapshot graph at submission time
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}
```

#### **2. As-Of Banner Component**
```tsx
// /components/workgraph/AsOfBanner.tsx
function AsOfBanner({ asOf, latest, onSwitchToLatest }: Props) {
  if (asOf === 'now') return null;
  
  return (
    <div className="bg-warning/10 border border-warning rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <div>
            <p className="font-medium">Viewing historical snapshot</p>
            <p className="text-sm text-muted-foreground">
              Graph as of {formatDate(asOf)} (v{graphVersion})
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={onSwitchToLatest}
        >
          Switch to latest
        </Button>
      </div>
    </div>
  );
}
```

#### **3. WorkGraphBuilder As-Of Mode**
```tsx
<WorkGraphBuilder
  projectId={projectId}
  asOf={asOf}  // '2024-11-05' or 'now'
  mode={asOf === 'now' ? 'edit' : 'view'}  // Read-only for historical
/>
```

#### **4. Drawer Graph Tab with As-Of**
```tsx
<MonthlyTimesheetDrawer
  item={selectedItem}
  defaultTab="graph"
>
  <TabsContent value="graph">
    <AsOfBanner
      asOf={selectedItem.graphVersion}
      latest={latestGraphVersion}
      onSwitchToLatest={() => setAsOf('now')}
    />
    <WorkGraphBuilder
      projectId={projectId}
      focusNodeId={selectedItem.contractorId}
      asOf={selectedItem.graphVersion}
      mode="view"  // Always read-only in drawer
    />
  </TabsContent>
</MonthlyTimesheetDrawer>
```

### **Files to Create:**
- `/components/workgraph/AsOfBanner.tsx`

### **Files to Modify:**
- `/components/workgraph/WorkGraphBuilder.tsx`
- `/components/timesheets/MonthlyTimesheetDrawer.tsx`
- `/types/timesheet.ts`

---

## 🚧 **PHASE 6: KEYBOARD SHORTCUTS** (TODO)

### **Planned Implementation:**

#### **1. Global Keyboard Listener**
```tsx
// /hooks/useKeyboardShortcuts.ts
export function useKeyboardShortcuts(projectWorkspaceRef: RefObject<Element>) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore if typing in input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextArea) {
        return;
      }
      
      switch (event.key.toLowerCase()) {
        case 'g':
          // Jump to Project Graph tab
          setActiveTab('project-graph');
          break;
          
        case 'p':
          // Toggle scope: people/approvals
          toggleScope('people');
          break;
          
        case 'm':
          // Show money flow
          setScope('money');
          setActiveTab('project-graph');
          break;
          
        case 'f':
          // Focus search
          focusSearchInput();
          break;
          
        case 'j':
        case 'k':
          // Navigate items (in lists)
          navigateList(event.key === 'j' ? 'down' : 'up');
          break;
          
        case '?':
          // Show keyboard shortcuts help
          showShortcutsModal();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
}
```

#### **2. Shortcuts Help Modal**
```tsx
// /components/KeyboardShortcutsModal.tsx
function KeyboardShortcutsModal() {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Navigation</h4>
            <div className="space-y-2">
              <ShortcutRow keys={['g']} description="Jump to Project Graph" />
              <ShortcutRow keys={['o']} description="Go to Overview" />
              <ShortcutRow keys={['t']} description="Go to Timesheets" />
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Graph Views</h4>
            <div className="space-y-2">
              <ShortcutRow keys={['p']} description="Toggle People scope" />
              <ShortcutRow keys={['m']} description="Show Money flow" />
              <ShortcutRow keys={['a']} description="Show Approvals" />
              <ShortcutRow keys={['f']} description="Focus search" />
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Lists</h4>
            <div className="space-y-2">
              <ShortcutRow keys={['j']} description="Next item" />
              <ShortcutRow keys={['k']} description="Previous item" />
              <ShortcutRow keys={['enter']} description="Open selected" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### **3. Visual Keyboard Hint**
```tsx
// Show on tab headers
<TabsTrigger value="project-graph">
  <Network className="w-4 h-4" />
  Project Graph
  <kbd className="ml-2 px-1.5 py-0.5 text-xs border rounded">G</kbd>
</TabsTrigger>
```

### **Files to Create:**
- `/hooks/useKeyboardShortcuts.ts`
- `/components/KeyboardShortcutsModal.tsx`

### **Files to Modify:**
- `/components/ProjectWorkspace.tsx`
- `/components/workgraph/WorkGraphBuilder.tsx`

---

## 📊 **ACCEPTANCE CRITERIA**

### **Phase 1 ✅**
- [x] Tab present: Project Graph tab appears on every project
- [x] Deep links work: URL parameters properly set
- [x] Add Module: "Graph Snapshot" available as optional
- [x] Lazy load: First open shows skeleton
- [x] Standalone route removed

### **Phase 2 ✅**
- [x] Budget card → Money flow link works
- [x] Pending Approvals → View on graph works
- [x] Tab switches automatically on deep link click
- [x] URL updates without page reload
- [x] Custom event listener registered

### **Phase 3 🚧**
- [ ] Timesheet row → "View path on graph" button
- [ ] Drawer opens with graph tab
- [ ] Focus on correct person node
- [ ] As-of snapshot from submission time

### **Phase 4 🚧**
- [ ] Graph Snapshot card addable via + Add Module
- [ ] Shows blocks/breaches/chains
- [ ] Deep links to full graph
- [ ] Real-time health check

### **Phase 5 🚧**
- [ ] Version tracking on submissions
- [ ] As-of banner appears when viewing historical
- [ ] "Switch to latest" button works
- [ ] Read-only mode for historical views

### **Phase 6 🚧**
- [ ] `g` key jumps to Project Graph
- [ ] `p` toggles scope
- [ ] `m` shows money flow
- [ ] `f` focuses search
- [ ] `j/k` navigate lists
- [ ] `?` shows shortcuts help

---

## 🎯 **NEXT STEPS**

1. **Complete Phase 3** - Timesheet row deep links
2. **Complete Phase 4** - Graph Snapshot card
3. **Complete Phase 5** - As-of snapshots
4. **Complete Phase 6** - Keyboard shortcuts
5. **Testing** - End-to-end user flows
6. **Documentation** - Update user guides

---

**Last Updated:** 2024-01-24  
**Current Phase:** 2/6 Complete  
**Next Milestone:** Phase 3 - Timesheet Row Deep Links
