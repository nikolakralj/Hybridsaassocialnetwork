# Boss Brief (Claude) — March 25, 2026

## Current Verdict

Phase 3 is still **NO-GO** for Phase 4 expansion until these blockers are closed with evidence:
1. Approver identity mapping must use real user UUIDs (not placeholder graph node IDs).
2. Submit -> approval-queue creation must be transactional (no silent partial success).
3. Approval decisions must atomically update both approval records and canonical timesheet status.

## What Was Completed Today

- Approvals surface was redesigned into a cleaner, pending-first operational queue.
- Mobile responsiveness improved in queue controls, bulk actions, and per-item action layout.
- Active worklog was compacted and archived:
  - `AGENT_WORKLOG.md` is now a concise live index.
  - `AGENT_WORKLOG_ARCHIVE.md` holds detailed historical notes.
- Invoice import foundation added:
  - Upload any invoice file type (PDF/DOCX/image/other).
  - Editable structured fields (number, dates, vendor/client, currency, line items, total, notes).
  - `AI Adapt` heuristic stub (filename-based suggestions + mandatory manual review).

## Expert Brainstorm (Top Takeaways)

- Best post-Phase-3 feature: **Approval-to-Invoice Orchestrator** (fastest money-loop impact).
- High-value reliability sprint item: **Identity Bridge** (graph node -> real user UUID).
- Strong near-term additions:
  - SLA escalation + delegated approver backup rules.
  - Server-authoritative “View As” context.
  - CSV onramp for timesheets/roster migration.

## Recommended Next Sprint Focus

Run a strict **Phase 3 Reliability Sprint** (identity + transactional queue + state transition integrity), then immediately ship Approval-to-Invoice orchestration once gate passes.

## Last-Hour Coordination Report

### Agent Output Snapshot

- Approvals UX hardening: completed (responsive queue shell, rejection dialog with required reason, cleaner structure).
- Integration audit: completed and identified 5 critical/high flow breakpoints.
- Invoice template worker: completed (editable amount + save/apply template flow in invoices).
- Coordinator audit: completed with assignment recommendations and confirms NO-GO on Phase 4 expansion.

### Boss Assignments (Start After Approval)

1. Backend Reliability Owner
- Implement transactional submit -> approval-record creation.
- Prevent phantom approvals when submit validation fails.

2. Identity Mapping Owner
- Map `approver_user_id` to real Supabase UUID via graph node -> member bridge.
- Remove placeholder node-only identity dependency.

3. Approval State Engine Owner
- Unify approve/reject transitions so approval queue and timesheet week status cannot diverge.
- Implement multi-layer next-step enqueue atomically.

4. QA Gate Owner
- Run scripted Phase 3 evidence pass and publish pass/fail with reproducible steps.

## Docs Control Audit (Codex)

- Doc-health score: Yellow.
- Reason: strong governance exists, but live status is split across multiple active docs and some files still read like competing sources of truth.

### Top 5 Documentation Risks

1. Status duplication risk: blocker state appears in `AGENT_WORKLOG.md`, `CLAUDE_BOSS_BRIEF_2026-03-25.md`, `CLAUDE_SPRINT_ASSIGNMENTS_2026-03-26.md`, and `PHASE3_GATE_RESULTS_2026-03-26.md`, which makes drift likely.
2. Stale history risk: `AGENT_WORKLOG_ARCHIVE.md` contains preserved "done" snapshots that can be mistaken for current truth unless readers also check the live worklog.
3. Source-of-truth ambiguity: `ARCHITECTURE.md`, `WORKGRAPH.md`, and feature specs overlap on current-system behavior, approval flow, and phase framing.
4. Handoff ambiguity: sprint assignments name owners by role, while registry/playbook define process by agent identity, so accountability can blur during parallel work.
5. Merge-gate ambiguity: docs governance says blockers must stay visible, but there is no single enforced pre-merge checklist telling contributors exactly which docs must be refreshed.

### Recommended File Ownership Map

- `ROADMAP.md`: product owner or coordinator only.
- `ARCHITECTURE.md`: lead engineer or architecture owner only.
- `WORKGRAPH.md`: convert to legacy/background reference only; architecture owner updates if kept.
- `AGENT_WORKLOG.md`: active coordinator only.
- `AGENT_WORKLOG_ARCHIVE.md`: coordinator on archive events only.
- `CLAUDE_SPRINT_ASSIGNMENTS_2026-03-26.md`: sprint lead only.
- `PHASE3_GATE_RESULTS_2026-03-26.md`: QA gate owner only.
- `AGENT_REGISTRY.md` and `CODEX_SUBAGENT_PLAYBOOK.md`: coordinator only.
- `DOCS_GOVERNANCE.md`: boss/coordinator only.
- Feature specs such as `PHASE4_INVOICE_SPEC.md`, `TIMESHEET_STRATEGY.md`, `SQL_SCHEMA_MIGRATION.md`: designated feature owner only.

### Gate Rule Before Any Feature PR Merge

- Update `AGENT_WORKLOG.md` with current blocker/status snapshot if the work changes risk, ownership, or gate state.
- Update the owning feature spec if behavior, schema, or acceptance criteria changed.
- Update `ARCHITECTURE.md` only if runtime behavior or data flow changed today.
- If gate evidence changed, update `PHASE3_GATE_RESULTS_2026-03-26.md` in the same PR.
- If two docs now overlap, collapse one into a pointer before merge; do not ship duplicated active truth.

### Control Verdict

- Red if blocker status conflicts across active docs.
- Yellow if statuses are aligned but ownership or merge-gate updates are missing.
- Green only when one live status doc, one owner per doc, and gate evidence matches current blocker state.
