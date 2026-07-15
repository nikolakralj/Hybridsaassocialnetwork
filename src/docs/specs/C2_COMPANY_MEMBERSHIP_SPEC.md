# C2 Company Membership And Private Worker Contracts

**Status:** Ready for architecture review  
**Date:** 2026-07-14  
**Owner:** Codex draft, Claude review  
**Related:** `GRAPH_CONFIDENTIALITY_SPEC.md`, `BULLHORN_LESSONS_STRATEGY.md`

## Decision

Company membership is separate from project membership.

A company can have many internal people, but only a chosen subset becomes visible
on a project roster. This lets a company keep accountants, finance admins,
internal coordinators, and non-project staff private while exposing the workers
and contacts needed for the project workflow.

## Why This Exists

The sellable staffing workflow is:

```text
agency invites company
company admin accepts
company admin chooses which workers appear on the project
worker submits time/contract
company admin approves internally
agency/client approve upstream work
invoice is generated without leaking private worker-company terms
```

C1 invitation acceptance only proves a user can accept a token. C2 defines the
trust model needed for real companies.

## Core Model

### Personal Profile

A user-owned profile in the future social/SaaS layer.

A person may publicly or privately state:

- name
- skills
- work history
- desired role
- "I work for Company XYZ"
- availability

Important rule:

> A profile claim is not organization membership.

If a person declares that they work for Company XYZ, that creates a claim or
request. It does not grant access to company-private data, project rosters,
contracts, rates, invoices, or approval powers until a company admin verifies it.

### Company Profile

A company-owned profile in the future social/SaaS layer.

Public side:

- company name
- description
- website/location
- public services/skills
- public contacts if the company chooses

Private side:

- verified organization directory
- project rosters
- company documents
- finance/admin roles
- membership requests

Only verified company admins can decide who belongs to the company directory and
who appears on a project roster.

### Organization Directory

The private list of people who belong to a company profile.

Visible to:

- `org_admin`
- `org_finance`, for finance-relevant fields
- `org_manager`, for assigned teams
- the person themself

Not automatically visible to:

- agency users
- client users
- upstream/downstream companies
- project owners outside the organization

Examples:

- owner/admin
- employee
- contractor
- accountant
- finance contact
- internal coordinator

### Project Roster

The subset of organization people exposed to a specific project.

Visible to direct counterparties only as needed for workflow:

- agency consultant can see named workers assigned to the placement
- client approver can see the worker/time details needed to approve
- agency/client cannot see hidden internal company staff
- agency/client cannot see private pay rate or worker-company contract unless
  they are signatories or explicit delegates

## Membership States

### Claimed

A user has claimed association with a company from their personal profile.

Example:

```text
Nikola creates personal profile
-> adds "I work for Triangle Services DOO"
-> membership state = claimed
```

Claimed users cannot:

- see company-private data
- submit time as that company's worker
- access company documents
- approve as company manager/admin
- appear as verified company staff

The company admin sees the claim as a pending membership request.

### Invited

A company admin invited a person to join the company directory.

The person must accept before membership is active. This prevents companies from
silently adding people who do not agree to be represented by that company.

### Verified

The person accepted the company invitation or the company admin approved the
person's claim.

Verified membership can then be assigned an organization role:

- `org_admin`
- `org_finance`
- `org_manager`
- `org_worker`
- `org_viewer`

Verified membership still does not mean project visibility. The company admin
must add the person to a project roster for project-specific work.

### Rejected / Removed

The company admin rejected a claim, or the person/company removed the
relationship.

Historical project records should keep their audit trail, but future access is
revoked.

### Placement Worker

A person who performs client-facing, billable, or approvable work.

Rule:

> A person cannot submit client-facing timesheets, appear on client-facing
> invoices, or require agency/client approval while being fully hidden from the
> direct approver/counterparty.

The counterparty does not need to see pay/margin/private contract terms, but they
do need enough operational identity to approve the work.

### Internal Support Person

A person who supports the company's operations but does not perform client-facing
work on the placement.

Examples:

- accountant
- payroll admin
- company finance user
- internal operations coordinator

These users can be hidden from the project roster. They may access company
documents/invoices internally if their org role allows it.

## Visibility Modes

### Hidden From Project

Use for:

- accountants
- finance admins not involved with the agency/client
- internal coordinators
- employees unrelated to the placement

They do not appear in:

- agency project roster
- client project roster
- approval queue submitter list
- invoice line item worker list
- placement reports shared outside the company

### Visible As Project Contact

Use for:

- company admin
- finance contact
- delivery manager

They can appear as:

- company contact
- invoice contact
- approval contact
- document signer

They do not automatically become billable workers.

### Visible As Worker

Use for:

- employees/contractors whose time is submitted for agency/client approval
- people whose hours appear on invoice lines
- people assigned to placement work

Visible operational fields:

- name
- role/title
- placement assignment
- submitted hours/tasks
- approval status
- worker/company relationship where needed

Hidden commercial fields:

- worker pay rate
- worker-company contract
- company margin
- company-to-worker payment terms

### Visible As Anonymized Capacity

Future option only, not v1.

Possible for enterprise/legal cases where the agency buys capacity rather than
named individuals. This requires separate approval/invoice rules and should not
be used for normal staffing timesheets.

## Invite Types

### Invite Company To Project

Sent by agency/project owner to a company admin.

Acceptance creates:

- project membership for the accepting company admin
- organization participation in the project
- empty project roster for that company

The company admin then chooses which internal people to expose.

### Invite Worker To Company

Sent by company admin.

Acceptance creates:

- organization membership
- mapped graph person identity
- default `Hidden from project` until explicitly added to a project roster

### Approve Company Claim

Used when a person found the company socially/publicly and requested membership
without a direct invite.

Approval creates:

- verified organization membership
- org role chosen by company admin
- default `Hidden from project`

Rejection creates no membership and should optionally notify the user.

### Invite Worker To Project Roster

Used when the worker already belongs to the company.

Creates:

- project roster entry
- placement worker assignment
- timesheet eligibility
- approval route participation

### Invite Agency/Client Approver

Creates:

- project membership
- optional organization membership for agency/client org
- approver permission for the assigned approval layer

Does not grant private company directory access.

## Canonical Scenario

### Actors

- Nikola: `org_admin` of Nikola Company
- Worker 1: `org_worker`, visible as project worker
- Worker 2: `org_worker`, visible as project worker
- Accountant: `org_finance`, hidden from project
- James: agency approver
- John: final agency/client-side approver

### Timesheet Flow

```text
Worker 1 submits timesheet
-> Nikola approves as company admin / manager
-> James approves as agency approver
-> John approves as final approver
-> Approved work becomes invoiceable
```

James and John can see Worker 1's name, role, submitted hours, approval history,
and placement context. They cannot see Worker 1's pay rate, worker-company
contract, or Nikola Company's margin.

### Contract Flow

```text
Worker 1 uploads/signs worker-company contract
-> Nikola reviews/approves/stores it
-> Accountant can see it if org_finance permission allows
-> James and John cannot see it
```

Company-to-agency contracts are separate signatory-scoped documents. James may
see those only if his agency is a signatory or explicit delegate.

## Data Model Direction

Target tables/RPCs from `GRAPH_CONFIDENTIALITY_SPEC.md` still apply.

Minimum C2 concepts:

- `wg_organizations`
- `wg_organization_members`
- `wg_project_organizations`
- `wg_project_roster`
- `wg_project_roster_visibility`
- `wg_documents`
- `wg_document_signatories`
- `wg_document_acl`

Until those land, UI must clearly mark any prototype-only behavior as not a
production security boundary.

## UI Requirements

### Company Profile

Future social/SaaS page for a company:

- public/company profile basics
- private internal directory
- company admins/managers/finance users
- active projects
- project-specific rosters
- documents owned by the company
- pending membership claims
- outgoing company invites

Company admins can:

- approve/reject people who claim company affiliation
- invite people directly by email
- set org role after verification
- add verified people to project rosters

Company admins cannot:

- silently turn an unverified external profile into a company member with access
  to private data
- add a person to client-facing project work unless that person is verified or
  explicitly invited into that workflow

### Project Company Settings

For each company in a project:

- show internal company members to company admins only
- let company admin choose who is visible on the project
- require a visibility reason:
  - worker
  - contact
  - approver
  - finance
  - hidden internal
- warn when a hidden person is used in client-facing time/invoice workflows

### Personal Profile

Future social/SaaS page for a person:

- user can claim current/past company affiliation
- user can accept/decline company invitations
- user can see which companies have verified them
- user can leave a company, subject to preserving historical audit records
- user can control public visibility of skills/profile fields

### Agency View

Agency sees:

- company name
- company project contacts
- visible project workers
- submitted/approved hours
- documents/contracts where agency is signatory
- invoice data issued to or from agency

Agency does not see:

- hidden internal company people
- worker-company private contracts
- worker pay rates
- company margin

## Acceptance Criteria

- [ ] Agency can invite a company, not only an individual project member.
- [ ] Company admin can invite workers into the company directory.
- [ ] A person can claim they work for a company, but the claim grants no access
      until a company admin verifies it.
- [ ] Company admin can approve/reject claimed membership.
- [ ] Company admin can choose which workers are visible on a project roster.
- [ ] Hidden internal users do not appear to agency/client users.
- [ ] Visible workers can submit timesheets under their mapped graph identity.
- [ ] Internal company approval can happen before upstream agency/client approval.
- [ ] Worker-company contracts remain invisible to agency/client users.
- [ ] Agency/client approvers can still approve work with enough operational
      context.
- [ ] Invoice generation can include visible worker hours without exposing worker
      pay terms or company margin.
- [ ] Debug persona switching remains local/debug-only and cannot become a
      production permission model.

## Non-Goals For C2

- full ATS candidate database
- CRM sales pipeline
- payroll execution
- anonymous labor marketplace
- enterprise SSO
- real-time multiplayer org admin

## Open Questions

1. Should agency approval require seeing a legal worker name, or can a company
   configure anonymized worker codes for some client types?
2. Should project roster visibility be controlled per project only, or per
   placement inside a project?
3. Should company finance users hidden from the project still receive invoice
   notifications from project workflows?
4. What is the first production-safe document storage path: Supabase Storage with
   RLS signed URLs, or metadata-only records until storage is ready?
5. Should company affiliation claims be public on the person's profile before
   verification, or should they display as "pending verification" privately only?
