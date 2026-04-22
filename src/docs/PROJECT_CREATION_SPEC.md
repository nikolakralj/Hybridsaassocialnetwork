# Project Creation — Full Redesign Spec

**Owner:** Claude · **Implementers:** Codex (3 cycles) · **Status:** Ready
**Date:** 2026-04-22 · **Audit basis:** `src/components/workgraph/ProjectCreateWizard.tsx`, `src/utils/api/projects-api.ts`, `supabase/migrations/005_workgraph_core.sql`

---

## Executive Summary

The current wizard is a 4-step modal that systematically ignores its own inputs: draft projects are hardcoded to active, currency/region are hardcoded to EUR/EU, the `graphNodeId` it tries to write doesn't exist as a column, and two separate invitation tables are never connected. The permission model exists in schema (`role`, `scope`, `accepted_at`, RLS) but isn't enforced meaningfully — Contributors can see other orgs' data, Viewers can't be set from the UI, and visibility flags live only in graph node data with no DB backing.

This spec fixes all of it in three ordered Codex cycles.

---

## Current State (what the audit found)

| Problem | Location | Impact |
|---|---|---|
| `wg_projects.status` hardcoded 'active' | `projects-api.ts:380` | Draft projects impossible |
| `wg_projects.supply_chain_status` hardcoded 'complete' | `projects-api.ts:381` | Incomplete chains indistinguishable |
| `region`/`currency` hardcoded 'EU'/'EUR' | `ProjectCreateWizard.tsx:294` | All projects same region |
| `graphNodeId` written but column missing | `ProjectCreateWizard.tsx:279` | Person→graph mapping broken; approvals can't route |
| `wg_project_invitations` never used | whole codebase | Invitation system exists but dead |
| `accepted_at IS NULL` blocks RLS | `005_workgraph_core.sql:172` | Invited-but-not-accepted users see nothing |
| `canViewRates`, `canEditTimesheets`, `visibleToChain` live in graph only | `ProjectCreateWizard.tsx:895-896` | Not queryable; not enforceable |
| `scope` stored but no RLS check | `005_workgraph_core.sql` | Contributors can read other party data |
| Graph `updateProject` failure silent | `ProjectCreateWizard.tsx:323` | Graph lost with no user notification |
| Commenter/Viewer roles unreachable from UI | wizard | Dead schema entries |
| Modal too small for live graph preview | visual | Preview is decorative, not useful |

---

## Cycle 1 — Schema + API correctness (Postgres-pro + backend-developer)

### Migration 013: `graph_node_id` column + invite linkage

```sql
-- 013_graph_node_id_and_invite_link.sql

-- 1. Add missing graphNodeId to wg_project_members
ALTER TABLE wg_project_members
  ADD COLUMN IF NOT EXISTS graph_node_id TEXT;

CREATE INDEX IF NOT EXISTS wg_members_graph_node_idx
  ON wg_project_members(graph_node_id);

-- 2. Backfill from existing data where scope matches a person node pattern
-- (manual verification required; left for admin backfill)

-- 3. Link wg_project_members to wg_project_invitations
ALTER TABLE wg_project_members
  ADD COLUMN IF NOT EXISTS invitation_id UUID
    REFERENCES wg_project_invitations(id) ON DELETE SET NULL;

-- 4. Add visibility + capability columns to wg_project_members
ALTER TABLE wg_project_members
  ADD COLUMN IF NOT EXISTS can_approve       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_view_rates    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_edit_timesheets BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visible_to_chain  BOOLEAN NOT NULL DEFAULT TRUE;

-- 5. Expand role values (already TEXT in schema; just document the contract)
COMMENT ON COLUMN wg_project_members.role IS
  'Owner | Editor | Contributor | Commenter | Viewer';

-- 6. Add RLS policy: Contributor scope enforcement
-- Contributors can only see members belonging to their party scope
CREATE POLICY wg_members_scope_contributor ON wg_project_members
  FOR SELECT
  USING (
    -- Owners see all
    project_id IN (SELECT id FROM wg_projects WHERE owner_id = auth.uid())
    OR
    -- Accepted members see their own scope + any 'all' scope members
    (
      EXISTS (
        SELECT 1 FROM wg_project_members m
        WHERE m.project_id = wg_project_members.project_id
          AND m.user_id = auth.uid()
          AND m.accepted_at IS NOT NULL
          AND (
            m.role IN ('Owner', 'Editor')      -- Editors see all
            OR m.scope = wg_project_members.scope  -- Contributor sees own party
          )
      )
    )
  );
```

### API fixes in `projects-api.ts`

**Fix 1 — Stop hardcoding status/supply_chain_status:**

```typescript
// supabaseCreateProject — replace hardcoded values with passed-in values
status: input.status || 'active',
supply_chain_status: input.supplyChainStatus || 'complete',
```

**Fix 2 — Write graphNodeId to wg_project_members:**

```typescript
// In member row construction (line ~390)
graph_node_id: m.graphNodeId || null,
can_approve: m.canApprove ?? false,
can_view_rates: m.canViewRates ?? true,
can_edit_timesheets: m.canEditTimesheets ?? true,
visible_to_chain: m.visibleToChain ?? true,
```

**Fix 3 — Fatal error if graph save fails (not silent):**

```typescript
// ProjectCreateWizard.tsx line 316-323
const graph = generateGraphFromWizard(parties, name);
try {
  await updateProject(result.project.id, {
    graph: { nodes: graph.nodes, edges: graph.edges },
    parties: parties.map(p => ({ ... })),
  }, accessToken);
} catch (e) {
  // Surface the error — don't silently proceed
  toast.error('Project created but graph failed to save. Please go to Project Graph tab and click Save.');
  console.error('Failed to save graph:', e);
  // Don't throw — project itself was created
}
```

**Fix 4 — Remove region/currency from wizard entirely:**

Strip `region` and `currency` from `ProjectCreateWizard.tsx` state and from `supabaseCreateProject`. These belong at the organization or contract level — not project creation (confirmed by Jira, Asana, Monday.com, MS Planner: none ask for currency at project creation). The existing hardcoded 'EU'/'EUR' can stay as a DB default until an org-settings page exists. When currency is needed (invoices, contracts), it is set on `wg_contracts`, not `wg_projects`.

### Deliverables (Cycle 1)
- [ ] Migration file `supabase/migrations/013_graph_node_id_and_invite_link.sql`
- [ ] `supabaseCreateProject` passes `status`, `supplyChainStatus`, `graphNodeId`, capability flags
- [ ] Graph save failure surfaces as toast (not silent)
- [ ] `npm run build` passes
- [ ] Update `AGENT_WORKLOG.md`

---

## Cycle 2 — Wizard UX: full-page, 5 steps, real permissions (frontend-developer)

### Layout: modal → full-page

Replace the current dialog (`Dialog` from shadcn) with a **full-page route** at `/app/projects/new` and `/app/projects/:id/setup`.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back   Create Project                               Step 2 of 5  │
├───────────────────────────┬─────────────────────────────────────────┤
│   LEFT PANEL (480px)      │   RIGHT PANEL (flex, min 400px)         │
│   Step form               │   Live Graph Preview                    │
│                           │   (real React flow / SVG canvas)        │
│                           │   Updates on every field change         │
│                           │   Shows nodes, edges, role badges       │
└───────────────────────────┴─────────────────────────────────────────┘
```

- Full viewport height, no scroll on the shell — only the form panel scrolls.
- Mobile: stacks vertically; graph preview collapses to a mini-banner at top.
- Back button → `/app/projects` (or previous step).
- Progress indicator: Carbon Design System style — numbered circles, connector lines, step labels below. Active = filled, completed = checkmark, future = outlined.

### Step redesign: 5 steps

#### Step 1 — Project Setup (was "Basics")

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Project name | text | YES | min 3 chars | — |
| Description | textarea | NO | max 500 chars | — |
| Project type | select | YES | one of 4 types | 'Service' |
| Visibility | radio | YES | Private / Org / External | 'Org' |
| Start date | date picker | YES | ≥ today | — |
| End date | date picker | NO | > start date | — |
| Work week | toggle (Mo-Su) | NO | at least 1 day | Mon-Fri |

> **Not here:** Currency and timezone are never asked at project creation in any major work-management tool (Jira, Asana, Monday.com, MS Planner). Currency lives on contracts (`wg_contracts`). Timezone is an org-level or user-level setting.

**Project types:** Service · Product · Internal · Compliance
**Visibility:**
- `Private` — only invited members (current behavior)
- `Org` — all users in owner's organization
- `External` — can include external partners (enables supply chain steps)

#### Step 2 — Supply Chain (unchanged, UX improvements only)

Improvements over current:
- Each party card shows **party type badge** (colored) + **role of party in chain** (Client/Vendor/Agency/etc.)
- "Bills to" connections rendered as animated arrows in the right-panel live preview, updating instantly.
- **Validation toast** (not blocking) if a party has no people with `canApprove = true`.
- Add **Party Lead** field per party (name + email, sets that person's `canApprove = true` and `role = 'Editor'` automatically).
- Drag-to-reorder parties (visual only; `billsTo` is the real topology).
- Draft mode: if party has no people, party is shown with a "pending" badge — save still allowed.

#### Step 3 — Members & Access (was "People")

Redesign the people section per party:

```
┌─ G2 (Company) ──────────────────────────────────────────────────┐
│  Party Lead: James @ james@workgraph.test                       │
├──────────────────────────────────────────────────────────────────┤
│  Name        Email                  Role         Permissions     │
│  ──────────  ─────────────────────  ───────────  ──────────────  │
│  James       james@workgraph.test   Editor       ✓ Approve       │
│                                                  ✓ View rates    │
│                                                  ✓ Edit time     │
│                                                  ✓ Visible       │
│  [+ Add person to G2]                                            │
└──────────────────────────────────────────────────────────────────┘
```

- Role dropdown per person: `Owner | Editor | Contributor | Commenter | Viewer`
- **Role → permission preset mapping** (user can override):

| Role | canApprove | canViewRates | canEditTimesheets | visibleToChain |
|---|---|---|---|---|
| Owner | ✓ | ✓ | ✓ | ✓ |
| Editor | ✓ | ✓ | ✓ | ✓ |
| Contributor | ✗ | ✗ | ✓ | ✓ |
| Commenter | ✗ | ✗ | ✗ | ✓ |
| Viewer | ✗ | ✗ | ✗ | optional |

- **Invitation status badge**: green "Registered" (user_id resolved) / amber "Invited" (email only, accepted_at will be NULL)
- "Invite by email" text + badge, no blocking — they'll accept later.
- Chain visibility per party: "Visible to entire chain / Only to connected parties / Hidden from chain" (maps to `visibleToChain` per person + party-level `chainVisibility`).

#### Step 4 — Approval Flow (NEW)

This is the missing step. Show the generated approval chain from the supply chain topology, let the user verify/adjust before creating.

```
Approval Chain Preview
Your Organization → G2 → NAS Client
     ↑                ↑
  Nikola (you)     James (PM)
  submitter        approver L1

Chain: Timesheet submitted by Nikola → approved by James → done
```

- Read-only visualization of the computed approval path from `getApprovalStepsForParty`.
- If chain is ambiguous or no approver at a step → amber warning: "G2 has no approver. Timesheets will require a manual workaround."
- **Approver override**: per party, allow swapping the approver without going back to Step 3.
- Shows: # approval steps, estimated turnaround note ("typically 1-3 business days").

#### Step 5 — Review & Create (was "Review")

Show full summary in two columns:

| Left | Right |
|---|---|
| Project name + type + visibility | Mini graph (100% interactive, not decorative) |
| Date range + timezone + region | Approval chain summary |
| # parties + # people + # approvers | Permission matrix (who can see rates, approve, edit) |
| Draft/Active status + save intent | Invitation status (N registered, M pending email) |

Two buttons: **Save as Draft** (supply chain incomplete) · **Create Project** (full activation).

Draft vs Active behavior:
- Draft: `status = 'draft'`, `supply_chain_status = 'incomplete'`, no approval records created yet
- Active: `status = 'active'`, `supply_chain_status = 'complete'`, approval directory written to sessionStorage immediately

### Stepper component

New `src/components/ui/WizardStepper.tsx`:

```tsx
// Numbered circles with Carbon Design System pattern
// Props: steps: string[], currentStep: number, completedSteps: Set<number>
// States per step: completed (green checkmark) | active (filled blue) | error (red !) | upcoming (gray outline)
// Connector line between each step circle (gray, turns green when source step completed)
```

### Live preview panel

Right panel always shows `generateGraphFromWizard(parties, projectName)` output rendered via the existing SVG layout engine. Updates are debounced 300ms on every form change. Shows:
- Party nodes (colored by type)
- Person nodes within each party (avatar initials, role badge)
- BillsTo edges with directional arrows
- Approval edges (dashed, amber)
- Highlighted "YOU" badge on creator's node
- Empty state: "Add parties in Step 2 to see the graph"

### Deliverables (Cycle 2)
- [ ] Full-page wizard at `/app/projects/new` (new route in App.tsx)
- [ ] `WizardStepper.tsx` component
- [ ] Step 1 with all fields including description/visibility/region/currency/timezone
- [ ] Step 2 with Party Lead field + instant preview updates
- [ ] Step 3 with role dropdown → permission preset, invitation status badge
- [ ] Step 4 (Approval Flow preview) — new, reads from `getApprovalStepsForParty`
- [ ] Step 5 Review with interactive mini-graph + Draft/Active split button
- [ ] Right-panel live graph preview, 300ms debounced
- [ ] `npm run build` passes + no TypeScript errors
- [ ] Dark mode parity
- [ ] Update `AGENT_WORKLOG.md`

---

## Cycle 3 — Invitation acceptance + project settings page (frontend-developer + backend-developer)

### 3a. Invite acceptance flow

When a user signs in and has `wg_project_members` rows with `accepted_at IS NULL` and `user_email` matching their auth email:

1. On app load (`AuthContext` or `DashboardPage`), query: `SELECT * FROM wg_project_members WHERE user_email = $email AND accepted_at IS NULL`
2. If results exist → show a **notification banner** (amber, dismissible): "You have N pending project invitations"
3. Click → `/app/invitations` page: list of pending invitations (project name, inviting user, role, expiry)
4. Accept button → `UPDATE wg_project_members SET accepted_at = NOW(), user_id = auth.uid() WHERE id = $memberId`
5. Decline → `DELETE FROM wg_project_members WHERE id = $memberId`

**Critical**: acceptance must also write `user_id`. This is what enables:
- RLS to grant access to the project
- Approval routing to resolve the person's UUID
- Timesheets viewer dropdown to include them

### 3b. Project settings page

Route: `/app/projects/:id/settings`
Accessible from: project workspace header "Settings" button (already exists, currently does nothing).

Tabs:
- **General** — Edit name, description, region, currency, dates, visibility, work week
- **Members** — List all members, role/permission inline edit, remove member, invite new
- **Approval Chain** — View/override the approval path (same as wizard Step 4)
- **Danger Zone** — Archive project, delete project (owner only)

**General tab writes to:** `wg_projects` via `updateProject()` — already implemented.

**Members tab:**
- Table: avatar | name | email | role (editable dropdown) | status (Accepted/Pending) | remove button
- Role change → `UPDATE wg_project_members SET role = $role WHERE id = $memberId` + update capability flags
- "Invite new member" → email input + role selector → INSERT into `wg_project_invitations` + INSERT stub into `wg_project_members` with `accepted_at = NULL`
- Remove member → confirm dialog → DELETE (owner cannot remove themselves)

### Deliverables (Cycle 3)
- [ ] Pending invitation detection on login (AuthContext or DashboardPage)
- [ ] Amber banner + `/app/invitations` page
- [ ] Accept: writes `accepted_at` + `user_id` to `wg_project_members`
- [ ] Project settings page at `/app/projects/:id/settings`
- [ ] General / Members / Approval Chain / Danger Zone tabs
- [ ] Settings "Members" tab: role edit, invite new, remove
- [ ] `npm run build` passes
- [ ] Update `AGENT_WORKLOG.md`

---

## Cross-cutting rules (all cycles must follow)

### Permission matrix (UI representation)

| Role | Can do |
|---|---|
| Owner | Everything + delete project + manage all members |
| Editor | Submit, approve, edit timesheets, view rates, invite (not delete project) |
| Contributor | Submit timesheets, edit own timesheets, no rate visibility |
| Commenter | Read-only + comment; no timesheet edit |
| Viewer | Read-only, no comments |

### Visibility contract

| `visibleToChain` | Party `chainVisibility` | Result |
|---|---|---|
| true | 'all' | Person visible to entire chain |
| true | 'selected' | Person visible to connected parties only |
| false | any | Person hidden from all external parties |

Enforce in: `buildViewerOptions` in `graph-visibility.ts` (already partially implemented).

### Approval chain contract

Approval route is computed from the DAG, not manually configured. Override is allowed (Step 4) but stores to `wg_projects.parties[].approverOverride` — not a separate table. The Approval Flow step makes this visible and editable for the first time.

---

## Files Codex must NOT touch (owned by Claude / active changes)

- `src/utils/api/approvals-supabase.ts` — active fixes in flight
- `src/utils/api/timesheets-api.ts` — active fixes in flight
- `src/components/approvals/ApprovalsWorkbench.tsx` — redesign spec already issued
- `src/docs/APPROVAL_SUBMISSIONS_SPEC.md`

## Files Codex owns in these cycles

**Cycle 1:** `supabase/migrations/013_*.sql`, `src/utils/api/projects-api.ts`
**Cycle 2:** `src/components/workgraph/ProjectCreateWizard.tsx`, `src/components/ui/WizardStepper.tsx`
**Cycle 3:** `src/contexts/AuthContext.tsx` (read-only extend), `src/components/settings/ProjectSettingsPage.tsx` (new), `src/pages/InvitationsPage.tsx` (new), `src/App.tsx` (routes only)

---

## Acceptance criteria (Claude review)

### Cycle 1
- [ ] Migration runs clean on Supabase SQL editor (no errors)
- [ ] `wg_project_members` has `graph_node_id`, `can_approve`, `can_view_rates`, `can_edit_timesheets`, `visible_to_chain`
- [ ] Creating a project writes correct `status` (draft vs active) and `supply_chain_status`
- [ ] Graph save failure shows a toast, doesn't crash

### Cycle 2
- [ ] Full-page wizard — no horizontal scroll, readable on 1280px
- [ ] Step 4 (Approval Flow) correctly shows the computed chain for the test project (Your Org → G2 → NAS)
- [ ] Role dropdown in Step 3 auto-fills permission checkboxes per preset table above
- [ ] Live preview panel updates within 500ms of any party/person change
- [ ] "Save as Draft" creates project with `status='draft'`; "Create Project" creates with `status='active'`

### Cycle 3
- [ ] Logging in as james@workgraph.test shows invitation banner if pending
- [ ] Accepting invitation writes `accepted_at` AND `user_id`
- [ ] After acceptance, James can see the project in his project list (RLS passes)
- [ ] Project Settings → Members tab: can change role, invite new by email, remove member

---

## Notes on what NOT to rebuild

- The supply chain topology (DAG, billsTo) is correct and well-designed — don't change the data model
- `generateGraphFromWizard` in auto-generate.ts is solid — don't rewrite it, just feed it the new fields
- The graph SVG layout engine works — reuse it in the live preview panel
- `getApprovalStepsForParty` in approval-fallback.ts correctly computes routes — Step 4 just visualizes it
- Existing RLS policies are mostly correct — Migration 013 extends rather than replaces them
