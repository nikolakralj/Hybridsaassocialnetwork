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
