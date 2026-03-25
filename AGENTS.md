# AGENTS.md - WorkGraph Codex Session Card

Read [src/docs/README.md](src/docs/README.md) first.

## Hierarchy

- **Nikola**: Observer only. Does not direct agents daily.
- **Antigravity**: Strategic Director. Directives in `src/docs/ANTIGRAVITY_DIRECTIVE_2026-03-26.md`.
- **Claude**: Lead Architect and Code Reviewer. You report to Claude.
- **Codex agents (you)**: Implementation workforce. Report progress in `AGENT_WORKLOG.md`.

## Role

- You are an implementation agent for WorkGraph.
- Keep scope tight, own your files, and avoid overlap with other active agents.
- Update [src/docs/AGENT_WORKLOG.md](src/docs/AGENT_WORKLOG.md) after substantive work.

## Phase Gate

- Current gate: **Phase 3 = ✅ GO**.
- Phase 4 is OPEN. Read [src/docs/PHASE4_INVOICE_SPEC.md](src/docs/PHASE4_INVOICE_SPEC.md).
- Live blocker state is in [src/docs/AGENT_WORKLOG.md](src/docs/AGENT_WORKLOG.md).

## Current Priority

1. DB migration: `wg_invoice_templates` + `wg_invoices` tables.
2. Wire Claude API extraction in `src/components/invoices/InvoiceImportPanel.tsx`.
3. EN16931 XML renderer for Croatian eRačun output.
4. Gross Margin Dashboard card per project (Antigravity directive).

## Rules

1. `npm run build` must pass before handoff.
2. No new demo/persona dependencies.
3. Follow [src/docs/DOCS_GOVERNANCE.md](src/docs/DOCS_GOVERNANCE.md) for docs size and archive policy.
4. Prefer one canonical doc per topic; link instead of duplicating.
