# Approval Workbench — "My Submissions" Redesign Spec

**Owner:** Claude (architect) · **Implementer:** Codex frontend-developer · **Reviewer:** Claude
**Status:** Ready for implementation · **Date:** 2026-04-21
**Scope:** `src/components/approvals/ApprovalsWorkbench.tsx` — the `viewScope === "submitted"` branch only. Do not change data-layer APIs; all needed data is already on `UIApprovalItem` + `approvalTrail`.

## Why this exists

The current submissions view is a horizontally-scrollable table with filler copy, ALL-CAPS column headers, bulk-approve UI that doesn't apply, and no visual approval chain. Benchmarked against SAP Fiori (My Inbox / Object Page), Workday Process History, ServiceNow Activity Stream, Replicon, and Harvest, we are off-pattern on the four things enterprise users expect:

1. A compact, scannable list (no horizontal scroll).
2. "Waiting on" as a first-class column.
3. Semantic status chips, not ALL-CAPS text.
4. A **vertical timeline** of every state change, opened in a right-side detail drawer.

References (cite these in PR description):
[SAP Fiori Semantic Colors](https://www.sap.com/design-system/fiori-design-web/v1-71/foundations/best-practices/ui-elements/how-to-use-semantic-colors) · [Fiori Content Density](https://experience.sap.com/fiori-design-web/cozy-compact/) · [Replicon "Waiting on Approver"](https://www.replicon.com/help/tracking-the-approval-status-of-items/) · [ServiceNow Activity Stream](https://horizon.servicenow.com/workspace/components/now-activity-stream-connected)

## Non-goals

- Do **not** touch the approver-facing Queue view in this PR.
- Do **not** change the backing data model, the approval-chain computation, or any `*-api.ts` file.
- Do **not** add new status types — reuse existing `"pending" | "approved" | "rejected"`.

## 1. Hide controls that don't apply

When `viewScope === "submitted"`:

- Remove the bulk-select checkbox row and the "Select all actionable approvals / N of N item can be bulk approved" banner.
- Remove the "Approvers can review items row-by-row…" helper text.
- Replace the page subtitle `"Manage approval requests for ${projectName} with pending items kept at the front of the queue."` with `"Audit trail of items you've submitted. Decisions, approvers, and timestamps are preserved."`
- Status filter pills stay (Pending / All / Approved / Rejected) but rename `"Pending first"` → `"All"`; this view doesn't need a priority-first sort.

## 2. Table — columns & density

Exactly six columns, in this order, fitting within the container width with **no horizontal scroll at ≥1280 px**:

| Column | Content | Alignment | Width |
|---|---|---|---|
| Period | `Apr 6 – Apr 10` (one line, no "2026") | Left | 140 px |
| Project | `fff` (project name, truncate with tooltip at 24 ch) | Left | flexible (1 fr) |
| Total | `24h` or `$1,200` (respect `canViewRates`) | Right | 80 px |
| Status | Chip (see §3) | Left | 120 px |
| Waiting on | Avatar + name, or `—` if terminal | Left | 180 px |
| Submitted | Relative time `2h ago`, tooltip with absolute | Right | 120 px |

- Remove: Person column (viewer IS the submitter, redundant), Organization (placeholder "Your Organization" is noise), Hours-with-day-bars (move into drawer), "Current approver / Step 1 of 1" text (move into drawer), separate `Details` + `Path` action buttons.
- Header: Tailwind `text-xs font-medium text-muted-foreground` — **sentence case**, not ALL-CAPS. e.g. `Period`, `Waiting on`.
- Row height: 40 px (`h-10`), `text-sm`, hover `bg-muted/50`, full row clickable → opens detail drawer (§4).
- Empty state (no submissions): centered illustration-less card with `"You haven't submitted anything yet."` + subtle CTA link to Timesheets tab.

## 3. Status chip — semantic, not labels

Replace the current `Approved` black pill. Use shadcn `Badge` with these variants (add to `src/components/ui/badge.tsx` if missing):

| Status | Label | Tailwind classes |
|---|---|---|
| pending (initial layer) | `Pending` | `bg-muted text-muted-foreground` |
| pending (later layer, someone already approved) | `In progress` | `bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200` |
| approved | `Approved` | `bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200` |
| rejected | `Rejected` | `bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200` |

Show a small leading dot (`●`, 6 px) in the chip's foreground color. Derive "In progress" by checking `approvalTrail` for any prior `approved` entry while the latest status is `pending`.

## 4. Detail drawer (right-side sheet)

Replace the current inline modal detail with shadcn `Sheet` (`side="right"`, `w-[480px] sm:w-[540px]`). No popover, no full-screen modal.

**Header:** project name (h3) + status chip. Subtext: `Week of Apr 6, 2026 · 24h · Submitted 2h ago`.

**Sections (in order):**

### 4a. Overview
Two-column grid (`grid-cols-2 gap-4 text-sm`): `Submitter`, `Project`, `Period`, `Total hours`, `Amount` (if `canViewRates`), `Submitted at` (absolute). Right-align values.

### 4b. Daily breakdown (only if subjectType === "timesheet")
Compact 5-column grid Mon-Fri with hours per day. Reuse the existing small bar chart but render at 100% width of the drawer — no overflow.

### 4c. Approval timeline — **the centerpiece**

Vertical timeline (new component `src/components/approvals/ApprovalTimeline.tsx`):

```
●  Submitted by Nikola
│  Apr 6, 2026 · 2:15 PM
│
●  Approved by James (nas)
│  Apr 6, 2026 · 4:58 PM
│  "Looks good — ship it."   ← only if notes present
│
○  Awaiting: Project Owner
   Current step
```

- Each node: 10 px colored dot (`bg-emerald-500`, `bg-rose-500`, `bg-amber-500`, `bg-muted` for pending-future) with a 1 px `bg-border` connector line between nodes.
- Data source: `item.approvalTrail` (already populated when `hasSubmitterFilter` is true in `getApprovalQueue`). Append one final pending-future node using `item.currentApproverName` if `status === "pending"` and the trail's last entry is an `approved` decision.
- Do NOT invent nodes for approvers that haven't acted and aren't currently assigned.
- Relative timestamp (`formatDistanceToNow` from `date-fns`), absolute on hover via shadcn `Tooltip`.
- Actor name bold; role/org below in `text-xs text-muted-foreground`.
- Optional `notes` rendered as quoted italics.

### 4d. Actions footer
Single button `Close`. Submitters cannot self-approve (already enforced). No `Details / Path` buttons.

## 5. Toolbar — single row

Keep: search input, type filter (`All types`), sort (`Newest`/`Oldest`), refresh.
Remove: the stats pills above search (`Pending 0 / Total 1 / Approved 1 / Rejected 0`) — this is status-tab noise on top of the existing status pills. Instead, show the count inline in the status pill label, e.g. `All (1)`, `Approved (1)`.

## 6. Interaction details

- Clicking anywhere on a row (except a text-selection drag) opens the drawer.
- Drawer opens via URL hash (`#submission/{id}`) so refresh keeps context — use `history.replaceState`, don't couple to `react-router`.
- Keyboard: `j` / `k` navigates rows when drawer is closed; `Esc` closes drawer.
- Drawer respects dark mode via existing tokens.

## 7. Implementation checklist

- [ ] Extract the current `viewScope === "submitted"` render block into a new file `src/components/approvals/SubmissionsView.tsx`. Keep `ApprovalsWorkbench.tsx` as a router.
- [ ] New `ApprovalTimeline.tsx` with the vertical stepper — unit-testable via props only.
- [ ] Hide bulk approve / helper text when scope = submitted (not-applicable copy is already listed in §1).
- [ ] Drawer with three sections (Overview / Daily / Timeline).
- [ ] Status chip variants per §3; derive "In progress" from `approvalTrail`.
- [ ] No horizontal scroll at 1280 px wide container — verify in Chrome.
- [ ] `npm run build` passes.
- [ ] Dark mode visual parity.
- [ ] Update `AGENT_WORKLOG.md`.

## 8. Out of scope (follow-up cycles)

- Bulk actions for approvers (Queue view).
- CSV export of submission history.
- Parallel approver branches in the timeline.
- Comments/threading on approvals.
- SLA badges ("2 days overdue").

## 9. Acceptance — how Claude reviews

On review I check:

1. No horizontal scroll at container widths ≥1280 px with the provided test data.
2. The approval timeline renders correctly for (a) pending first-layer, (b) pending later-layer after one approval, (c) fully approved, (d) rejected.
3. No "Your Organization", no "Rate masked", no "Step 1 of 1" literals leaking through anywhere.
4. Build clean. No new TypeScript warnings. Keyboard `Esc` closes drawer.
5. Dark-mode screenshots attached.
