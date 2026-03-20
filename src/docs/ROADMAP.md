# WorkGraph: Comprehensive Implementation Roadmap

**Version 2.0 | March 20, 2026**
**Target Audience: AI agents and engineers implementing future phases**

---

## TABLE OF CONTENTS

1. [Current State Summary](#1-current-state-summary)
2. [Architecture Constraints & Environment Rules](#2-architecture-constraints--environment-rules)
3. [Phase 3: Live Collaboration & Real-Time Sync](#3-phase-3-live-collaboration--real-time-sync)
4. [Phase 4: Policy Compilation & Enforcement](#4-phase-4-policy-compilation--enforcement)
5. [Phase 5: Invoice & Billing Engine](#5-phase-5-invoice--billing-engine)
6. [Phase 6: Document Management](#6-phase-6-document-management)
7. [Phase 7: Analytics & Reporting](#7-phase-7-analytics--reporting)
8. [Phase 8: Social Network Features](#8-phase-8-social-network-features)
9. [Phase 9: Production Auth & Identity](#9-phase-9-production-auth--identity)
10. [Phase 10: Advanced Graph Features](#10-phase-10-advanced-graph-features)
11. [Phase 11: Mobile & Public API](#11-phase-11-mobile--public-api)
12. [Phase 12: Enterprise Features](#12-phase-12-enterprise-features)
13. [Cross-Cutting Concerns](#13-cross-cutting-concerns)
14. [Testing Strategy](#14-testing-strategy)
15. [Migration Playbooks](#15-migration-playbooks)

---

## 1. CURRENT STATE SUMMARY

### 1.1 Completed Phases

**Phase 0.5 — Platform Foundation (COMPLETE)**
- Supabase Auth with signup/signin via `/supabase/functions/server/auth.tsx`
- KV store abstraction via `/supabase/functions/server/kv_store.tsx` (protected, never modify)
- Generic KV API at `/supabase/functions/server/kv-api.tsx`
- `AuthContext` with session management at `/contexts/AuthContext.tsx`

**Phase 1 — Real Data Wiring (COMPLETE)**
- Projects CRUD API: `/supabase/functions/server/projects-api.tsx`
  - KV schema: `project:{projectId}` → Project JSON, `user-projects:{userId}` → string[]
- Contracts CRUD API: `/supabase/functions/server/contracts-api.tsx`
  - KV schema: `contract:{contractId}` → Contract JSON, `project-contracts:{projectId}` → string[]
- Timesheets CRUD API: `/supabase/functions/server/timesheets-api.tsx`
  - `TimesheetDataContext` rewired from local state to API-backed persistence
- Frontend API clients in `/utils/api/` (projects-api.ts, contracts-api.ts, timesheets-api.ts)

**Phase 2 — Graph Engine (COMPLETE)**
- Connection-based DAG model: `PartyEntry.billsTo: string[]` supports any topology
- Pure SVG Sugiyama layout engine in `WorkGraphBuilder.tsx` (~1537 lines)
- ReBAC visibility engine in `graph-visibility.ts` (~520 lines)
- Graph auto-generation from wizard in `/utils/graph/auto-generate.ts`
- Per-party privacy controls: `chainVisibility` and `visibleToChain` flags
- Monthly snapshot system in `graph-data-flows.ts`
- reactflow fully removed (was causing module resolution failures in Figma Make CDN)

### 1.2 Key Architecture Facts for Implementing Agents

1. **Runtime**: Frontend is React SPA (Vite). Server is Deno (Supabase Edge Functions with Hono).
2. **Database**: Single `kv_store_f8b491be` table. You CANNOT create new tables or run DDL. Use KV prefixed keys.
3. **Server directory**: All server code in `/supabase/functions/server/`. No subdirectories. No importing from outside.
4. **Server imports**: Use `npm:` or `jsr:` prefixes. Node builtins use `node:` prefix.
5. **Route prefix**: Every server route must start with `/make-server-f8b491be`.
6. **CORS**: Already configured open in `index.tsx`. All new routers just need `app.route('/', newRouter)`.
7. **Auth pattern**: `getUserId(c)` helper extracts user ID from Bearer token via Supabase Auth.
8. **Frontend requests**: Use `projectId` and `publicAnonKey` from `/utils/supabase/info.tsx`.
9. **No reactflow**: The app uses a custom SVG layout engine. Never import reactflow.
10. **File storage**: Use Supabase Storage with private buckets prefixed `make-f8b491be`.
11. **UI framework**: Tailwind CSS v4 + shadcn/ui components in `/components/ui/`.
12. **Routing**: React Router Data mode via `RouterProvider` in App.tsx, routes in `/routes.tsx`.

### 1.3 Key Files Reference

| Purpose | File(s) |
|---------|---------|
| Entry point | `/App.tsx` |
| Routes | `/routes.tsx` |
| Server entry | `/supabase/functions/server/index.tsx` |
| Graph types | `/types/workgraph.ts` |
| Project types | `/types/collaboration.ts` |
| Approval types | `/types/approvals.ts` |
| Timesheet types | `/types/timesheets.ts` |
| Graph builder UI | `/components/workgraph/WorkGraphBuilder.tsx` |
| Wizard | `/components/workgraph/ProjectCreateWizard.tsx` |
| Visibility engine | `/components/workgraph/graph-visibility.ts` |
| Graph generation | `/utils/graph/auto-generate.ts` |
| Persona switching | `/contexts/PersonaContext.tsx` |
| Timesheet store | `/contexts/TimesheetDataContext.tsx` |
| KV store (PROTECTED) | `/supabase/functions/server/kv_store.tsx` |

---

## 2. ARCHITECTURE CONSTRAINTS & ENVIRONMENT RULES

### 2.1 The KV-Only Database Rule

The Figma Make environment does not support DDL execution. You MUST use the existing `kv_store_f8b491be` table through the KV abstraction. The KV store provides:

```typescript
// Available functions from kv_store.tsx:
get(key: string): Promise<any>              // Single value
set(key: string, value: any): Promise<void> // Single write
del(key: string): Promise<void>             // Single delete
mget(...keys: string[]): Promise<any[]>     // Multi-get
mset(entries: [string, any][]): Promise<void> // Multi-write
mdel(...keys: string[]): Promise<void>      // Multi-delete
getByPrefix(prefix: string): Promise<any[]> // Prefix scan
```

**KV Schema Design Patterns:**

```
// Entity storage
entity:{entityId}              → Full entity JSON

// Index: user → entities
user-entities:{userId}         → string[] of entityIds

// Index: parent → children
parent-children:{parentId}     → string[] of childIds

// Index: lookup by field
entity-by-field:{fieldValue}   → entityId or string[]

// Counters/aggregates
counter:{entityType}:{scope}   → number

// Sorted sets (manual)
entity-sorted:{sortKey}:{id}   → entity JSON
```

**Important**: `getByPrefix` returns an array of values (not key-value pairs). If you need keys, store the key inside the value object.

### 2.2 Server Code Rules

```typescript
// CORRECT: Server file structure
// /supabase/functions/server/my-new-api.tsx

import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2";

const myRouter = new Hono();

// CORRECT: Route prefix
myRouter.get("/make-server-f8b491be/api/my-endpoint", async (c) => { ... });

// CORRECT: Auth check
async function getUserId(c: any): Promise<string | null> {
  const token = c.req.header("Authorization")?.split(" ")[1];
  if (!token) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

export { myRouter };
```

Then register in `/supabase/functions/server/index.tsx`:
```typescript
import { myRouter } from "./my-new-api.tsx";
app.route('/', myRouter);
```

### 2.3 Frontend API Client Pattern

```typescript
// /utils/api/my-api.ts
import { projectId, publicAnonKey } from '../supabase/info';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be`;

export async function getMyThing(id: string, token?: string): Promise<MyThing> {
  const res = await fetch(`${BASE}/api/my-endpoint/${id}`, {
    headers: {
      'Authorization': `Bearer ${token || publicAnonKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to get my thing: ${err.error}`);
  }
  const data = await res.json();
  return data.thing;
}
```

### 2.4 Component Creation Rules

- All components in `/components/` directory (subdirectories allowed)
- Use `.tsx` extension only
- Import UI primitives from `/components/ui/`
- Use `lucide-react` for icons
- Use `sonner@2.0.3` for toast notifications
- Use `date-fns` for date manipulation
- Never import reactflow or any package that re-exports it
- Images: use `ImageWithFallback` from `/src/app/components/figma/ImageWithFallback.tsx`

---

## 3. PHASE 3: LIVE COLLABORATION & REAL-TIME SYNC

### 3.0 Overview

Transform WorkGraph from single-user to multi-user real-time collaboration. Multiple users should be able to view and edit the same project graph simultaneously, see each other's cursors, and have changes propagate instantly.

**Duration estimate**: 15-20 implementation sessions
**Dependencies**: Phase 1 (Projects API), Phase 2 (Graph Engine)
**Risk**: Supabase Realtime channel limits in Figma Make environment

### 3.1 Milestone 3.1 — Realtime Channel Infrastructure

**Goal**: Establish Supabase Realtime channels for project-scoped collaboration.

**Files to create:**
- `/utils/realtime/channel-manager.ts` — Singleton managing Realtime channel lifecycle
- `/contexts/CollaborationContext.tsx` — React context for collaboration state
- `/types/collaboration-realtime.ts` — Types for realtime messages

**Implementation details:**

```typescript
// /types/collaboration-realtime.ts

export type RealtimeMessageType =
  | 'cursor_move'
  | 'node_select'
  | 'node_update'
  | 'node_create'
  | 'node_delete'
  | 'edge_create'
  | 'edge_delete'
  | 'graph_lock'
  | 'graph_unlock'
  | 'presence_join'
  | 'presence_leave';

export interface CursorPosition {
  userId: string;
  userName: string;
  avatarColor: string;
  x: number;       // SVG coordinate
  y: number;       // SVG coordinate
  nodeId?: string;  // If hovering over a node
  timestamp: number;
}

export interface CollaboratorPresence {
  userId: string;
  userName: string;
  avatarColor: string;
  activeNodeId?: string;
  lastSeen: number;
  role: string; // ProjectRole
}

export interface GraphOperation {
  id: string;          // UUID for idempotency
  type: RealtimeMessageType;
  userId: string;
  timestamp: number;
  payload: any;        // Specific to operation type
  version: number;     // Optimistic concurrency control
}
```

**Channel manager implementation:**

```typescript
// /utils/realtime/channel-manager.ts
// Use Supabase client's .channel() API
// Channel name: `project:${projectId}`
// Track presence with user metadata
// Broadcast cursor positions at 10Hz max (throttle)
// Queue operations for offline resilience
```

**Key design decisions:**
1. **One channel per project** — not per graph, since a project has one graph
2. **Presence via Supabase Realtime Presence** — tracks who's online
3. **Broadcast for ephemeral events** (cursors) — no persistence needed
4. **KV writes for durable changes** (node edits) — through existing APIs
5. **Optimistic updates** — apply locally, then confirm via server

**Steps:**
1. Create `collaboration-realtime.ts` types
2. Create `channel-manager.ts` with channel lifecycle (join, leave, subscribe)
3. Create `CollaborationContext.tsx` wrapping channel-manager
4. Add presence tracking (join/leave events)
5. Wire into `AppLayout.tsx` as a provider (only active on project routes)

### 3.2 Milestone 3.2 — Cursor Sharing & Presence Indicators

**Goal**: Show collaborator cursors and presence in the graph builder.

**Files to modify:**
- `/components/workgraph/WorkGraphBuilder.tsx` — Add cursor overlay rendering

**Files to create:**
- `/components/workgraph/CollaboratorCursors.tsx` — SVG cursor rendering
- `/components/workgraph/PresenceBar.tsx` — Avatar bar showing who's online

**Implementation details:**

The graph builder uses SVG for rendering. Collaborator cursors are SVG `<g>` elements overlaid on the graph canvas:

```tsx
// CollaboratorCursors.tsx — rendered inside the SVG
// For each collaborator, render:
// 1. A colored arrow cursor SVG at (x, y)
// 2. A name label below the cursor
// 3. Smooth animation using CSS transitions (not Motion — SVG compat)

interface CollaboratorCursorProps {
  cursors: CursorPosition[];
  viewTransform: { x: number; y: number; scale: number }; // Current pan/zoom
}

// Render as a <g> group inside the main SVG, after all nodes/edges
// Transform coordinates: screen → SVG space using inverse of viewTransform
```

**Presence bar:**
```tsx
// PresenceBar.tsx — fixed position bar above the graph
// Shows avatar circles with initials for each collaborator
// Color-coded to match cursor colors
// Tooltip shows full name and what they're looking at
// "3 people viewing" summary text
```

**Cursor throttling:**
- Capture `onMouseMove` on the SVG container
- Throttle to 100ms intervals (10 updates/second)
- Broadcast via Supabase Realtime channel
- Incoming cursors smoothed with CSS `transition: transform 100ms ease`

**Steps:**
1. Add `onMouseMove` handler to SVG in WorkGraphBuilder
2. Create CollaboratorCursors component
3. Create PresenceBar component
4. Integrate both into WorkGraphBuilder layout
5. Test with two browser tabs

### 3.3 Milestone 3.3 — Conflict-Free Graph Edits

**Goal**: Multiple users can edit the graph simultaneously without data loss.

**Strategy**: Last-Writer-Wins (LWW) with optimistic concurrency and conflict toast notifications.

**Files to create:**
- `/utils/realtime/operation-log.ts` — Operation history for undo support
- `/utils/realtime/conflict-resolver.ts` — Conflict detection and resolution

**Implementation details:**

Each graph edit generates a `GraphOperation` with a monotonic version counter. The server stores the current graph version in KV:

```
KV Schema additions:
  graph-version:{projectId}    → number (monotonic counter)
  graph-ops:{projectId}:{opId} → GraphOperation (for audit log)
```

**Conflict handling flow:**
1. User A edits node X → generates op with version N
2. User B edits node X → generates op with version N (same base)
3. Both send to server concurrently
4. Server processes op with version N, increments to N+1
5. Second op arrives with version N, but server is at N+1
6. Server applies LWW (latest timestamp wins) and returns conflict info
7. "Losing" user sees toast: "Sarah updated this node — your change was merged"

**Optimistic local updates:**
- Apply edit locally immediately
- Send to server
- If server rejects (conflict), roll back and apply server version
- Show toast notification

**Node-level locking (soft):**
- When user clicks a node to edit, broadcast `node_select` event
- Other users see a colored border indicating "being edited by Sarah"
- This is advisory only — not a hard lock
- Lock expires after 30 seconds of inactivity

**Steps:**
1. Add version counter to graph KV storage
2. Create operation-log.ts
3. Create conflict-resolver.ts
4. Modify graph save logic to include version checks
5. Add visual indicators for "being edited" nodes
6. Add conflict toast notifications

### 3.4 Milestone 3.4 — Comment Threads on Nodes

**Goal**: Users can leave comments on any node in the graph.

**Files to create:**
- `/components/workgraph/CommentThread.tsx` — Comment UI
- `/supabase/functions/server/comments-api.tsx` — Comments CRUD
- `/utils/api/comments-api.ts` — Frontend client

**KV Schema:**
```
comment:{commentId}              → Comment JSON
node-comments:{projectId}:{nodeId} → string[] of commentIds
project-comments:{projectId}     → string[] of commentIds (for feed)
```

**Comment data model:**
```typescript
interface GraphComment {
  id: string;
  projectId: string;
  nodeId: string;
  parentCommentId?: string; // For threaded replies
  authorId: string;
  authorName: string;
  body: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  mentions: string[];  // User IDs mentioned with @
}
```

**UI integration:**
- Small chat bubble icon on nodes that have comments
- Badge with count of unresolved comments
- Click to open comment thread in the NodeDetailDrawer
- New "Comments" tab in NodeDetailDrawer alongside existing tabs
- @-mention autocomplete from project members

**Steps:**
1. Create Comment type
2. Create server CRUD API
3. Create frontend API client
4. Add comment indicators to node rendering in WorkGraphBuilder
5. Add CommentThread component
6. Integrate into NodeDetailDrawer
7. Add comment count to project list view

### 3.5 Milestone 3.5 — Change Proposals

**Goal**: Non-owners can suggest graph changes that require approval before applying.

**Files to create:**
- `/components/workgraph/ChangeProposal.tsx` — Proposal review UI
- `/supabase/functions/server/proposals-api.tsx` — Proposals CRUD
- `/utils/api/proposals-api.ts` — Frontend client
- `/types/proposals.ts` — Types

**Data model:**
```typescript
interface ChangeProposal {
  id: string;
  projectId: string;
  authorId: string;
  authorName: string;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  operations: GraphOperation[]; // The proposed changes
  reviewerId?: string;
  reviewComment?: string;
  createdAt: string;
  reviewedAt?: string;
}
```

**KV Schema:**
```
proposal:{proposalId}            → ChangeProposal JSON
project-proposals:{projectId}    → string[] of proposalIds
```

**Workflow:**
1. Contributor edits graph → changes captured as operations
2. Instead of saving directly, creates a ChangeProposal
3. Owner/Editor sees proposal notification
4. Review UI shows "before" and "after" graph side-by-side
5. Owner approves → operations applied to graph
6. Owner rejects → changes discarded with comment

**Integration with ProjectRole permissions:**
- Owner, Editor: direct edit (no proposal needed)
- Contributor: changes create proposals
- Commenter: can only add comments
- Viewer: read-only

This leverages the existing `ProjectRole` type in `/types/collaboration.ts`.

**Steps:**
1. Create proposal types
2. Create server CRUD API
3. Create frontend client
4. Add proposal creation flow (intercept save for Contributors)
5. Create proposal review UI with diff view
6. Add proposal notifications
7. Wire into permission checks

---

## 4. PHASE 4: POLICY COMPILATION & ENFORCEMENT

### 4.0 Overview

The graph is currently a visual representation. This phase makes it executable — the graph topology compiles into policy objects that enforce approval chains, visibility rules, and billing flows at runtime.

**Duration estimate**: 12-15 sessions
**Dependencies**: Phase 2 (Graph Engine)
**Risk**: Policy complexity explosion with large graphs

### 4.1 Milestone 4.1 — Policy Compiler

**Goal**: Transform the visual graph into a deterministic set of `ApprovalPolicy` objects.

**Files to create:**
- `/utils/policy/compiler.ts` — Core compiler
- `/utils/policy/policy-types.ts` — Compiled policy types
- `/utils/policy/validator.ts` — Policy validation

**Files to modify:**
- `/components/workgraph/CompileModal.tsx` — Wire to real compiler

**Compiled policy data model:**
```typescript
// /utils/policy/policy-types.ts

export interface CompiledPolicy {
  id: string;
  projectId: string;
  version: number;
  compiledAt: string;
  compiledBy: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  status: 'draft' | 'active' | 'superseded' | 'archived';

  // The compiled rules
  approvalChains: ApprovalChainRule[];
  visibilityRules: VisibilityRule[];
  billingRoutes: BillingRoute[];
  rateCards: RateCard[];

  // Source graph snapshot (for audit)
  sourceGraphHash: string;
  sourceNodeCount: number;
  sourceEdgeCount: number;
}

export interface ApprovalChainRule {
  id: string;
  /** Which person's timesheets this rule governs */
  subjectPersonId: string;
  subjectPersonName: string;
  /** Ordered list of approval steps */
  steps: ApprovalStep[];
  /** Conditions for escalation */
  escalation?: EscalationPolicy;
}

export interface ApprovalStep {
  order: number;
  approverPartyId: string;
  approverPartyName: string;
  approverRole?: string;        // Specific role, or any person at party
  approverPersonId?: string;    // Specific person, if designated
  required: boolean;
  autoApproveConditions?: {
    maxHoursPerDay?: number;     // Auto-approve if <=8h/day
    maxHoursPerWeek?: number;    // Auto-approve if <=40h/week
    maxAmount?: number;          // Auto-approve if total <= amount
  };
  timeoutHours?: number;        // SLA: must act within N hours
  timeoutAction?: 'escalate' | 'auto_approve' | 'auto_reject';
}

export interface VisibilityRule {
  viewerPartyId: string;
  canSeeNodes: string[];
  canSeeEdges: string[];
  maskedFields: { nodeId: string; fields: string[] }[];
  canSeeRates: string[];       // Contract IDs where rates visible
}

export interface BillingRoute {
  fromPartyId: string;
  toPartyId: string;
  contractId: string;
  rateType: 'hourly' | 'daily' | 'fixed';
  rate: number;
  currency: string;
  markup?: number;             // Percentage markup over cost
}

export interface RateCard {
  personId: string;
  contractId: string;
  billRate: number;
  costRate: number;
  currency: string;
  effectiveFrom: string;
  effectiveUntil?: string;
}
```

**Compilation algorithm:**

```typescript
// /utils/policy/compiler.ts

export function compileGraph(
  nodes: BaseNode[],
  edges: BaseEdge[],
  projectId: string,
  compiledBy: string,
): CompiledPolicy {
  // Step 1: Build adjacency from edges
  // Step 2: Find all person nodes
  // Step 3: For each person, trace the approval chain:
  //   - Person belongs to Party A
  //   - Party A billsTo Party B (via 'billsTo' edges)
  //   - Party B billsTo Party C
  //   - Approval chain: A.approver → B.approver → C.approver
  // Step 4: For each party pair with a contract edge, extract billing route
  // Step 5: For each party, compute visibility using graph-visibility.ts
  // Step 6: Generate rate cards from contracts
  // Step 7: Hash source graph for audit trail
  // Step 8: Return CompiledPolicy
}
```

**Approval chain derivation algorithm:**

```
For person P at party X:
1. Find all 'billsTo' edges from X → [Y1, Y2, ...]
2. For each Yi, find the contract between X and Yi
3. The approval chain is: X.approver → Yi.approver
4. If Yi also billsTo [Z1, Z2, ...], extend: ... → Yi.approver → Zi.approver
5. Handle diamonds: if X billsTo both Y and Z, and both billsTo W,
   the chain forks: X → Y → W AND X → Z → W (parallel approval)
6. Handle skip-tier: if X billsTo Z directly, chain is: X → Z (skips Y)
```

**Validation rules:**
1. Every person must have at least one approval step
2. No cycles in approval chains
3. Every billing route must have a valid contract
4. Rate cards must not have overlapping effective dates
5. Warn if any party has no approver designated

**Steps:**
1. Create policy-types.ts
2. Implement compiler.ts with approval chain derivation
3. Implement validator.ts
4. Create server endpoint to store compiled policies in KV
5. Wire CompileModal.tsx to use real compiler
6. Add compilation status indicators to project workspace

### 4.2 Milestone 4.2 — Policy Versioning

**Goal**: Track policy versions with effective dates, support rollback.

**KV Schema:**
```
policy:{policyId}                    → CompiledPolicy JSON
project-policies:{projectId}         → string[] of policyIds (ordered by version)
active-policy:{projectId}            → policyId (currently active)
policy-history:{projectId}:{version} → CompiledPolicy JSON (immutable archive)
```

**Files to create:**
- `/supabase/functions/server/policies-api.tsx` — Policy CRUD + activation
- `/utils/api/policies-api.ts` — Frontend client

**Files to modify:**
- `/components/workgraph/PolicyVersionBadge.tsx` — Show active version
- `/components/workgraph/VersionHistoryDrawer.tsx` — Policy version history

**Version lifecycle:**
```
draft → active → superseded
              ↗
draft → active → superseded
              ↗
draft → active (current)
```

Only one policy active at a time per project. Activating a new version supersedes the previous.

**Effective dates:**
- `effectiveFrom`: when this policy starts governing behavior
- `effectiveUntil`: auto-set when superseded
- Future-dated policies: can schedule activation in advance
- Retroactive edits: not allowed (audit compliance)

**Steps:**
1. Create policies-api.tsx server endpoint
2. Create policies-api.ts frontend client
3. Implement version numbering (monotonic per project)
4. Add policy activation endpoint
5. Wire VersionHistoryDrawer to show policy versions
6. Add diff view between policy versions

### 4.3 Milestone 4.3 — Runtime Policy Enforcement

**Goal**: When a timesheet is submitted, the system enforces the active policy's approval chain.

**Files to modify:**
- `/supabase/functions/server/timesheets-api.tsx` — Add policy enforcement on submission
- `/supabase/functions/server/timesheet-approvals.ts` — Route approvals per policy
- `/contexts/TimesheetDataContext.tsx` — Update status tracking

**Enforcement flow:**

```
1. User submits timesheet for week X
2. Server loads active policy for the project
3. Server finds the ApprovalChainRule for this person
4. Server creates approval requests for Step 1 approvers
5. When Step 1 approves, server creates requests for Step 2
6. Continue until all steps complete or any step rejects
7. On final approval, lock the financial amounts
```

**Auto-approval rules:**
- If a step has `autoApproveConditions` and the timesheet meets them, auto-approve
- Log auto-approvals with reason: "Auto-approved: 40h/week within limit"
- Auto-approval is auditable (appears in approval history)

**SLA enforcement:**
- Each step can have a `timeoutHours`
- Background check (on each API call, check for expired SLAs)
- On timeout: execute `timeoutAction` (escalate, auto-approve, or auto-reject)
- Send notification to approver when SLA is 75% consumed

**Steps:**
1. Add policy lookup to timesheet submission endpoint
2. Create approval request generation from policy
3. Implement step-by-step approval progression
4. Add auto-approval logic
5. Add SLA timeout handling
6. Update TimesheetDataContext with richer status tracking
7. Add policy enforcement status to approval UI

### 4.4 Milestone 4.4 — Policy Simulator Enhancement

**Goal**: Enhance the existing PolicySimulator to use the real compiler.

**Files to modify:**
- `/components/workgraph/PolicySimulator.tsx` — Use real compiled policies
- `/components/workgraph/SimulatorInputForm.tsx` — Add scenario editor
- `/components/workgraph/SimulatorResults.tsx` — Show compiled results
- `/components/workgraph/SimulatorFlowVisualization.tsx` — Animate flows

**Simulation scenarios:**
1. "What if Sarah submits 45 hours?" → Show which steps auto-approve, which need manual
2. "What if we add a new agency?" → Re-compile and show diff
3. "What if we change the approval timeout?" → Show SLA impact
4. "What if an approver is on vacation?" → Show escalation path

**Steps:**
1. Wire PolicySimulator to real compiler
2. Add scenario presets
3. Add "What-if" graph editor (temporary modifications)
4. Show step-by-step approval flow animation
5. Show cost impact analysis

---

## 5. PHASE 5: INVOICE & BILLING ENGINE

### 5.0 Overview

Generate invoices from approved timesheets, following the billing routes defined by the graph. Each contract in the chain generates a separate invoice at the contracted rate.

**Duration estimate**: 15-18 sessions
**Dependencies**: Phase 4 (Policy Compilation for billing routes), Phase 1 (Timesheets API)
**Risk**: Multi-currency rounding, tax jurisdiction complexity

### 5.1 Milestone 5.1 — Invoice Data Model & API

**Files to create:**
- `/types/invoices.ts` — Invoice types
- `/supabase/functions/server/invoices-api.tsx` — Invoice CRUD
- `/utils/api/invoices-api.ts` — Frontend client

**Data model:**
```typescript
// /types/invoices.ts

export interface Invoice {
  id: string;
  invoiceNumber: string;         // Auto-generated: INV-2026-0001
  projectId: string;

  // Parties
  fromPartyId: string;           // Who's billing
  fromPartyName: string;
  toPartyId: string;             // Who's being billed
  toPartyName: string;
  contractId: string;            // Which contract governs this

  // Period
  periodStart: string;           // ISO date
  periodEnd: string;
  periodLabel: string;           // "March 2026"

  // Line items
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  currency: string;

  // Status
  status: InvoiceStatus;
  issuedAt?: string;
  dueDate?: string;
  paidAt?: string;

  // Approval
  approvedTimesheetIds: string[]; // Source data (immutable after creation)

  // Metadata
  notes?: string;
  paymentTerms?: string;         // "Net 30", "Net 60"
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'issued'
  | 'sent'
  | 'viewed'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'disputed'
  | 'cancelled'
  | 'written_off';

export interface InvoiceLineItem {
  id: string;
  description: string;
  personName: string;
  personId: string;
  hours: number;
  rate: number;
  amount: number;                // hours * rate
  timesheetWeekIds: string[];    // Traceability to source timesheets
  category?: string;             // 'Development', 'Meeting', etc.
}
```

**KV Schema:**
```
invoice:{invoiceId}               → Invoice JSON
project-invoices:{projectId}      → string[] of invoiceIds
party-invoices:{partyId}:sent     → string[] (invoices sent by this party)
party-invoices:{partyId}:received → string[] (invoices received by this party)
invoice-counter:{projectId}       → number (for sequential numbering)
```

**Steps:**
1. Create invoice types
2. Create server CRUD API with auto-numbering
3. Create frontend API client
4. Add invoice generation endpoint (from approved timesheets)

### 5.2 Milestone 5.2 — Invoice Generation Engine

**Goal**: Automatically generate invoices from approved timesheets along the billing routes.

**Files to create:**
- `/supabase/functions/server/invoice-generator.tsx` — Generation logic

**Generation algorithm:**

```
Input: projectId, periodStart, periodEnd
1. Load active policy → get billingRoutes
2. For each billingRoute (fromParty → toParty via contract):
   a. Find all approved timesheets for people at fromParty in the period
   b. Group by person
   c. For each person:
      - Look up rate from contract (or rate card)
      - Calculate: hours * rate = amount
      - Create InvoiceLineItem
   d. Sum all line items → subtotal
   e. Apply tax if configured
   f. Create Invoice in draft status
3. Return list of generated invoices
```

**Multi-tier billing example:**
```
Sarah (freelancer at DevShop) works 40 hours
DevShop bills TechStaff at $85/hr: Invoice A = $3,400
TechStaff bills MegaCorp at $120/hr: Invoice B = $4,800
Each is a separate invoice following the billsTo chain.
```

**Steps:**
1. Create invoice-generator.tsx
2. Add "Generate Invoices" button to project workspace
3. Handle edge cases: partial periods, multiple contracts per pair
4. Add invoice preview before generation

### 5.3 Milestone 5.3 — Invoice UI

**Files to create:**
- `/components/invoices/InvoiceListView.tsx` — List of invoices with filters
- `/components/invoices/InvoiceDetail.tsx` — Single invoice detail view
- `/components/invoices/InvoicePreview.tsx` — Print-ready preview
- `/components/invoices/InvoiceApprovalBar.tsx` — Approve/reject/dispute

**Files to modify:**
- `/routes.tsx` — Add `/app/invoices` route
- `/components/AppHeader.tsx` — Add Invoices nav item

**Invoice list features:**
- Filter by status, party, period
- Sort by date, amount, status
- Quick actions: approve, send, mark paid
- Batch operations: approve all, send all
- Summary cards: total outstanding, overdue, paid this month

**Invoice detail features:**
- Full invoice view with line items
- Drill-down: click line item → view source timesheets
- Status timeline (draft → issued → paid)
- Payment recording
- Dispute flow with comments

**Steps:**
1. Create InvoiceListView with filters
2. Create InvoiceDetail with line items
3. Create InvoicePreview (print layout)
4. Add to routes
5. Add nav item
6. Wire status transitions

### 5.4 Milestone 5.4 — Multi-Currency Support

**Files to create:**
- `/utils/currency/exchange-rates.ts` — Rate provider
- `/utils/currency/formatter.ts` — Currency formatting

**Implementation:**
- Store exchange rates in KV: `exchange-rate:{from}:{to}` → rate
- Allow manual rate override per project
- All amounts stored in source currency
- Display conversion for reporting
- Supported currencies: USD, EUR, GBP, CAD, AUD, CHF, JPY

**Steps:**
1. Create exchange rate storage
2. Create formatting utilities
3. Add currency selector to project settings
4. Add converted amounts to invoice preview

### 5.5 Milestone 5.5 — Payment Tracking

**Files to create:**
- `/types/payments.ts` — Payment types
- `/components/invoices/PaymentRecorder.tsx` — Record payment UI

**Data model:**
```typescript
interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  method: 'bank_transfer' | 'check' | 'credit_card' | 'wire' | 'other';
  reference: string;        // Check number, wire reference, etc.
  receivedAt: string;
  recordedBy: string;
  notes?: string;
}
```

**KV Schema:**
```
payment:{paymentId}          → Payment JSON
invoice-payments:{invoiceId} → string[] of paymentIds
```

**Features:**
- Record partial payments
- Auto-calculate remaining balance
- Mark invoice as paid when fully settled
- Payment history per invoice
- Overdue detection with aging buckets (0-30, 31-60, 61-90, 90+)

---

## 6. PHASE 6: DOCUMENT MANAGEMENT

### 6.0 Overview

Manage contracts, NDAs, SOWs, and other legal documents with versioning, e-signature tracking, and compliance monitoring.

**Duration estimate**: 10-12 sessions
**Dependencies**: Phase 1 (Contracts API), Supabase Storage
**Risk**: File size limits in Figma Make, e-signature integration complexity

### 6.1 Milestone 6.1 — Document Storage Infrastructure

**Files to create:**
- `/supabase/functions/server/documents-api.tsx` — Document CRUD with Supabase Storage
- `/utils/api/documents-api.ts` — Frontend client
- `/types/documents.ts` — Document types

**Supabase Storage setup:**
```typescript
// In documents-api.tsx, on startup:
const bucketName = 'make-f8b491be-documents';
const { data: buckets } = await supabase.storage.listBuckets();
const exists = buckets?.some(b => b.name === bucketName);
if (!exists) {
  await supabase.storage.createBucket(bucketName, { public: false });
}
```

**Data model:**
```typescript
interface Document {
  id: string;
  projectId: string;
  contractId?: string;        // If attached to a contract
  partyIds: string[];          // Which parties have access

  // Metadata
  name: string;
  type: DocumentType;
  mimeType: string;
  sizeBytes: number;

  // Versioning
  version: number;
  previousVersionId?: string;

  // Storage
  storagePath: string;         // Path in Supabase Storage bucket
  signedUrl?: string;          // Temporary signed URL (expires)

  // Signature tracking
  signatureStatus: 'not_required' | 'pending' | 'partially_signed' | 'fully_signed';
  signatories: Signatory[];

  // Compliance
  expiresAt?: string;
  complianceStatus: 'compliant' | 'expiring_soon' | 'expired' | 'missing';

  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

type DocumentType = 'nda' | 'msa' | 'sow' | 'po' | 'invoice' | 'contract' | 'amendment' | 'other';

interface Signatory {
  partyId: string;
  partyName: string;
  signerName: string;
  signerEmail: string;
  signedAt?: string;
  signatureMethod?: 'manual' | 'e_signature';
}
```

**KV Schema:**
```
document:{docId}                  → Document JSON (metadata only, file in Storage)
project-documents:{projectId}     → string[] of docIds
contract-documents:{contractId}   → string[] of docIds
```

**Steps:**
1. Create document types
2. Create documents-api.tsx with Storage integration
3. Implement upload endpoint (write to Storage, metadata to KV)
4. Implement download endpoint (generate signed URL)
5. Create frontend API client

### 6.2 Milestone 6.2 — Document UI

**Files to create:**
- `/components/documents/DocumentLibrary.tsx` — Document list with filters
- `/components/documents/DocumentUploader.tsx` — Upload dropzone
- `/components/documents/DocumentViewer.tsx` — In-app document preview
- `/components/documents/DocumentVersionHistory.tsx` — Version timeline

**Files to modify:**
- `/routes.tsx` — Add `/app/documents` route
- `/components/AppHeader.tsx` — Add Documents nav item
- `/components/workgraph/NodeDetailDrawer.tsx` — Add documents tab for contract nodes

**Steps:**
1. Create DocumentLibrary with grid/list toggle
2. Create DocumentUploader with drag-and-drop
3. Create DocumentViewer (PDF.js for PDFs, image preview for images)
4. Add document section to NodeDetailDrawer for contract nodes
5. Add to routes and nav

### 6.3 Milestone 6.3 — Template Library

**Files to create:**
- `/components/documents/TemplateLibrary.tsx` — Template browser
- `/utils/documents/template-engine.ts` — Variable substitution

**Template system:**
- Pre-built templates for NDA, MSA, SOW with variable placeholders
- Variables auto-filled from project/party data: `{{company_name}}`, `{{contractor_name}}`, etc.
- Generate document from template as PDF (using server-side rendering)
- Store generated documents in Storage

**Templates to include:**
1. Mutual NDA
2. Master Service Agreement
3. Statement of Work
4. Independent Contractor Agreement
5. Change Order

### 6.4 Milestone 6.4 — Compliance Dashboard

**Files to create:**
- `/components/documents/ComplianceDashboard.tsx` — Compliance overview

**Features:**
- Document status matrix: project × document type → status
- Expiration warnings (30/60/90 days)
- Missing document alerts
- Compliance score per project
- Bulk renewal reminders

---

## 7. PHASE 7: ANALYTICS & REPORTING

### 7.0 Overview

Comprehensive analytics covering utilization, financial performance, project health, and custom report generation.

**Duration estimate**: 12-15 sessions
**Dependencies**: Phase 1 (Timesheets), Phase 5 (Invoices)
**Risk**: Performance with large datasets in KV store

### 7.1 Milestone 7.1 — Analytics Data Aggregation

**Files to create:**
- `/supabase/functions/server/analytics-api.tsx` — Analytics computation endpoints
- `/utils/api/analytics-api.ts` — Frontend client
- `/types/analytics.ts` — Analytics types

**Aggregation strategy:**
Since we use KV store, pre-compute aggregates on write and cache them:

```
KV Schema:
analytics:utilization:{projectId}:{month}   → UtilizationData
analytics:financial:{projectId}:{month}     → FinancialData
analytics:person:{personId}:{month}         → PersonAnalytics
analytics:project-summary:{projectId}       → ProjectSummary (rolling)
```

**Data models:**
```typescript
interface UtilizationData {
  projectId: string;
  month: string;            // '2026-03'
  people: PersonUtilization[];
  avgUtilization: number;   // Percentage
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
}

interface PersonUtilization {
  personId: string;
  personName: string;
  partyName: string;
  totalHours: number;
  billableHours: number;
  targetHours: number;      // Based on work week config
  utilization: number;      // billableHours / targetHours * 100
}

interface FinancialData {
  projectId: string;
  month: string;
  revenue: number;          // From invoices issued
  cost: number;             // From timesheets at cost rate
  margin: number;           // revenue - cost
  marginPercent: number;
  invoiced: number;
  collected: number;
  outstanding: number;
  byParty: PartyFinancials[];
}

interface ProjectSummary {
  projectId: string;
  totalHours: number;
  totalBilled: number;
  totalPaid: number;
  avgUtilization: number;
  activeContractors: number;
  burnRate: number;          // $ per month
  projectedCompletion?: string;
  healthScore: number;       // 0-100
}
```

**Steps:**
1. Create analytics types
2. Create analytics-api.tsx with aggregation endpoints
3. Add aggregate computation triggers (on timesheet approval, invoice payment)
4. Create frontend API client

### 7.2 Milestone 7.2 — Dashboard Widgets

**Files to modify:**
- `/components/dashboard/DashboardPage.tsx` — Add analytics widgets
- `/components/dashboard/EarningsChart.tsx` — Wire to real data

**Files to create:**
- `/components/analytics/UtilizationChart.tsx` — Bar chart using recharts
- `/components/analytics/RevenueChart.tsx` — Line chart
- `/components/analytics/MarginAnalysis.tsx` — Stacked bar chart
- `/components/analytics/BurndownChart.tsx` — Budget burndown
- `/components/analytics/HealthScoreCard.tsx` — Project health indicator

**Chart library**: Use `recharts` for all charts.

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
```

**Steps:**
1. Create each chart component with mock data
2. Wire to analytics API
3. Add to DashboardPage
4. Add date range selector
5. Add project filter

### 7.3 Milestone 7.3 — Report Builder

**Files to create:**
- `/components/analytics/ReportBuilder.tsx` — Custom report configuration
- `/components/analytics/ReportViewer.tsx` — Report display
- `/utils/analytics/report-engine.ts` — Report generation

**Report types:**
1. Utilization Report (by person, by project, by party)
2. Financial Summary (revenue, cost, margin)
3. Timesheet Audit (all entries for a period)
4. Invoice Aging (outstanding invoices by age bucket)
5. Contractor Performance (hours, approval rate, on-time submission)
6. Custom: user picks dimensions, measures, filters

**Export formats:**
- PDF (using browser print API)
- CSV (client-side generation)
- JSON (raw data dump)

**Steps:**
1. Create report type selector
2. Create dimension/measure picker
3. Create filter configuration
4. Implement report-engine.ts
5. Create ReportViewer with tables and charts
6. Add export functionality

### 7.4 Milestone 7.4 — Budget vs. Actual

**Files to create:**
- `/components/analytics/BudgetTracker.tsx` — Budget tracking dashboard

**Features:**
- Set budget per project or per contract
- Track actual spend against budget
- Variance analysis (over/under budget by %)
- Forecasting: project remaining based on burn rate
- Alerts: 80%, 90%, 100% budget consumption
- Budget breakdown by category, person, month

---

## 8. PHASE 8: SOCIAL NETWORK FEATURES

### 8.0 Overview

Transform the existing social scaffolding (FeedHome, ProfilePage, etc.) into a real professional social network for freelancers and companies.

**Duration estimate**: 15-18 sessions
**Dependencies**: Phase 9 (Production Auth) recommended but not required
**Risk**: Content moderation, spam prevention

### 8.1 Milestone 8.1 — Social Post System

**Files to create:**
- `/supabase/functions/server/social-api.tsx` — Social CRUD
- `/utils/api/social-api.ts` — Frontend client
- `/types/social.ts` — Social types

**Files to modify:**
- `/components/FeedHome.tsx` — Wire to real data
- `/components/social/PostCard.tsx` — Wire to real data
- `/components/social/ProfileCard.tsx` — Wire to real data

**Data model:**
```typescript
interface SocialPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorTitle?: string;
  authorCompany?: string;

  content: string;            // Markdown
  type: 'update' | 'article' | 'question' | 'job_posting' | 'milestone' | 'endorsement';

  // Media
  images?: string[];          // Storage signed URLs
  links?: LinkPreview[];

  // Engagement
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;

  // Targeting
  visibility: 'public' | 'connections' | 'company';
  tags: string[];             // Skills, topics

  createdAt: string;
  updatedAt: string;
}

interface SocialComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  parentCommentId?: string;   // Threading
  likeCount: number;
  createdAt: string;
}

interface Connection {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  connectedAt?: string;
  relationship?: 'colleague' | 'client' | 'vendor' | 'mentor' | 'other';
}
```

**KV Schema:**
```
post:{postId}                    → SocialPost JSON
user-posts:{userId}              → string[] of postIds
feed:{userId}:{timestamp}        → postId (for chronological feed)
post-comments:{postId}           → string[] of commentIds
comment:{commentId}              → SocialComment JSON
post-likes:{postId}              → string[] of userIds
connection:{fromUser}:{toUser}   → Connection JSON
user-connections:{userId}        → string[] of connected userIds
```

**Feed generation strategy:**
- Fan-out-on-write: when user posts, add to followers' feeds
- For MVP: simple reverse-chronological feed
- Future: algorithmic ranking based on engagement and relevance

**Steps:**
1. Create social types
2. Create social-api.tsx with post CRUD, like, comment
3. Create frontend API client
4. Wire FeedHome to real data
5. Wire PostCard to real data
6. Add post creation form
7. Add like/comment interactions
8. Add connection management

### 8.2 Milestone 8.2 — Skill-Based Matching

**Files to create:**
- `/components/social/SkillMatcher.tsx` — Skill matching UI
- `/supabase/functions/server/matching-api.tsx` — Matching engine
- `/utils/api/matching-api.ts` — Frontend client

**Data model:**
```typescript
interface UserSkillProfile {
  userId: string;
  skills: Skill[];
  availability: AvailabilityStatus;
  preferredRate?: { min: number; max: number; currency: string };
  preferredWorkType: ('remote' | 'hybrid' | 'onsite')[];
  location?: string;
  timezone?: string;
}

interface Skill {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsOfExperience: number;
  endorsed: boolean;         // Whether endorsed by connections
  endorsementCount: number;
}

type AvailabilityStatus = 'available' | 'available_soon' | 'open_to_offers' | 'not_available';
```

**Matching algorithm:**
1. Score = skill overlap * level match * availability * rate match
2. Weight by recency of endorsements
3. Filter by work type and location preferences
4. Return top N matches with match percentage

**Steps:**
1. Create skill profile editor in SettingsPage
2. Create matching engine on server
3. Create SkillMatcher UI with filters
4. Add "Find Talent" section to dashboard
5. Add skill badges to profile cards

### 8.3 Milestone 8.3 — Reputation System

**Files to create:**
- `/components/social/ReputationBadge.tsx` — Reputation display
- `/utils/social/reputation-calculator.ts` — Score calculation

**Reputation factors:**
- Projects completed (from approved timesheets)
- On-time submission rate
- Approval rate (first-time vs. revision needed)
- Endorsements received
- Social engagement (helpful answers, quality posts)
- Tenure on platform

**Score display:**
- Numeric score (0-1000)
- Level badges: Bronze (0-200), Silver (201-500), Gold (501-800), Platinum (801+)
- Breakdown visible on profile

### 8.4 Milestone 8.4 — Company Directory

**Files to create:**
- `/components/social/CompanyDirectory.tsx` — Searchable company listing
- `/components/social/CompanyCard.tsx` — Company summary card

**Features:**
- Search by name, industry, location, skills needed
- Company profiles with team size, active projects, reviews
- "Open positions" section
- Industry categorization
- Verification badges

**Steps:**
1. Add company profile data model
2. Create search endpoint with filters
3. Create CompanyDirectory page
4. Create CompanyCard component
5. Add to routes

---

## 9. PHASE 9: PRODUCTION AUTH & IDENTITY

### 9.0 Overview

Replace the `PersonaContext` testing harness with real auth-based permissions. This is the most critical phase for production readiness — every permission check currently uses `PersonaContext.persona.role` which must transition to real user identity.

**Duration estimate**: 12-15 sessions
**Dependencies**: None (but needed before production launch)
**Risk**: High — touches every component that checks permissions

### 9.1 Milestone 9.1 — Auth System Upgrade

**Current state:**
- `/contexts/PersonaContext.tsx` provides `TEST_PERSONAS` with hardcoded users
- Components call `usePersona()` to get `persona.role`, `persona.id`, etc.
- `WorkGraphBuilder.tsx` uses `persona.graphViewerType` and `persona.graphOrgId` for visibility
- This is explicitly labeled "TEST MODE ONLY" in the source

**Migration plan:**

```typescript
// NEW: /contexts/IdentityContext.tsx
// Replaces PersonaContext with real auth-backed identity

interface UserIdentity {
  id: string;              // Supabase Auth user ID
  email: string;
  name: string;
  avatarUrl?: string;

  // Organization memberships (replaces hardcoded graphOrgId)
  organizations: OrgMembership[];
  activeOrganizationId?: string;

  // Graph-derived role (computed from graph position, not hardcoded)
  graphRole?: ViewerType;   // From graph-visibility.ts
  graphNodeId?: string;     // Which node they ARE in the graph
}

interface OrgMembership {
  orgId: string;
  orgName: string;
  role: 'owner' | 'admin' | 'member';
  partyType: PartyType;
}
```

**Steps:**
1. Create IdentityContext with real auth integration
2. Create user profile API (store profile in KV: `user-profile:{userId}`)
3. Create organization membership API
4. Create migration path: PersonaContext → IdentityContext
5. Keep PersonaContext as optional dev-mode override (behind feature flag)

### 9.2 Milestone 9.2 — Permission Migration

**Goal**: Replace every `usePersona()` call with `useIdentity()` or graph-derived permissions.

**Files requiring migration (comprehensive list):**

| File | What it uses | Migration approach |
|------|-------------|-------------------|
| `WorkGraphBuilder.tsx` | `persona.graphViewerType`, `graphOrgId` | Look up user's node in graph via org membership |
| `ProjectWorkspace.tsx` | `persona.role` | Check ProjectMember role for this project |
| `TimesheetDataContext.tsx` | `persona.id` | Use auth userId |
| `AppHeader.tsx` | `persona.name`, `persona.role` | Use IdentityContext |
| `NodeDetailDrawer.tsx` | persona for edit permissions | Check graph visibility |
| `ProjectCreateWizard.tsx` | persona for party defaults | Use org membership |
| `CompanyPrivateWorkspace.tsx` | persona for company access | Check org membership |
| Various timesheet components | persona for approval rights | Use policy-derived permissions |
| Various approval components | persona for approval UI | Use policy-derived permissions |

**Migration strategy:**
1. Create `useIdentity()` hook with same interface shape as `usePersona()`
2. Add compatibility layer: if `PersonaContext` is in dev mode, use it; otherwise use IdentityContext
3. Migrate components one by one, testing each
4. After all migrated, remove PersonaContext (or keep for dev only)

**Steps:**
1. Create IdentityContext
2. Create useIdentity hook with compat layer
3. Migrate AppHeader and AppLayout (low risk)
4. Migrate WorkGraphBuilder (high complexity)
5. Migrate timesheet components
6. Migrate approval components
7. Remove PersonaContext from production build

### 9.3 Milestone 9.3 — OAuth Providers

**Goal**: Add Google and GitHub social login.

**Implementation:**
```typescript
// Frontend: /contexts/AuthContext.tsx
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/app`,
  },
});
```

**CRITICAL**: User must configure OAuth provider in Supabase dashboard following:
- Google: https://supabase.com/docs/guides/auth/social-login/auth-google
- GitHub: https://supabase.com/docs/guides/auth/social-login/auth-github

**Steps:**
1. Add OAuth buttons to AuthModal
2. Handle OAuth callback redirect
3. Create/update user profile on first login
4. Test with both providers
5. Add provider icons and "Continue with..." buttons

### 9.4 Milestone 9.4 — Organization Invitations

**Files to create:**
- `/supabase/functions/server/invitations-api.tsx` — Invitation CRUD
- `/utils/api/invitations-api.ts` — Frontend client
- `/components/organizations/InviteModal.tsx` — Invitation UI

**Data model:**
```typescript
interface Invitation {
  id: string;
  orgId: string;
  orgName: string;
  invitedEmail: string;
  invitedBy: string;
  role: 'admin' | 'member';
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  token: string;            // Unique token for acceptance link
  expiresAt: string;
  createdAt: string;
}
```

**KV Schema:**
```
invitation:{invitationId}        → Invitation JSON
org-invitations:{orgId}          → string[] of invitationIds
user-invitations:{email}         → string[] of invitationIds
invitation-token:{token}         → invitationId (lookup by token)
```

**Flow:**
1. Org admin enters email → creates invitation
2. System sends email with acceptance link (using existing email infrastructure)
3. User clicks link → redirected to signup/login
4. After auth, invitation auto-accepted → user added to org
5. User appears in org member list

### 9.5 Milestone 9.5 — Graph-Based Permission Resolution

**Goal**: Derive a user's permissions entirely from their position in the project's graph.

**Implementation:**
```typescript
// /utils/permissions/graph-permissions.ts

export function resolvePermissions(
  userId: string,
  projectId: string,
  graph: { nodes: BaseNode[], edges: BaseEdge[] },
  policy: CompiledPolicy,
): UserPermissions {
  // 1. Find user's node in the graph (person node with matching userId)
  // 2. Find which party they belong to
  // 3. Determine party type (client, agency, company, freelancer)
  // 4. Look up visibility rules from policy
  // 5. Look up approval capabilities from policy
  // 6. Combine with project membership role (Owner/Editor/etc.)
  // Return merged permissions
}

interface UserPermissions {
  canEditGraph: boolean;
  canSubmitTimesheets: boolean;
  canApproveTimesheets: boolean;
  canViewRates: string[];      // Which contracts' rates they can see
  canViewPeople: string[];     // Which people they can see
  canCreateInvoices: boolean;
  canManageContracts: boolean;
  visibilityScope: ScopedGraphView;
}
```

---

## 10. PHASE 10: ADVANCED GRAPH FEATURES

### 10.0 Overview

Enhance the graph editing experience with drag-and-drop, undo/redo, diffing, templates marketplace, and AI-suggested structures.

**Duration estimate**: 15-18 sessions
**Dependencies**: Phase 2 (Graph Engine)
**Risk**: SVG drag-and-drop complexity, undo/redo state management

### 10.1 Milestone 10.1 — Drag-and-Drop Node Positioning

**Current state**: Nodes are positioned by the Sugiyama layout algorithm. Users cannot manually reposition them.

**Goal**: Allow users to drag nodes to custom positions while maintaining edge connections.

**Files to modify:**
- `/components/workgraph/WorkGraphBuilder.tsx` — Add drag handlers to SVG node groups

**Implementation approach:**

The graph renders nodes as SVG `<g>` elements inside a main `<svg>`. Add mouse event handlers:

```typescript
// In WorkGraphBuilder.tsx, for each node's <g> element:
onMouseDown={(e) => startDrag(node.id, e)}
onMouseMove={(e) => onDrag(e)}
onMouseUp={(e) => endDrag(e)}

// State:
const [dragState, setDragState] = useState<{
  nodeId: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
} | null>(null);

// On drag:
// 1. Calculate new position in SVG coordinates (accounting for pan/zoom)
// 2. Update node position in local state
// 3. Re-render edges connected to this node
// 4. On drop: persist new position
```

**Important considerations:**
- Must account for current pan/zoom transform
- Edges must update in real-time during drag (recalculate path)
- Snap-to-grid option (configurable grid size)
- "Reset layout" button to re-run Sugiyama algorithm
- Store custom positions: `node-positions:{projectId}` → `{ [nodeId]: {x, y} }`
- If custom positions exist, use them instead of auto-layout

**Steps:**
1. Add drag event handlers to node SVG elements
2. Implement coordinate transform (screen → SVG space)
3. Update edge paths during drag
4. Add snap-to-grid
5. Persist custom positions
6. Add "Reset layout" button
7. Handle drag in collaboration mode (broadcast drag events)

### 10.2 Milestone 10.2 — Edge Editing

**Goal**: Click to add or remove edges between nodes.

**Files to modify:**
- `/components/workgraph/WorkGraphBuilder.tsx` — Add edge creation mode

**Implementation:**

Two modes:
1. **Add edge mode**: Click source node, then click target node → create edge
2. **Delete edge mode**: Click existing edge → show delete confirmation

```typescript
type EditMode = 'select' | 'add_edge' | 'delete_edge' | 'add_node';

// Visual feedback:
// - In add_edge mode, hovering over nodes shows green highlight
// - After clicking source, a temporary edge follows the cursor
// - Valid targets highlighted green, invalid (would create cycle) highlighted red
// - Cycle detection: run DFS from target to see if source is reachable
```

**Edge type selection:**
- After connecting two nodes, show a popover to select edge type
- The existing `EdgeConfigPopover.tsx` can be extended for this
- Edge types: 'approves', 'owns', 'funds', 'assigns', 'billsTo', etc.

**Steps:**
1. Add edit mode toggle to toolbar
2. Implement source node selection
3. Implement temporary edge rendering (follows cursor)
4. Implement cycle detection
5. Implement target node selection and edge creation
6. Add edge deletion with confirmation
7. Wire EdgeConfigPopover for type selection

### 10.3 Milestone 10.3 — Undo/Redo

**Goal**: Full undo/redo support for all graph edits.

**Files to create:**
- `/utils/graph/undo-manager.ts` — Command pattern undo/redo stack

**Implementation:**

```typescript
interface GraphCommand {
  id: string;
  type: 'add_node' | 'delete_node' | 'update_node' | 'add_edge' | 'delete_edge' | 'move_node';
  timestamp: number;
  // For undo:
  previousState: any;  // State before this command
  // For redo:
  nextState: any;      // State after this command
}

class UndoManager {
  private undoStack: GraphCommand[] = [];
  private redoStack: GraphCommand[] = [];
  private maxHistory = 50;

  execute(command: GraphCommand) { ... }
  undo(): GraphCommand | null { ... }
  redo(): GraphCommand | null { ... }
  canUndo(): boolean { ... }
  canRedo(): boolean { ... }
}
```

**Keyboard shortcuts:**
- `Ctrl+Z` / `Cmd+Z`: Undo
- `Ctrl+Shift+Z` / `Cmd+Shift+Z`: Redo
- `Ctrl+Y` / `Cmd+Y`: Redo (alternative)

**Steps:**
1. Create UndoManager class
2. Wrap all graph mutations to generate commands
3. Add keyboard shortcut listeners
4. Add undo/redo buttons to toolbar
5. Show undo/redo stack in a dropdown (optional)
6. Handle collaboration: undo only own operations

### 10.4 Milestone 10.4 — Graph Diffing

**Goal**: Compare two graph versions side-by-side with visual diff highlighting.

**Files to create:**
- `/components/workgraph/GraphDiff.tsx` — Side-by-side diff view
- `/utils/graph/graph-differ.ts` — Diff computation

**Diff algorithm:**
```typescript
interface GraphDiff {
  addedNodes: BaseNode[];
  removedNodes: BaseNode[];
  modifiedNodes: { before: BaseNode; after: BaseNode; changedFields: string[] }[];
  addedEdges: BaseEdge[];
  removedEdges: BaseEdge[];
  modifiedEdges: { before: BaseEdge; after: BaseEdge; changedFields: string[] }[];
}

function computeGraphDiff(before: GraphSnapshot, after: GraphSnapshot): GraphDiff {
  // Match nodes by ID
  // Compare data fields for modifications
  // Identify additions and removals
}
```

**Visual rendering:**
- Green nodes/edges: added
- Red nodes/edges: removed
- Yellow nodes/edges: modified (with field-level diff tooltip)
- Gray: unchanged
- Side-by-side layout: before on left, after on right
- Linked scrolling and zoom

### 10.5 Milestone 10.5 — Templates Marketplace

**Goal**: Expand beyond hardcoded templates to a shareable templates system.

**Files to modify:**
- `/components/workgraph/TemplateLoader.tsx` — Browse and load templates
- `/components/workgraph/templates.ts` — Template data structure

**Files to create:**
- `/components/workgraph/TemplateCreator.tsx` — Save current graph as template
- `/supabase/functions/server/templates-api.tsx` — Template CRUD

**Data model:**
```typescript
interface GraphTemplate {
  id: string;
  name: string;
  description: string;
  category: 'consulting' | 'staffing' | 'freelance' | 'enterprise' | 'custom';
  tags: string[];
  authorId: string;
  authorName: string;
  isPublic: boolean;
  useCount: number;
  rating: number;
  nodes: BaseNode[];     // Template nodes (IDs will be regenerated on use)
  edges: BaseEdge[];
  partyCount: number;
  personCount: number;
  contractCount: number;
  thumbnail?: string;    // SVG snapshot
  createdAt: string;
}
```

**Steps:**
1. Create template save flow (strip real IDs, generalize names)
2. Create templates API for community sharing
3. Create TemplateCreator component
4. Enhance TemplateLoader with search, categories, ratings
5. Add "Save as Template" button to graph builder

### 10.6 Milestone 10.6 — AI-Suggested Structures

**Goal**: AI recommends graph structures based on project description.

**Files to create:**
- `/components/workgraph/AIStructureSuggestor.tsx` — AI suggestion UI
- `/supabase/functions/server/ai-suggest-api.tsx` — AI endpoint

**Implementation:**
- Use an LLM API (OpenAI, Anthropic, etc.) to analyze project description
- Generate suggested party structure, connections, and contract types
- Present as a template that user can accept/modify

**Prompt engineering:**
```
Given a project description, suggest a supply chain structure:
- Identify parties (freelancers, companies, agencies, clients)
- Suggest billing relationships (who bills whom)
- Suggest contract types (hourly, fixed, daily)
- Suggest approval chain

Project: "{description}"
Industry: "{industry}"
Budget range: "{budget}"

Output JSON matching the PartyEntry[] interface.
```

**Steps:**
1. Create AI suggestion endpoint (requires API key via create_supabase_secret)
2. Create suggestion UI with editable preview
3. Add "AI Suggest" button to ProjectCreateWizard
4. Handle API key configuration

---

## 11. PHASE 11: MOBILE & PUBLIC API

### 11.0 Overview

Make the app responsive for mobile use and expose a public API for integrations.

**Duration estimate**: 12-15 sessions
**Dependencies**: Phase 9 (Auth for API keys)
**Risk**: SVG graph rendering on small screens

### 11.1 Milestone 11.1 — Responsive Graph Viewer

**Goal**: Make the graph viewable (read-only) on mobile screens.

**Files to modify:**
- `/components/workgraph/WorkGraphBuilder.tsx` — Responsive breakpoints

**Mobile adaptations:**
- Below 768px: switch from full graph to a list/tree view
- Touch gestures: pinch-to-zoom, pan with one finger
- Tap node to open detail drawer (full screen on mobile)
- Simplified node rendering (less detail, larger tap targets)

**Implementation:**
```typescript
// Use existing useIsMobile from /components/ui/use-mobile.ts
const isMobile = useIsMobile();

// If mobile, render <GraphTreeView> instead of SVG canvas
// GraphTreeView: indented tree list showing party → person → contract hierarchy
```

**Files to create:**
- `/components/workgraph/GraphTreeView.tsx` — Mobile tree view of graph

**Steps:**
1. Create GraphTreeView component
2. Add mobile detection to WorkGraphBuilder
3. Implement touch gesture handlers for SVG (pinch/pan)
4. Test on various screen sizes
5. Add responsive breakpoints to all layouts

### 11.2 Milestone 11.2 — Mobile Timesheet Entry

**Goal**: Optimize timesheet entry for mobile use.

**Files to modify:**
- `/components/timesheets/TimesheetModule.tsx` — Responsive layout
- `/components/timesheets/EnhancedTimesheetCalendar.tsx` — Mobile calendar

**Mobile optimizations:**
- Day-by-day entry mode (swipe between days)
- Large number input with +/- buttons
- Quick entry: "8h" → tap to log full day
- Voice input for notes (browser speech API)
- Swipe to submit week

**Steps:**
1. Add responsive breakpoints to timesheet components
2. Create mobile day-entry card
3. Add swipe navigation between days
4. Optimize touch targets (min 44px)
5. Add quick-entry shortcuts

### 11.3 Milestone 11.3 — Push Notifications

**Goal**: Real-time push notifications for approval requests, comments, etc.

**Implementation approach**: Use browser Push API (no native app needed).

**Files to create:**
- `/utils/notifications/push-manager.ts` — Push subscription management
- `/supabase/functions/server/push-api.tsx` — Push sending endpoint

**Notification types:**
- Timesheet needs approval
- Timesheet approved/rejected
- New comment on your node
- Change proposal submitted/reviewed
- Invoice generated/paid
- SLA warning (approval timeout approaching)

**Steps:**
1. Create push subscription management
2. Create push sending endpoint using Web Push API
3. Add notification permission request UI
4. Wire notification triggers to push
5. Add notification preferences (which types to receive)

### 11.4 Milestone 11.4 — Public REST API

**Goal**: Expose API for external integrations.

**Files to create:**
- `/supabase/functions/server/public-api.tsx` — Public API routes
- `/supabase/functions/server/api-keys.tsx` — API key management

**API key model:**
```typescript
interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyHash: string;        // SHA-256 hash (never store raw key)
  prefix: string;         // First 8 chars for identification: "wg_live_"
  permissions: string[];  // ['read:timesheets', 'write:timesheets', etc.]
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
}
```

**API endpoints (all require API key auth):**
```
GET    /api/v1/projects
GET    /api/v1/projects/:id
GET    /api/v1/projects/:id/timesheets
POST   /api/v1/projects/:id/timesheets
GET    /api/v1/projects/:id/invoices
GET    /api/v1/projects/:id/graph
GET    /api/v1/me
```

**Rate limiting**: Track API calls per key in KV, enforce limits.

**Steps:**
1. Create API key generation and management
2. Create API key auth middleware
3. Create public API routes
4. Add rate limiting
5. Create API key management UI in Settings

### 11.5 Milestone 11.5 — Webhook System

**Goal**: Allow external systems to receive events from WorkGraph.

**Files to create:**
- `/supabase/functions/server/webhooks-api.tsx` — Webhook management
- `/supabase/functions/server/webhook-sender.tsx` — Event dispatch

**Data model:**
```typescript
interface Webhook {
  id: string;
  userId: string;
  url: string;
  events: WebhookEvent[];
  secret: string;           // For HMAC signature verification
  active: boolean;
  lastTriggeredAt?: string;
  failureCount: number;
  createdAt: string;
}

type WebhookEvent =
  | 'timesheet.submitted'
  | 'timesheet.approved'
  | 'timesheet.rejected'
  | 'invoice.created'
  | 'invoice.paid'
  | 'project.created'
  | 'contract.signed'
  | 'graph.updated';
```

**Delivery:**
- POST to webhook URL with JSON payload
- HMAC-SHA256 signature in `X-WorkGraph-Signature` header
- Retry 3 times with exponential backoff (1s, 10s, 60s)
- Disable webhook after 10 consecutive failures

---

## 12. PHASE 12: ENTERPRISE FEATURES

### 12.0 Overview

Enterprise-grade security, compliance, and customization features.

**Duration estimate**: 15-20 sessions
**Dependencies**: Phase 9 (Auth)
**Risk**: SSO complexity, compliance certification costs

### 12.1 Milestone 12.1 — SSO (SAML/OIDC)

**Goal**: Enterprise customers can use their own identity provider.

**Implementation**: Leverage Supabase Auth's SSO support.

```typescript
// Supabase supports SAML SSO natively
// Configuration is done in the Supabase dashboard
// Frontend just needs to redirect to the SSO provider

const { data, error } = await supabase.auth.signInWithSSO({
  domain: 'enterprise-customer.com',
});
if (data.url) {
  window.location.href = data.url;
}
```

**Files to create:**
- `/components/auth/SSOLoginForm.tsx` — SSO login with domain input
- `/supabase/functions/server/sso-config-api.tsx` — SSO configuration management

**Steps:**
1. Create SSO login form with domain input
2. Add SSO configuration management for admins
3. Handle SSO callback and user provisioning
4. Add "Sign in with SSO" option to AuthModal
5. Test with a SAML IdP (Okta, Azure AD, etc.)

### 12.2 Milestone 12.2 — Audit Logs

**Goal**: Comprehensive audit trail of all actions for compliance.

**Files to create:**
- `/supabase/functions/server/audit-api.tsx` — Audit log API
- `/components/admin/AuditLogViewer.tsx` — Audit log UI
- `/types/audit.ts` — Audit types

**Data model:**
```typescript
interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: AuditAction;
  resourceType: 'project' | 'timesheet' | 'invoice' | 'contract' | 'graph' | 'user' | 'policy';
  resourceId: string;
  resourceName: string;
  details: Record<string, any>;  // Action-specific details
  ipAddress?: string;
  userAgent?: string;
  projectId?: string;
  orgId?: string;
}

type AuditAction =
  | 'create' | 'update' | 'delete'
  | 'login' | 'logout'
  | 'submit' | 'approve' | 'reject'
  | 'invite' | 'revoke'
  | 'export' | 'download'
  | 'policy_compile' | 'policy_activate';
```

**KV Schema:**
```
audit:{auditId}                          → AuditLogEntry JSON
audit-project:{projectId}:{timestamp}    → auditId
audit-user:{userId}:{timestamp}          → auditId
audit-org:{orgId}:{timestamp}            → auditId
```

**Implementation:**
- Create `logAudit()` helper function used by all API endpoints
- Every state-changing API call generates an audit entry
- Audit logs are immutable (no update or delete operations)
- Searchable by project, user, action, date range

**Steps:**
1. Create audit types
2. Create logAudit helper
3. Add audit logging to all existing API endpoints
4. Create audit-api.tsx for querying logs
5. Create AuditLogViewer component
6. Add to admin settings
7. Add export functionality (CSV)

### 12.3 Milestone 12.3 — Data Residency Controls

**Goal**: Ensure data stays in the correct geographic region.

**Implementation:**
- Tag all KV entries with region: `region:{region}:entity:{id}`
- Supabase project region determines physical data location
- For multi-region: separate Supabase projects per region
- Show data residency badge on project settings

**Note**: True multi-region requires multiple Supabase instances. For MVP, provide region labeling and policy enforcement that prevents data from being accessed cross-region.

### 12.4 Milestone 12.4 — White-Labeling

**Goal**: Allow enterprise customers to customize branding.

**Files to create:**
- `/components/admin/BrandingSettings.tsx` — Brand customization UI
- `/utils/branding/theme-engine.ts` — Dynamic theme application

**Customizable elements:**
- Logo (header and login page)
- Primary/secondary colors
- Company name in title
- Custom domain (via DNS CNAME)
- Email template branding
- Footer text

**Implementation:**
- Store branding config in KV: `branding:{orgId}` → BrandConfig JSON
- Apply CSS custom properties dynamically based on config
- Override Tailwind CSS variables in `/styles/globals.css`

```typescript
interface BrandConfig {
  orgId: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  companyName: string;
  customDomain?: string;
  footerText?: string;
}
```

---

## 13. CROSS-CUTTING CONCERNS

### 13.1 Error Handling Strategy

**Frontend:**
- All API calls wrapped in try/catch with user-friendly toast messages
- `ErrorBoundary` component (already exists) catches render errors
- Network errors: show "Connection lost" banner with retry button
- Auth errors (401): redirect to login

**Backend:**
- All endpoints return structured error JSON: `{ error: string, details?: any }`
- Always include contextual information: "Failed to create invoice for project X: rate not found for contract Y"
- Log errors with `console.log` (captured by Supabase)
- Never expose internal details (stack traces, KV keys) to frontend

### 13.2 Performance Optimization

**KV Store:**
- Use `mget` for batch reads instead of sequential `get` calls
- Use `getByPrefix` sparingly (full scan)
- Cache frequently-read data (e.g., active policy) in-memory on server
- Consider denormalization for hot paths

**Frontend:**
- `useMemo` for expensive graph computations
- `useCallback` for event handlers passed to children
- Virtualize long lists (timesheet entries, audit logs)
- Lazy load routes with `React.lazy` and `Suspense`
- Debounce API calls for search/filter inputs (300ms)

**Graph Rendering:**
- Only re-render changed nodes (React keys on node IDs)
- Throttle cursor broadcast to 10Hz
- Use CSS transforms for pan/zoom (not re-render)
- Limit visible nodes for very large graphs (collapse distant branches)

### 13.3 Security Checklist

1. Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend
2. Always validate auth token on protected endpoints
3. Validate all input on server (never trust frontend)
4. Sanitize user-generated content (XSS prevention)
5. Rate limit public endpoints
6. Hash API keys before storage
7. Sign webhook payloads with HMAC
8. Validate file uploads (type, size)
9. Use signed URLs for Storage (never public buckets)
10. Audit log all destructive operations

### 13.4 Accessibility (a11y)

- All interactive elements must be keyboard navigable
- ARIA labels on graph nodes and edges
- Color should not be the only way to convey information
- Screen reader support for approval status
- Focus management in modals and drawers
- Minimum touch target size: 44x44px

### 13.5 Internationalization Preparation

- All user-facing strings should be extracted to constants
- Date formatting via `date-fns` (locale-aware)
- Currency formatting via `Intl.NumberFormat`
- RTL layout support (CSS logical properties)
- Number formatting respects locale

---

## 14. TESTING STRATEGY

### 14.1 Component Testing Approach

Since the Figma Make environment doesn't support test runners, testing is done through:

1. **Dev mode personas**: PersonaContext provides test users for each role
2. **Demo data**: Seed data in contexts for immediate testing
3. **Console logging**: Strategic `console.log` for debugging
4. **Error boundaries**: Catch and display errors gracefully

### 14.2 Integration Test Scenarios

For each phase, verify these scenarios manually:

**Phase 3 (Collaboration):**
- [ ] Open project in two tabs, verify cursor sharing
- [ ] Edit node in tab A, verify update in tab B
- [ ] Add comment, verify it appears for other viewers
- [ ] Create change proposal as Contributor role

**Phase 4 (Policies):**
- [ ] Compile graph → verify all people have approval chains
- [ ] Submit timesheet → verify correct approval chain activates
- [ ] Auto-approve within limits → verify auto-approval fires
- [ ] Timeout SLA → verify escalation

**Phase 5 (Invoices):**
- [ ] Generate invoices from approved timesheets
- [ ] Verify multi-tier billing generates separate invoices
- [ ] Record payment → verify status updates
- [ ] Verify overdue detection

**Phase 9 (Auth):**
- [ ] Sign up with email → verify user created
- [ ] Sign in → verify session persists
- [ ] Switch to real auth → verify PersonaContext bypassed
- [ ] Verify graph visibility matches real user's position

---

## 15. MIGRATION PLAYBOOKS

### 15.1 PersonaContext → IdentityContext Migration

This is the most complex migration. Follow this order:

```
Week 1: Create IdentityContext + compat layer
  - Both contexts active simultaneously
  - useIdentity() falls back to usePersona() in dev mode

Week 2: Migrate low-risk components
  - AppHeader, AppLayout, SettingsPage, ProfilePage
  - These only read name/email/role

Week 3: Migrate medium-risk components
  - DashboardPage, FeedHome, ProjectsListView
  - These filter data by user

Week 4: Migrate high-risk components
  - WorkGraphBuilder (graph visibility)
  - TimesheetDataContext (data ownership)
  - All approval components

Week 5: Cleanup
  - Remove PersonaContext from provider tree (keep file for dev)
  - Add feature flag: ENABLE_DEV_PERSONAS
  - Update all tests
```

### 15.2 Adding a New API Endpoint (Playbook)

```
1. Create types in /types/my-feature.ts
2. Create server router in /supabase/functions/server/my-feature-api.tsx
   - Import Hono, kv_store, supabase client
   - Define KV schema in header comment
   - Add getUserId helper
   - Implement CRUD endpoints with /make-server-f8b491be prefix
   - Export router
3. Register in /supabase/functions/server/index.tsx
   - Import: import { myFeatureRouter } from "./my-feature-api.tsx"
   - Register: app.route('/', myFeatureRouter)
4. Create frontend client in /utils/api/my-feature-api.ts
   - Import projectId, publicAnonKey
   - Define BASE URL
   - Implement typed fetch wrappers
5. Create React hook if needed: /hooks/useMyFeature.ts
6. Wire into components
```

### 15.3 Adding a New Graph Node Type (Playbook)

```
1. Add to NodeType union in /types/workgraph.ts
2. Create data interface (e.g., TeamNodeData) in same file
3. Add rendering logic in WorkGraphBuilder.tsx:
   - Add new card component (SVG <g> with <rect>, <text>, etc.)
   - Add to the node rendering switch/map
   - Add color/icon for the new type
4. Add layer assignment in auto-generate.ts:
   - assignLayer() must handle the new type
5. Add detail view in NodeDetailDrawer.tsx:
   - Add tab content for inspecting the new node type
6. Add edge type inference in auto-generate.ts:
   - What edges connect to/from this node type?
7. Add visibility rules in graph-visibility.ts:
   - Who can see this node type at what hop distance?
8. Add to wizard if user-creatable:
   - Add to NodePalette.tsx
   - Add creation flow in ProjectCreateWizard.tsx
```

### 15.4 Supabase Storage Integration (Playbook)

```
1. Define bucket name: 'make-f8b491be-{feature}'
2. In server API file, add bucket initialization:
   const supabase = createClient(URL, SERVICE_KEY);
   const { data: buckets } = await supabase.storage.listBuckets();
   if (!buckets?.some(b => b.name === bucketName)) {
     await supabase.storage.createBucket(bucketName, { public: false });
   }
3. Upload endpoint:
   const file = await c.req.blob();
   const path = `${userId}/${filename}`;
   await supabase.storage.from(bucketName).upload(path, file);
4. Download endpoint (signed URL):
   const { data } = await supabase.storage
     .from(bucketName)
     .createSignedUrl(path, 3600); // 1 hour expiry
   return c.json({ url: data.signedUrl });
5. Store metadata in KV, file content in Storage
```

---

## APPENDIX A: PHASE DEPENDENCY GRAPH

```
Phase 0.5 (Foundation)  ──┬── Phase 1 (Data Wiring) ──┬── Phase 2 (Graph Engine)
                          │                            │
                          │                            ├── Phase 3 (Collaboration)
                          │                            │
                          │                            ├── Phase 4 (Policies) ────── Phase 5 (Invoices)
                          │                            │
                          │                            ├── Phase 7 (Analytics) ←── Phase 5
                          │                            │
                          │                            └── Phase 10 (Adv Graph)
                          │
                          ├── Phase 8 (Social) ←── Phase 9 (Auth)
                          │
                          ├── Phase 9 (Auth) ──┬── Phase 11 (Mobile/API)
                          │                    └── Phase 12 (Enterprise)
                          │
                          └── Phase 6 (Documents)
```

**Recommended implementation order:**
1. Phase 4 (Policies) — makes the graph executable
2. Phase 9 (Auth) — required for production
3. Phase 5 (Invoices) — revenue-generating feature
4. Phase 3 (Collaboration) — multiplayer experience
5. Phase 7 (Analytics) — decision support
6. Phase 10 (Advanced Graph) — UX improvements
7. Phase 6 (Documents) — legal compliance
8. Phase 8 (Social) — network effects
9. Phase 11 (Mobile/API) — platform expansion
10. Phase 12 (Enterprise) — upmarket sales

## APPENDIX B: KV SCHEMA REGISTRY

Complete list of all KV key patterns (existing + planned):

```
# === EXISTING (Phase 0.5-2) ===
project:{projectId}                   → Project JSON
user-projects:{userId}                → string[] of projectIds
project-members:{projectId}           → ProjectMember[] array
contract:{contractId}                 → Contract JSON
project-contracts:{projectId}         → string[] of contractIds
user-contracts:{userId}               → string[] of contractIds
timesheet:{timesheetId}               → StoredWeek JSON
user-timesheets:{userId}              → string[] of timesheetIds

# === Phase 3 (Collaboration) ===
graph-version:{projectId}             → number
graph-ops:{projectId}:{opId}          → GraphOperation JSON
comment:{commentId}                   → GraphComment JSON
node-comments:{projectId}:{nodeId}    → string[] of commentIds
project-comments:{projectId}          → string[] of commentIds
proposal:{proposalId}                 → ChangeProposal JSON
project-proposals:{projectId}         → string[] of proposalIds

# === Phase 4 (Policies) ===
policy:{policyId}                     → CompiledPolicy JSON
project-policies:{projectId}          → string[] of policyIds
active-policy:{projectId}             → policyId
policy-history:{projectId}:{version}  → CompiledPolicy JSON

# === Phase 5 (Invoices) ===
invoice:{invoiceId}                   → Invoice JSON
project-invoices:{projectId}          → string[] of invoiceIds
party-invoices:{partyId}:sent         → string[]
party-invoices:{partyId}:received     → string[]
invoice-counter:{projectId}           → number
payment:{paymentId}                   → Payment JSON
invoice-payments:{invoiceId}          → string[] of paymentIds

# === Phase 6 (Documents) ===
document:{docId}                      → Document JSON
project-documents:{projectId}         → string[] of docIds
contract-documents:{contractId}       → string[] of docIds

# === Phase 7 (Analytics) ===
analytics:utilization:{projectId}:{month}  → UtilizationData
analytics:financial:{projectId}:{month}    → FinancialData
analytics:person:{personId}:{month}        → PersonAnalytics
analytics:project-summary:{projectId}      → ProjectSummary

# === Phase 8 (Social) ===
post:{postId}                         → SocialPost JSON
user-posts:{userId}                   → string[] of postIds
feed:{userId}:{timestamp}             → postId
post-comments:{postId}                → string[] of commentIds
post-likes:{postId}                   → string[] of userIds
connection:{fromUser}:{toUser}        → Connection JSON
user-connections:{userId}             → string[] of userIds
user-skills:{userId}                  → UserSkillProfile JSON

# === Phase 9 (Auth) ===
user-profile:{userId}                 → UserProfile JSON
org:{orgId}                           → Organization JSON
org-members:{orgId}                   → string[] of userIds
user-orgs:{userId}                    → string[] of orgIds
invitation:{invitationId}             → Invitation JSON
org-invitations:{orgId}               → string[]
invitation-token:{token}              → invitationId

# === Phase 11 (API) ===
api-key:{keyId}                       → ApiKey JSON
user-api-keys:{userId}                → string[] of keyIds
api-key-hash:{hash}                   → keyId
webhook:{webhookId}                   → Webhook JSON
user-webhooks:{userId}                → string[] of webhookIds
webhook-deliveries:{webhookId}        → DeliveryLog[]

# === Phase 12 (Enterprise) ===
audit:{auditId}                       → AuditLogEntry JSON
audit-project:{projectId}:{timestamp} → auditId
audit-user:{userId}:{timestamp}       → auditId
branding:{orgId}                      → BrandConfig JSON
```

## APPENDIX C: FILE CREATION MANIFEST

Summary of all new files planned across all phases:

```
# Phase 3 — 8 new files
/types/collaboration-realtime.ts
/utils/realtime/channel-manager.ts
/utils/realtime/operation-log.ts
/utils/realtime/conflict-resolver.ts
/contexts/CollaborationContext.tsx
/components/workgraph/CollaboratorCursors.tsx
/components/workgraph/PresenceBar.tsx
/components/workgraph/CommentThread.tsx
/components/workgraph/ChangeProposal.tsx
/supabase/functions/server/comments-api.tsx
/supabase/functions/server/proposals-api.tsx
/utils/api/comments-api.ts
/utils/api/proposals-api.ts

# Phase 4 — 5 new files
/utils/policy/compiler.ts
/utils/policy/policy-types.ts
/utils/policy/validator.ts
/supabase/functions/server/policies-api.tsx
/utils/api/policies-api.ts

# Phase 5 — 8 new files
/types/invoices.ts
/types/payments.ts
/supabase/functions/server/invoices-api.tsx
/supabase/functions/server/invoice-generator.tsx
/utils/api/invoices-api.ts
/utils/currency/exchange-rates.ts
/utils/currency/formatter.ts
/components/invoices/InvoiceListView.tsx
/components/invoices/InvoiceDetail.tsx
/components/invoices/InvoicePreview.tsx
/components/invoices/InvoiceApprovalBar.tsx
/components/invoices/PaymentRecorder.tsx

# Phase 6 — 7 new files
/types/documents.ts
/supabase/functions/server/documents-api.tsx
/utils/api/documents-api.ts
/utils/documents/template-engine.ts
/components/documents/DocumentLibrary.tsx
/components/documents/DocumentUploader.tsx
/components/documents/DocumentViewer.tsx
/components/documents/DocumentVersionHistory.tsx
/components/documents/TemplateLibrary.tsx
/components/documents/ComplianceDashboard.tsx

# Phase 7 — 7 new files
/types/analytics.ts
/supabase/functions/server/analytics-api.tsx
/utils/api/analytics-api.ts
/components/analytics/UtilizationChart.tsx
/components/analytics/RevenueChart.tsx
/components/analytics/MarginAnalysis.tsx
/components/analytics/BurndownChart.tsx
/components/analytics/HealthScoreCard.tsx
/components/analytics/ReportBuilder.tsx
/components/analytics/ReportViewer.tsx
/utils/analytics/report-engine.ts
/components/analytics/BudgetTracker.tsx

# Phase 8 — 6 new files
/types/social.ts
/supabase/functions/server/social-api.tsx
/supabase/functions/server/matching-api.tsx
/utils/api/social-api.ts
/utils/api/matching-api.ts
/utils/social/reputation-calculator.ts
/components/social/SkillMatcher.tsx
/components/social/ReputationBadge.tsx
/components/social/CompanyDirectory.tsx
/components/social/CompanyCard.tsx

# Phase 9 — 6 new files
/contexts/IdentityContext.tsx
/supabase/functions/server/invitations-api.tsx
/utils/api/invitations-api.ts
/utils/permissions/graph-permissions.ts
/components/organizations/InviteModal.tsx
/components/auth/SSOLoginForm.tsx

# Phase 10 — 5 new files
/utils/graph/undo-manager.ts
/utils/graph/graph-differ.ts
/components/workgraph/GraphDiff.tsx
/components/workgraph/GraphTreeView.tsx
/components/workgraph/TemplateCreator.tsx
/components/workgraph/AIStructureSuggestor.tsx
/supabase/functions/server/templates-api.tsx
/supabase/functions/server/ai-suggest-api.tsx

# Phase 11 — 5 new files
/utils/notifications/push-manager.ts
/supabase/functions/server/push-api.tsx
/supabase/functions/server/public-api.tsx
/supabase/functions/server/api-keys.tsx
/supabase/functions/server/webhooks-api.tsx
/supabase/functions/server/webhook-sender.tsx

# Phase 12 — 5 new files
/types/audit.ts
/supabase/functions/server/audit-api.tsx
/supabase/functions/server/sso-config-api.tsx
/utils/branding/theme-engine.ts
/components/admin/AuditLogViewer.tsx
/components/admin/BrandingSettings.tsx
```

---

*End of WorkGraph Comprehensive Roadmap v2.0*
*Total phases: 10 (Phase 3-12)*
*Total milestones: ~45*
*Estimated total implementation: 130-160 sessions*
