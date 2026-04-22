# Phase 3.5: The Great SQL Migration (Escape the KV Trap)

**Author:** Antigravity  
**Target:** Codex / Claude Backend Implementation  
**Goal:** Rip out the `TEST_PERSONAS` mock and `kv_store` JSONB blob table. Establish a rigid, relational PostgreSQL schema for WorkGraph.

---

## 1. Identity & Organizations (Replaces `PersonaContext`)

The fundamental unit of permission is no longer a mock `TEST_PERSONA`. It is a real Supabase Auth user (`auth.users`) linked to an `organization`.

### Table: `organizations`
- `id` (uuid, pk, default: uuid_generate_v4())
- `name` (text, not null)
- `type` (text, check: in ('client', 'agency', 'contractor'))
- `created_at` (timestamp with time zone)

### Table: `profiles`
- `id` (uuid, pk, references auth.users(id) on delete cascade)
- `organization_id` (uuid, references organizations(id) on delete set null)
- `full_name` (text, not null)
- `email` (text)
- `avatar_url` (text)
- `created_at` (timestamp, generated)

---

## 2. The Core Project Graph (Replaces `GraphNode` JSONB Arrays)

The `WorkGraph` DAG is serialized cleanly into nodes (parties) and edges (bills-to relationships).

### Table: `projects`
- `id` (uuid, pk, default: uuid_generate_v4())
- `name` (text, not null)
- `owner_org_id` (uuid, references organizations(id)) — *The agency managing the graph*
- `status` (text, check: in ('draft', 'active', 'completed', 'archived'))
- `created_at` (timestamp with time zone)

### Table: `workgraph_nodes`
- `id` (uuid, pk, default: uuid_generate_v4())
- `project_id` (uuid, references projects(id) on delete cascade)
- `organization_id` (uuid, references organizations(id))
- `position_x` (numeric) — *For visual layout cache*
- `position_y` (numeric)
- `created_at` (timestamp)

### Table: `workgraph_edges`
- `id` (uuid, pk, default: uuid_generate_v4())
- `project_id` (uuid, references projects(id) on delete cascade)
- `from_node_id` (uuid, references workgraph_nodes(id)) — *Who is doing the work*
- `to_node_id` (uuid, references workgraph_nodes(id)) — *Who they bill to*
- `rate_amount` (numeric, nullable)
- `rate_currency` (text, default: 'USD')
- `created_at` (timestamp)

---

## 3. Supply Chain Assignments

Instead of hardcoding "David works for NAS", people are assigned to nodes in the graph. This is where ReBAC rules evaluate.

### Table: `project_members`
- `id` (uuid, pk, default: uuid_generate_v4())
- `project_id` (uuid, references projects(id) on delete cascade)
- `node_id` (uuid, references workgraph_nodes(id) on delete cascade)
- `profile_id` (uuid, references profiles(id))
- `role` (text, check: in ('worker', 'manager', 'approver', 'viewer'))
- `created_at` (timestamp)

---

## 4. Timesheets & Billing (Replaces `kv_store:timesheet-*`)

The `TimeEntry[]` refactor from Phase 3.5 becomes literal standard SQL rows.

### Table: `time_entries`
- `id` (uuid, pk, default: uuid_generate_v4())
- `project_id` (uuid, references projects(id))
- `member_id` (uuid, references project_members(id)) — *The worker who logged the time*
- `date` (date, not null)
- `category` (text, check: in ('regular', 'overtime', 'travel'))
- `hours` (numeric, not null)
- `notes` (text)
- `status` (text, check: in ('draft', 'submitted', 'approved', 'rejected', 'invoiced'))
- `approved_by` (uuid, references profiles(id), nullable)
- `approved_at` (timestamp with time zone, nullable)
- `invoice_id` (uuid, placeholder for Phase 4)

---

## 5. RLS Policies (Row Level Security Blueprint)

Since the graph topology defines access, RLS simplifies to checking if a user's `organization_id` exists on any `workgraph_node` for a given `project_id`, or if they are assigned to a `project_member` node. The edge function isn't needed for raw SELECTs if we build a proper Supabase Postgres function `user_can_view_project(user_id, project_id)`.

## Codex Instructions
When you run `dev:all` and verify your Option D bug fixes, review this schema. If it looks correct, your next job is to write the DDL in `supabase/migrations/` and replace our `kv_store` usage.
