# Agent Registry (WorkGraph)

Version: 1.0  
Date: 2026-03-25  
Workspace: `C:\Users\NK\Projects\HybridSocialApp-run`

---

## 1) Where agent files live on this machine

### Skill interface files (installed)
- `C:\Users\NK\.codex\vendor_imports\skills\skills\.curated\*\agents\openai.yaml`
- `C:\Users\NK\.codex\skills\*\agents\openai.yaml`

These `openai.yaml` files define skill UI metadata (display name, default prompt, optional MCP dependencies).

### Skill behavior docs (how a skill should be used)
- `C:\Users\NK\.codex\skills\*\SKILL.md`
- Example: `C:\Users\NK\.codex\skills\figma\SKILL.md`

### Project coordination docs (this repository)
- `src/docs/CODEX_SUBAGENT_PLAYBOOK.md`
- `src/docs/AGENT_WORKLOG.md`
- `src/docs/AGENT_REGISTRY.md` (this file)

---

## 2) Important distinction: skills vs runtime subagents

- Skills are reusable instruction packs on disk (`SKILL.md` + `agents/openai.yaml`).
- Runtime subagents (spawned in a Codex session) do not create per-agent `.md` files automatically.
- To keep accountability, we document runtime subagents in `AGENT_WORKLOG.md` and in this registry.

---

## 3) Standard team topology for this project

1. Coordinator (main Codex thread)
- Role: sequencing, ownership assignment, integration, final quality gate.
- Writes: only when integrating or fixing.

2. Critical Auditor (read-only explorer)
- Model: `gpt-5.4` (high).
- Role: hard blocker detection, phase-gate verdict, risk review.

3. Idea Strategist (read-only explorer)
- Model: `gpt-5.2` or `gpt-5.4-mini`.
- Role: alternatives, UX/product options, forward-compatible schema ideas.

4. Implementer A (worker)
- Model: `gpt-5.3-codex` or `gpt-5.4-mini`.
- Role: one bounded implementation area.

5. Implementer B (worker, optional)
- Model: `gpt-5.4-mini`.
- Role: second bounded implementation area with disjoint file scope.

Rules:
- Max 2 writer agents in parallel.
- Every delegated task must include explicit file ownership.
- Every agent output must include changed files and a short verification note.

---

## 4) Current session mapping (for Claude review)

### Batch A (fallback + audits)
- `Goodall` (`019d253a-3d45-7581-8014-fa10ecb02faf`): worker, implemented fallback chain.
- `Hooke` (`019d253a-3d08-7a20-ad62-ecdadb246345`): explorer, timesheet UX audit.
- `Confucius` (`019d253a-3d75-7611-8a21-268431484307`): explorer, approval/DB consistency audit.

### Batch B (phase gate hard blocker #1)
- `Beauvoir` (`019d2555-e092-7d43-ba67-a7ae311cd997`): explorer, critical gate verdict and schema contract.
- `Laplace` (`019d2555-e0c6-7f31-a723-d97e3d28491e`): explorer, forward-compatible schema recommendation.
- `Hypatia` (`019d2555-e11a-71d0-8574-6aef302e3708`): worker, added `007_approval_records.sql`.

---

## 5) Output template each agent must follow

1. `Role + model + task`
2. `Owned files`
3. `What changed`
4. `What is still risky`
5. `How to verify quickly`

This is mandatory for worklog entries going forward.

---

## 6) Phase-gate policy

- If `Phase 3 gate = NO-GO`, no new Phase 4 features should be started.
- Allowed work during NO-GO: blocker fixes, bug fixes, migrations, stability tests, docs alignment.

