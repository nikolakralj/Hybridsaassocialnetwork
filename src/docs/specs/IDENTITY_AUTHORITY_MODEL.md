# Identity & Authority Model — Investigation + Target Design

**Status:** Investigation complete; target design DECIDED; build mostly NOT done.
**Author:** Claude (architect), 2026-07-16
**Trigger:** Nikola's questions on company representation, delegation, cross-org
invites, hiding, and destructive-action protection.
**Related:** GRAPH_CONFIDENTIALITY_SPEC (Privity Rule), C2_COMPANY_MEMBERSHIP_SPEC.

## The core distinction the whole model rests on

There are **three separate identity layers**. Most confusion (and most gaps)
come from conflating them:

1. **Account** — a real login (Nikola, Rodman, James). Proven by email/password.
2. **Company representation** — "this account acts for Company X." A *claim*
   until verified. The Facebook-page model: the first verified admin of a
   company controls who else may represent it.
3. **Project seat** — "on THIS project, this account has role R for party P."
   Scoped to one project; does not grant company-wide authority.

A person can be a verified rep of G2 (layer 2) yet have only a Viewer seat on
one project (layer 3). These must never be collapsed into a single "role".

## Who represents a company? (layer 2)

Target rule (schema exists in migration 018; flow mostly NOT built):

- **`wg_organizations.owner_user_id`** = the company's root admin (first claimer).
- **`wg_organization_members.membership_state`** ∈ claimed / invited / verified /
  rejected / removed. **A `claimed` affiliation grants ZERO access** — only an
  existing verified `org_admin` can promote it to `verified`.
- Bootstrapping a brand-new company (chicken-and-egg): the first person to
  register it becomes owner/admin. Trust anchors to be added later: verified
  company email domain, or invitation from an already-verified upstream party.

So "how do I guarantee James owns/represents G2?" → **G2's existing admin
verifies him.** If G2 doesn't exist yet, whoever first registers G2 (with a G2
email) is its admin, and verifies the rest. You (Nikola, from Triangle Services)
cannot *unilaterally* certify that James represents G2 — you can only *invite*
him; his authority over G2 comes from G2's side.

## Per-scenario status (what's actually built)

| # | Scenario | Status | Notes |
|---|---|---|---|
| Q1 | Designate a person as owner/rep of an agency (G2) | **SCHEMA ONLY** | `wg_organizations.owner_user_id` + verified members exist; no claim→verify UI |
| Q2 | Social profiles; person owns company, represents it | **NOT BUILT** | Phase 9 territory; the C2 claim model is the bridge |
| Q3 | Invite someone and delegate them to G2 (counterparty rep) | **NOT BUILT** | Only `wg_assign_project_member_as_worker` exists, and it maps to the OWNER's org only, owner-only |
| Q4 | Nikola invites James (G2 PM) for only this project | **PARTIAL** | Can send a project invite; cannot map him as G2's project approver — no flow |
| Q5 | James invites B2 and hides them from Triangle Services | **NOT BUILT** | Needs sub-invitation authority + privity hiding across a new edge |
| Q6 | James accidentally deletes the Triangle Services node | **🔴 VULNERABLE** | See below — any Editor can delete any node |
| Q7 | Can Rodman (Contributor) invite anyone? | **CORRECT: NO** | `getInvitableRolesForRole(Contributor) = []`; only Owner/Editor invite |

## 🔴 Critical vulnerability found (Q6): graph authority

**Today, any project Editor can delete or overwrite ANY node — including your
own company node — and it is enforced only in the browser.**

Root causes (verified in code):
1. `ROLE_PERMISSIONS.Editor` includes `delete_party`, `edit_party` for **all**
   nodes — there is no per-party ownership check.
2. `checkContributorScope()` is a **TODO stub that returns `true`** — even a
   Contributor can edit any node, not just their own org's.
3. The graph is one `wg_projects.graph` JSONB blob written wholesale by
   `updateProject`. **Last-write-wins, no per-node ownership, no server
   validation.** Whoever saves the graph replaces the entire thing.

So James-as-Editor deleting "Triangle Services" is not a hypothetical — it works,
and there's no undo. This must be fixed before any real counterparty gets an
Editor seat.

**Target fix (not yet built):**
- **Node ownership**: every party/person node carries `ownerOrgId`. You may only
  edit/delete nodes your org owns; counterparty nodes are read-only to you.
- **Server-authoritative graph writes**: an RPC validates each node change
  against the caller's org before persisting (no wholesale blob overwrite).
- **Soft delete + version history** so an accidental delete is recoverable
  (the graph-versions table exists but is currently dead — revive it).

## Invitation authority (layer 3) — target rules

Extends the Privity Rule's "edges are created only by their endpoints":

- **Own workers**: an org's admin (or the project owner for their own org)
  invites Contributors and maps them as workers. ✅ built (owner path).
- **Counterparty rep**: to give G2 a real approver, **G2's admin** invites/maps
  their own people. As a testing shortcut the project owner may seed a G2 rep,
  but production authority is G2's. ❌ flow not built.
- **Downstream sub (Q5)**: James (G2) may invite a sub (B2) on the G2↔B2 edge,
  gated by the upstream contract flag `subcontracting: allowed|with_consent|
  forbidden`. Triangle Services sees *that* G2 subcontracts (if policy requires
  disclosure) but never B2's internal terms — privity hiding. ❌ not built.
- **Rodman (Contributor)** invites **nobody**. ✅ correct today.

## Recommended build order (a real epic, post-M2)

1. **C3a — Graph authority (URGENT, security):** node `ownerOrgId`, edit/delete
   guarded to owning org, server-authoritative graph write RPC, soft-delete +
   revive version history. Fixes Q6. Do this before any external Editor.
2. **C3b — Counterparty representative:** invite + verify a person as an org's
   rep/approver (Q1, Q3, Q4). Retires the dev chain-walker.
3. **C3c — Sub-invitation + privity hiding (Q5):** downstream invites gated by
   the subcontracting flag; new party hidden from non-privity parties.
4. **Phase 9 — Social identity (Q2):** public person/company profiles; profile
   "I work for X" is a claim that anchors into the C2 verification model.

## One-line answers for Nikola

- **Rodman can invite nobody** — correct and enforced.
- **You cannot certify James as G2** — you invite; G2's admin verifies. First
  registrant of G2 is its admin.
- **James-as-Editor CAN delete your node today** — real bug, fix is C3a.
- **"Do we have working versions for all these?"** — No. Q7 yes, Q6 is a bug,
  the rest are schema-only or unbuilt. This spec is the plan to get there.
