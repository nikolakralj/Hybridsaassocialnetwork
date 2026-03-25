# Codex Subagent Playbook (WorkGraph)

Version: 1.0
Date: 2026-03-25
Scope: Practical reuse of [awesome-codex-subagents](https://github.com/VoltAgent/awesome-codex-subagents) for this repository.

---

## 1. Why This Exists

This project is now in a multi-agent workflow (Nikola + Codex + Antigravity + occasional Claude).
To avoid overlap and wasted cycles, we use specialized subagents with clear file ownership and
phase-aware responsibilities.

---

## 2. Recommended Subagents To Reuse First

Use these first because they map directly to current roadmap pressure (Phase 3/4):

1. `backend-developer`
- Owns `supabase/functions/server/*` and SQL-facing API handlers.
- Use for auth/invite routes, approval routing, invoice backend endpoints.

2. `frontend-developer`
- Owns `src/components/*`, `src/contexts/*`, `src/utils/*` (UI-facing).
- Use for timesheet UX polish, approvals UX, Team/Settings workflows.

3. `postgres-pro`
- Owns `supabase/migrations/*` and SQL review.
- Use for schema safety, indexes, constraints, RLS checks, migration reviews.

4. `api-designer`
- Cross-checks request/response contracts between UI and edge function APIs.
- Use before touching routes consumed by multiple tabs/modules.

5. `security-auditor`
- Reviews auth, invite acceptance, approver permissions, and data exposure.
- Use before release milestones and before payment integration.

6. `reviewer`
- Final gate on risky PRs (visibility logic, approval fallback, invoice generation).
- Use for regression-focused reviews with file/line findings.

7. `test-automator`
- Builds focused test plans/checklists for critical user flows.
- Use for submit -> approval -> invoice loop and invite onboarding.

8. `technical-writer`
- Maintains docs consistency across `ROADMAP`, `AGENT_WORKLOG`, and feature specs.
- Use for handoffs and external contributor onboarding.

---

## 3. Phase-Aligned Usage

### Phase 3 (Auth + Invites + Incremental Supply Chains)
- Primary: `backend-developer`, `frontend-developer`, `postgres-pro`
- Guardrail: `security-auditor`, `reviewer`

### Phase 4 (Invoice from Approved Timesheets)
- Primary: `backend-developer`, `api-designer`, `frontend-developer`
- Guardrail: `reviewer`, `test-automator`

### Phase 5 (CSV Import + PDF Export)
- Primary: `frontend-developer`, `backend-developer`
- Guardrail: `test-automator`, `technical-writer`

---

## 4. File Ownership Protocol (Conflict Prevention)

When two agents run in parallel:

1. Assign disjoint write scopes before coding.
2. Never edit another agent's owned files in the same cycle.
3. If shared file is unavoidable (example: `ProjectWorkspace.tsx`), one agent owns implementation and others provide comments only.
4. Every cycle ends with:
- touched files list
- open blockers
- explicit "safe to merge" statement

---

## 5. Ready-To-Paste Task Prompts

### A) Approval fallback policy hardening
Use with `backend-developer`:

"Implement deterministic approval fallback in `src/utils/graph/auto-generate.ts` and any approval routing utilities. Rule: prefer approver in submitter org; if none, route to nearest upstream billTo org approver; if none, route to project owner as last fallback. Add clear logs and keep behavior backward-compatible."

### B) Timesheet professional UI pass
Use with `frontend-developer`:

"Refine `src/components/timesheets/ProjectTimesheetsView.tsx` and related components for professional agency UX: tighter spacing scale, clearer weekly status hierarchy, cleaner day-entry modal, stronger primary actions, and stable responsive behavior. Preserve current data flow and no mock data reintroduction."

### C) SQL/RLS review before release
Use with `postgres-pro` + `security-auditor`:

"Audit all WorkGraph SQL tables/policies and edge API usage for auth correctness and least privilege. Validate invite acceptance paths and approval queue visibility. Return only concrete findings with severity and exact file/SQL line references."

---

## 6. Definition Of Done For Subagent Contributions

A contribution is done only when all are true:

1. `npm run build` passes.
2. No new demo/persona dependency introduced.
3. AGENT_WORKLOG updated with:
- what changed
- why
- tests run
- residual risks
4. Changes are scoped to assigned files.

---

## 7. Notes For This Repo

- Canonical workspace: `C:\Users\NK\Projects\HybridSocialApp-run`
- Do not run `supabase db push` during this phase (manual SQL migration history already used).
- Prefer deploy-only for functions when needed:
  - `npm run edge:deploy -- --project-ref gcdtimasyknakdojiufl`

