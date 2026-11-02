# Design: per-link rates, pass-through billing, company add/remove, party visibility

Branch `claude/graph-visibility` (PR #20). Written 2026-11-02 (Europe/Zagreb), before the code.

## 1. Data model

New table **`wg_link_rates`** (migration 044). Rates are not stored in `wg_projects.graph` JSON or on `wg_contract_rates`:
- `wg_contract_rates` lets the row creator always read the row. That is wrong for a rate typed in by the other side of the link.
- The other branch's 042 already strips commercial keys from graph edges.

| column | meaning |
|---|---|
| `id` text pk | `lrate_<uuid>` |
| `project_id` text fk wg_projects | |
| `link_kind` text | `supply` (company→company billing link) or `employment` (company→its worker) |
| `seller_party_id` text | graph party node that SELLS the hours. Supply: the subcontractor/agency on the `billsTo` source. Employment: the employer. |
| `buyer_party_id` text null | graph party node that BUYS. Supply only; null for employment. |
| `subject_graph_node_id` text null | Worker person node. Required for employment. Optional per-worker override on supply links; null means it applies to every worker whose hours cross this link. |
| `subject_user_id` uuid null | Worker account, when known (lets the worker read their own pay rate) |
| `rate_type` hourly/daily/fixed, `amount` numeric(14,2) > 0, `currency` | |
| `effective_from/to`, `created_by`, `created_at`, `updated_at` | One active row per (project, kind, seller, buyer, subject): unique partial index on `effective_to IS NULL`. |

The Vis chain is modelled as:
- `supply` Vis Agency → Vis Client: €80
- `supply` Vis Sub → Vis Agency: €60
- `employment` Vis Sub → Will: €45
- Optional `employment` Agency → Ana: the agency's own pay rate.

## 2. Access rules (RLS, server truth)

The helper `wg_user_is_party_commercial(project, party)` is true when the caller is one of:
- an accepted project member scoped to that party with role Owner/Editor or `can_approve` (the company's decision-maker on this project); or
- a verified org member of the org mapped to that party with org_admin / org_finance / org_manager / org_approver.

It does **not** use `can_view_rates`, which the wizard defaulted to true for every worker.

Rules:
- **SELECT** on `wg_link_rates`: the caller is commercial for the seller party, or (supply only) for the buyer party, or (employment only) is the subject worker (`subject_user_id = auth.uid()`, or the caller's accepted member row has `graph_node_id = subject_graph_node_id`).
- **INSERT / UPDATE / DELETE**: commercial for the seller, or (supply only) for the buyer. Employment rates can only be written by the employer. `created_by` must equal `auth.uid()`. There is **no** creator-can-always-read clause.

Expected results for the Vis chain:

| viewer | sees |
|---|---|
| Client (Cara) | 80 |
| Agency (Ola) | 80, 60, its own Ana pay rate; **not** 45 |
| Sub (Sam) | 60, 45 |
| Will | 45 |
| Ana | her own pay rate only (none set); not 80 or 60 |
| Outsider | nothing |

**Margins** are never stored. Each party computes them in the browser from the two rates it can already read: the agency sees 80−60 and the sub sees 60−45. Invoice rows carry only that invoice's sell price, so a buyer reading the invoice learns nothing it didn't already have.

## 3. Pass-through billing (front end, pure function + tests)

For each approved worker-week, walk the billing chain from the worker's employer upward (`billsTo` edges): Sub → Agency → Client. Each hop S→B gets one line on S's invoice to B, priced in this order:
1. `supply` link rate (S, B, subject = worker);
2. else `supply` link rate (S, B, any worker);
3. else (legacy) the worker's old per-person bill rate, but only on the hop that ends at the final client. This keeps today's single-rate projects billing exactly as before.

A hop with no rate is skipped and reported by name; the other invoices are still generated. Invoices are only built for hops whose seller the caller is commercial for, or for any hop when the caller manages the project (current behaviour). Duplicate detection is per seller: a week already invoiced by the Sub does not block the Agency from billing the same hours onward.

## 4. Company add / remove (edge function `PUT /projects/:id`, needs deploy)

- **Who:** only the project owner, or an Editor scoped to the creator party, may add or remove a party. Everyone else keeps today's rules.
- **Add:** a new party node, its `parties[]` entry, and billing edges that touch it. Connections between existing parties stay untouched unless one end is the caller's own party.
- **Remove:** **blocked (409)** when the party has any timesheet weeks (of members scoped to it or linked to its person nodes), invoices (from/to), or accepted members. Approval records always hang off a timesheet week, so the week check covers them. Otherwise it is removed together with its people nodes and edges; pending placeholder members and invitations for that scope are deleted, and its `wg_project_organizations` row is set to `removed`. Soft removal (archiving) is not built; with history present it is a hard block with a message.
- **UI:** the Edit Supply Chain wizard lets structure managers add and remove companies (`canAddParties` was `!editMode`). Existing other companies stay read-only; the caller's own company cannot be removed; new companies are fully editable in that session.
- **Code:** the rules live in the pure module `supabase/functions/server/supply-chain-guard.ts` (unit-tested with vitest); `projects-api.tsx` runs the DB activity check and cleanup.

## 5. Party visibility fixes

- **Graph (migration 045):** the privity projection gives `org_approver` the same one-hop counterparty sight as org_admin/finance/manager, so the Sub sees Agency and the Client sees Agency. Commercial fields are still stripped.
- **Timesheets (front end):** approvers see the weeks the server already returns to them (RLS-scoped). Names resolve from the week's own person/graph ids.
- **Invoices (migration 046):** `wg_invoices` SELECT adds `wg_user_is_party_commercial` on `from_party_id` / `to_party_id`. The Invoices tab shows party approvers a read-only list of the invoices where their party is buyer or seller.
- **Edit Supply Chain people:** after a successful save, each new person node with an email gets a project member placeholder plus an invitation through the deployed `POST /projects/:id/members` route, with scope = the person's party. No SMTP is needed for the row to exist.

## 6. Migration list (files only, none applied)

| # | file | depends on |
|---|---|---|
| 043 | `043_vis_invitation_email_policy_and_party_privity.sql` (earlier) | 018, 020 |
| 044 | `044_link_rates.sql`: table, helper, RLS | 018, 020, 024 |
| 045 | `045_scoped_graph_approver_counterparty.sql`: renames the current `wg_get_scoped_graph` to `wg_get_scoped_graph_pre045` and wraps it; adds org_approver one-hop counterparties | 025, 031 |
| 046 | `046_invoice_party_commercial_read.sql`: invoice SELECT for buyer/seller decision-makers | 044 |
| 047 | `047_invoice_hop_pricing_once_per_seller.sql`: replaces 041's invoice trigger function. It adds per-hop pricing from wg_link_rates (the legacy per-person rate applies only on the final hop), "already billed" per seller, a seller-must-be-on-the-worker's-chain check, and worker names on lines. Party decision-makers may invoice from their own party. It refuses to apply without 041 and 044 | 041, 044 |

Verification: a local PostgreSQL 18 (embedded-postgres) with Supabase auth stubs, all repo migrations plus 044–047 applied, and a seeded Vis-shaped project. SQL assertions run per user (`request.jwt.claim.sub` + `SET ROLE authenticated`). Front-end logic gets vitest tests. Live checks use the 5 vis accounts for everything that needs no new migration or deploy.

Note: branches `grok/p0-*` carry 036–042 (not on the base branch). 045 uses the same rename-and-wrap pattern as 031 and 042 on `wg_get_scoped_graph`, so it stacks with 042 in either order (each wraps whatever is current); the outer wrapper strips last. If 042 is applied after 045, 042's billing-key stripping runs on top of 045's output, which is the safe direction. 047 is written on top of 041 (grok/p0-6) and must be applied after it. Applied after 041, the earlier draft (a copy of 035) silently removed 041's gate. Applied before it, 041 refused every pass-through invoice.
