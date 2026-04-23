# WorkGraph Operations Manual

**Version:** 2.0 · **Date:** 2026-04-22 · **Owner:** Nikola Kralj
**Purpose:** Single source of truth for team structure, agent roles, memory, tools, and coordination.

---

## 1. Who Does What

### Nikola (Product Owner)
- Sets priorities. Approves/rejects agent output. Makes go/no-go calls on phases.
- Does NOT write code. Does NOT decide implementation details.
- Communicates via chat with Claude. Claude relays decisions to Codex via spec files.

### Claude (Lead Architect + Reviewer)
**Role:** Senior developer, researcher, architect, code reviewer, gate authority.
- Writes specs that Codex implements. Reviews all Codex output before it ships.
- Implements the hardest cross-cutting problems directly (auth wiring, approval chain logic, data persistence patterns).
- Does NOT rubber-stamp Codex. Reads actual diffs, runs builds, verifies in Chrome.
- Gate authority: no phase transition happens without Claude's honest GO/NO-GO.

**Memory:** Lives in `CLAUDE.md` (root) + `src/docs/OPERATIONS.md` + conversation context.
Claude should re-read `CLAUDE.md` + `AGENT_WORKLOG.md` at the start of each session.

**MCP tools Claude uses:**
| Tool | Purpose |
|---|---|
| `mcp__Claude_in_Chrome__*` | Live browser inspection, DB queries, UI verification |
| `mcp__44755e1c-3b95-48f1-bb03-983950f41cc3__*` | Figma — read designs, extract specs |
| `mcp__5cea0d57-*__*` | Gmail — read notifications, approval emails |
| `mcp__bd1f36da-*__*` | Calendar — sprint planning, milestones |
| `WebFetch / WebSearch` | Research industry patterns (SAP Fiori, Workday UX, etc.) |
| `Read / Edit / Write / Grep / Glob` | Direct codebase access |

**What Claude needs that it doesn't have yet:**
- **Supabase MCP** — direct DB queries without going through Chrome JavaScript injection
- **GitHub MCP** — read PRs, create issues, check CI status
- **Persistent memory file** — a `src/docs/CLAUDE_MEMORY.md` updated at end of each session

---

### Codex (Implementation Workforce)
**Role:** Writes code against Claude's specs. Never sets its own direction.
- Reads the spec. Implements it. Updates AGENT_WORKLOG.md. Runs `npm run build`.
- Does NOT touch files owned by Claude in the same cycle (see §5 File Ownership).
- Does NOT make architectural decisions. Flags blockers to Claude instead.

**Memory:** Codex agents have NO persistent memory between runs.
This is the biggest operational risk. Every Codex run must start with:
1. Read `CLAUDE.md`
2. Read `src/docs/OPERATIONS.md`
3. Read `src/docs/TASK_BACKLOG.md` (pick the top unstarted task)
4. Read `src/docs/AGENT_WORKLOG.md` (understand what just changed)

**MCP tools Codex needs (currently missing):**
| Tool | Gap | Impact |
|---|---|---|
| Supabase MCP | Codex can't query live DB | Can't verify data-layer fixes without Chrome |
| GitHub MCP | No PR/issue creation | Handoffs are chat-only |
| Browser/Preview MCP | No UI verification | Ships broken layouts (see SubmissionsView row bug) |
| Figma MCP | No design access | UI deviates from design intent |

**Codex subagents** (defined in `.codex/agents/`):
- `frontend-developer` — React, Tailwind, shadcn/ui
- `backend-developer` — Supabase, edge functions, Hono
- `postgres-pro` — Migrations, RLS, schema design
- `api-designer` — API contracts, types, validation
- `security-auditor` — Auth, RLS, permission model
- `reviewer` — Build verification, diff review

---

### Antigravity (UI/UX Designer)
**Role:** Visual polish, component styling, Figma → code translation.
- Works from Figma designs or Claude's written specs with exact Tailwind classes.
- Does NOT make UX decisions. Does NOT touch business logic or API files.
- Output reviewed by Claude before merge.

**Memory:** Reads `src/docs/DESIGN_PRINCIPLES.md` (to be created) + Figma file.

**What Antigravity needs:**
- **A Figma file** — without it, Antigravity guesses. We need at least a design system (colors, typography, spacing, component states).
- **Design tokens** locked in `tailwind.config.ts` — consistent spacing and color scale.
- **Screen recordings** of current UI — so Antigravity sees what's actually rendering.

---

## 2. Memory Protocol

### Problem
All agents lose context between runs. This causes:
- Codex re-implementing things already done
- Decisions made in one session lost in the next
- Duplicate bugs, duplicate fixes

### Solution: Three memory files

**`CLAUDE.md` (root)** — Project-level context. Read by ALL agents at the start of every run.
- Updated by Claude after significant architectural decisions.
- Contains: tech stack, current phase, critical architecture notes, things that bite you.

**`src/docs/AGENT_WORKLOG.md`** — Activity log. Updated after every completed task.
- Format: `## YYYY-MM-DD - [STATUS] task-name (Agent)` + bullet summary + residual risks.
- Max 30 entries. Older entries move to `archive/AGENT_WORKLOG_ARCHIVE.md`.

**`src/docs/TASK_BACKLOG.md`** — Ordered task queue. The sprint board.
- Codex picks the top `[READY]` task. Claude moves tasks through statuses.
- Statuses: `[READY]` → `[IN PROGRESS]` → `[REVIEW]` → `[DONE]` / `[BLOCKED]`

### Session start ritual (all agents)
```
1. Read CLAUDE.md
2. Read src/docs/OPERATIONS.md (this file)
3. Read src/docs/TASK_BACKLOG.md
4. Read src/docs/AGENT_WORKLOG.md (last 10 entries)
5. Pick your task. Update its status to [IN PROGRESS].
```

---

## 3. Doc Structure

```
/ (root)
├── CLAUDE.md                    ← Project context. Read by everyone. Updated by Claude.
│
src/docs/
├── OPERATIONS.md               ← This file. Team structure, memory, tools, coordination.
├── TASK_BACKLOG.md             ← Sprint board. Ordered task queue.
├── AGENT_WORKLOG.md            ← Activity log (last 30 entries).
├── ROADMAP.md                  ← Product phases and priorities.
│
├── specs/                      ← Implementation specs (one per feature).
│   ├── APPROVAL_SUBMISSIONS_SPEC.md
│   ├── PROJECT_CREATION_SPEC.md
│   ├── PHASE4_INVOICE_SPEC.md
│   ├── SQL_SCHEMA_MIGRATION.md
│   ├── TIMESHEET_STRATEGY.md
│   └── WORKGRAPH.md
│
└── archive/                    ← Historical snapshots. Never delete, just move here.
    ├── AGENT_WORKLOG_ARCHIVE.md
    └── [dated sprint/gate docs]
```

**Rules:**
- Root `src/docs/` stays under 6 files. New feature docs go in `specs/`.
- No file > 300 lines. Split if larger.
- Never edit files in `archive/`.
- Specs reference `AGENT_WORKLOG.md` for recent changes — don't duplicate history in specs.

---

## 4. Coordination Protocol

### Claude → Codex (assigning work)
1. Claude writes or updates a spec in `src/docs/specs/`.
2. Claude adds the task to `src/docs/TASK_BACKLOG.md` with status `[READY]`.
3. Claude tells Nikola: "Ready for Codex. Task: X in TASK_BACKLOG."
4. Nikola triggers Codex.

### Codex → Claude (reporting back)
1. Codex updates `AGENT_WORKLOG.md` with what changed + residual risks.
2. Codex updates task in `TASK_BACKLOG.md` to `[REVIEW]`.
3. Nikola shares screenshot or build output with Claude.
4. Claude reviews diff + build + visual. Approves or flags issues.

### Conflict prevention
- Codex never edits files listed as "Claude-owned" in TASK_BACKLOG.md.
- Claude-owned files (always): `CLAUDE.md`, `src/docs/OPERATIONS.md`, `src/docs/ROADMAP.md`
- Spec ownership is per-task — defined in each TASK_BACKLOG entry.

---

## 5. File Ownership Rules

| File / Directory | Owner | Rule |
|---|---|---|
| `CLAUDE.md` | Claude | Never touched by Codex |
| `src/docs/OPERATIONS.md` | Claude | Never touched by Codex |
| `src/docs/ROADMAP.md` | Claude | Never touched by Codex |
| `src/docs/TASK_BACKLOG.md` | Claude writes, Codex updates status | Both touch, no structural edits by Codex |
| `src/docs/AGENT_WORKLOG.md` | All agents append | Append only. Never edit prior entries. |
| `src/utils/api/approvals-supabase.ts` | Claude (active fixes) | Codex may read, not edit without explicit clearance |
| `src/utils/api/timesheets-api.ts` | Claude (active fixes) | Same |
| `src/components/approvals/ApprovalsWorkbench.tsx` | Claude reviews, Codex implements | Codex must reference spec |
| All other `src/` files | Codex | Claude reviews output |
| `supabase/migrations/` | Codex postgres-pro drafts, Claude approves | Claude reviews before user applies |

---

## 6. Quality Gates

### Before Codex marks a task [REVIEW]:
- [ ] `npm run build` passes (zero errors, circular chunk warnings OK)
- [ ] No new TypeScript `any` casts without comment explaining why
- [ ] `AGENT_WORKLOG.md` updated with what changed + residual risks
- [ ] Task status updated in `TASK_BACKLOG.md`

### Before Claude approves a task:
- [ ] Read the actual diff (not just the summary)
- [ ] Verify build passes
- [ ] Visual verification via Chrome MCP or user screenshot
- [ ] No regressions in files Claude owns
- [ ] Residual risks documented

### Before a phase gate:
- [ ] All `[REVIEW]` tasks approved or moved to next phase
- [ ] Core loop works end-to-end: project → timesheet → approve → reflect in timesheets
- [ ] No `[BLOCKED]` tasks in current phase backlog
- [ ] Claude issues honest GO/NO-GO in writing in AGENT_WORKLOG.md
