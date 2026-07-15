# WorkGraph Graph Confidentiality Spec

**Status:** Draft for implementation  
**Owner:** Codex + Claude review  
**Date:** 2026-07-10  
**Scope:** Graph, rates, contracts, timesheets, approvals, invoices

## Why this exists

WorkGraph is sellable only if every company in the chain can trust that private
commercial data is not leaked to upstream or downstream parties.

The mistake to avoid: treating `ProjectRole.Owner` as permission to see every
rate, every contract, and every private company detail in the DAG.

Project ownership is not commercial omniscience.

## Core Principle

Visibility is the intersection of three independent axes:

1. **Project collaboration role**
   Controls project shell actions: invite, edit graph, configure workflow, archive.
2. **Organization role**
   Controls what a person can see inside their own legal entity.
3. **Graph relationship**
   Controls what counterparties can see through direct contract/signatory edges.

No single axis grants full access by itself.

## Terms

### Person

A human user. A person can belong to one or more organizations over time.

### Organization / party

A company, agency, client, freelancer business entity, or contractor entity in
the project DAG.

### Project member

The collaboration account row for the WorkGraph project.

Examples: `Owner`, `Editor`, `Contributor`, `Commenter`, `Viewer`.

This is not enough to read private rates.

### Organization membership

The person's permission inside a company/agency/client entity.

Recommended org roles:

- `org_admin`: can manage org members and see internal org commercial data.
- `org_pm`: can manage assigned project operations for the org, but only direct
  project/contract neighbor data unless explicitly granted more.
- `org_finance`: can see billing/payment/rate data for contracts involving the org.
- `org_employee`: can see own assignment, own timesheets, own pay/earning rate.
- `org_viewer`: can see non-sensitive org/project metadata only.

### Contract edge

A commercial relationship between exactly two parties.

Only signatories and explicit finance/admin delegates for those signatories can
see private contract terms by default.

## Data Classes

### Public graph metadata

May be visible to nearest relevant nodes:

- party display name
- party type
- direct connection exists
- approval position/status
- masked node placeholder

### Operational workflow data

Visible only where needed for work:

- submitted hours
- approval status
- waiting-on approver
- non-sensitive task labels when needed for approval

### Private contract data

Always signatory-scoped unless explicitly shared:

- bill rate
- pay rate
- fixed fee
- payment terms
- contract PDF
- purchase order
- invoice details before issued to the counterparty

### Personal compensation data

The worker can see what they earn.

The worker does not automatically see what the company bills for them.

### Margin data

Derived from bill rate minus pay cost.

This is internal company data. Only explicit org finance/admin roles should see
it.

## Visibility Rules

### Project Owner

Can:

- invite and manage project collaboration roles
- edit project graph/workflow if allowed
- see the graph through their own person/org identity

Cannot automatically:

- see every downstream contract
- see every rate in the chain
- see private contracts between other companies
- see another company's internal employee rates or margins

### Agency project manager

Example: agency PM manages delivery for an agency node.

Can see:

- their agency node
- agency employees/contractors assigned to the project, subject to org role
- direct neighbors connected by contract or approval edges
- direct contracts where the agency is a signatory
- rates on direct contracts only if org role permits rate visibility
- approval/timesheet status needed to operate the project

Cannot see:

- contractor-to-subcontractor rates one level behind
- contractor internal pay rates
- client-to-other-agency rates
- company margin on workers unless explicitly granted by that company

### Company owner/admin

Can see:

- company internal people and contracts only if they have `org_admin` or
  equivalent explicit company permission
- direct contracts where the company is a signatory
- company margin only for company-owned contracts/rates

Cannot see:

- non-signatory contracts elsewhere in the project
- private data for a supplier's supplier
- private data for a client-side contract unless the company is a signatory

### Company employee

Can see:

- own profile and assignment
- own timesheets
- own earning/pay rate
- direct approval status relevant to their submitted work

Cannot see:

- what the company bills the client for them
- company margin on them
- coworkers' pay rates
- downstream or upstream commercial terms

### Approver

Can see:

- submitted hours/tasks needed to approve
- submitter identity and relevant period
- approval trail

Can see rates only when:

- the approver's org is a signatory to the relevant contract, or
- the approval policy explicitly grants rate visibility for that approver.

### Client

Can see:

- direct contracts where client is a signatory
- submitted/approved hours that roll up to client approval
- invoices issued to the client

Cannot see:

- agency internal pay rates
- agency-to-subcontractor rates
- supplier margins

## Nearest Node Rule

Default graph visibility should be one commercial hop:

- show direct counterparties
- show direct contract/approval edges
- show masked existence of a second-hop party only when needed to explain the
  approval chain
- do not show second-hop private contract fields

Second-hop visibility should be status/shape, not money.

## Required Data Model Change

Private rates and contracts must not live only inside `wg_projects.graph` JSON.

Target tables:

- `wg_project_parties`
- `wg_party_members`
- `wg_party_member_roles`
- `wg_contracts`
- `wg_contract_signatories`
- `wg_contract_rates`
- `wg_contract_rate_acl`
- `wg_contract_documents`

`wg_projects.graph` may store layout and non-sensitive topology, but private
commercial fields should be resolved server-side.

## Required Server Boundary

The browser should never receive the full unmasked graph for normal users.

Required RPC/API shape:

```sql
get_project_graph_view(project_id, viewer_user_id)
```

Returns:

- visible nodes
- visible edges
- masked placeholders
- only the rate fields the viewer is allowed to see

Invoice generation should use server-side contract/rate resolution, not a rate
copied from a browser-visible graph JSON payload.

## UI Rules

- Remove production "view as anyone" impersonation. Keep only debug mode for
  testing.
- If a rate is hidden, show "Hidden: not a contract signatory" or "Hidden:
  company confidential".
- Do not show "Rate masked" as a fake table value in polished production views.
  Prefer hours-only or a subtle lock tooltip.
- Company/org viewer mode should require explicit org permission. Being project
  Owner is not enough.
- Person viewer mode is the default for ordinary users.

## Implementation Phases

### G0 - Containment

Done 2026-07-10:

- Admin full graph view disabled by default.
- Stale `__admin__` session viewers cleared.
- Invite-created members default to no rate visibility.

### G1 - Viewer Permission Refactor

- Add org-level roles/permissions separate from project roles.
- Restrict production viewer identities to:
  - current person
  - organizations where the current person has explicit org permission
- Keep arbitrary viewer switching only behind a debug flag.

### G2 - Contract/Rate Extraction From Graph JSON

- Move private rate fields from person/contract graph nodes to contract/rate
  tables.
- Replace browser-side rate reads with server-side RPCs.
- Keep graph JSON as layout/topology only.

### G3 - RLS and RPC Enforcement

- Add RLS policies so signatories and explicit org finance/admin delegates can
  read private contract/rate rows.
- Add test fixtures for agency, company, employee, contractor, subcontractor,
  and client perspectives.

### G4 - Invoice/Approval Integration

- Invoice generation resolves rates from server-side contract/rate ACL.
- Approval views show amounts only when approval policy and contract signatory
  rules allow it.

## Acceptance Scenarios

1. Agency PM sees agency's direct client contract rate, but not the
   contractor-to-subcontractor rate behind the contractor.
2. Company employee sees own pay rate but not company bill rate or company
   margin.
3. Company owner without `org_admin` project role cannot see all company private
   data just because they own the WorkGraph project.
4. Company org admin can see company internal rates and margins, but only for
   that company.
5. Client sees invoices and direct contract terms issued to the client, but not
   agency internal pay/margin data.
6. Project Owner sees project structure through their own identity, not all
   private commercial terms.
7. Refreshing the browser cannot restore a stale full-view/admin identity.

---

## DECIDED 2026-07-15 — The Privity Rule (general visibility + invitation authority)

**Decided by:** Claude (architect ruling requested by Nikola after the Rodman test)
**Status:** Canonical policy. M2's server-side graph projection implements exactly this.

### The one-line rule

> **Privity: you see your own house, the neighbors you contract with, and the
> edges you sign. Everything further is a numbered external stage unless a
> neighbor deliberately discloses it.**

This mirrors legal reality (privity of contract: NAS contracts G2, G2 contracts
Nikola Company — NAS and Nikola Company have no relationship) and the staffing
business model (the agency's client list and margins ARE its business; forced
transparency would make WorkGraph unadoptable by the very agencies it serves).

### Rule 1 — Organization sight: one hop

An organization sees, at most:
- **Itself** — fully, filtered by org roles (admin/finance/manager/employee).
- **Direct counterparties** (orgs sharing a contract/billing edge) — as a
  *façade*: org name, project contacts, the shared contract and its workflow
  state. Never their internals, other edges, people beyond the roster exposure,
  or their prices with anyone else.
- **Beyond one hop** — existence only, anonymized: "External approval — stage 2
  of 3". Counts are visible; names are not.

**Named disclosure (the exception):** an org may deliberately disclose a
neighbor's identity across one hop (e.g., G2 tells Nikola Company "the end
client is NAS") — recorded as an explicit `disclosure` grant on the edge, not a
default. Compliance regimes that require end-client disclosure (AWR/IR35-style)
use this mechanism.

### Rule 2 — Person sight: their org's sight, narrowed

A person's view = (their org's view) ∩ (their org role) ∩ (their assignment
scope). Per-assignment `visibility_scope`, chosen by the employing org's admin
when placing the person on a project roster:

| Scope | The worker sees | Use when |
|---|---|---|
| `company_only` (**default**) | Own org only; upstream = "External approval (N stages)" | Back-office staff, sensitive placements |
| `counterparty` | Own org + the one org their placement bills to (G2) | Normal placed worker — they badge into G2 anyway |
| `named_chain` | Explicitly listed orgs | Rare; senior/on-site leads |

This replaces the hardcoded rule in `graph-visibility.ts` and gives semantics to
`visibility_mode` from migration 022. `visibleToChain` (may upstream see the
worker) and `visibility_scope` (what the worker sees) are independent axes.

### Rule 3 — Invitation authority: edges are created only by their endpoints

- **Into your org:** org admins invite their own workers/members (Nikola →
  Rodman). Nobody can invite people into an org they don't administer.
- **New counterparty:** inviting an org = proposing a contract edge, allowed
  only for the org that will be an endpoint of that edge. G2 invites NAS
  (G2↔NAS edge). G2 invites Nikola Company. **Nikola Company cannot invite NAS**
  — it would be creating someone else's edge two hops away.
- **Downward extension:** Nikola Company MAY invite its own subcontractor
  (Nikola↔SubCo edge — it's an endpoint). Real contracts often forbid or gate
  subcontracting, so the upstream edge carries a policy flag:
  `subcontracting: allowed | with_consent | forbidden` (default `with_consent`
  → upstream neighbor gets a consent request, sees the fact of subcontracting,
  not SubCo's terms). Enforcement may land post-M2; the flag exists from day one.
- **Project roles** (approver/viewer seats) are granted by the org that owns
  that seat's side of the workflow, and grant only the narrow project role —
  never org membership.
- Project ownership grants **no** invitation authority beyond the owner org's
  own edges. Ownership is not omniscience — and not omnipotence either.

### Rule 4 — Commercial values live on edges, never in shared state

Every money value belongs to exactly one relationship and is visible only to
that relationship's endpoints (per org role):

| Value | Lives on | Visible to |
|---|---|---|
| Rodman's pay/salary | Person↔Company contract | Rodman (own terms) + company admin/finance |
| Nikola→G2 bill rate | Company↔Agency edge | Both signatories' finance/admin |
| G2→NAS rate | Agency↔Client edge | G2 + NAS only — Nikola never |
| Margins | Derived, org-private | Owning org's finance only |

Workers don't set their own pay (propose/accept only). Employees may have no
hourly rate at all (P4-7 engagement type). These values are forbidden in shared
graph JSON — 020/021 tables are their only home (M2 completes the migration).

### Rule 5 — The rule is server truth or it is nothing

`graph-visibility.ts` is presentation. The enforcement point is a server-side
projection — `get_scoped_graph(project_id) → nodes/edges the caller may see`,
computed from org membership + edges + roster + visibility_scope + disclosures.
Unauthorized nodes are never serialized to the browser. The privity rule makes
this cheap: caller's org + one hop + explicit disclosures is a bounded query,
not a policy engine.

### Acceptance additions (extend the scenario list above)

8. Rodman (`company_only`) sees Nikola Company and "External approval — 2
   stages"; G2 and NAS names never reach his browser payload.
9. Rodman (`counterparty`) sees G2's façade; NAS still absent from his payload.
10. Nikola Company's UI offers no path to invite NAS; G2's does.
11. Nikola invites SubCo under `with_consent`: G2 receives a consent item; NAS
    sees nothing.
12. DevTools inspection of any non-admin session shows no cross-boundary org
    names, rates, or contracts in any network response (M2 exit test).
