# G2 / RSM InTime Benchmark Notes

**Status:** Product research  
**Date:** 2026-07-14  
**Source:** authenticated G2 placement list + public RSM/InTime contractor and manager guides  
**Scope:** Ideas to adapt into WorkGraph, not clone one-to-one

## Access Reality

The G2 portal URL redirects anonymous automation to the public RSM InTime login page:

- `https://timesheets.g2recruitment.com/placement/list`
- Redirects to `/login/auth`

After the user opened the authenticated session in Chrome, Codex inspected the live
Placement Search page. Do not store private row values from that page in this repo;
only field names and workflow patterns are captured below.

## Authenticated Placement Search Findings

The opened G2/InTime page confirms that the placement is the commercial operating
record. It is a searchable, sortable, column-configurable grid with page-size controls,
Detailed Report, Download Detailed Report, and CSV export actions.

Observed columns, anonymized:

- Ref
- Start / End
- Job Title
- Worker
- Provider
- Ltd Company
- Payroll
- Consultant
- Client Names
- Client Ref
- Manager
- Created / Modified
- Default Rate
- Default Rate Pay
- Default Rate Type
- Purchase Order Number
- Expenses PO

Product implications for WorkGraph:

- A graph edge/person assignment needs a placement profile, not only a visual node.
- Placement IDs and client refs are first-class support/reconciliation fields.
- Payroll cadence belongs on the assignment: weekly/monthly/limited-company/etc.
- Consultant and manager are first-class routing actors for support and approvals.
- Purchase order and expenses purchase order should be separate fields.
- Rate display must distinguish rate label, pay amount, rate type, and confidentiality.
- Report/export is table-stakes for agencies; "Choose columns + CSV" is not a nice-to-have.

## What InTime Gets Right

### 1. Placement-Centric Model

InTime treats the placement as the contractor's work container. Public guides describe
profiles/placements as where contractors view placement details, associated clients,
contract documentation, information requests, and AWR status.

WorkGraph fit:

- Add a "Placement profile" panel for each person/org assignment.
- Show client, agency, role/title, start/end date, approval manager, engagement type,
  allowed expense policy, and document/compliance status.
- Link placement to the graph edge, not just to a person.
- Include operational identifiers: placement ref, client ref, PO number, expenses PO,
  payroll cadence, consultant, manager, rate label/type, and confidential pay/bill
  rate summaries where allowed.

### 2. Timesheet Status Buckets

InTime menus commonly split timesheets into draft, submitted/unauthorised,
approved, rejected, and search/history.

WorkGraph fit:

- Keep our month calendar, but add status shortcuts:
  - Draft
  - Waiting approval
  - Approved
  - Rejected
  - Missing / not submitted
- Add "missing timesheets" as a first-class manager dashboard item.

### 3. Expenses Are A Peer Workflow

InTime supports expense creation, draft/edit, submit, unauthorised/approved/rejected
status views, and manager authorisation. Expenses follow the same approval mental
model as timesheets.

WorkGraph fit:

- P4-9 is correctly shaped: expense claims should reuse the approval engine.
- Expense claims need period/placement selection, category, amount, currency,
  description, receipt, billable flag, and status.
- Rejected expenses should return to draft with a visible rejection reason.

### 4. Pay / Invoices / Remittance Advice

InTime contractor portals commonly expose pay, invoices, credit notes, and remittance
advice slips.

WorkGraph fit:

- Add a "Pay" or "Billing" subview for contractors/orgs:
  - draft invoices
  - issued invoices
  - paid/remittance status
  - credit notes later
- Our invoice list should eventually show "paid by agency/client" and remittance
  document/status, not only generated draft/issued.

### 5. Manager Authorisation

Manager guides describe an Authorise queue for both timesheets and expenses, with
bulk approve and per-item approve/reject plus rejection reason. Some guides also
describe approval by email links.

WorkGraph fit:

- Our Approvals queue should show mixed subjects cleanly:
  - timesheet
  - expense
  - invoice / credit note later
- Keep row-level details and rejection reason.
- Email approval links are a strong follow-up once token security is fully deployed.

### 6. Compliance / AWR / Information Requests

Public guides reference compliance, contract documentation, information requests,
and AWR status.

WorkGraph fit:

- Add a "Placement readiness" strip:
  - contract signed
  - right-to-work/compliance complete
  - AWR status where relevant
  - payment/bank details complete
  - expense policy enabled/disabled
- This belongs next to the placement profile, not buried in settings.

## WorkGraph Differentiation

InTime is placement and payroll-portal centered.

WorkGraph should be graph and trust-boundary centered:

- InTime says "placement"; WorkGraph says "placement inside a multi-party DAG."
- InTime has timesheet/expense/invoice modules; WorkGraph should connect those to
  contract signatories, approval paths, and rate visibility rules.
- The win is not copying forms. The win is making each form explain *why this person,
  this company, and this approver can see or act on this item*.

## Proposed Product Cards

### G2-1 Placement Profile Panel

Add a placement detail drawer/page for each person assignment:

- person / org / client
- placement ref / client ref
- role/title
- engagement type: employee/contractor
- start/end date
- payroll cadence
- consultant / manager
- purchase order number / expenses PO
- approval manager / route
- expense policy
- rate label/type and pay/bill summary, masked by graph confidentiality rules
- document/compliance status
- billing/payment status shortcuts

### G2-1b Placement Reports / Export

Add agency-grade reporting around placements:

- searchable placement list
- configurable columns
- CSV export
- detailed report view/download
- filters by worker, provider, client, manager, consultant, date range, payroll cadence,
  missing PO, and missing/expired end date

### G2-2 Missing Timesheets Dashboard

Manager/org view should show:

- expected weeks
- submitted weeks
- approved weeks
- missing weeks
- rejected weeks needing resubmission

This is more sellable than only showing what exists.

### G2-3 Expenses P4-9

Proceed with the existing P4-9 design:

- expense CRUD
- submit for approval
- same approval queue
- approved billable expenses appended to invoice
- rejected claims return to draft with reason

### G2-4 Pay / Remittance Status

After invoice issue/PDF:

- add payment/remittance status
- support credit notes later
- allow contractors/orgs to view issued invoices/remittance documents they are
  signatories to

### G2-5 Compliance / Information Requests

Later:

- compliance request checklist
- AWR/status fields for UK-style staffing workflows
- document upload requests tied to placement

## References

- G2 InTime login: `https://timesheets.g2recruitment.com/login/auth`
- RED Global InTime contractor guide: `https://www.redglobal.com/upload/files/intime-guide-contractor-2024-08.pdf`
- RSM InTime Contractor Portal Confluence: `https://eslrsm.atlassian.net/wiki/spaces/ds/pages/51875818/Contractor%2BPortal`
- IT Works RSM In-Time manager guide: `https://www.itworksrec.co.uk/rsm-in-time-manager-guide/`
- IT Works Health RSM In-Time contractor guide: `https://www.itworkshealth.co.uk/rsm-in-time-contractor-guide/`
- Outsource UK InTime contractor guide: `https://www.outsource-uk.co.uk/sites/default/files/2023-08/Outsource%20UK%20InTime%20Contractor%20Guide.pdf`
