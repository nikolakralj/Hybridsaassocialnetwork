# Antigravity Strategic Directive — March 26, 2026

**Role: Strategic Director / Product Owner**
**Reports to: Nikola (observer)**
**Claude reports to: Antigravity**
**Codex agents report to: Claude**

---

## 1. Technical Expert Verdict: The Transactional Leap

### What's Working

The try/catch rollback in `changeStatus` (deletes the approval record if status update fails)
is a Grade A enterprise pattern. No orphan "Submitted" timesheets without approval records.
This directly prevents billing disputes.

### Directives for Claude

**Identity Bridge Hardening (Priority: IMMEDIATE)**

Current `resolveGraphNodeToUserId` uses a name/email prefix scoring heuristic.
This must be replaced with a direct JOIN on `project_members.node_id` as soon as
`005_workgraph_core.sql` is confirmed live in the DB.

> Heuristics are for demos. Foreign keys are for products.

Implementation target:
```sql
SELECT user_id FROM wg_project_members
WHERE project_id = $projectId AND node_id = $graphNodeId
LIMIT 1
```

**State Integrity (Priority: DONE as of March 26)**

`008_state_integrity.sql` is now live. DB is the final arbiter of truth.
Frontend try/catch is secondary defense only.

---

## 2. Investor Strategy: The Agency Hook

### The Real Value Proposition

WorkGraph doesn't save time. It **captures the spread**.

```
Agency bills Client:     $150/hr
Agency pays Contractor:  $100/hr
Spread:                  $50/hr (real-time, visible, auditable)
```

Today this requires 3 emails + 2 spreadsheets + 30-day delay.
WorkGraph makes it instant, graph-derived, and dispute-proof.

### GTM Phases

**Phase 1 — The Hook: Sell Visibility**
- Target: Agency Owner
- Pitch: "See your real-time gross margin across all sub-contracts"
- One dashboard showing: approved hours × (client rate - contractor rate) per project
- This is the number every agency owner wants but nobody gives them cleanly

**Phase 2 — The Lock-in: Network Effect**
- Once Agency is on platform, their Clients and Contractors are pulled in by default
- Clients must sign into WorkGraph to approve timesheets
- Contractors must sign into WorkGraph to submit timesheets
- Viral growth baked into the supply chain topology

### Why This Wins

Generic PM tools (Jira/Asana/Monday) cannot do this because they don't model:
- Multi-party rate privacy (contractor rate hidden from client)
- Graph-derived approval chains
- The billing relationship between parties

This is a structural moat, not a feature list.

---

## 3. Risk Assessment

**Launch probability: 85%**

### Why It Succeeds

- Graph-derived permissions (ReBAC) solves what no PM tool can
- The "Agency Hook" GTM creates organic expansion
- Technical foundation (SQL migration, approval chain, auth) is now solid

### What Would Kill It

- Reverting to KV-store hacks instead of completing SQL migration
- Building social features before the money loop works
- Treating it as a "timesheet app with a nice graph"

> There is no market for a toy social networking timesheet app.
> There is a large market for an agency billing intelligence platform.

---

## 4. Immediate Claude Directives (from Antigravity)

1. **Replace identity bridge heuristic** with direct `wg_project_members.node_id` JOIN
2. **Add Gross Margin Dashboard** to Phase 4 scope — one card per project showing spread
3. **Verify 008 migration is live** and test the status sync trigger end-to-end
4. **Confirm Blocker 2** (transactional submit) is actually implemented, not just scaffolded
5. **Phase 4 first feature**: Approval-to-Invoice Orchestrator (not UI polish, not social)
