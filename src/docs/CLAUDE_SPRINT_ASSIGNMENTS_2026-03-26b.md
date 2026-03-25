# Claude Sprint Assignments — March 26, 2026 (Batch B)

**Sprint goal: Close the 2 remaining PARTIAL items and flip Phase 3 gate to GO.**

Previous batch (A) is complete. Tasks 1-6 are DONE. These are the only two items
still blocking the gate.

---

## TASK 7: Post-Create Supply Chain Editor

**Assign to: frontend-developer agent**

```
Task: Add "Edit Supply Chain" capability to an existing project in WorkGraphBuilder

Context:
- ProjectCreateWizard handles party/person setup at creation time only
- After a project is saved, there is currently NO way to add parties or members later
- The gate reviewer flagged this as PARTIAL because no post-create add-later workflow exists
- useGraphPersistence.saveVersion() IS being called on manual save — that part works

Files to modify:
- src/components/workgraph/WorkGraphBuilder.tsx (add button + state)
- src/components/workgraph/ProjectCreateWizard.tsx (add edit-mode prop)

Requirements:
1. In WorkGraphBuilder toolbar, add a button "Edit Supply Chain" (use Users icon from lucide)
   next to the existing Save button
2. Clicking it opens ProjectCreateWizard with:
   - open=true
   - editMode=true (new prop)
   - initialParties populated from existing graph nodes (read from allNodes)
3. In ProjectCreateWizard, when editMode=true:
   - Skip steps 1 (basic) and 4 (review) — go straight to step 2 (supply-chain)
   - Title should be "Edit Supply Chain" instead of "Create Project"
   - On save: call updateProject() with the new graph (merge new nodes/edges with existing)
   - Do NOT reset or delete existing nodes — only add new ones
4. After save, call graphPersistence.saveVersion(nodes, edges, 'Supply chain updated')
   to create a version checkpoint

Verification:
- Create a project with 2 parties
- Open "Edit Supply Chain"
- Add a 3rd party
- Save
- Verify the 3rd party appears in the graph
- Check Supabase: wg_graph_versions should have a new row with change_summary
  = 'Supply chain updated'

Do NOT touch: approval files, timesheet files, migration files, context files
```

---

## TASK 8: Version History Panel

**Assign to: frontend-developer agent (same or different)**

```
Task: Add a Version History panel to WorkGraphBuilder so history preservation is provable

Context:
- useGraphPersistence exposes getVersionHistory() which returns GraphVersion[]
- saveVersion() is already called on every manual Save and auto-save
- The gate reviewer marked history as PARTIAL because there is no UI to view/prove history
- We need a way to show that saving, then editing, then saving again preserves old versions

Files to modify:
- src/components/workgraph/WorkGraphBuilder.tsx ONLY

Requirements:
1. Add a "History" button to the toolbar (use Clock icon, already imported)
2. Clicking it opens a slide-in panel (right side, same pattern as NodeDetailDrawer)
3. The panel calls graphPersistence.getVersionHistory() on open
4. Displays a list of versions:
   - version number (v1, v2, v3...)
   - created_at formatted as "Mar 26, 09:14"
   - change_summary (e.g. "Manual save", "Supply chain updated", "Auto-saved changes")
   - a "Restore" button for each (calls graphPersistence.loadVersion(version.id))
5. If no versions exist yet, show "No history yet — save the graph to create a checkpoint"
6. Loading state with Loader2 spinner while fetching

Verification:
- Open any project
- Click Save twice with a small change between saves
- Open History panel
- Should see at least 2 entries with different timestamps
- This proves history is preserved across saves

Do NOT touch: approval files, timesheet files, migration files, context files,
ProjectCreateWizard.tsx (unless you are also doing Task 7)
```

---

## Gate Checklist After These Tasks

When Tasks 7 + 8 are done, the gate reviewer must re-run against these 2 items:

| Item | Required Evidence |
|---|---|
| Add missing party/member later | "Edit Supply Chain" button exists, adds node to existing graph, version saved |
| Save and confirm existing history remains intact | History panel shows multiple versions after multiple saves |

If both pass → update PHASE3_GATE_RESULTS_2026-03-26.md → flip gate to GO in AGENT_WORKLOG.md.

---

## After Gate = GO

Phase 4 begins. First feature (per Antigravity directive):
- Approval-to-Invoice Orchestrator (see PHASE4_INVOICE_SPEC.md)
- NOT social features, NOT CSV export, NOT UI polish
