# WorkGraph Docs Index

**Last updated:** 2026-07-15

This folder is getting large. Treat this file as the current map.

Do not read every document for every task. Start with the core run docs, then
read only the specs referenced by the backlog item you are working on.

## Start Here

| Doc | What it is | When to read |
|---|---|---|
| `/CLAUDE.md` (repo root) | Project context, architecture, security issues, file ownership | Every run - read first |
| `OPERATIONS.md` | Team roles, memory protocol, coordination rules | When unsure who owns what |
| `TASK_BACKLOG.md` | Sprint board - pick your next task from here | Every run - read second |
| `AGENT_WORKLOG.md` | Recent changes, current blockers | Every run - read third |
| `ROADMAP.md` | Long-term product phases | When deciding scope |

## Current Strategy Specs

Read these before changing invites, graph permissions, contracts, invoices, or
project/company visibility.

| Doc | What it covers |
|---|---|
| `CLAUDE_PRODUCT_STRATEGY_BRIEF.md` | Claude's critical GO/PIVOT/STOP product and agentic-roadmap audit |
| `specs/BULLHORN_LESSONS_STRATEGY.md` | Product wedge: learn from Bullhorn without copying Bullhorn |
| `specs/G2_INTIME_BENCHMARK.md` | G2/InTime placement/pay-bill benchmark |
| `specs/GRAPH_CONFIDENTIALITY_SPEC.md` | Rate, contract, document, and graph visibility model |
| `specs/C2_COMPANY_MEMBERSHIP_SPEC.md` | Company directory, project roster, worker invites, private worker contracts |

## Implementation Specs

| Doc | What it covers |
|---|---|
| `specs/APPROVAL_SUBMISSIONS_SPEC.md` | Approvals UI: My Submissions redesign |
| `specs/PHASE4_INVOICE_SPEC.md` | Invoice engine spec |
| `specs/PROJECT_CREATION_SPEC.md` | Project creation flow |
| `specs/TIMESHEET_STRATEGY.md` | Timesheet workflow and policy |
| `specs/WORKGRAPH.md` | WorkGraph domain model |

## Current Doc Health

- `AGENT_WORKLOG.md` is too large for long-term use. Read the latest entries
  first; archive older entries in a cleanup pass.
- `TASK_BACKLOG.md` is the most current tactical source.
- `ROADMAP.md` is still the product-phase source, but some newer 2026-07
  strategy lives in the specs above.
- Some old root/session docs may contain stale task lists. Prefer this index and
  `TASK_BACKLOG.md` for current execution.

## Archive

Old sprint cards, gate results, and dated snapshots should live in `archive/`.
Do not read archive docs during normal work - they are historical only.
