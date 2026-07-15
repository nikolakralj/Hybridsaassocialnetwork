# Bullhorn Lessons Strategy

**Status:** Product strategy note  
**Date:** 2026-07-14  
**Scope:** What WorkGraph should learn from Bullhorn without trying to become Bullhorn

## Executive Decision

Do not try to compete with Bullhorn feature-for-feature.

Bullhorn is a broad staffing operating system: ATS, CRM, candidate pipeline,
client sales, automation, onboarding, time and expense, pay/bill, reporting, and
marketplace integrations.

WorkGraph should win with a narrower wedge:

> Graph-aware pay-and-bill workflows for small staffing and contractor companies
> where every party sees only the contracts, rates, approvals, and invoices they
> are entitled to see.

The graph is not the product surface users live in every day. The graph is the
trust model and explanation layer behind placements, approvals, expenses,
invoices, and documents.

## What Bullhorn Teaches Us

### 1. The Placement Is The Operating Object

Bullhorn/InTime-style systems organize real work around placements:

- worker
- provider/company
- client
- consultant
- manager
- start/end date
- payroll cadence
- purchase order
- rate type
- time, expense, pay, bill, and reporting

WorkGraph should treat each graph assignment as a placement record. The canvas is
useful for setup and explanation, but daily work needs placement profiles,
placement lists, and placement reports.

### 2. Pay/Bill Is The Trust Center

The sellable loop is:

```text
placement -> timesheet/expense -> approval -> invoice -> payment/remittance
```

If approved work does not become correct invoice output, WorkGraph stops before
the money moment.

### 3. Automation Should Remove Agency Busywork

Useful automation is not a generic chatbot. Useful automation should:

- remind workers to submit missing timesheets
- remind managers/agency approvers when approval is waiting
- warn when PO data is missing before invoicing
- warn when approved work has not been invoiced
- detect missing rates/contracts before the invoice run
- draft polite reminder emails
- classify expense receipts later

### 4. Confidentiality Is WorkGraph's Differentiator

Bullhorn-scale systems are broad. WorkGraph can be sharper by solving the trust
boundary for multi-party contractor chains:

- employee sees own pay/earning rate
- employee does not see company bill rate or margin
- agency sees direct placement/work data needed for approval
- agency does not see private worker-company contracts
- project owner does not automatically see every downstream contract
- invoices/documents are visible to signatories and explicit delegates only

This is the reason WorkGraph needs a graph.

### 5. Integrations Are Later, Exports Are Now

Marketplace integrations can become a moat later. The immediate customer need is
lower-friction import/export:

- invoice PDF
- placement CSV/report export
- timesheet CSV export
- document download
- later: Xero, QuickBooks, Stripe, Peppol/e-invoice

## What Not To Build Now

Do not build these before the placement/pay-bill loop is trustworthy:

- full ATS candidate pipeline
- full CRM sales pipeline
- job board posting
- SMS campaigns
- broad marketplace integrations
- enterprise SSO/governance
- public talent marketplace
- real payroll engine

These are not bad ideas. They are Bullhorn-scale ideas, and building them now
would bury the wedge.

## Recommended WorkGraph Sequence

### Step 1 - C2 Company Membership And Private Worker Contracts

Before inviting real workers broadly, add the missing trust model:

- organization membership roles
- company employee invites
- graph person identity mapping
- private worker-company contract visibility
- signatory-scoped document access
- debug-only persona switcher for testing

### Step 2 - Placement Core

Make graph assignments usable as placement records:

- placement profile panel
- placement ref/client ref
- consultant/manager
- payroll cadence
- PO and expenses PO
- rate label/type with confidentiality masking
- links to timesheets, expenses, invoices, documents

### Step 3 - Pay/Bill Completion

Finish the money loop:

- billable expenses
- invoice PDF export
- employee vs contractor invoice behavior
- pay/remittance status

### Step 4 - Operational Automation

Add reminders and warnings after the workflow is real:

- missing timesheet reminders
- approval waiting reminders
- missing PO warnings
- approved-not-invoiced warnings
- expiring placement warnings

### Step 5 - Reporting/Exports

Add agency-grade reports:

- placement list/report
- configurable columns
- CSV export
- detailed report export
- no hidden rate/contract leakage in exports

## North Star

WorkGraph should not pitch itself as "Bullhorn but smaller."

The stronger pitch:

> WorkGraph is the trust-aware pay-and-bill workspace for multi-party staffing
> chains. It shows each company exactly what they need to approve, bill, and get
> paid, without exposing private rates, contracts, or margins.

