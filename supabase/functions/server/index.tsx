import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { registerEmailRoutes } from "./email.tsx"; // Phase 5 Day 8: Email sending
import { registerApprovalKVRoutes } from "./approvals-kv.tsx"; // Phase 5 Days 9-10: KV-based approval
import { timesheetApprovalsRouter } from "./timesheet-approvals.ts"; // Phase 5B: Graph-based approvals
import { graphVersionsRouter } from "./graph-versions.ts"; // Phase 5B: Graph versions API
import { graphDynamicNodesRouter } from "./graph-dynamic-nodes.ts"; // Dynamic graph nodes
import migrateContractsRouter from "./migrate-contracts.ts"; // Local scope: Contracts migration
import runMigrationRouter from "./run-migration.ts"; // Local scope: Direct SQL migration
import { authRouter } from "./auth.tsx"; // Phase 0.5: Auth routes
import { kvApiRouter } from "./kv-api.tsx"; // Phase 0.5: Generic KV API
import { projectsRouter } from "./projects-api.tsx"; // Phase 1: Projects CRUD
import { contractsRouter } from "./contracts-api.tsx"; // Phase 1: Contracts CRUD
import { timesheetsRouter } from "./timesheets-api.tsx"; // Phase 1: Timesheets CRUD
import { invitationsRouter } from "./invitations-api.tsx"; // Phase 5: Project invitations
import { invoicesRouter } from "./invoices-api.tsx"; // Phase 4: Invoices
import { invoiceTemplatesRouter } from "./invoice-templates-api.tsx"; // Phase 4: Invoice templates
import { invoiceExtractRouter } from "./invoice-extract-api.tsx"; // Phase 4: Invoice extraction

// Force rebuild - 2026-03-12-v1 (Phase 1: Projects, Contracts, Timesheets APIs)

const app = new Hono();

app.use("/*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

app.use("*", logger(console.log));

app.route("/", authRouter); // Phase 0.5: Auth
app.route("/", kvApiRouter); // Phase 0.5: KV API
app.route("/", projectsRouter); // Phase 1: Projects
app.route("/", contractsRouter); // Phase 1: Contracts
app.route("/", timesheetsRouter); // Phase 1: Timesheets
app.route("/make-server-f8b491be/invitations", invitationsRouter); // Phase 5: Project invitations
registerEmailRoutes(app); // Phase 5 Day 8: Email sending
registerApprovalKVRoutes(app); // Phase 5 Days 9-10: KV-based approval
app.route("/make-server-f8b491be/timesheet-approvals", timesheetApprovalsRouter); // Phase 5B: Graph approvals
app.route("/make-server-f8b491be/graph-versions", graphVersionsRouter); // Phase 5B: Graph versions
app.route("/make-server-f8b491be/graph/dynamic-nodes", graphDynamicNodesRouter); // Dynamic nodes
app.route("/make-server-f8b491be/invoices", invoicesRouter); // Phase 4: Invoices
app.route("/make-server-f8b491be/invoice-templates", invoiceTemplatesRouter); // Phase 4: Invoice templates
app.route("/make-server-f8b491be/invoice-extract", invoiceExtractRouter); // Phase 4: Invoice extraction
app.route("/", migrateContractsRouter); // Local scope: Contracts migration
app.route("/", runMigrationRouter); // Local scope: Direct SQL migration

Deno.serve(app.fetch);
