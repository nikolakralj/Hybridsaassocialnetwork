# WorkGraph: Complete Architecture & Codebase Documentation

**For new engineers joining the project. Last updated: March 20, 2026.**

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [Directory Structure](#4-directory-structure)
5. [Data Model & Type System](#5-data-model--type-system)
6. [Application Entry Point & Routing](#6-application-entry-point--routing)
7. [Context Providers (Global State)](#7-context-providers-global-state)
8. [Backend: Supabase Edge Functions](#8-backend-supabase-edge-functions)
9. [Frontend API Clients](#9-frontend-api-clients)
10. [The WorkGraph Engine (Core Innovation)](#10-the-workgraph-engine-core-innovation)
11. [Graph Visibility & ReBAC](#11-graph-visibility--rebac)
12. [Graph Auto-Generation from Wizard](#12-graph-auto-generation-from-wizard)
13. [Layout Engine (Pure SVG Sugiyama)](#13-layout-engine-pure-svg-sugiyama)
14. [Node Detail Drawer](#14-node-detail-drawer)
15. [Graph Data Flows & Monthly Snapshots](#15-graph-data-flows--monthly-snapshots)
16. [Project Create Wizard](#16-project-create-wizard)
17. [Timesheet System](#17-timesheet-system)
18. [Approval System](#18-approval-system)
19. [Notification System](#19-notification-system)
20. [Authentication & Authorization](#20-authentication--authorization)
21. [Landing Page & Onboarding](#21-landing-page--onboarding)
22. [Dashboard & Social Features](#22-dashboard--social-features)
23. [Contracts Module](#23-contracts-module)
24. [UI Component Library](#24-ui-component-library)
25. [Styling System](#25-styling-system)
26. [Key Patterns & Conventions](#26-key-patterns--conventions)
27. [Known Issues & Technical Debt](#27-known-issues--technical-debt)
28. [Future Roadmap](#28-future-roadmap)

---

## 1. EXECUTIVE SUMMARY

WorkGraph is a **hybrid SaaS + social work network** for technical freelancers. It models the
complex supply chains that exist in enterprise consulting (Company -> Agency -> Client) as a
**visual directed acyclic graph (DAG)**, then uses that graph structure to derive:

- **Approval chains** (who approves whose timesheets)
- **Visibility rules** (who can see what rates, people, contracts)
- **Billing flows** (who bills whom)
- **Access control** (Relationship-Based Access Control / ReBAC)

The core insight: instead of rigid role-based permissions, the **graph topology IS the
permission model**. Your position in the supply chain determines what you see and do.

### Product Personas

| Persona | Description | Graph Position |
|---------|-------------|----------------|
| Freelancer | Independent worker | Leaf node (depth 0) |
| Company | Employer/staffing firm | Middle tier |
| Agency | Recruiting/staffing agency | Middle tier |
| Client | End client paying for work | Top of chain |
| Admin | God mode (testing only) | Sees everything |

### Current Phase

- **Phase 0.5** (Platform Foundation): Auth, KV store, basic CRUD APIs - COMPLETE
- **Phase 1** (Real Data Wiring): Projects, Contracts, Timesheets APIs + frontend rewiring - COMPLETE
- **Phase 2** (Graph Engine): Connection-based DAG, auto-layout, visibility engine - COMPLETE
- **Phase 3+**: See Future Roadmap section

---

## 2. SYSTEM ARCHITECTURE OVERVIEW

```
+-------------------+     HTTPS      +-------------------------+     KV Store     +-------------+
|                   |  ============> |   Supabase Edge Fn      |  =============> |  Supabase   |
|   React SPA       |                |   (Hono web server)     |                 |  Postgres   |
|   (Vite + React)  | <============  |   /supabase/functions/  | <============== |  kv_store   |
|                   |   JSON resp    |   server/index.tsx      |                 |  table      |
+-------------------+                +-------------------------+                 +-------------+
        |                                     |
        |                                     |  Supabase Auth
        |                              +------+------+
        |                              | Supabase    |
        +----------------------------->| Auth API    |
           signIn/signUp/getSession    +-------------+
```

### Three-Tier Architecture

1. **Frontend**: React SPA with React Router, Tailwind CSS v4, shadcn/ui components
2. **Server**: Supabase Edge Function running a Hono web server (Deno runtime)
3. **Database**: Supabase Postgres with a single `kv_store` table (key-value pattern)

### Key Architectural Decisions

1. **KV Store over SQL tables**: We use a flexible key-value pattern instead of creating
   custom Postgres tables. This is a constraint of the Figma Make environment where DDL
   statements cannot be executed. The KV schema uses prefixed keys for different entity types.

2. **Pure SVG rendering (reactflow fully removed)**: The graph canvas uses a custom
   SVG-based layout engine instead of React Flow or similar libraries. This gives full
   control over rendering and avoids library-specific abstractions. See
   [Section 13.7: Rendering Engine History & reactflow Removal](#137-rendering-engine-history--reactflow-removal)
   for the full migration story.

3. **Connection-based DAG**: Supply chains are modeled as DAGs where each party explicitly
   declares `billsTo: string[]` — who they bill/report to. This supports any topology
   (linear, parallel, skip-tier, diamond, N-tier).

4. **Persona-based testing**: A `PersonaContext` allows switching between different user
   perspectives without re-authenticating, enabling rapid testing of visibility rules.

---

## 3. TECHNOLOGY STACK

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18+ | UI framework |
| React Router | 6+ (Data mode) | Client-side routing |
| Tailwind CSS | v4.0 | Utility-first CSS |
| shadcn/ui | Latest | Component library (accordion, dialog, etc.) |
| Lucide React | Latest | Icon library |
| Sonner | 2.0.3 | Toast notifications |
| date-fns | Latest | Date formatting |
| Motion | Latest | Animations (import from 'motion/react') |
| ~~reactflow~~ | ~~11.10.0~~ | **REMOVED** — was never used at runtime; legacy imports caused module resolution failures. All 6 files migrated to local stubs. See Section 13.7. |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Deno | Latest | Runtime for Edge Functions |
| Hono | Latest | HTTP server framework |
| Supabase JS | 2 | Database & Auth client |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| Supabase | Hosted Postgres, Auth, Edge Functions, Storage |
| Figma Make | Deployment platform |

---

## 4. DIRECTORY STRUCTURE

```
/
├── App.tsx                          # Entry point. Wraps providers + RouterProvider
├── routes.tsx                       # React Router configuration (createBrowserRouter)
│
├── components/                      # All React components
│   ├── ui/                         # shadcn/ui primitives (button, dialog, input, etc.)
│   ├── workgraph/                  # *** CORE: Graph engine components ***
│   │   ├── WorkGraphBuilder.tsx    # Main graph canvas + layout engine
│   │   ├── graph-visibility.ts    # ReBAC visibility engine
│   │   ├── graph-data-flows.ts    # Monthly snapshot data
│   │   ├── NodeDetailDrawer.tsx   # Side drawer for node inspection
│   │   ├── ProjectCreateWizard.tsx # 4-step project creation wizard
│   │   ├── nodes/                 # LEGACY node renderers (PartyNode, PersonNode, ContractNode)
│   │   │                         # NOT used by active SVG engine — WorkGraphBuilder renders
│   │   │                         # its own OrgNodeCard, PersonNodeCard, ContractNodeCard inline.
│   │   │                         # reactflow imports replaced with local stubs (March 2026).
│   │   ├── templates.ts          # Default graph templates
│   │   ├── overlay-transforms.ts # Visual overlay engine (reactflow types replaced with local aliases)
│   │   ├── CustomEdge.tsx        # LEGACY edge component (reactflow getBezierPath replaced with local impl)
│   │   ├── CompanySearchDialog.tsx # Company search modal
│   │   ├── CompileModal.tsx      # Policy compilation modal
│   │   ├── PolicySimulator.tsx   # What-if policy simulator
│   │   └── ...
│   ├── timesheets/                 # Timesheet module
│   │   ├── TimesheetModule.tsx    # Main timesheet component
│   │   ├── EnhancedTimesheetCalendar.tsx
│   │   ├── approval/             # Approval views
│   │   ├── approval-v2/          # Redesigned approval views
│   │   ├── forms/                # Entry editing forms
│   │   ├── hooks/                # Timesheet-specific hooks
│   │   ├── modal/                # Day entry modals
│   │   ├── table/                # Table-based views
│   │   └── demo-data*.ts        # Seed data for demos
│   ├── approvals/                  # Approval workbench
│   ├── contracts/                  # Contracts management
│   ├── dashboard/                  # Dashboard widgets
│   ├── notifications/              # Notification system
│   ├── onboarding/                 # User onboarding flows
│   ├── social/                     # Social feed components
│   ├── widgets/                    # Dashboard widget cards
│   ├── hooks/                      # Shared hooks
│   ├── AppLayout.tsx              # Authenticated layout wrapper
│   ├── AppHeader.tsx              # Global navigation header
│   ├── Landing.tsx                # Public landing page
│   ├── ProjectWorkspace.tsx       # Project workspace (tab container)
│   └── ...
│
├── contexts/                        # React Context providers
│   ├── AuthContext.tsx             # Supabase auth state
│   ├── PersonaContext.tsx          # Test persona switching
│   ├── WorkGraphContext.tsx        # Organization context
│   ├── TimesheetDataContext.tsx    # Timesheet data store
│   ├── MonthContext.tsx            # Selected month state
│   └── NotificationContext.tsx    # Notification state
│
├── types/                           # TypeScript type definitions
│   ├── index.ts                   # Core types (Context, PersonalProfile, Organization, etc.)
│   ├── workgraph.ts               # Graph types (BaseNode, BaseEdge, policies, etc.)
│   ├── collaboration.ts           # Project & member types
│   ├── timesheets.ts              # Timesheet types
│   ├── contracts.ts               # Contract types
│   ├── approvals.ts               # Approval types
│   ├── notifications.ts           # Notification types
│   ├── permissions.ts             # Permission types
│   └── ...
│
├── utils/                           # Utility functions
│   ├── api/                       # Frontend API clients
│   │   ├── projects-api.ts       # Projects CRUD
│   │   ├── contracts-api.ts      # Contracts CRUD
│   │   ├── timesheets-api.ts     # Timesheets CRUD
│   │   ├── timesheets-hooks.ts   # React Query hooks for timesheets
│   │   └── ...
│   ├── graph/                     # Graph utilities
│   │   ├── auto-generate.ts      # Graph generation from wizard data
│   │   └── timesheet-nodes.ts    # Timesheet node generation
│   ├── supabase/                  # Supabase configuration
│   │   ├── client.ts             # Singleton Supabase client
│   │   └── info.tsx              # Project ID & anon key (PROTECTED)
│   ├── collaboration/            # Permission utilities
│   ├── notifications/            # Email templates
│   └── ...
│
├── supabase/functions/server/       # Backend (Deno Edge Functions)
│   ├── index.tsx                  # Hono app entry point (route registration)
│   ├── kv_store.tsx               # KV store utility (PROTECTED - DO NOT MODIFY)
│   ├── projects-api.tsx           # Projects CRUD endpoints
│   ├── contracts-api.tsx          # Contracts CRUD endpoints
│   ├── timesheets-api.tsx         # Timesheets CRUD endpoints
│   ├── auth.tsx                   # Auth endpoints (signup)
│   ├── kv-api.tsx                 # Generic KV access API
│   ├── email.tsx                  # Email sending (Resend)
│   ├── approvals-kv.tsx           # Approval chain KV endpoints
│   ├── timesheet-approvals.ts     # Graph-based approval endpoints
│   ├── graph-versions.ts          # Graph version history
│   ├── graph-dynamic-nodes.ts     # Dynamic node CRUD
│   └── ...
│
├── hooks/                           # Top-level shared hooks
│   ├── useNodeStats.ts
│   ├── useNotifications.ts
│   └── useProjectContracts.ts
│
├── styles/
│   └── globals.css                # Tailwind v4 config + design tokens
│
└── docs/
    └── WORKGRAPH.md               # Original architecture notes
```

---

## 5. DATA MODEL & TYPE SYSTEM

### 5.1 Graph Entity Types (`/types/workgraph.ts`)

The graph is the central data structure. Everything revolves around nodes and edges.

#### Node Types (`NodeType`)

```typescript
type NodeType =
  | 'party'      // Organization (Company, Agency, Client, Contractor)
  | 'team'       // Team within an organization
  | 'person'     // Individual worker
  | 'contract'   // Contract between parties
  | 'sow'        // Statement of Work
  | 'po'         // Purchase Order
  | 'budget'     // Budget allocation
  | 'milestone'  // Deliverable milestone
  | 'timesheet'  // Timesheet template
  | 'expense';   // Expense template
```

Currently, only `party`, `person`, and `contract` are actively used. The others are
defined for future expansion.

#### Edge Types (`EdgeType`)

```typescript
type EdgeType =
  | 'approves'     // Approval relationship (person → party they approve)
  | 'owns'         // Ownership
  | 'funds'        // Funding relationship
  | 'assigns'      // Assignment (org → person)
  | 'worksOn'      // Work relationship
  | 'billsTo'      // Billing relationship (party → party)
  | 'invoices'     // Invoicing
  | 'subcontracts'; // Subcontracting
```

The most important edges are:
- **`billsTo`**: Structural edge defining the supply chain topology
- **`approves`**: Person-to-party edge defining who approves whose timesheets
- **`employs`/`assigns`**: Legacy edges (now replaced by `partyId` in person node data)

#### BaseNode

```typescript
interface BaseNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };  // Used by layout engine, often {0,0} initially
  data: any;  // Node-type-specific payload
  selected?: boolean;
  draggable?: boolean;
}
```

The `data` field is polymorphic. For each node type:

**Party (Organization) node data:**
```typescript
{
  name: string;           // "Andritz", "B2 Solutions"
  partyType: PartyType;   // 'client' | 'agency' | 'company' | 'contractor' | 'freelancer'
  organizationId?: string;
  logo?: string;          // Emoji or URL
  color?: string;         // Hex color for rendering
  chainPosition: number;  // Depth in the DAG (computed by auto-generate)
  isCreator?: boolean;    // Whether this party created the project
  invitedEmail?: string;  // Email if invited but not yet joined
}
```

**Person node data:**
```typescript
{
  name: string;                    // "Martin Doe"
  email: string;                   // "martin@b2.com"
  role: string;                    // "project_manager", "developer", etc.
  company: string;                 // Company name (display only)
  partyId: string;                 // ID of the party node this person belongs to
  userId: string;                  // Maps to auth user (same as node ID)
  canApprove: boolean;             // Whether this person can approve timesheets
  canViewRates: boolean;           // Whether this person can see contract rates
  canEditTimesheets: boolean;      // Whether this person can edit their timesheets
  visibleToChain: boolean;         // Whether connected parties can see this person
}
```

**CRITICAL**: Person nodes store their org membership via `data.partyId`, NOT via
`employs`/`assigns` edges. The auto-generator (`auto-generate.ts`) creates person nodes
with `partyId` but does NOT create edges between persons and their party. This is why the
BFS in the visibility engine needed virtual adjacency (added in the latest fix).

**Contract node data:**
```typescript
{
  name: string;
  contractType: 'hourly' | 'daily' | 'fixed' | 'custom';
  hourlyRate?: number;
  dailyRate?: number;
  fixedAmount?: number;
  currency: string;
  startDate: string;
  endDate?: string;
  status: 'draft' | 'active' | 'expired' | 'terminated';
  parties: {
    partyA: string;  // Party ID
    partyB: string;  // Party ID
  };
  visibility: {
    hideRateFrom: string[];   // Party IDs who can't see rates
    hideTermsFrom: string[];  // Party IDs who can't see terms
  };
  weeklyHourLimit?: number;
  monthlyHourLimit?: number;
}
```

#### BaseEdge

```typescript
interface BaseEdge {
  id: string;
  type: EdgeType;       // The semantic type
  source: string;       // Source node ID
  target: string;       // Target node ID
  data: any;            // Edge-type-specific payload
  animated?: boolean;
  style?: any;
}
```

Edge data typically contains:
```typescript
{
  edgeType: string;     // Redundant with type, but used by rendering code
  label: string;        // Display label ("bills to", "approves")
  order?: number;       // For approval chains: step order (1, 2, 3...)
  required?: boolean;   // For approvals: is this step required?
}
```

### 5.2 Core Identity Types (`/types/index.ts`)

```typescript
// Organization context (what entity you're operating as)
type ContextType = "personal" | "company" | "agency";

interface Context {
  id: string;
  type: ContextType;
  name: string;
  role?: "owner" | "admin" | "manager" | "member" | "contractor" | "recruiter";
}

// Personal profile (freelancer's public identity)
interface PersonalProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  skills: string[];
  availability: "available" | "limited" | "unavailable";
  hourlyRate?: number;
  // ... extensive profile fields
}

// Worker record (org's view of a worker)
interface WorkerRecord {
  id: string;
  organizationId: string;
  personalProfileId?: string;  // Link to personal profile (optional)
  name: string;
  internalTitle: string;
  billableRate?: number;
  status: "unclaimed" | "claimed" | "active" | "inactive";
  // ...
}

// Organization
interface Organization {
  id: string;
  type: "company" | "agency" | "freelancer-company";
  name: string;
  settings: { /* privacy, currency, timezone */ };
  // ...
}
```

### 5.3 Collaboration Types (`/types/collaboration.ts`)

```typescript
interface Project {
  id: string;
  name: string;
  region: 'US' | 'EU' | 'UK';
  currency: 'USD' | 'EUR' | 'GBP';
  startDate: string;
  endDate?: string;
  workWeek: WorkWeek;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkWeek {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

type ProjectRole = 'Owner' | 'Editor' | 'Contributor' | 'Commenter' | 'Viewer';

interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  scope?: string;     // For contributors: which org they represent
  invitedBy: string;
  invitedAt: string;
  acceptedAt?: string;
}
```

### 5.4 Timesheet Types (`/contexts/TimesheetDataContext.tsx`)

```typescript
interface DayTask {
  id: string;
  description: string;
  hours: number;
  category?: string;  // 'Development', 'Meeting', etc.
}

interface StoredDay {
  day: string;          // 'Mon' | 'Tue' | ... | 'Fri'
  hours: number;
  startTime?: string;   // HH:mm
  endTime?: string;
  breakMinutes?: number;
  notes?: string;
  tasks?: DayTask[];    // Multiple tasks per day
}

type WeekStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

interface StoredWeek {
  personId: string;
  weekLabel: string;     // 'Nov 3-7'
  weekStart: string;     // '2025-11-03' ISO date
  days: StoredDay[];     // Always 5 (Mon-Fri)
  tasks: string[];       // Task descriptions
  status: WeekStatus;
  submittedAt?: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionNote?: string;
}
```

### 5.5 Compiled Policy Types (`/types/workgraph.ts`)

When a graph is "compiled," it produces executable policies:

```typescript
interface CompiledProjectConfig {
  projectId: string;
  version: number;
  compiledAt: string;
  compiledBy: string;
  graph: { nodes: BaseNode[]; edges: BaseEdge[] };
  approvalPolicies: ApprovalPolicy[];
  visibilityRules: VisibilityRule[];
  routingRules: RoutingRule[];
  notificationRules: NotificationRule[];
}

interface ApprovalPolicy {
  projectId: string;
  workType: 'timesheet' | 'expense' | 'deliverable' | 'change_order' | 'invoice';
  sequential: boolean;
  steps: ApprovalStep[];
  escalation?: { timeoutHours: number; action: 'notify' | 'auto_approve' | 'reassign' };
  autoApprove?: { underAmount?: number; underHours?: number };
}
```

---

## 6. APPLICATION ENTRY POINT & ROUTING

### `/App.tsx` - Root Component

```typescript
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>           {/* Supabase auth state */}
        <PersonaProvider>      {/* Test persona switching */}
          <WorkGraphProvider>  {/* Organization context */}
            <TimesheetStoreProvider>  {/* Timesheet data */}
              <NotificationProvider>  {/* Notification state */}
                <RouterProvider router={router} />
              </NotificationProvider>
            </TimesheetStoreProvider>
          </WorkGraphProvider>
        </PersonaProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
```

**Provider nesting order matters:**
1. `ErrorBoundary` - Catches rendering errors
2. `AuthProvider` - Must be outermost data provider (everything needs auth)
3. `PersonaProvider` - Test mode persona switching
4. `WorkGraphProvider` - Organization context switching
5. `TimesheetStoreProvider` - Timesheet data (needs auth for API calls)
6. `NotificationProvider` - Notification state

Also forces light mode by removing the `dark` class from `<html>`.

### `/routes.tsx` - Route Configuration

Uses React Router v6 Data mode (`createBrowserRouter`):

```
/                          → Landing (public marketing page)
/onboarding/
  personal                 → PersonalProfileSetup
  freelancer               → FreelancerOnboarding
  company                  → CompanyOnboarding
  agency                   → AgencyOnboardingNew
/app/                      → AppLayout (authenticated shell)
  (index)                  → DashboardPage
  feed                     → FeedHome (social feed)
  projects                 → ProjectsListView
  project-workspace        → ProjectWorkspace (tabs: overview, graph, timesheets, approvals)
  approvals                → ApprovalsWorkbench
  contracts                → ContractsPage
  company-profile          → CompanyProfilePage
  notifications            → ActivityFeedPage
  profile                  → ProfilePage
  profile/:userId          → PublicProfilePage
  settings                 → SettingsPage
  approve                  → DeepLinkHandler (email deep link)
  reject                   → DeepLinkHandler
  approval-view            → ApprovalsWorkbench
```

**`AppLayout`** is the authenticated wrapper. It:
1. Shows a loading spinner while checking auth
2. If not authenticated, shows a sign-in prompt
3. If authenticated, renders `AppHeader` + `<Outlet />`

---

## 7. CONTEXT PROVIDERS (GLOBAL STATE)

### 7.1 AuthContext (`/contexts/AuthContext.tsx`)

**Purpose**: Manages Supabase authentication state.

**State shape:**
```typescript
interface AuthState {
  user: UserProfile | null;    // Authenticated user
  accessToken: string | null;  // JWT for API calls
  loading: boolean;            // Initial session check
  error: string | null;        // Last auth error
}
```

**Key operations:**
- `signUp(email, password, name)` - Creates user via server `/signup` endpoint
- `signIn(email, password)` - Direct Supabase auth
- `signOut()` - Clears session
- `updateProfile(updates)` - Updates user metadata

**Implementation details:**
- Uses a singleton `createClient()` instance (created outside component)
- On mount, checks for existing session via `supabase.auth.getSession()`
- Subscribes to auth state changes via `supabase.auth.onAuthStateChange()`
- Builds `UserProfile` from `user.user_metadata`

**How API calls use it:**
```typescript
const { accessToken } = useAuth();
// Pass to API clients:
await listProjects(accessToken);
// Server validates: supabase.auth.getUser(accessToken)
```

### 7.2 PersonaContext (`/contexts/PersonaContext.tsx`)

**Purpose**: Test-mode persona switching. Allows viewing the app as different users
without re-authenticating. Will be replaced with real auth in Phase 9.

**Hardcoded test personas** (13 total):
- `__admin__` - Admin (Full View)
- `user-sarah`, `user-mike`, `user-emily`, `user-robert`, `user-lisa` - Acme Dev Studio employees
- `user-sophia`, `user-oliver`, `user-emma` - BrightWorks Design employees
- `user-alex`, `user-jordan` - Freelancers
- `org-acme`, `org-brightworks`, `client-company` - Organization viewers

Each persona has:
```typescript
interface TestPersona {
  id: string;              // Matches graph node ID
  email: string;
  name: string;
  role: PersonaRole;       // 'contractor' | 'manager' | 'client' | 'admin'
  companyId?: string;
  graphViewerType?: string; // Maps to ViewerIdentity.type
  graphOrgId?: string;      // Org node ID for employee viewers
}
```

**Integration with WorkGraph:**
When the graph viewer selector changes, it calls `setPersonaByNodeId(nodeId)`, which
finds the matching TestPersona and updates the global persona. This syncs the graph
perspective with the rest of the app.

**Persistence:** Current persona is stored in `localStorage` under `'test-persona'`.

### 7.3 WorkGraphContext (`/contexts/WorkGraphContext.tsx`)

**Purpose**: Manages the current "organization context" — which entity the user is
operating as (personal, company, or agency).

This is separate from PersonaContext. PersonaContext is about *who* you are;
WorkGraphContext is about *which hat* you're wearing.

**Current state:** Uses mock data (3 hardcoded contexts). Will be replaced with
real data from the user's organization memberships.

### 7.4 TimesheetDataContext (`/contexts/TimesheetDataContext.tsx`)

**Purpose**: Single source of truth for ALL timesheet data. Provides a `TimesheetStoreAPI`
that components use to read/write timesheet data.

**API surface:**
```typescript
interface TimesheetStoreAPI {
  // Read
  getWeeksForPerson(personId: string, month: string): StoredWeek[];
  getAllWeeksForMonth(month: string): StoredWeek[];
  getPersonIds(): string[];

  // Write
  updateWeekDays(personId: string, weekStart: string, days: StoredDay[]): void;
  updateSingleDay(personId: string, weekStart: string, dayIndex: number, day: StoredDay): void;
  updateWeekTasks(personId: string, weekStart: string, tasks: string[]): void;
  setWeekStatus(personId: string, weekStart: string, status: WeekStatus, meta?: {...}): void;
  batchApproveMonth(personId: string, month: string, approverName: string): number;
}
```

**Data flow:**
1. On mount, loads timesheets from server API (`listTimesheets`)
2. Merges with seed data for demo purposes
3. Writes are persisted to server API with debouncing (`saveTimesheetWeek`)
4. Status changes trigger immediate API calls (`updateTimesheetStatus`)

### 7.5 MonthContext (`/contexts/MonthContext.tsx`)

Simple context holding the currently selected month (`YYYY-MM` string).
Used by timesheet views and the graph's month navigator.

### 7.6 NotificationContext (`/contexts/NotificationContext.tsx`)

Manages notification state (unread count, notification list).
Used by the notification bell and activity feed.

---

## 8. BACKEND: SUPABASE EDGE FUNCTIONS

### 8.1 Server Architecture (`/supabase/functions/server/index.tsx`)

The backend is a single Hono web server deployed as a Supabase Edge Function.
All routes are prefixed with `/make-server-f8b491be` (a unique identifier for this deployment).

```typescript
const app = new Hono();

// Middleware
app.use("/*", cors({ origin: "*", ... }));
app.use('*', logger(console.log));

// Route registration
app.route('/', authRouter);            // /make-server-f8b491be/signup
app.route('/', kvApiRouter);           // /make-server-f8b491be/kv/*
app.route('/', projectsRouter);        // /make-server-f8b491be/api/projects/*
app.route('/', contractsRouter);       // /make-server-f8b491be/api/contracts/*
app.route('/', timesheetsRouter);      // /make-server-f8b491be/api/timesheets/*
// ... more routers

Deno.serve(app.fetch);
```

### 8.2 KV Store Schema

All data is stored in a single Postgres table `kv_store_f8b491be` with key-value pairs.
The `kv_store.tsx` utility provides: `get`, `set`, `del`, `mget`, `mset`, `mdel`, `getByPrefix`.

**Key naming conventions:**
```
project:{projectId}                → Project JSON
user-projects:{userId}             → string[] of project IDs
project-members:{projectId}        → ProjectMember[] array
contract:{contractId}              → Contract JSON
project-contracts:{projectId}      → string[] of contract IDs
user-contracts:{userId}            → string[] of contract IDs
timesheet-week:{userId}:{weekStart} → StoredWeek JSON
user-timesheet-weeks:{userId}      → string[] of weekStart dates
profile:{userId}                   → UserProfile JSON
graph-version:{projectId}:{versionId} → Graph version JSON
```

### 8.3 Projects API (`/supabase/functions/server/projects-api.tsx`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/projects` | List user's projects |
| GET | `/api/projects/:id` | Get single project (with members) |
| POST | `/api/projects` | Create project (with graph data) |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/projects/:id/members` | Add project member |
| DELETE | `/api/projects/:id/members/:memberId` | Remove member |

**Authentication pattern** (used by all API routes):
```typescript
async function getUserId(c: any): Promise<string | null> {
  const token = c.req.header("Authorization")?.split(" ")[1];
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  return data?.user?.id || null;
}
```

**Project creation** saves the graph alongside the project:
```typescript
// POST body includes:
{
  name: "My Project",
  graph: { nodes: [...], edges: [...] },  // From wizard
  parties: [...],                          // PartyEntry[] from wizard
  ...
}
```

### 8.4 Contracts API (`/supabase/functions/server/contracts-api.tsx`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/contracts` | List user's contracts |
| GET | `/api/contracts/:id` | Get single contract |
| POST | `/api/contracts` | Create contract |
| PUT | `/api/contracts/:id` | Update contract |
| DELETE | `/api/contracts/:id` | Delete contract |

### 8.5 Timesheets API (`/supabase/functions/server/timesheets-api.tsx`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/timesheets?month=YYYY-MM` | List user's timesheet weeks |
| POST | `/api/timesheets` | Save a timesheet week |
| PUT | `/api/timesheets/status` | Update week status |

### 8.6 Auth Routes (`/supabase/functions/server/auth.tsx`)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/signup` | Create new user (uses admin API with `email_confirm: true`) |

Sign-in/sign-out use the Supabase client directly (no server route needed).

### 8.7 Other Server Routes

- **Email** (`email.tsx`): Sends approval/notification emails via Resend API
- **Approvals KV** (`approvals-kv.tsx`): KV-backed approval chain operations
- **Timesheet Approvals** (`timesheet-approvals.ts`): Graph-based approval logic
- **Graph Versions** (`graph-versions.ts`): Temporal graph versioning
- **Graph Dynamic Nodes** (`graph-dynamic-nodes.ts`): CRUD for individual graph nodes

---

## 9. FRONTEND API CLIENTS

All API clients live in `/utils/api/` and follow the same pattern:

```typescript
import { projectId, publicAnonKey } from '../supabase/info';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/api`;

function getHeaders(accessToken?: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken || publicAnonKey}`,
  };
}

export async function listProjects(accessToken?: string | null) {
  const res = await fetch(`${BASE}/projects`, { headers: getHeaders(accessToken) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed');
  return data.projects || [];
}
```

**Key clients:**
- `projects-api.ts` - `listProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`
- `contracts-api.ts` - `listContracts`, `getContract`, `createContract`, etc.
- `timesheets-api.ts` - `listTimesheets`, `saveTimesheetWeek`, `updateTimesheetStatus`

---

## 10. THE WORKGRAPH ENGINE (Core Innovation)

The WorkGraph engine is the heart of the application. It's spread across several files in
`/components/workgraph/`.

### 10.1 WorkGraphBuilder (`/components/workgraph/WorkGraphBuilder.tsx`)

This is the main component that renders the interactive graph canvas. It's approximately
1537 lines and contains:

1. **Layout engine** (lines 62-290)
2. **Edge rendering** (lines 292-400)
3. **Node card components** (lines 402-628)
4. **Group labels** (lines 630-664)
5. **Viewer selector** (lines 666-776)
6. **Month navigator** (lines 778-829)
7. **Month summary bar** (lines 831-872)
8. **Graph canvas** (lines 904-1168)
9. **List view** (lines 1170-1243)
10. **Hidden nodes banner** (lines 1245-1262)
11. **Main component** (lines 1264-1537)

#### Data Flow

```
ProjectWorkspace
  └─ WorkGraphBuilder
       ├─ On mount: load project graph from KV (getProject API)
       ├─ Or fallback: use TEMPLATES[0] (default template)
       │
       ├─ State: allNodes, allEdges (raw graph)
       ├─ Compute: viewerOptions = buildViewerOptions(allNodes, allEdges)
       ├─ State: currentViewer (selected ViewerIdentity)
       ├─ Compute: scopedView = computeScopedView(currentViewer, allNodes, allEdges)
       ├─ Filter: monthFilteredNodes (remove inactive people for selected month)
       ├─ Filter: monthFilteredEdges (edges between visible nodes only)
       ├─ Filter: filteredNodes (apply search query)
       ├─ Filter: filteredEdges
       ├─ Compute: edgeFlows (data flowing through edges this month)
       │
       └─ Render:
            ├─ Header bar (viewer selector, month nav, search, stats)
            ├─ MonthSummaryBar (active people, hours, pending)
            ├─ HiddenBanner (X nodes hidden from this view)
            └─ GraphCanvas or ListView
                 ├─ computeLayout() → LayoutNode[], LayoutEdge[]
                 ├─ SVG edges (bezier curves with arrowheads)
                 ├─ HTML node cards (absolutely positioned)
                 └─ NodeDetailDrawer (slide-in from right)
```

#### Viewer Selector

The ViewerSelector dropdown groups viewers into three categories:
1. **Admin** (red shield icon) - God mode, sees everything
2. **Organizations** (building icon) - See graph as that org
3. **People** (user icon) - See graph as that individual employee

When the viewer changes:
1. `setCurrentViewer(viewer)` updates local state
2. `setPersonaByNodeId(viewer.nodeId)` syncs with PersonaContext
3. `computeScopedView` is re-computed, filtering nodes/edges
4. The canvas re-renders with the new scoped view

---

## 11. GRAPH VISIBILITY & ReBAC

### `/components/workgraph/graph-visibility.ts`

This is the **Relationship-Based Access Control** engine. It determines what each viewer
can see based on their position in the graph.

### 11.1 Core Types

```typescript
type ViewerType = 'admin' | 'company' | 'agency' | 'client' | 'freelancer';

interface ViewerIdentity {
  nodeId: string;     // Graph node ID of the viewer
  type: ViewerType;
  name: string;
  orgId?: string;     // For employees: the party node they belong to
}

interface VisibleNode extends BaseNode {
  visibility: 'full' | 'partial' | 'masked';
  maskedFields?: string[];  // Which fields are hidden
  hopDistance: number;       // Distance from viewer in BFS
}

interface ScopedGraphView {
  viewer: ViewerIdentity;
  nodes: VisibleNode[];
  edges: VisibleEdge[];
  hiddenNodeCount: number;
  hiddenEdgeCount: number;
}
```

### 11.2 `computeScopedView()` - The Main Function

This function takes a viewer identity + full graph and returns the scoped view.

**Algorithm:**

1. **Admin shortcut**: If `viewer.type === 'admin'`, return everything with `visibility: 'full'`.

2. **Compute hop distances** via BFS:
   - Start nodes: viewer's own node + their org node (if employee)
   - Build undirected adjacency from edges
   - **CRITICAL FIX**: Also add virtual adjacency for person→org based on `partyId`
     (because auto-generated graphs don't create explicit edges between persons and their party)
   - BFS traversal computes distance from viewer to every reachable node
   - `effectiveMaxHops = 2` for employees, `maxHops` (default 3) for org viewers

3. **Filter nodes** by hop distance + viewer-specific scoping rules:

   **Employee scoping for person nodes** (most complex):
   - Always see yourself
   - See colleagues in same org (same `partyId`)
   - If approver: see people from directly connected parties IF `visibleToChain !== false`
   - Otherwise: hidden

   **Employee scoping for org/party nodes**:
   - See your own org
   - See directly connected orgs (via structural edges: billsTo, approves)
   - See orgs that share a contract with yours
   - Everything else: hidden

   **Employee scoping for contracts**:
   - Only see contracts where your org is partyA or partyB

   **Org viewer scoping** (viewing as the org itself, not as an employee):
   - Own employees: always visible
   - Other org's people: only if `visibleToChain !== false`
   - Freelancers: only if directly connected to viewer's org
   - Other orgs: only if directly connected or sharing a contract

4. **Compute masked fields** based on viewer type and hop distance:
   - Clients can't see internal rates on contracts they're not party to
   - Agencies can't see company's employee details
   - Companies can't see agency's rates to client
   - Freelancers see very limited data beyond their own chain

5. **Filter edges**: Only include edges where both endpoints are visible nodes.

### 11.3 `buildViewerOptions()` - Build Viewer Dropdown

Scans the graph and creates ViewerIdentity entries for:
1. Admin (always)
2. Each party node (company/agency/client)
3. Each person node (maps to company or freelancer type)

For persons, it determines `orgId` by:
1. Looking for `employs`/`assigns` edges pointing to the person
2. Falling back to `partyId` in the person's node data

### 11.4 Visibility Rules Summary

| Viewer | Sees own org people | Sees connected org people | Sees rates | Sees contracts |
|--------|-------------------|-----------------------------|------------|----------------|
| Admin | All | All | All | All |
| Employee (non-approver) | All colleagues | No | Own contracts | Own org's contracts |
| Employee (approver) | All colleagues | Chain-visible only | Own contracts | Own org's contracts |
| Org viewer | All employees | Chain-visible only | Own contracts | Own org's contracts |
| Freelancer | Self only | No | Own chain | Own contracts |

---

## 12. GRAPH AUTO-GENERATION FROM WIZARD

### `/utils/graph/auto-generate.ts`

Converts the wizard's party/people data into graph nodes and edges.

### 12.1 Input Types

```typescript
interface PartyEntry {
  id: string;
  name: string;
  partyType: PartyType;
  billsTo: string[];           // IDs of parties this party bills
  people: PersonEntry[];
  chainVisibility?: 'all' | 'selected' | 'none';
  // ...
}

interface PersonEntry {
  id: string;
  name: string;
  email: string;
  role: string;
  canApprove?: boolean;
  visibleToChain?: boolean;    // Individual visibility flag
  // ...
}
```

### 12.2 `generateGraphFromWizard(parties, projectName)`

**Step 1: Compute depths** (`computeDepths`)
- Uses topological sort from leaves
- Parties with no `billsTo` (outgoing) and no inbound connections = depth 0
- Parties receiving bills from depth-N parties = depth N+1
- This determines the horizontal layer in the graph layout

**Step 2: Create party nodes**
- One node per party with `chainPosition` = computed depth
- Color and logo based on `partyType`

**Step 3: Create person nodes**
- One node per person, with `partyId` linking to their party
- `visibleToChain` resolved: party-level `chainVisibility` overrides individual setting
  - `'none'` → all people hidden from chain
  - `'all'` → all people visible to chain
  - `'selected'` (default) → uses individual `person.visibleToChain`

**Step 4: Create billing edges**
- For each party's `billsTo` entries, create a `billsTo` or `subcontracts` edge
- Edge type inferred from source/target party types

**Step 5: Create approval edges**
- For each party with approvers (`canApprove: true`):
  - Find parties that bill TO this party (subordinates)
  - Create `approves` edge from each approver person to each subordinate party
  - This means: "this person approves timesheets from that company"

**IMPORTANT**: No `employs`/`assigns` edges are created! Person→org membership is
encoded only via `partyId` in person node data. This is why the BFS needed the
virtual adjacency fix.

### 12.3 `validatePartyChain(parties)`

Returns an array of error strings:
- "At least one/two parties required"
- "Party X is not connected to any other party"
- "Party X has no people assigned"

---

## 13. LAYOUT ENGINE (Pure SVG Sugiyama)

### Inside `WorkGraphBuilder.tsx`, lines 62-290

The layout engine implements a simplified Sugiyama-style hierarchical graph layout
entirely in JavaScript, rendered via absolutely-positioned HTML divs + SVG edges.

### 13.1 Constants

```typescript
const NODE_WIDTH = 240;
const NODE_HEIGHT_PERSON = 52;
const NODE_HEIGHT_ORG = 56;
const NODE_HEIGHT_CONTRACT = 80;
const LAYER_GAP = 300;     // Horizontal distance between layers
const NODE_GAP_Y = 16;     // Vertical gap between nodes in same layer
const GROUP_GAP_Y = 40;    // Extra gap between org groups
const PADDING = 80;        // Canvas padding
```

### 13.2 Layer Assignment (`assignLayer`)

```
Layer 0: Person nodes (leftmost)
Layer 1: Party nodes with chainPosition 0 + 1 (or default company position)
Layer 2: Party nodes with chainPosition 1 + 1, contracts, SOWs
Layer 3: Party nodes with chainPosition 2 + 1 (typically clients)
Layer N: Supports N-tier chains
```

The `chainPosition` comes from `computeDepths()` in auto-generate.ts.
Person nodes are always at layer 0 regardless of their org's position.

### 13.3 Sorting

- **Layer 0 (People)**: Sorted by org group, then alphabetically
- **Layer 1 (Companies)**: Companies before agencies
- **Layer 2+ (Clients, Contracts)**: Alphabetically

### 13.4 Positioning

Nodes are placed top-to-bottom within each layer:
```
currentY = PADDING
for each node in layer:
  if layer == 0 and org group changed: add GROUP_GAP_Y
  node.x = PADDING + layerIndex * LAYER_GAP
  node.y = currentY
  currentY += nodeHeight + NODE_GAP_Y
```

After positioning, layers are centered vertically around the tallest layer.

### 13.5 Edge Rendering

Edges are rendered as SVG cubic bezier curves:
```
M sourcePort C controlPoint1, controlPoint2, targetPort
```

Control point offset = `max(dx * 0.4, 60)` to create nice curves.

Edge visual properties:
- **employs**: Dashed gray (opacity 0.2)
- **approves**: Dashed blue with step number badge
- **billsTo**: Solid amber
- **funds**: Solid green

Highlighted edges (on hover/select) get a glow effect and thicker stroke.

### 13.6 Canvas Interaction

The `GraphCanvas` component handles:
- **Pan**: Mouse drag on background
- **Zoom**: Mouse wheel (0.2x to 2.5x)
- **Fit view**: Calculates zoom to fit all nodes
- **Select**: Click node → opens NodeDetailDrawer
- **Hover**: Highlights node + connected edges

State: `zoom`, `pan: {x, y}`, `isPanning`

The canvas uses a dotted grid background that scales with zoom:
```css
background: radial-gradient(circle at 1px 1px, var(--border) 0.5px, transparent 0.5px);
background-size: ${24 * zoom}px ${24 * zoom}px;
```

### 13.7 Rendering Engine History & reactflow Removal

#### Background: Two Rendering Systems

WorkGraph originally prototyped its graph canvas using **reactflow v11.10.0**, a popular
React library for node-based UIs. This is why files exist in `/components/workgraph/nodes/`
(`PartyNode.tsx`, `PersonNode.tsx`, `ContractNode.tsx`) and `CustomEdge.tsx` — these were
reactflow custom node/edge components using reactflow's `Handle`, `Position`, `EdgeProps`,
and `getBezierPath` APIs.

During Phase 2, the rendering was **completely rewritten** as a pure SVG + HTML layout engine
inside `WorkGraphBuilder.tsx`. This custom engine provides:

- **Full layout control**: Sugiyama-style hierarchical positioning (Section 13.2-13.4)
- **Inline node cards**: `OrgNodeCard`, `PersonNodeCard`, `ContractNodeCard` rendered as
  absolutely-positioned HTML `<div>` elements over an SVG canvas
- **Custom edge rendering**: SVG cubic bezier paths with arrowhead markers, hover glow effects,
  and flow badges — all rendered directly in the SVG layer
- **Pan/zoom**: Native mouse event handling (no library overhead)

However, **the old reactflow imports were never cleaned up** from 6 files. The reactflow
library was not used at runtime, but the `import` statements still existed, causing the
module bundler to attempt loading `reactflow@11.10.0`.

#### The Module Resolution Failure (March 20, 2026)

The Figma Make deployment environment uses dynamic module imports via HTTPS. The reactflow
package resolution failed with:

```
TypeError: Failed to fetch dynamically imported module:
https://app-*.makeproxy-c.figma.site/@react-refresh
```

This was a **cascading failure**: reactflow's internal dependency on `@react-refresh` could
not be resolved in the Figma Make CDN environment. Since the imports existed in 6 files
that were transitively loaded by the active application (e.g., `useGraphPersistence.ts` is
imported by `WorkGraphBuilder.tsx`), the entire app failed to load.

#### The Fix: Complete reactflow Removal

All 6 files with `import ... from 'reactflow@11.10.0'` were migrated to use local
type aliases or inline stubs. No runtime behavior changed because reactflow was never
called at runtime.

**Files affected and what was done:**

| File | What was imported | Replacement |
|------|------------------|-------------|
| `/components/hooks/useGraphPersistence.ts` | `Node`, `Edge` types | `type Node = any; type Edge = any;` — these types were only used for generic graph serialization (saving/loading JSON to KV). The actual shapes are `BaseNode`/`BaseEdge` from `/types/workgraph.ts`. |
| `/components/workgraph/overlay-transforms.ts` | `Node`, `Edge` types | Same `any` aliases. The overlay engine operates on generic node/edge objects with `.data`, `.style`, `.type` properties — no reactflow-specific APIs are called. |
| `/components/workgraph/nodes/PartyNode.tsx` | `Handle`, `Position` | `Handle` stubbed as a no-op `<div>`. `Position` stubbed as a const object `{ Top, Bottom, Left, Right }`. **This component is not rendered by the active engine** — `WorkGraphBuilder.tsx` renders `OrgNodeCard` instead. |
| `/components/workgraph/nodes/PersonNode.tsx` | `Handle`, `Position` | Same stubs as PartyNode. **Not rendered by active engine** — `PersonNodeCard` is used instead. |
| `/components/workgraph/nodes/ContractNode.tsx` | `Handle`, `Position` | Same stubs. **Not rendered** — `ContractNodeCard` is used instead. |
| `/components/workgraph/CustomEdge.tsx` | `EdgeProps`, `getBezierPath` | `EdgeProps` aliased to `any`. `getBezierPath` replaced with a local cubic bezier implementation: `M sx sy C mx sy, mx ty, tx ty`. **Not rendered** — `WorkGraphBuilder` renders SVG `<path>` elements directly. |

#### Active vs Legacy Rendering Components

| Concern | Active (used now) | Legacy (stubs, not rendered) |
|---------|-------------------|------------------------------|
| Org/party nodes | `OrgNodeCard` in WorkGraphBuilder.tsx (inline) | `PartyNode.tsx` in nodes/ |
| Person nodes | `PersonNodeCard` in WorkGraphBuilder.tsx (inline) | `PersonNode.tsx` in nodes/ |
| Contract nodes | `ContractNodeCard` in WorkGraphBuilder.tsx (inline) | `ContractNode.tsx` in nodes/ |
| Edges | SVG `<path>` elements in `GraphCanvas` (inline) | `CustomEdge.tsx` |
| Layout | `computeLayout()` in WorkGraphBuilder.tsx | N/A (reactflow had its own) |
| Pan/zoom | Mouse events in `GraphCanvas` component | N/A (reactflow had its own) |
| Graph persistence | `useGraphPersistence.ts` (uses generic `any` types for serialization) | Was using reactflow `Node`/`Edge` types |
| Overlay transforms | `overlay-transforms.ts` (uses generic `any` types) | Was using reactflow `Node`/`Edge` types |

#### Why the Legacy Files Still Exist

The legacy node/edge components in `nodes/` and `CustomEdge.tsx` are kept for reference
because they contain useful logic (edge type styling, badge rendering, permission display)
that may be backported into the active inline components. They are importable without
errors now (stubs prevent any reactflow resolution), but **nothing in the active render
tree imports or renders them**.

The `overlay-transforms.ts` and `useGraphPersistence.ts` files ARE actively used — they
just never needed reactflow's specific type constraints. The `any` aliases are functionally
correct because:
- `useGraphPersistence` serializes/deserializes graph data as opaque JSON to/from the KV store
- `overlay-transforms` reads `.data`, `.style`, `.type` properties that exist on our
  `BaseNode`/`BaseEdge` types regardless of whether they extend reactflow's types

#### Future Cleanup

To fully retire the legacy files:
1. Extract any remaining useful styling/logic from `nodes/*.tsx` and `CustomEdge.tsx`
   into the active `WorkGraphBuilder.tsx` inline components
2. Delete `nodes/PartyNode.tsx`, `nodes/PersonNode.tsx`, `nodes/ContractNode.tsx`, `CustomEdge.tsx`
3. Replace `any` aliases in `useGraphPersistence.ts` with `BaseNode`/`BaseEdge` from
   `/types/workgraph.ts`
4. Replace `any` aliases in `overlay-transforms.ts` with `BaseNode`/`BaseEdge`

---

## 14. NODE DETAIL DRAWER

### `/components/workgraph/NodeDetailDrawer.tsx`

A 360px-wide slide-in panel on the right side of the graph canvas.
Shows contextual details based on the selected node type.

### 14.1 Structure

The drawer is split into sections:

**For Person nodes:**
1. Header (avatar, name, role, company)
2. "My Chain" path visualization (person → org → client)
3. Contracts section (contracts involving their org)
4. Timesheet summary (hours this month)
5. Documents section (NDAs, compliance)
6. Quick actions (submit timesheet, request approval)

**For Party (org) nodes:**
1. Header (icon, name, party type)
2. People list (`OrgPeopleList` component)
3. Contracts section
4. Aggregate hours
5. Actions

**For Contract nodes:**
1. Header (name, type, status)
2. Parties (partyA, partyB)
3. Rate details (masked if viewer doesn't have permission)
4. Covered people
5. NDA status

### 14.2 OrgPeopleList Component

Shows people belonging to an org. Finds people via:
1. `employs`/`assigns` edges where `source === orgId`
2. Person nodes where `data.partyId === orgId`

Each person row shows:
- Avatar with initials (or lock icon if masked)
- Name and role
- Approver badge (blue "approver" pill with Shield icon) if `canApprove`
- "internal" badge (orange with EyeOff) if `visibleToChain === false`
- Hours submitted this month
- Click to navigate to that person's detail view

### 14.3 Navigation

The drawer supports navigation between nodes:
- Click a person in an org's people list → drawer shows that person
- Click an org in a person's chain → drawer shows that org
- "Jump to timesheets" → dispatches custom event `changeTab` to switch ProjectWorkspace tab

---

## 15. GRAPH DATA FLOWS & MONTHLY SNAPSHOTS

### `/components/workgraph/graph-data-flows.ts`

Provides temporal data about what's happening in the graph each month.

### 15.1 Monthly Snapshots

Currently uses hardcoded demo data (`MONTHLY_SNAPSHOTS` array) with months from
Oct 2025 to Jan 2026. Each snapshot contains:

```typescript
{
  month: '2025-11',
  label: 'Nov 2025',
  activePeople: [
    {
      personId: 'user-sarah',
      orgId: 'org-acme',
      hoursSubmitted: 168,
      hoursApproved: 160,
      status: 'active'  // or 'onboarding', 'offboarding', 'inactive'
    },
    // ...
  ],
  flows: [/* DataFlowItem[] */],
  stats: {
    totalHoursSubmitted: 2180,
    totalHoursApproved: 2020,
    totalAmountInvoiced: 342400,
    pendingApprovals: 12,
    activeContracts: 5,
    activeNDAs: 4
  }
}
```

### 15.2 Helper Functions

- `getSnapshotForMonth(month)` - Returns the snapshot for a given month
- `getActivePeopleIds(month)` - Returns Set of active person IDs
- `getPersonMonthlyActivity(personId, month)` - Returns individual person's activity
- `computeEdgeFlows(edges, snapshot)` - Computes what data flows through each edge

### 15.3 Edge Flow Visualization

When a node is selected/hovered, edges show flow badges:
```
[ 3 timesheets, 1 NDA ]
```
Yellow background if there are alerts (pending items), green if all clear.

---

## 16. PROJECT CREATE WIZARD

### `/components/workgraph/ProjectCreateWizard.tsx`

A 4-step wizard dialog for creating new projects with their supply chains.

### 16.1 Steps

**Step 1: Basics**
- Project name, region, currency
- Start/end dates (calendar picker)
- Work week checkboxes (Mon-Sun)

**Step 2: Supply Chain**
- Add parties (company, agency, client, freelancer, contractor)
- Each party has: name, type, search for existing company
- Draw connections: each party selects who they `billsTo` via dropdown
- Live DAG preview (mini SVG visualization)
- Validates: cycle detection, disconnected nodes, minimum 2 parties

**Step 3: People**
- Per-party people list
- Each person: name, email, role
- Permission toggles: `canApprove`, `canViewRates`, `canEditTimesheets`
- `visibleToChain` toggle per person
- Party-level `chainVisibility` dropdown (all/selected/none) in header

**Step 4: Review**
- Summary of all parties, connections, people
- Live mini-graph preview
- Validation errors/warnings
- "Create Project" button

### 16.2 On Create

1. Calls `generateGraphFromWizard(parties, projectName)` to produce nodes + edges
2. Calls `createProject()` API with project data + graph
3. Stores graph in KV alongside the project
4. Navigates to project workspace

### 16.3 Side-by-Side Layout

The wizard uses a split layout:
- Left side: form content (scrollable)
- Right side: live mini-graph preview that updates as you configure

---

## 17. TIMESHEET SYSTEM

### 17.1 Architecture

The timesheet system is the most feature-rich module, with many components:

```
TimesheetModule.tsx                  # Main container with view switching
├── EnhancedTimesheetCalendar.tsx   # Calendar grid view
├── TimesheetCalendarView.tsx       # Simplified calendar
├── TimesheetListView.tsx           # List-based entry view
├── UnifiedTimesheetView.tsx        # Combined view
├── BulkTimesheetEntry.tsx          # Bulk entry form
├── MultiPersonTimesheetCalendar.tsx # Multi-person calendar
├── table/
│   ├── TimesheetTableView.tsx     # Table-based view
│   ├── MonthlyTable.tsx           # Monthly table
│   └── WeeklyTable.tsx            # Weekly table
├── forms/
│   ├── EntryEditForm.tsx          # Single entry editor
│   ├── BulkEntryEditor.tsx        # Bulk entry editor
│   ├── MultiTaskEditor.tsx        # Multiple tasks per day
│   └── HoursInputWithCalculator.tsx # Hours calculator
├── modal/
│   ├── SinglePersonDayModal.tsx   # Day detail modal
│   ├── MultiPersonDayModal.tsx    # Multi-person day modal
│   └── EnhancedMultiPersonDayModal.tsx
├── approval/                       # Approval views (see section 18)
└── hooks/
    ├── useTimesheetState.ts       # Complex state management
    ├── useMultiDaySelection.ts    # Multi-day drag selection
    └── useUndoRedo.ts             # Undo/redo for entries
```

### 17.2 Data Model

The timesheet model is "hours-first":
- **Week** is the primary unit (Mon-Fri)
- Each week has a **status**: draft → submitted → approved | rejected
- Each **day** has: hours, optional start/end time, break, notes, tasks
- Each day can have multiple **tasks** with categories

### 17.3 View Modes

1. **Calendar**: Grid showing days with colored cells (green = approved, amber = submitted)
2. **Table**: Spreadsheet-like with editable cells
3. **List**: Vertical list of entries
4. **Bulk**: Form for entering many entries at once

### 17.4 Data Flow

```
TimesheetDataContext (global state)
  → getWeeksForPerson(personId, month)
  → Components render week/day data
  → User edits → updateWeekDays() / updateSingleDay()
  → Debounced API write → saveTimesheetWeek()
  → Status change → setWeekStatus() → updateTimesheetStatus()
```

---

## 18. APPROVAL SYSTEM

### 18.1 Graph-Based Approvals

The approval chain is derived from the graph structure:
1. Person submits a timesheet
2. System looks at `approves` edges in the graph
3. Finds approvers for the submitter's org (people with `canApprove: true` in upstream parties)
4. Routes the approval request through the chain in order

### 18.2 Components

```
ApprovalsWorkbench.tsx              # Main approval page
├── ProjectApprovalsTab.tsx        # Per-project approval view
├── GraphOverlayModal.tsx          # Graph overlay showing approval paths
├── DeepLinkHandler.tsx            # Handles /approve?token=... links
└── EmailPreview.tsx               # Preview approval emails
```

### 18.3 Approval V2 (`/components/timesheets/approval-v2/`)

Redesigned approval view:
- `ApprovalsV2Tab.tsx` - Organization-grouped approval table
- `OrganizationGroupedTable.tsx` - Groups timesheets by org
- `MonthlyTimesheetDrawer.tsx` - Detailed view of a person's month
- `period-aggregation.ts` - Aggregates timesheet data by period

### 18.4 Batch Approval

`BatchApprovalView.tsx` and `BatchApprovalBar.tsx` allow:
- Select multiple timesheet weeks
- Approve/reject all at once
- Shows running totals of selected hours

---

## 19. NOTIFICATION SYSTEM

### 19.1 Components

```
NotificationBell.tsx               # Bell icon with unread count
NotificationDropdown.tsx           # Dropdown list
NotificationItem.tsx               # Individual notification
InAppNotificationCenter.tsx        # Full notification center
ActivityFeedPage.tsx               # Full-page activity feed
NotificationPreferencesPanel.tsx   # Preferences management
ApprovalChainTracker.tsx           # Tracks approval chain progress
```

### 19.2 Email Integration

The server can send emails via Resend API:
- Approval request emails
- Approval/rejection notifications
- Deep links to approve/reject directly from email

Email templates are in `/utils/notifications/email-templates.ts`.

---

## 20. AUTHENTICATION & AUTHORIZATION

### 20.1 Auth Flow

1. **Sign Up**: Frontend → server `/signup` → Supabase `auth.admin.createUser()`
   - Uses `email_confirm: true` (no email verification needed)
   - Stores user metadata (name, etc.)

2. **Sign In**: Frontend → Supabase `auth.signInWithPassword()`
   - Returns `access_token` (JWT)
   - Token stored in AuthContext

3. **Session Check**: On mount, `supabase.auth.getSession()`
   - Restores session from cookies/localStorage

4. **API Calls**: `Authorization: Bearer <accessToken>`
   - Server validates via `supabase.auth.getUser(token)`

### 20.2 Authorization Layers

1. **API-level**: Server checks `userId` from token. Routes return 401 if unauthorized.
2. **Data-level**: User can only access their own projects/timesheets (KV key includes userId)
3. **Graph-level (ReBAC)**: Visibility engine controls what graph data is shown
4. **Persona-level**: Test mode allows perspective switching (temporary)

---

## 21. LANDING PAGE & ONBOARDING

### 21.1 Landing Page (`/components/Landing.tsx`)

Public marketing page with:
- Hero section with CTA
- Feature comparison diagram
- Benefits sections
- Pricing snapshot
- Testimonials
- Logo strip
- FAQ
- Final CTA banner

### 21.2 Onboarding Flows

Three distinct onboarding paths:
- **Freelancer** (`FreelancerOnboarding.tsx`): Profile setup, skills, rates
- **Company** (`CompanyOnboarding.tsx`): Company details, team setup
- **Agency** (`AgencyOnboardingNew.tsx`): Agency details, services

All use `OnboardingLayout.tsx` as a wrapper with progress tracking.

---

## 22. DASHBOARD & SOCIAL FEATURES

### 22.1 Dashboard (`/components/dashboard/DashboardPage.tsx`)

Widget-based dashboard with:
- `StatCard` - Key metrics (hours, earnings, etc.)
- `EarningsChart` - Revenue chart (Recharts)
- `JobOpportunitiesCard` - Available jobs
- `NetworkFeed` - Recent network activity
- Widget cards: AI Insights, Active Projects, Inbox, My Week, Quick Actions, Deadlines

### 22.2 Social Features

Located in `/components/social/`:
- `PostCard` - Social post with likes/comments
- `ProfileCard` - User profile card
- `MiniFeed` - Compact activity feed
- `ActivityRibbon` - GitHub-style activity heatmap
- `IntentChips` - Quick action chips
- `TagRail` - Skill/tag browsing
- `CommunityMetrics` - Network statistics

### 22.3 Feed (`/components/FeedHome.tsx`)

Social feed with posts from the network.

---

## 23. CONTRACTS MODULE

### `/components/contracts/`

- `ContractsPage.tsx` - Main contracts list page
- `ContractCard.tsx` - Individual contract card
- `MyContractsPanel.tsx` - User's active contracts
- `InvitationInbox.tsx` - Contract invitations
- `DisclosureRequestDialog.tsx` - Rate disclosure requests
- `MigrationRunner.tsx` - Data migration tool

---

## 24. UI COMPONENT LIBRARY

### `/components/ui/`

Full shadcn/ui component library with Tailwind CSS v4:

| Component | File | Description |
|-----------|------|-------------|
| Accordion | accordion.tsx | Collapsible sections |
| Alert | alert.tsx | Alert messages |
| Alert Dialog | alert-dialog.tsx | Confirmation dialogs |
| Avatar | avatar.tsx | User avatars |
| Badge | badge.tsx | Status badges |
| Button | button.tsx | Buttons (variants: default, outline, ghost, etc.) |
| Calendar | calendar.tsx | Date picker calendar |
| Card | card.tsx | Content cards |
| Checkbox | checkbox.tsx | Checkboxes |
| Command | command.tsx | Command palette |
| Dialog | dialog.tsx | Modal dialogs |
| Dropdown Menu | dropdown-menu.tsx | Dropdown menus |
| Input | input.tsx | Text inputs |
| Label | label.tsx | Form labels |
| Popover | popover.tsx | Popovers |
| Progress | progress.tsx | Progress bars |
| Radio Group | radio-group.tsx | Radio buttons |
| Scroll Area | scroll-area.tsx | Scrollable containers |
| Select | select.tsx | Select dropdowns |
| Separator | separator.tsx | Dividers |
| Sheet | sheet.tsx | Side sheets |
| Skeleton | skeleton.tsx | Loading skeletons |
| Slider | slider.tsx | Range sliders |
| Switch | switch.tsx | Toggle switches |
| Table | table.tsx | Data tables |
| Tabs | tabs.tsx | Tab navigation |
| Textarea | textarea.tsx | Multiline text |
| Tooltip | tooltip.tsx | Tooltips |
| Toast (Sonner) | sonner.tsx | Toast notifications |

---

## 25. STYLING SYSTEM

### `/styles/globals.css`

Uses Tailwind CSS v4 with CSS custom properties:

```css
:root {
  /* Apple-inspired design system */
  --background: #F7F8FA;
  --foreground: #0B0F14;
  --card: #FFFFFF;
  --border: #E6E8EC;
  --accent-brand: #3B77FF;
  --muted-foreground: #6B7280;
  
  /* Status colors */
  --success: #10B981;
  --warning: #F59E0B;
  --destructive: #EF4444;
  
  /* Charts */
  --chart-1: #2563EB;
  --chart-2: #10B981;
  // ...
}
```

**Design principles:**
- Clean, minimal Apple-inspired aesthetic
- 8px spacing scale
- 28/20/16/14/12 typography scale
- Single brand accent hue (`#3B77FF`)
- Status colors reserved for data states only
- Light mode only (dark mode disabled)

---

## 26. KEY PATTERNS & CONVENTIONS

### 26.1 File Naming
- Components: PascalCase (`WorkGraphBuilder.tsx`)
- Utilities: kebab-case (`graph-visibility.ts`)
- Types: kebab-case or camelCase (`workgraph.ts`, `collaboration.ts`)
- Hooks: camelCase with `use` prefix (`useGraphPersistence.ts`)

### 26.2 Component Structure
- Default exports for page components
- Named exports for reusable components
- Inline sub-components for single-file components (like WorkGraphBuilder)
- `useMemo` for expensive computations
- `useCallback` for stable function references
- `useRef` for DOM references and mutable values

### 26.3 State Management
- Global state via React Context (no Redux, no Zustand)
- Local state via `useState`/`useReducer`
- Server state via manual `useEffect` + `fetch` (no React Query in most places)
- Persistence via KV store API calls

### 26.4 API Calls
- All API calls go through `/utils/api/*.ts` clients
- Use `Authorization: Bearer <accessToken>` header
- Fall back to `publicAnonKey` if no access token
- Error handling: throw on non-OK response, catch in component

### 26.5 Error Handling
- `ErrorBoundary` wraps the entire app
- `DrawerErrorBoundary` wraps the NodeDetailDrawer
- API errors logged to console + shown via toast
- Server errors include detailed error messages

### 26.6 Navigation
- React Router v6 Data mode (createBrowserRouter + RouterProvider)
- Hash params for deep linking within ProjectWorkspace
- Custom events for tab switching within ProjectWorkspace:
  ```typescript
  window.dispatchEvent(new CustomEvent('changeTab', { detail: 'timesheets' }));
  ```

### 26.7 Protected Files (DO NOT MODIFY)
- `/src/app/components/figma/ImageWithFallback.tsx`
- `/supabase/functions/server/kv_store.tsx`
- `/utils/supabase/info.tsx`

---

## 27. KNOWN ISSUES & TECHNICAL DEBT

### 27.1 Active Issues
1. **Person-to-org edges**: Auto-generator creates person nodes with `partyId` but no
   explicit edges. The BFS virtual adjacency fix works but is a workaround.
   **Future fix**: Generate explicit `employs` edges in `auto-generate.ts`.

2. **Hardcoded monthly snapshots**: `graph-data-flows.ts` uses static demo data.
   Should be computed from actual timesheet data.

3. **Test personas**: PersonaContext uses hardcoded personas. Should be replaced
   with real user profiles from the graph.

4. **orgPeopleCount calculation**: In WorkGraphBuilder line 947-955, the people count
   on org nodes only counts `employs`/`assigns` edges, missing `partyId`-based
   memberships. The OrgPeopleList in the drawer handles this correctly.

5. **Mock data in WorkGraphContext**: Uses hardcoded organization contexts.

### 27.2 Technical Debt
1. Many components are very long (WorkGraphBuilder: 1537 lines, NodeDetailDrawer: 1400+ lines).
   Could be split into smaller sub-components.

2. Some demo data files (`demo-data*.ts`) are still imported in production components.

3. The template system (`templates.ts`) duplicates data that should come from the API.

4. ~~React Flow imports in some files (`useGraphPersistence.ts`, `overlay-transforms.ts`)
   even though we no longer use React Flow for the canvas.~~
   **RESOLVED (March 20, 2026)**: All 6 reactflow imports replaced with local stubs/aliases.
   See Section 13.7 for full details. Remaining cleanup: replace `any` aliases with
   `BaseNode`/`BaseEdge` types, and delete unused legacy node/edge files.

5. Multiple approval view implementations (v1 and v2) that should be consolidated.

---

## 28. FUTURE ROADMAP

The canonical forward-looking plan now lives in [`/src/docs/ROADMAP.md`](./ROADMAP.md).

This architecture document is the source of truth for:
- the current implementation
- key technical decisions
- code layout and data flow
- current technical debt

`ROADMAP.md` is the source of truth for:
- customer sequencing
- phase priorities
- what should be built next
- what is intentionally deferred

### Current Canonical Sequence

1. Production auth, invites, and incremental supply-chain onboarding
2. Invoice generation from approved timesheets
3. CSV import and PDF export
4. Multi-project unified dashboard
5. Supply Chain Assistant (AI Agent 1)
6. Stripe and money movement
7. Public profiles and Matchmaker (AI Agent 2)
8. Analytics and reporting
9. Collaboration, mobile, and public API
10. Enterprise features

---

## APPENDIX A: COMPLETE FILE INVENTORY

### Root Files
| File | Lines (est.) | Purpose |
|------|-------------|---------|
| App.tsx | 34 | Entry point, provider nesting |
| routes.tsx | 58 | React Router configuration |

### Components (Core)
| File | Lines (est.) | Purpose |
|------|-------------|---------|
| AppLayout.tsx | ~100 | Authenticated layout wrapper |
| AppHeader.tsx | ~200 | Global navigation header |
| Landing.tsx | ~500 | Public landing page |
| ProjectWorkspace.tsx | ~300 | Project tab container |
| FeedHome.tsx | ~200 | Social feed page |
| DashboardPage.tsx | ~200 | Dashboard with widgets |
| ProfilePage.tsx | ~200 | User profile page |
| SettingsPage.tsx | ~150 | Settings page |
| AuthModal.tsx | ~200 | Sign in/up modal |
| ErrorBoundary.tsx | ~50 | Error boundary component |

### Components (WorkGraph) - THE CORE
| File | Lines (est.) | Purpose |
|------|-------------|---------|
| WorkGraphBuilder.tsx | 1537 | Graph canvas, layout, rendering |
| graph-visibility.ts | ~520 | ReBAC visibility engine |
| graph-data-flows.ts | ~400 | Monthly snapshots, edge flows |
| NodeDetailDrawer.tsx | ~1400 | Node inspection drawer |
| ProjectCreateWizard.tsx | ~1200 | 4-step project creation |
| templates.ts | ~400 | Default graph templates |
| overlay-transforms.ts | ~200 | Visual overlay engine (reactflow types removed) |
| nodes/PartyNode.tsx | ~120 | LEGACY: Not rendered. reactflow stubs. |
| nodes/PersonNode.tsx | ~37 | LEGACY: Not rendered. reactflow stubs. |
| nodes/ContractNode.tsx | ~52 | LEGACY: Not rendered. reactflow stubs. |
| CustomEdge.tsx | ~140 | LEGACY: Not rendered. reactflow stubs. |
| CompanySearchDialog.tsx | ~150 | Company search modal |
| CompileModal.tsx | ~200 | Policy compilation |
| PolicySimulator.tsx | ~300 | What-if simulator |

### Contexts
| File | Lines (est.) | Purpose |
|------|-------------|---------|
| AuthContext.tsx | ~200 | Supabase auth |
| PersonaContext.tsx | 250 | Test persona switching |
| WorkGraphContext.tsx | 62 | Org context |
| TimesheetDataContext.tsx | ~500 | Timesheet store |
| MonthContext.tsx | ~30 | Month selection |
| NotificationContext.tsx | ~100 | Notifications |

### Server
| File | Lines (est.) | Purpose |
|------|-------------|---------|
| index.tsx | 49 | Route registration |
| projects-api.tsx | ~200 | Projects CRUD |
| contracts-api.tsx | ~150 | Contracts CRUD |
| timesheets-api.tsx | ~100 | Timesheets CRUD |
| auth.tsx | ~50 | Signup endpoint |
| email.tsx | ~100 | Email sending |

---

## APPENDIX B: COMMON DEVELOPMENT TASKS

### Adding a New Node Type

1. Add to `NodeType` in `/types/workgraph.ts`
2. Create data interface (e.g., `TeamNodeData`)
3. Add rendering in `WorkGraphBuilder.tsx` (new card component)
4. Add layer assignment in `assignLayer()`
5. Add detail view in `NodeDetailDrawer.tsx`
6. Add edge type inference in `auto-generate.ts`

### Adding a New API Endpoint

1. Create handler in `/supabase/functions/server/` (new file or existing)
2. Add to `index.tsx` route registration
3. Create frontend client in `/utils/api/`
4. Add types if needed in `/types/`

### Changing Visibility Rules

Edit `/components/workgraph/graph-visibility.ts`:
- `computeScopedView()` for node filtering
- `getMaskedFields()` for field masking
- Update the scoping conditions in the `allNodes.forEach()` loop

### Adding a New Wizard Step

Edit `/components/workgraph/ProjectCreateWizard.tsx`:
1. Add step type to `Step` union
2. Add step content component
3. Add to step navigation logic
4. Update progress bar
5. Handle data in the review/create step

---

## APPENDIX C: DEBUGGING GUIDE

### Graph Visibility Issues
1. Check `computeHopDistances()` - are nodes reachable via BFS?
2. Check virtual adjacency - does the person have `partyId` set?
3. Check scoping conditions in `computeScopedView()`
4. Console log: `scopedView.hiddenNodeCount` to see how many nodes are hidden

### API Issues
1. Check server logs in Supabase dashboard
2. Check browser console for error responses
3. Verify `Authorization` header has valid token
4. Check KV key format matches between read and write

### Module Resolution / Build Failures
1. If you see `Failed to fetch dynamically imported module` errors, check for **unused
   library imports**. The Figma Make environment resolves all imports via HTTPS CDN —
   even unused imports trigger network fetches that can fail.
2. Search codebase: `grep -r "from '.*@" --include="*.ts" --include="*.tsx"` to find
   all versioned package imports. Verify each is actually needed at runtime.
3. The reactflow removal (Section 13.7) is the canonical example of this failure mode.
4. Common fix: replace library type imports with `type Foo = any` if only used for
   type annotations, not runtime behavior.

### Layout Issues
1. Check `assignLayer()` - is the node in the right layer?
2. Check `computeDepths()` - is the chain position correct?
3. Check edge visibility - are both endpoints visible?
4. Console log `layoutNodes` and `layoutEdges` in `computeLayout()`

---

*This document covers every major component, type, pattern, and architectural decision
in the WorkGraph codebase. When in doubt, trace the data flow from the user interaction
back through the component tree, through the context providers, to the API clients,
and finally to the KV store.*
