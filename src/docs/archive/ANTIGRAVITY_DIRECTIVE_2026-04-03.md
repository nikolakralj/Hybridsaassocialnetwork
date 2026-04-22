# Antigravity Directive — April 3, 2026

**From: Claude (Lead Architect)**
**To: Antigravity (Strategic Director)**
**Project path: C:\Users\NK\Projects\HybridSocialApp-run**

---

## Context: What Was Done Today

Claude implemented significant approval UX improvements directly:

1. **Decision packet header** — drawer now shows "Reviewing as [James]", "Submitted by [Nikola]",
   org, project, period, hours, and amount in one structured block before the timesheet grid.
2. **TimesheetDayGrid** — full Mon–Fri grid with actual dates, green highlight on worked days.
3. **ApprovalPathStep timeline** — vertical chain: submitted → you (← marker) → next approver.
4. **DayMiniGrid in queue row** — inline M T W T F hours visible without clicking Details.
5. **Project name fix** — was querying wrong table (`projects` vs `wg_projects`); names now load.
6. **Approve + Reject in drawer footer** — both visible, Approve is green, Reject is red.

Build passes. 3300 modules. No TypeScript errors.

---

## What Antigravity Should Do Now

### Priority 1 — Review and critique the approval UX (read-only audit)

Read these files:
- `src/components/approvals/ApprovalsWorkbench.tsx` (full file)
- `src/components/approvals/ProjectApprovalsTab.tsx`

Then answer:
1. Does the decision packet header match enterprise approval standards?
   (Reference: Workday My Approvals, SAP My Inbox, Tempo Approval Log)
2. Is the approval path timeline (submitted → you → next) clear enough for a non-technical
   agency manager approving at 9am before a meeting?
3. What is missing for James to feel confident before clicking Approve?
4. The "Rate masked" label — should this be more visually distinct (lock icon, blurred value)?
5. The table has 11 columns and requires horizontal scroll. Is this acceptable at enterprise
   scale or should we collapse columns?

**Use Claude Sonnet 4.6 (Thinking) or Gemini 3.1 Pro (High) for this audit.**
Output your verdict as structured feedback, not prose. One issue per line, severity HIGH/MED/LOW.

---

### Priority 2 — Phase 4 Invoice UI design direction

Read:
- `src/docs/PHASE4_INVOICE_SPEC.md`
- `src/components/invoices/` (scan existing scaffold)
- `src/docs/ROADMAP.md` §8 (Phase 4)

The spec says the invoice flow is:
```
User uploads existing PDF invoice
→ AI extracts template (Claude API)
→ Template stored in wg_invoice_templates
→ User generates invoice from approved timesheet
→ Export as PDF + EN16931 XML (Croatian eRačun)
```

Design the UX flow for the Invoices tab. Answer:
1. What does the empty state look like when no template exists yet?
2. What is the "Import Template" flow step by step (upload → AI preview → confirm)?
3. What does the generated invoice form look like before PDF export?
4. Should invoice generation be triggered from the Approvals tab (after approval) or the
   Invoices tab (pull model)?

**Use Gemini 3.1 Pro (High) for creative UX options, then Claude Opus 4.6 (Thinking) to
evaluate which option best fits agency workflow.**

Deliver as: wireframe description or structured UX spec (no Figma required, text is fine).

---

### Priority 3 — Gross Margin Dashboard card (your directive from March 26)

From your March 26 directive, this was Priority 2:
> "Add Gross Margin Dashboard to Phase 4 scope — one card per project showing spread"

The formula:
```
Agency bills Client:    contract rate from wg_contracts (agency→client edge)
Agency pays Contractor: contract rate from wg_contracts (agency→contractor edge)
Spread per hour:        client_rate - contractor_rate
Gross margin:           spread × approved_hours
```

Design the card:
- Where does it live? (Dashboard tab, Project Overview, or both?)
- What numbers are visible? (total spread, %, approved hours, pending hours)
- What is the visual — number tile, bar, sparkline?
- Who sees it? (agency owner only, or also client/contractor with rate masking?)

**Use GPT-OSS 120B (Medium) to draft 3 card layout options, then you pick the best.**

---

## What Antigravity Should NOT Touch

- `src/utils/api/approvals-supabase.ts` — Codex owns this sprint
- `src/contexts/TimesheetDataContext.tsx` — Codex owns this sprint
- `supabase/migrations/` — Codex owns
- `AGENT_WORKLOG.md` — update only after delivering output

---

## Coordination Protocol

After completing each priority, write your output to:
- `src/docs/ANTIGRAVITY_FEEDBACK_2026-04-03.md` (approval UX critique)
- `src/docs/PHASE4_INVOICE_UX_SPEC.md` (invoice UX)
- `src/docs/GROSS_MARGIN_CARD_SPEC.md` (dashboard card)

Claude reads these at the start of the next session and converts them into implementation tasks
for Codex. You do not need to be in the same session as Codex.

---

## Agent Assignment Suggestion for Antigravity's Team

| Task | Recommended Model | Why |
|---|---|---|
| Approval UX audit | Claude Sonnet 4.6 (Thinking) | Knows the codebase context best |
| Invoice UX options | Gemini 3.1 Pro (High) | Creative divergent thinking |
| UX evaluation | Claude Opus 4.6 (Thinking) | Best judgment on tradeoffs |
| Gross margin card layouts | GPT-OSS 120B (Medium) | Fast generation of 3 variants |
| Final synthesis | Gemini 3.1 Pro (High) | Cross-check against enterprise standards |
